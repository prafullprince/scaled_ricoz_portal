import type { NextFunction, Request, Response } from "express";
import type { UploadedFile } from "express-fileupload";
import { Types } from "mongoose";
import {
  ChatMessage,
  Conversation,
  ConversationType,
  User,
} from "../../models/index.js";
import { UserRole } from "../auth/authorization.js";
import { ApiError } from "../../utils/apiError.utils.js";
import {
  chatQueue,
  clearActiveGroupCall,
  getActiveGroupCall,
  publishChatEvent,
  setActiveGroupCall,
} from "./chat.infrastructure.js";
import { uploadChatFile } from "../../utils/cloudinary.utils.js";
import { createLiveKitToken, endLiveKitRoom } from "../../utils/livekit.utils.js";
import { ChatCallRecord } from "../../models/chatActivity.models.js";
import { requestRoles } from "../organization/organization.roles.js";
import { messageEditWindowMs } from "./chat.validation.js";
import { callIceServers } from "../../utils/webrtc.utils.js";

export function getCallIceServers(req: Request, res: Response, next: NextFunction) {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json({ iceServers: callIceServers(String(req.authUser!._id)) });
  } catch (error) {
    next(error);
  }
}

const collectiveCreatorRoles = new Set<UserRole>([
  UserRole.CEO,
  UserRole.MANAGER,
  UserRole.PRODUCT_HEAD,
  UserRole.MARKETING_HEAD,
  UserRole.FINANCE_HEAD,
  UserRole.SALES_HEAD,
  UserRole.PROJECTS_HEAD,
  UserRole.SUPPORT_HEAD,
  UserRole.HR_HEAD,
  UserRole.DESIGN_HEAD,
  UserRole.ENGINEERING_HEAD,
  UserRole.IT_HEAD,
  UserRole.PRODUCT_MANAGER,
  UserRole.MARKETING_MANAGER,
  UserRole.FINANCE_MANAGER,
  UserRole.SALES_MANAGER,
  UserRole.PROJECTS_MANAGER,
  UserRole.SUPPORT_MANAGER,
  UserRole.HR_MANAGER,
  UserRole.DESIGN_MANAGER,
  UserRole.ENGINEERING_MANAGER,
  UserRole.IT_MANAGER,
  UserRole.ADMIN,
]);
const memberPopulate = {
  path: "members.userId",
  select: "name email profile_pic about lastSeen roles",
};
const canCreateCollective = (roles: UserRole[]) =>
  roles.some((role) => collectiveCreatorRoles.has(role));
const uniqueIds = (ids: string[]) => [...new Set(ids)];
const allowedUploadTypes = [
  /^image\/(jpeg|png|gif|webp|heic|heif)$/,
  /^video\/(mp4|webm|quicktime|x-m4v)$/,
  /^audio\/(webm|ogg|mp4|mpeg|wav|x-m4a)$/,
  /^application\/(pdf|msword|vnd\.openxmlformats-officedocument\.(wordprocessingml\.document|spreadsheetml\.sheet|presentationml\.presentation)|vnd\.ms-(excel|powerpoint)|zip|x-zip-compressed)$/,
  /^text\/(plain|csv)$/,
];

async function requireConversation(
  conversationId: string,
  userId: Types.ObjectId,
) {
  if (!Types.ObjectId.isValid(conversationId))
    throw new ApiError(400, "Invalid conversation id");
  const conversation = await Conversation.findOne({
    _id: conversationId,
    "members.userId": userId,
  });
  if (!conversation) throw new ApiError(404, "Conversation not found");
  return conversation;
}

function requireAdmin(
  conversation: Awaited<ReturnType<typeof requireConversation>>,
  userId: Types.ObjectId,
) {
  if (!conversation.admins.some((id) => id.equals(userId)))
    throw new ApiError(403, "Only conversation admins can manage members");
}

export async function listContacts(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const search = String(req.query.search ?? "").trim();
    const filter: Record<string, unknown> = {
      _id: { $ne: req.authUser!._id },
      status: "ACTIVE",
      ...(search
        ? { $or: [{ name: new RegExp(search, "i") }, { email: new RegExp(search, "i") }] }
        : {}),
    };
    const users = await User.find(filter)
      .select("name email profile_pic about lastSeen roles")
      .sort({ name: 1 })
      .limit(50)
      .lean();
    return res.json({ success: true, users });
  } catch (error) {
    next(error);
  }
}

