import type { Server } from "node:http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import { ChatMessage, Conversation, User } from "../../models/index.js";
import { ChatCallRecord } from "../../models/chatActivity.models.js";
import type { IUserPayload } from "../../types/http/index.js";
import { UserRole } from "../auth/authorization.js";
import { finishedCallState, sendMessageSchema } from "./chat.validation.js";
import {
  chatQueue,
  createRedisConnection,
  publishChatEvent,
  type QueuedChatMessage,
} from "./chat.infrastructure.js";
import { runWithCompany, type CompanyScope } from "../company/company.context.js";
import { resolveUserCompany } from "../company/company.service.js";

type LiveSocket = WebSocket & { userId: string; alive: boolean; scope: CompanyScope; companyId: string };
type ClientEvent = {
  type: string;
  conversationId?: string;
  callId?: string;
  callType?: "audio" | "video";
  targetUserId?: string;
  sdp?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit;
  reason?: string;
  clientId?: string;
  messageId?: string;
  text?: string;
  messageType?: string;
  attachments?: QueuedChatMessage["attachments"];
  location?: QueuedChatMessage["location"];
  replyTo?: string | null;
};

export function attachChatGateway(server: Server) {
  const gateway = new WebSocketServer({
    noServer: true,
    maxPayload: 64 * 1024,
  });
  const clients = new Map<string, Set<LiveSocket>>();
  const subscriber = createRedisConnection();

  subscriber.subscribe("chat:events");
  subscriber.on("message", (_channel: string, raw: string) => {
    const packet = JSON.parse(raw) as { recipients: string[]; event: object };
    for (const userId of packet.recipients) {
      for (const socket of clients.get(userId) ?? []) {
        if (socket.readyState === WebSocket.OPEN)
          socket.send(JSON.stringify(packet.event));
      }
    }
  });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const url = new URL(request.url ?? "", `http://${request.headers.host}`);
      if (url.pathname !== "/ws/chat") return socket.destroy();
      const token = url.searchParams.get("token");
      if (!token) return socket.destroy();
      const payload = jwt.verify(
        token,
        process.env.JWT_ACCESS_SECRET!,
      ) as IUserPayload;
      const user = await User.findById(payload.id)
        .select("status emailVerifiedAt emailVerified roles companyId")
        .lean();
      if (
        !user ||
        user.status !== "ACTIVE" ||
        !Boolean(user.emailVerifiedAt ?? user.emailVerified)
      )
        return socket.destroy();
      const { scope } = await resolveUserCompany(user, url.searchParams.get("companyId"));
      gateway.handleUpgrade(request, socket, head, (webSocket) => {
        const liveSocket = webSocket as LiveSocket;
        liveSocket.userId = String(user._id);
        liveSocket.alive = true;
        liveSocket.scope = scope;
        liveSocket.companyId = String(scope.companyId);
        gateway.emit("connection", liveSocket);
      });
    } catch {
      socket.destroy();
    }
  });

  gateway.on("connection", (socket: LiveSocket) => {
    const sockets = clients.get(socket.userId) ?? new Set<LiveSocket>();
    sockets.add(socket);
    clients.set(socket.userId, sockets);
    void User.updateOne(
      { _id: socket.userId },
      { $set: { lastSeen: new Date() } },
    ).catch((error) => console.error("Failed to update chat presence", error));
    socket.send(
      JSON.stringify({ type: "connection.ready", userId: socket.userId }),
    );

    socket.on("pong", () => {
      socket.alive = true;
    });
    socket.on("message", (raw) => runWithCompany(socket.scope, async () => {
      try {
        const event = JSON.parse(raw.toString()) as ClientEvent;
        if (!event.conversationId) return;
        const conversation = await Conversation.findOne({
          _id: event.conversationId,
          "members.userId": socket.userId,
        }).lean();
        if (!conversation)
          return socket.send(
            JSON.stringify({
              type: "error",
              message: "Conversation access denied",
            }),
          );
        const recipients = conversation.members.map((member) =>
          String(member.userId),
        );
        if (event.type === "message.send" && event.clientId) {
          const validated = sendMessageSchema.safeParse({
            body: {
              clientId: event.clientId,
              type: event.messageType,
              text: event.text,
              attachments: event.attachments,
              location: event.location,
              replyTo: event.replyTo,
            },
          });
          if (!validated.success)
            return socket.send(
              JSON.stringify({
                type: "error",
                message: "Invalid message or attachment",
              }),
            );
          const message = validated.data.body;
          const payload: QueuedChatMessage = {
            conversationId: event.conversationId,
            senderId: socket.userId,
            clientId: message.clientId,
            type: message.type,
            text: message.text.trim(),
            attachments: message.attachments,
            location: message.location ?? null,
            replyTo: message.replyTo ?? null,
            companyId: socket.companyId,
          };
          await chatQueue.add("persist", payload, {
            jobId: `${socket.userId}-${event.clientId}`.replace(
              /[^a-zA-Z0-9_-]/g,
              "-",
            ),
          });
          socket.send(
            JSON.stringify({
              type: "message.queued",
              clientId: event.clientId,
              conversationId: event.conversationId,
            }),
          );
        } else if (event.type === "message.delivered" && event.messageId) {
          await ChatMessage.updateOne(
            { _id: event.messageId, conversationId: event.conversationId },
            { $addToSet: { deliveredTo: socket.userId } },
          );
          await publishChatEvent(
            {
              type: "message.receipt",
              conversationId: event.conversationId,
              messageId: event.messageId,
              userId: socket.userId,
              receipt: "delivered",
            },
            recipients,
          );
        } else if (["typing.start", "typing.stop"].includes(event.type)) {
          await publishChatEvent(
            { ...event, userId: socket.userId },
            recipients.filter((id) => id !== socket.userId),
          );
        } else if (
          [
            "call.offer",
            "call.answer",
            "call.ice",
            "call.end",
            "call.resume",
            "call.resume.offer",
            "call.resume.answer",
          ].includes(event.type)
        ) {
          if (
            conversation.type !== "DIRECT" ||
            recipients.length !== 2 ||
            !event.targetUserId ||
            !event.callId ||
            !/^[a-zA-Z0-9_-]{1,100}$/.test(event.callId) ||
            !recipients.includes(event.targetUserId) ||
            event.targetUserId === socket.userId
          )
            return socket.send(
              JSON.stringify({
                type: "call.error",
                callId: event.callId,
                message: "Calls are available only in one-to-one chats",
              }),
            );

          let callerName: string | undefined;
          if (event.type === "call.offer") {
            const caller = await User.findById(socket.userId)
              .select("roles name")
              .lean();
            callerName = caller?.name;
            if (
              caller?.roles.some((role) =>
                [UserRole.INTERN, UserRole.EMPLOYEE].includes(role),
              )
            )
              return socket.send(
                JSON.stringify({
                  type: "call.error",
                  callId: event.callId,
                  message:
                    "Your role can receive calls but cannot start them",
                }),
              );
            if (
              !event.callType ||
              !event.sdp ||
              JSON.stringify(event.sdp).length > 32_000
            )
              return socket.send(
                JSON.stringify({
                  type: "call.error",
                  callId: event.callId,
                  message: "Invalid call offer",
                }),
              );
          }
          if (
            event.type === "call.ice" &&
            (!event.candidate ||
              JSON.stringify(event.candidate).length > 8_000)
          )
            return;
          if (
            [
              "call.answer",
              "call.resume.offer",
              "call.resume.answer",
            ].includes(event.type) &&
            (!event.sdp || JSON.stringify(event.sdp).length > 32_000)
          )
            return;

          if (event.type === "call.offer") {
            await ChatCallRecord.updateOne({ callId: event.callId, conversationId: conversation._id, callerId: socket.userId, calleeId: event.targetUserId }, {
              $setOnInsert: { participantIds: recipients, type: event.callType, state: "RINGING" },
            }, { upsert: true });
          } else {
            const record = await ChatCallRecord.findOne({ callId: event.callId, conversationId: conversation._id, participantIds: { $all: [socket.userId, event.targetUserId] } });
            if (!record || !["RINGING", "ANSWERED"].includes(record.state)) return;
            if (event.type === "call.answer") {
              if (String(record.calleeId) !== socket.userId) return;
              await ChatCallRecord.updateOne({ _id: record._id, state: "RINGING" }, { $set: { state: "ANSWERED", answeredAt: new Date() } });
            }
            if (event.type === "call.end") {
              await ChatCallRecord.updateOne({ _id: record._id, state: { $in: ["RINGING", "ANSWERED"] } }, {
                $set: { state: finishedCallState(Boolean(record.answeredAt), String(record.callerId) === socket.userId, event.reason), endedAt: new Date() },
              });
            }
          }
          if (["call.offer", "call.answer", "call.end"].includes(event.type)) {
            await publishChatEvent({ type: "call.history.changed" }, recipients);
          }
          await publishChatEvent(
            {
              ...event,
              userId: socket.userId,
              ...(event.type === "call.offer"
                ? { callerName: callerName ?? "Ricoz contact" }
                : {}),
            },
            [event.targetUserId],
          );
        }
      } catch {
        socket.send(
          JSON.stringify({ type: "error", message: "Invalid realtime event" }),
        );
      }
    }));
    socket.on("close", async () => {
      sockets.delete(socket);
      if (!sockets.size) clients.delete(socket.userId);
      await User.updateOne(
        { _id: socket.userId },
        { $set: { lastSeen: new Date() } },
      );
    });
  });

  const heartbeat = setInterval(() => {
    for (const socket of gateway.clients as Set<LiveSocket>) {
      if (!socket.alive) socket.terminate();
      else {
        socket.alive = false;
        socket.ping();
      }
    }
  }, 30000);
  gateway.on("close", () => clearInterval(heartbeat));
  return gateway;
}
