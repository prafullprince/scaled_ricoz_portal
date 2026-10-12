"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppSelector } from "@/redux/hooks";
import { toast } from "sonner";
import type { TaskNotification } from "@/services/notification.service";
import { NotificationService } from "@/services/notification.service";
import { ChatService, chatWebSocketUrl, type ChatMessage } from "@/services/chat.service";
import {
  enableChatNotificationSound,
  isChatActive,
  isChatMuted,
  playIncomingMessageSound,
} from "@/lib/chat/notificationSound";

const senderId = (message: ChatMessage) =>
  typeof message.senderId === "string"
    ? message.senderId
    : message.senderId?._id;

export function ChatNotificationListener({
  onUnreadCountChange,
}: {
  onUnreadCountChange: (count: number | ((current: number) => number)) => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const token = useAppSelector((state) => state.auth.access_token);
  const userId = useAppSelector((state) => state.auth.user?.user_id);

  useEffect(() => enableChatNotificationSound(), []);

  useEffect(() => {
    if (!token || !userId) return;
    const refresh = () => {
      void ChatService.unreadCount().then(onUnreadCountChange);
    };
    const handleCount = (event: Event) => {
      const count = (event as CustomEvent<number>).detail;
      if (Number.isFinite(count)) onUnreadCountChange(Math.max(0, count));
    };
    refresh();
    window.addEventListener("ricoz-chat-unread-count", handleCount);
    return () => window.removeEventListener("ricoz-chat-unread-count", handleCount);
  }, [onUnreadCountChange, token, userId]);

  useEffect(() => {
    if (!token || !userId) return;

    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let retry = 0;
    let closed = false;

    const connect = () => {
      socket = new WebSocket(chatWebSocketUrl(token));
      socket.onopen = () => {
        retry = 0;
      };
      socket.onmessage = (event) => {
        const packet = JSON.parse(event.data) as {
          type: string;
          message?: ChatMessage;
          notification?: TaskNotification;
        };
        if (packet.type === "task.notification" && packet.notification) {
          const notification = packet.notification;
          window.dispatchEvent(new Event("ricoz-notifications-changed"));
          playIncomingMessageSound(`task:${notification._id}`);
          toast(notification.title, { description: notification.message, action: { label: "View", onClick: () => {
            void NotificationService.read(notification._id).catch(() => toast.error("Could not mark the notification as read."));
            router.push(`/dashboard/tasks/${encodeURIComponent(notification.taskId)}`);
          } } });
          return;
        }
        if (pathname === "/dashboard/messages") return;
        if (packet.type === "conversation.read") {
          void ChatService.unreadCount().then(onUnreadCountChange);
          return;
        }
        if (
          packet.type !== "message.created" ||
          !packet.message ||
          senderId(packet.message) === userId ||
          isChatActive(packet.message.conversationId)
        )
          return;

        onUnreadCountChange((current) => current + 1);
        if (!isChatMuted(packet.message.conversationId))
          playIncomingMessageSound(packet.message._id);
        socket?.send(
          JSON.stringify({
            type: "message.delivered",
            conversationId: packet.message.conversationId,
            messageId: packet.message._id,
          }),
        );
      };
      socket.onclose = () => {
        if (!closed)
          reconnectTimer = setTimeout(
            connect,
            Math.min(30000, 1000 * 2 ** retry++),
          );
      };
    };

    connect();
    return () => {
      closed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [onUnreadCountChange, pathname, router, token, userId]);

  return null;
}