export async function listConversations(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const limit = Math.min(50, Math.max(1, Number(req.query.limit ?? 25)));
    const cursor =
      typeof req.query.cursor === "string" ? req.query.cursor : null;
    const filter: Record<string, unknown> = {
      "members.userId": req.authUser!._id,
    };
    if (cursor) filter.lastMessageAt = { $lt: new Date(cursor) };
    const conversations = await Conversation.find(filter)
      .populate(memberPopulate)
      .sort({ lastMessageAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = conversations.length > limit;
    const page = conversations.slice(0, limit);
    const items = await Promise.all(
      page.map(async (conversation) => {
        const member = conversation.members.find(
          (item) =>
            String((item.userId as any)?._id ?? item.userId) ===
            String(req.authUser!._id),
        );
        const [lastMessage, unreadCount] = await Promise.all([
          ChatMessage.findOne({ conversationId: conversation._id, hiddenFor: { $ne: req.authUser!._id } } as any)
            .populate("senderId", "name profile_pic")
            .sort({ createdAt: -1 })
            .lean(),
          ChatMessage.countDocuments({
            conversationId: conversation._id,
            senderId: { $ne: req.authUser!._id },
            hiddenFor: { $ne: req.authUser!._id },
            createdAt: { $gt: member?.lastReadAt ?? new Date(0) },
          } as any),
        ]);
        return {
          ...conversation,
          lastMessage,
          unreadCount,
          mySettings: member,
        };
      }),
    );
    return res.json({
      success: true,
      conversations: items,
      nextCursor: hasMore ? page.at(-1)?.lastMessageAt.toISOString() : null,
    });
  } catch (error) {
    next(error);
  }
}

export async function getUnreadMessageCount(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversations = await Conversation.find({
      "members.userId": req.authUser!._id,
    })
      .select("members.userId members.lastReadAt")
      .lean();
    const counts = await Promise.all(
      conversations.map((conversation) => {
        const member = conversation.members.find(
          (item) => String(item.userId) === String(req.authUser!._id),
        );
        return ChatMessage.countDocuments({
          conversationId: conversation._id,
          senderId: { $ne: req.authUser!._id },
          hiddenFor: { $ne: req.authUser!._id },
          createdAt: { $gt: member?.lastReadAt ?? new Date(0) },
        } as any);
      }),
    );
    return res.json({
      success: true,
      unreadCount: counts.reduce((total, count) => total + count, 0),
    });
  } catch (error) {
    next(error);
  }
}

export async function listMessages(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await requireConversation(String(req.params.id), req.authUser!._id);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit ?? 40)));
    const before =
      typeof req.query.before === "string" ? req.query.before : null;
    const filter: Record<string, unknown> = { conversationId: req.params.id, hiddenFor: { $ne: req.authUser!._id } };
    if (before) {
      const cursorMessage = await ChatMessage.findById(before)
        .select("createdAt")
        .lean();
      if (cursorMessage)
        filter.$or = [
          { createdAt: { $lt: cursorMessage.createdAt } },
          {
            createdAt: cursorMessage.createdAt,
            _id: { $lt: cursorMessage._id },
          },
        ];
    }
    const messages = await ChatMessage.find(filter)
      .populate("senderId", "name email profile_pic")
      .populate({
        path: "replyTo",
        populate: { path: "senderId", select: "name" },
      })
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();
    const hasMore = messages.length > limit;
    const page = messages.slice(0, limit);
    page.reverse();
    return res.json({
      success: true,
      messages: page,
      nextCursor: hasMore ? String(page[0]?._id) : null,
    });
  } catch (error) {
    next(error);
  }
}

export async function createDirectConversation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const other = await User.findOne({
      _id: req.body.userId,
      status: "ACTIVE",
    } as any)
      .select("_id")
      .lean();
    if (!other || other._id.equals(req.authUser!._id))
      throw new ApiError(400, "Select another active user");
    const directKey = [String(req.authUser!._id), String(other._id)]
      .sort()
      .join(":");
    const conversation = await Conversation.findOneAndUpdate(
      { directKey },
      {
        $setOnInsert: {
          type: ConversationType.DIRECT,
          directKey,
          createdBy: req.authUser!._id,
          admins: [],
          members: [{ userId: req.authUser!._id }, { userId: other._id }],
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true },
    ).populate(memberPopulate);
    return res.status(201).json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
}

