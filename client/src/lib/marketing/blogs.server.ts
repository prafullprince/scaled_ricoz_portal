import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { PublicMarketingBlog } from "@/types/marketing";

export type PublicBlogsResult =
  | { ok: true; blogs: PublicMarketingBlog[] }
  | { ok: false; message: string };

function isPublicBlog(value: unknown): value is PublicMarketingBlog {
  if (typeof value !== "object" || value === null) return false;
  const blog = value as Record<string, unknown>;
  return (
    typeof blog.id === "string" &&
    typeof blog.title === "string" &&
    typeof blog.description === "string" &&
    typeof blog.thumbnail === "string" &&
    typeof blog.details === "string" &&
    (blog.publishedAt === null ||
      (typeof blog.publishedAt === "string" &&
        Number.isFinite(Date.parse(blog.publishedAt)))) &&
    typeof blog.createdAt === "string" &&
    Number.isFinite(Date.parse(blog.createdAt)) &&
    typeof blog.updatedAt === "string" &&
    Number.isFinite(Date.parse(blog.updatedAt))
  );
}

export async function getPublicMarketingBlogs(): Promise<PublicBlogsResult> {
  const base = process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL;
  if (!base) {
    console.error("The marketing blog API is not configured.");
    return { ok: false, message: "News is temporarily unavailable." };
  }

  let response: Response;
  try {
    response = await fetch(
      `${base.replace(/\/$/, "")}/marketing/blogs/published`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(10000),
        headers: { Accept: "application/json" },
      },
    );
  } catch (error) {
    unstable_rethrow(error);
    console.error("Public marketing blog request failed", error);
    return { ok: false, message: "News is temporarily unavailable." };
  }
  if (!response.ok) {
    console.error(`Public marketing blog request returned HTTP ${response.status}`);
    return { ok: false, message: "News is temporarily unavailable." };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (error) {
    console.error("Invalid public marketing blog response", error);
    return { ok: false, message: "News is temporarily unavailable." };
  }
  if (
    typeof data !== "object" ||
    data === null ||
    !("success" in data) ||
    data.success !== true ||
    !("blogs" in data) ||
    !Array.isArray(data.blogs) ||
    !data.blogs.every(isPublicBlog)
  ) {
    console.error("Public marketing blog response did not match the expected shape");
    return { ok: false, message: "News is temporarily unavailable." };
  }
  return { ok: true, blogs: data.blogs };
}
