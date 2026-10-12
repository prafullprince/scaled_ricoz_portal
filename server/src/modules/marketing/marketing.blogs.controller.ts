import type { NextFunction, Request, Response } from "express";
import { Types } from "mongoose";
import { MarketingBlog } from "../../models/index.js";
import { ApiError } from "../../utils/apiError.utils.js";
import { uploadMarketingBlogThumbnail } from "../../utils/cloudinary.utils.js";
import { MarketingAccessScope } from "./marketing.authorization.js";
import { managedUserIds } from "../organization/organization.controller.js";
import { runWithCompany } from "../company/company.context.js";

type MarketingBlogAccess = {
  scope: MarketingAccessScope;
};

function getThumbnailFile(req: Request, required: boolean) {
  const uploaded = req.files?.thumbnail;
  const file = Array.isArray(uploaded) ? uploaded[0] : uploaded;
  if (!file) {
    if (required) throw new ApiError(400, "A thumbnail image is required");
    return null;
  }
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.mimetype))
    throw new ApiError(400, "Thumbnail must be a JPEG, PNG, WebP, or GIF image");
  if (file.size > 5 * 1024 * 1024)
    throw new ApiError(400, "Thumbnail must be 5 MB or smaller");
  return file;
}

async function authorFilter(access: MarketingBlogAccess, actorId: Types.ObjectId) {
  if (access.scope === MarketingAccessScope.DEPARTMENT) return {};
  const authorIds =
    access.scope === MarketingAccessScope.TEAM
      ? (await managedUserIds(actorId, false)) ?? [actorId]
      : [actorId];
  return { authorId: { $in: authorIds } };
}

export async function getPublishedMarketingBlogs(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const blogs = await runWithCompany(null, async () => {
      return await MarketingBlog.find({ published: true })
        .select("title description thumbnail details publishedAt createdAt updatedAt")
        .sort({ publishedAt: -1, createdAt: -1 })
        .lean();
    });
    return res.json({
      success: true,
      blogs: blogs.map((blog) => ({
        id: String(blog._id),
        title: blog.title,
        description: blog.description,
        thumbnail: blog.thumbnail,
        details: blog.details,
        publishedAt: blog.publishedAt?.toISOString() ?? null,
        createdAt: blog.createdAt.toISOString(),
        updatedAt: blog.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getMarketingBlogs(
  _req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const access = res.locals.marketingAccess as MarketingBlogAccess;
    const actorId = _req.authUser!._id;
    const blogs = await MarketingBlog.find(await authorFilter(access, actorId))
      .sort({ updatedAt: -1 })
      .limit(100)
      .lean();
    return res.json({ success: true, blogs });
  } catch (error) {
    next(error);
  }
}

export async function createMarketingBlog(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const thumbnail = getThumbnailFile(req, true)!;
    const uploaded = await uploadMarketingBlogThumbnail(
      thumbnail.data,
      String(req.authUser!._id),
      thumbnail.name,
    );
    const blog = await MarketingBlog.create({
      ...req.body,
      thumbnail: uploaded.secure_url,
      authorId: req.authUser!._id,
      publishedAt: req.body.published ? new Date() : null,
    });
    return res.status(201).json({ success: true, blog });
  } catch (error) {
    next(error);
  }
}

export async function updateMarketingBlog(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const blogId = String(req.params.blogId);
    if (!Types.ObjectId.isValid(blogId))
      throw new ApiError(400, "Invalid blog id");
    const access = res.locals.marketingAccess as MarketingBlogAccess;
    const blog = await MarketingBlog.findOne({
      _id: blogId,
      ...(await authorFilter(access, req.authUser!._id)),
    });
    if (!blog) throw new ApiError(404, "Marketing blog not found");
    const wasPublished = blog.published;
    blog.set(req.body);
    const thumbnail = getThumbnailFile(req, false);
    if (thumbnail) {
      const uploaded = await uploadMarketingBlogThumbnail(
        thumbnail.data,
        String(req.authUser!._id),
        thumbnail.name,
      );
      blog.thumbnail = uploaded.secure_url;
    }
    if (req.body.published === true && !wasPublished)
      blog.publishedAt = new Date();
    if (req.body.published === false) blog.publishedAt = null;
    await blog.save();
    return res.json({ success: true, blog });
  } catch (error) {
    next(error);
  }
}