export async function createConversation(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!canCreateCollective(requestRoles(req)))
      throw new ApiError(403, "Your role can create one-to-one chats only");
    const memberIds = uniqueIds([
      String(req.authUser!._id),
      ...req.body.memberIds,
    ]);
    const activeCount = await User.countDocuments({
      _id: { $in: memberIds },
      status: "ACTIVE",
    } as any);
    if (activeCount !== memberIds.length)
      throw new ApiError(400, "Every member must be an active user");
    const conversation = await Conversation.create({
      type: req.body.type,
      name: req.body.name,
      description: req.body.description,
      createdBy: req.authUser!._id,
      admins: [req.authUser!._id],
      members: memberIds.map((userId) => ({ userId })),
    });
    await publishChatEvent(
      { type: "conversation.created", conversationId: conversation._id },
      memberIds,
    );
    return res
      .status(201)
      .json({
        success: true,
        conversation: await conversation.populate(memberPopulate),
      });
  } catch (error) {
    next(error);
  }
}

export async function createCommunityGroup(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (!canCreateCollective(requestRoles(req)))
      throw new ApiError(403, "Your role can create one-to-one chats only");
    const community = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireAdmin(community, req.authUser!._id);
    if (community.type !== ConversationType.COMMUNITY)
      throw new ApiError(409, "This conversation is not a community");
    const communityMembers = new Set(
      community.members.map((member) => String(member.userId)),
    );
    const memberIds = uniqueIds([
      String(req.authUser!._id),
      ...req.body.memberIds,
    ]);
    if (memberIds.some((id) => !communityMembers.has(id)))
      throw new ApiError(400, "Group members must belong to the community");
    const group = await Conversation.create({
      type: ConversationType.GROUP,
      communityId: community._id,
      name: req.body.name,
      description: req.body.description,
      createdBy: req.authUser!._id,
      admins: [req.authUser!._id],
      members: memberIds.map((userId) => ({ userId })),
    });
    return res
      .status(201)
      .json({
        success: true,
        conversation: await group.populate(memberPopulate),
      });
  } catch (error) {
    next(error);
  }
}

export async function addMembers(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireAdmin(conversation, req.authUser!._id);
    if (conversation.type === ConversationType.DIRECT)
      throw new ApiError(409, "Direct chats cannot have additional members");
    const ids = uniqueIds(req.body.userIds);
    if (conversation.type === ConversationType.GROUP && conversation.communityId) {
      const community = await Conversation.findById(conversation.communityId)
        .select("members.userId")
        .lean();
      const communityMemberIds = new Set(
        community?.members.map((member) => String(member.userId)) ?? [],
      );
      if (ids.some((id) => !communityMemberIds.has(id)))
        throw new ApiError(400, "Group members must belong to the community");
    }
    const users = await User.find({
      _id: { $in: ids },
      status: "ACTIVE",
    } as any)
      .select("_id")
      .lean();
    if (users.length !== ids.length)
      throw new ApiError(400, "Every member must be an active user");
    const existing = new Set(
      conversation.members.map((member) => String(member.userId)),
    );
    conversation.members.push(
      ...ids
        .filter((id) => !existing.has(id))
        .map((userId) => ({
          userId: new Types.ObjectId(userId),
          joinedAt: new Date(),
          lastReadAt: new Date(),
          archived: false,
          pinned: false,
        })),
    );
    await conversation.save();
    const updatedConversation = await conversation.populate(memberPopulate);
    await publishChatEvent(
      { type: "conversation.updated", conversation: updatedConversation },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({
      success: true,
      conversation: updatedConversation,
    });
  } catch (error) {
    next(error);
  }
}

