import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { ChatCallRecord, ChatStory, ChatStoryView } from "../../models/chatActivity.models.js";
import { User } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { uploadChatFile } from "../../utils/cloudinary.utils.js";
import { activityPageSchema, storyInputSchema } from "./chat.validation.js";
import { UserStatus } from "../auth/authorization.js";

const dayMs = 24 * 60 * 60 * 1000;

function storyId(req: Request) {
  const id = String(req.params.id);
  if (!Types.ObjectId.isValid(id)) throw new ApiError(400, "Invalid status id");
  return id;
}

export async function createStory(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = storyInputSchema.safeParse(req.body ?? {});
    if (!parsed.success) throw new ApiError(400, "Status text must be 700 characters or less with a supported background");
    const file = req.files?.file;
    if (req.body?.file && !file) throw new ApiError(400, "Upload status media as multipart form data");
    if (Array.isArray(file)) throw new ApiError(400, "Upload one photo or video per status");
    if (!file && !parsed.data.text) throw new ApiError(400, "Add text, a photo, or a video");
    if (file && (!/^image\/(jpeg|png|webp|gif)$|^video\/(mp4|webm|quicktime)$/.test(file.mimetype))) {
      throw new ApiError(415, "Choose a JPEG, PNG, WebP, GIF, MP4, WebM or MOV file");
    }
    if (file && file.size > 20 * 1024 * 1024) throw new ApiError(413, "Status media must be 20 MB or smaller");
    const recent = await ChatStory.countDocuments({ authorId: req.authUser!._id, expiresAt: { $gt: new Date() } });
    if (recent >= 30) throw new ApiError(429, "You can have up to 30 active statuses");
    const uploaded = file ? await uploadChatFile(file.data, String(req.authUser!._id), file.name.slice(0, 255)) : null;
    const story = await ChatStory.create({
      authorId: req.authUser!._id,
      ...parsed.data,
      ...(uploaded && file ? { media: { url: uploaded.secure_url, name: file.name.slice(0, 255), mimeType: file.mimetype } } : {}),
      expiresAt: new Date(Date.now() + dayMs),
    });
    return res.status(201).json({ success: true, story });
  } catch (error) { next(error); }
}

export async function listStories(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = activityPageSchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, "Invalid status page");
    const { cursor, limit } = parsed.data;
    const stories = await ChatStory.find({ expiresAt: { $gt: new Date() }, ...(cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {}) })
      .populate({ path: "authorId", select: "name profile_pic", match: { status: "ACTIVE" } })
      .sort({ _id: -1 }).limit(limit + 1).lean();
    const page = stories.slice(0, limit);
    const ownIds = page.filter((story) => String(story.authorId?._id) === String(req.authUser!._id)).map((story) => story._id);
    const [viewed, counts] = await Promise.all([
      ChatStoryView.find({ storyId: { $in: page.map((story) => story._id) }, userId: req.authUser!._id }).select("storyId").lean(),
      ChatStoryView.aggregate<{ _id: Types.ObjectId; count: number }>([
        { $match: { storyId: { $in: ownIds } } }, { $group: { _id: "$storyId", count: { $sum: 1 } } },
      ]),
    ]);
    const viewedIds = new Set(viewed.map((view) => String(view.storyId)));
    return res.json({ success: true, stories: page.filter((story) => story.authorId).map((story) => ({
      ...story,
      viewed: viewedIds.has(String(story._id)),
      ...(String(story.authorId._id) === String(req.authUser!._id) ? { viewCount: counts.find((count) => String(count._id) === String(story._id))?.count ?? 0 } : {}),
    })), nextCursor: stories.length > limit ? String(page.at(-1)!._id) : null });
  } catch (error) { next(error); }
}

export async function viewStory(req: Request, res: Response, next: NextFunction) {
  try {
    const story = await ChatStory.findOne({ _id: storyId(req), expiresAt: { $gt: new Date() } });
    if (!story || !await User.exists({ _id: story.authorId, status: UserStatus.ACTIVE })) throw new ApiError(404, "Status has expired or is unavailable");
    if (String(story.authorId) !== String(req.authUser!._id)) {
      await ChatStoryView.updateOne({ storyId: story._id, userId: req.authUser!._id }, {
        $setOnInsert: { viewedAt: new Date(), expiresAt: story.expiresAt },
      }, { upsert: true }).catch((error: { code?: number }) => { if (error.code !== 11000) throw error; });
    }
    return res.json({ success: true });
  } catch (error) { next(error); }
}

export async function storyViewers(req: Request, res: Response, next: NextFunction) {
  try {
    const story = await ChatStory.findOne({ _id: storyId(req), authorId: req.authUser!._id, expiresAt: { $gt: new Date() } });
    if (!story) throw new ApiError(404, "Status not found");
    const parsed = activityPageSchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, "Invalid viewers page");
    const { cursor, limit } = parsed.data;
    const [views, total] = await Promise.all([
      ChatStoryView.find({ storyId: story._id, ...(cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {}) })
        .populate("userId", "name profile_pic").sort({ _id: -1 }).limit(limit + 1).lean(),
      ChatStoryView.countDocuments({ storyId: story._id }),
    ]);
    const page = views.slice(0, limit);
    return res.json({ success: true, views: page, total, nextCursor: views.length > limit ? String(page.at(-1)!._id) : null });
  } catch (error) { next(error); }
}

export async function deleteStory(req: Request, res: Response, next: NextFunction) {
  try {
    const story = await ChatStory.findOneAndDelete({ _id: storyId(req), authorId: req.authUser!._id });
    if (!story) throw new ApiError(404, "Status not found");
    await ChatStoryView.deleteMany({ storyId: story._id });
    return res.json({ success: true });
  } catch (error) { next(error); }
}

export async function listCallHistory(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = activityPageSchema.safeParse(req.query);
    if (!parsed.success) throw new ApiError(400, "Invalid calls page");
    const { cursor, limit } = parsed.data;
    const scope = { participantIds: req.authUser!._id };
    await ChatCallRecord.updateMany({ ...scope, state: "RINGING", createdAt: { $lt: new Date(Date.now() - 65_000) } }, [
      { $set: { state: "MISSED", endedAt: { $add: ["$createdAt", 60_000] } } },
    ], { updatePipeline: true });
    await ChatCallRecord.updateMany({ ...scope, state: "ANSWERED", createdAt: { $lt: new Date(Date.now() - 12 * 60 * 60 * 1000) } }, { $set: { state: "ENDED", endedAt: new Date() } });
    const calls = await ChatCallRecord.find({ ...scope, ...(cursor ? { _id: { $lt: new Types.ObjectId(cursor) } } : {}) })
      .populate("callerId calleeId", "name profile_pic")
      .populate("conversationId", "name type admins members.userId")
      .sort({ _id: -1 }).limit(limit + 1).lean();
    const page = calls.slice(0, limit);
    return res.json({ success: true, calls: page, nextCursor: calls.length > limit ? String(page.at(-1)!._id) : null });
  } catch (error) { next(error); }
}