import { Router } from "express";
import { createStory, deleteStory, listCallHistory, listStories, storyViewers, viewStory } from "./chat.activity.controller.js";
import { auth } from "../../middleware/auth.middleware.js";
import { errorHandler } from "../../middleware/error_handler.middleware.js";
import { validateRequest } from "../../middleware/validate_request.middleware.js";
import {
  addMembers,
  createCommunityGroup,
  createConversation,
  createDirectConversation,
  deleteMessage,
  demoteAdmin,
  editMessage,
  endGroupCall,
  enqueueMessage,
  getCallIceServers,
  getGroupCallStatus,
  getUnreadMessageCount,
  joinGroupCall,
  listContacts,
  listConversations,
  listMessages,
  markRead,
  promoteAdmin,
  removeMember,
  startGroupCall,
  toggleReaction,
  updateConversationSettings,
  uploadAttachment,
} from "./chat.controller.js";
import {
  conversationMemberSchema,
  conversationSettingsSchema,
  createCommunityGroupSchema,
  createConversationSchema,
  createDirectChatSchema,
  deleteMessageSchema,
  editMessageSchema,
  reactionSchema,
  readMessageSchema,
  sendMessageSchema,
  startGroupCallSchema,
} from "./chat.validation.js";

const router = Router();
router.use(auth);
router.get("/statuses", listStories, errorHandler);
router.post("/statuses", createStory, errorHandler);
router.post("/statuses/:id/views", viewStory, errorHandler);
router.get("/statuses/:id/views", storyViewers, errorHandler);
router.delete("/statuses/:id", deleteStory, errorHandler);
router.get("/calls", listCallHistory, errorHandler);
router.get("/calls/ice-servers", getCallIceServers, errorHandler);
router.get("/contacts", listContacts, errorHandler);
router.get("/unread-count", getUnreadMessageCount, errorHandler);
router.post("/attachments", uploadAttachment, errorHandler);
router.get("/conversations", listConversations, errorHandler);
router.post(
  "/conversations/direct",
  validateRequest(createDirectChatSchema),
  createDirectConversation,
  errorHandler,
);
router.post(
  "/conversations",
  validateRequest(createConversationSchema),
  createConversation,
  errorHandler,
);
router.get("/conversations/:id/messages", listMessages, errorHandler);
router.post(
  "/conversations/:id/messages",
  validateRequest(sendMessageSchema),
  enqueueMessage,
  errorHandler,
);
router.post(
  "/conversations/:id/read",
  validateRequest(readMessageSchema),
  markRead,
  errorHandler,
);
router.patch(
  "/conversations/:id/settings",
  validateRequest(conversationSettingsSchema),
  updateConversationSettings,
  errorHandler,
);
router.post(
  "/conversations/:id/members",
  validateRequest(conversationMemberSchema),
  addMembers,
  errorHandler,
);
router.delete("/conversations/:id/members/:userId", removeMember, errorHandler);
router.post("/conversations/:id/admins/:userId", promoteAdmin, errorHandler);
router.delete("/conversations/:id/admins/:userId", demoteAdmin, errorHandler);
router.get("/conversations/:id/call", getGroupCallStatus, errorHandler);
router.post(
  "/conversations/:id/call",
  validateRequest(startGroupCallSchema),
  startGroupCall,
  errorHandler,
);
router.post("/conversations/:id/call/join", joinGroupCall, errorHandler);
router.delete("/conversations/:id/call", endGroupCall, errorHandler);
router.post(
  "/communities/:id/groups",
  validateRequest(createCommunityGroupSchema),
  createCommunityGroup,
  errorHandler,
);
router.patch(
  "/messages/:messageId",
  validateRequest(editMessageSchema),
  editMessage,
  errorHandler,
);
router.delete("/messages/:messageId", validateRequest(deleteMessageSchema), deleteMessage, errorHandler);
router.post(
  "/messages/:messageId/reactions",
  validateRequest(reactionSchema),
  toggleReaction,
  errorHandler,
);
export default router;