export async function removeMember(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireAdmin(conversation, req.authUser!._id);
    const userId = String(req.params.userId);
    if (String(conversation.createdBy) === userId)
      throw new ApiError(409, "The creator cannot be removed");
    const recipients = conversation.members.map((member) => String(member.userId));
    conversation.members = conversation.members.filter(
      (member) => String(member.userId) !== userId,
    );
    conversation.admins = conversation.admins.filter(
      (admin) => String(admin) !== userId,
    );
    await conversation.save();
    const updatedConversation = await conversation.populate(memberPopulate);
    await publishChatEvent(
      { type: "conversation.updated", conversation: updatedConversation },
      recipients,
    );
    return res.json({ success: true, conversation: updatedConversation });
  } catch (error) {
    next(error);
  }
}

export async function updateConversationSettings(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const update: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(req.body))
      update[`members.$.${key}`] = value === null ? null : value;
    const conversation = await Conversation.findOneAndUpdate(
      { _id: req.params.id, "members.userId": req.authUser!._id } as any,
      { $set: update },
      { returnDocument: "after" },
    ).populate(memberPopulate);
    if (!conversation) throw new ApiError(404, "Conversation not found");
    return res.json({ success: true, conversation });
  } catch (error) {
    next(error);
  }
}

export async function enqueueMessage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    await requireConversation(String(req.params.id), req.authUser!._id);
    const payload = {
      conversationId: String(req.params.id),
      senderId: String(req.authUser!._id),
      ...req.body,
      companyId: req.company ? String(req.company._id) : null,
    };
    const job = await chatQueue.add("persist", payload, {
      jobId: `${payload.senderId}-${payload.clientId}`.replace(
        /[^a-zA-Z0-9_-]/g,
        "-",
      ),
    });
    return res
      .status(202)
      .json({
        success: true,
        queued: true,
        jobId: job.id,
        clientId: payload.clientId,
      });
  } catch (error) {
    next(error);
  }
}

export async function uploadAttachment(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const fileEntry = req.files?.file;
    if (Array.isArray(fileEntry) && fileEntry.length > 1)
      throw new ApiError(400, "Upload one file per request");
    const file = (Array.isArray(fileEntry) ? fileEntry[0] : fileEntry) as
      | UploadedFile
      | undefined;
    if (!file) throw new ApiError(400, "Select a file to upload");
    if (file.size > 50 * 1024 * 1024)
      throw new ApiError(413, "Files must be 50 MB or smaller");
    if (!allowedUploadTypes.some((pattern) => pattern.test(file.mimetype)))
      throw new ApiError(415, "This file format is not supported");
    const safeName =
      file.name.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 255) ||
      "attachment";
    const uploaded = await uploadChatFile(
      file.data,
      String(req.authUser!._id),
      safeName,
    );
    return res.status(201).json({
      success: true,
      attachment: {
        url: uploaded.secure_url,
        name: safeName,
        mimeType: file.mimetype,
        size: file.size,
        ...(typeof uploaded.duration === "number"
          ? { duration: uploaded.duration }
          : {}),
      },
    });
  } catch (error) {
    next(error);
  }
}

export async function editMessage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const existing = await ChatMessage.findOne({
      _id: req.params.messageId,
      senderId: req.authUser!._id,
      deletedForEveryoneAt: null,
      hiddenFor: { $ne: req.authUser!._id },
    } as any).select("createdAt").lean();
    if (!existing) throw new ApiError(404, "Editable message not found");
    const editableAfter = new Date(Date.now() - messageEditWindowMs);
    if (existing.createdAt < editableAfter) throw new ApiError(403, "Messages can only be edited within 1 hour of sending");
    const message = await ChatMessage.findOneAndUpdate(
      {
        _id: existing._id,
        senderId: req.authUser!._id,
        deletedForEveryoneAt: null,
        createdAt: { $gte: editableAfter },
      } as any,
      { $set: { text: req.body.text, editedAt: new Date() } },
      { returnDocument: "after" },
    )
      .populate("senderId", "name email profile_pic")
      .lean();
    if (!message) throw new ApiError(403, "Messages can only be edited within 1 hour of sending");
    const conversation = await requireConversation(
      String(message.conversationId),
      req.authUser!._id,
    );
    await publishChatEvent(
      { type: "message.updated", message },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({ success: true, message });
  } catch (error) {
    next(error);
  }
}

export async function deleteMessage(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    if (res.locals.query?.scope === "me") {
      const target = await ChatMessage.findById(req.params.messageId).select("conversationId").lean();
      if (!target) throw new ApiError(404, "Message not found");
      await requireConversation(String(target.conversationId), req.authUser!._id);
      await ChatMessage.updateOne({ _id: target._id }, { $addToSet: { hiddenFor: req.authUser!._id } });
      await publishChatEvent(
        { type: "message.hidden", messageId: target._id, conversationId: target.conversationId },
        [String(req.authUser!._id)],
      );
      return res.json({ success: true, scope: "me" });
    }
    const message = await ChatMessage.findOneAndUpdate(
      { _id: req.params.messageId, senderId: req.authUser!._id } as any,
      {
        $set: {
          text: "",
          attachments: [],
          location: null,
          deletedForEveryoneAt: new Date(),
        },
      },
      { returnDocument: "after" },
    ).lean();
    if (!message) throw new ApiError(404, "Message not found");
    const conversation = await requireConversation(
      String(message.conversationId),
      req.authUser!._id,
    );
    await publishChatEvent(
      {
        type: "message.deleted",
        messageId: message._id,
        conversationId: message.conversationId,
      },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function toggleReaction(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const message = await ChatMessage.findById(req.params.messageId);
    if (!message) throw new ApiError(404, "Message not found");
    const conversation = await requireConversation(
      String(message.conversationId),
      req.authUser!._id,
    );
    const reaction = message.reactions.find(
      (item) => item.emoji === req.body.emoji,
    );
    if (reaction) {
      const hasReacted = reaction.userIds.some((id) =>
        id.equals(req.authUser!._id),
      );
      reaction.userIds = hasReacted
        ? reaction.userIds.filter((id) => !id.equals(req.authUser!._id))
        : [...reaction.userIds, req.authUser!._id];
      message.reactions = message.reactions.filter(
        (item) => item.userIds.length,
      );
    } else
      message.reactions.push({
        emoji: req.body.emoji,
        userIds: [req.authUser!._id],
      });
    await message.save();
    await publishChatEvent(
      {
        type: "message.reaction",
        messageId: message._id,
        conversationId: message.conversationId,
        reactions: message.reactions,
      },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({ success: true, reactions: message.reactions });
  } catch (error) {
    next(error);
  }
}

export async function markRead(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    const message = await ChatMessage.findOne({
      _id: req.body.messageId,
      conversationId: conversation._id,
    })
      .select("createdAt")
      .lean();
    if (!message) throw new ApiError(404, "Message not found");
    await Promise.all([
      Conversation.updateOne(
        { _id: conversation._id, "members.userId": req.authUser!._id },
        { $set: { "members.$.lastReadAt": message.createdAt } },
      ),
      ChatMessage.updateMany(
        {
          conversationId: conversation._id,
          createdAt: { $lte: message.createdAt },
        },
        {
          $addToSet: {
            readBy: req.authUser!._id,
            deliveredTo: req.authUser!._id,
          },
        },
      ),
    ]);
    await publishChatEvent(
      {
        type: "conversation.read",
        conversationId: conversation._id,
        userId: req.authUser!._id,
        messageId: message._id,
        readThroughAt: message.createdAt,
      },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

function requireCollective(
  conversation: Awaited<ReturnType<typeof requireConversation>>,
) {
  if (conversation.type === ConversationType.DIRECT)
    throw new ApiError(409, "Group calls are only available in groups and communities");
}

export async function getGroupCallStatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireCollective(conversation);
    const activeCall = await getActiveGroupCall(String(conversation._id));
    return res.json({ success: true, activeCall });
  } catch (error) {
    next(error);
  }
}

export async function startGroupCall(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireCollective(conversation);
    requireAdmin(conversation, req.authUser!._id);
    const existing = await getActiveGroupCall(String(conversation._id));
    if (existing)
      throw new ApiError(409, "A call is already active in this conversation");
    const callType = req.body.type === "audio" ? "audio" : "video";
    const roomName = `conv-${conversation._id}-${Date.now()}`;
    const activeCall = {
      roomName,
      type: callType as "audio" | "video",
      startedBy: String(req.authUser!._id),
      startedByName: req.authUser!.name,
      conversationName: conversation.name ?? "Group call",
      startedAt: Date.now(),
    };
    await setActiveGroupCall(String(conversation._id), activeCall);
    const token = await createLiveKitToken(
      roomName,
      String(req.authUser!._id),
      req.authUser!.name,
    );
    await ChatCallRecord.create({
      callId: roomName,
      conversationId: conversation._id,
      callerId: req.authUser!._id,
      participantIds: conversation.members.map((member) => member.userId),
      kind: "GROUP",
      type: callType,
      state: "ANSWERED",
      answeredAt: new Date(),
    });
    await publishChatEvent(
      {
        type: "call.livekit.started",
        conversationId: conversation._id,
        roomName: activeCall.roomName,
        callType: activeCall.type,
        startedBy: activeCall.startedBy,
        startedByName: activeCall.startedByName,
        conversationName: activeCall.conversationName,
        startedAt: activeCall.startedAt,
      },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.status(201).json({
      success: true,
      token,
      url: process.env.LIVEKIT_URL,
      roomName,
      type: callType,
      isAdmin: true,
    });
  } catch (error) {
    next(error);
  }
}

export async function joinGroupCall(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireCollective(conversation);
    const activeCall = await getActiveGroupCall(String(conversation._id));
    if (!activeCall) throw new ApiError(404, "No call is active in this conversation");
    const token = await createLiveKitToken(
      activeCall.roomName,
      String(req.authUser!._id),
      req.authUser!.name,
    );
    return res.json({
      success: true,
      token,
      url: process.env.LIVEKIT_URL,
      roomName: activeCall.roomName,
      type: activeCall.type,
      isAdmin: conversation.admins.some((id) => id.equals(req.authUser!._id)),
    });
  } catch (error) {
    next(error);
  }
}

export async function endGroupCall(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireCollective(conversation);
    const activeCall = await getActiveGroupCall(String(conversation._id));
    if (!activeCall) return res.json({ success: true });
    const isAdmin = conversation.admins.some((id) => id.equals(req.authUser!._id));
    if (!isAdmin && activeCall.startedBy !== String(req.authUser!._id))
      throw new ApiError(403, "Only an admin can end this call");
    await clearActiveGroupCall(String(conversation._id));
    await endLiveKitRoom(activeCall.roomName);
    await ChatCallRecord.updateOne({ callId: activeCall.roomName, state: "ANSWERED" }, { $set: { state: "ENDED", endedAt: new Date() } });
    await publishChatEvent(
      { type: "call.livekit.ended", conversationId: conversation._id },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({ success: true });
  } catch (error) {
    next(error);
  }
}

export async function promoteAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireCollective(conversation);
    requireAdmin(conversation, req.authUser!._id);
    const targetId = String(req.params.userId);
    if (!conversation.members.some((member) => String(member.userId) === targetId))
      throw new ApiError(400, "That person is not a member of this conversation");
    if (!conversation.admins.some((id) => String(id) === targetId)) {
      conversation.admins.push(new Types.ObjectId(targetId));
      await conversation.save();
    }
    const updatedConversation = await conversation.populate(memberPopulate);
    await publishChatEvent(
      { type: "conversation.updated", conversation: updatedConversation },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({ success: true, conversation: updatedConversation });
  } catch (error) {
    next(error);
  }
}

export async function demoteAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const conversation = await requireConversation(
      String(req.params.id),
      req.authUser!._id,
    );
    requireCollective(conversation);
    requireAdmin(conversation, req.authUser!._id);
    const targetId = String(req.params.userId);
    if (String(conversation.createdBy) === targetId)
      throw new ApiError(409, "The creator cannot be removed as admin");
    if (conversation.admins.length <= 1)
      throw new ApiError(409, "A conversation must keep at least one admin");
    conversation.admins = conversation.admins.filter(
      (id) => String(id) !== targetId,
    );
    await conversation.save();
    const updatedConversation = await conversation.populate(memberPopulate);
    await publishChatEvent(
      { type: "conversation.updated", conversation: updatedConversation },
      conversation.members.map((member) => String(member.userId)),
    );
    return res.json({ success: true, conversation: updatedConversation });
  } catch (error) {
    next(error);
  }
}
