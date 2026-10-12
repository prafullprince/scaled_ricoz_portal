"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MarketingService } from "@/services/marketing.service";
import type { MarketingBlog, SaveMarketingBlogInput } from "@/types/marketing";

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "The marketing blog could not be saved. Please try again.";
}

export function MarketingBlogs() {
  const [blogs, setBlogs] = useState<MarketingBlog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<MarketingBlog | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const previewUrl = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    MarketingService.blogs()
      .then((items) => {
        if (active) setBlogs(items);
      })
      .catch((loadError: unknown) => {
        if (active) setError(errorMessage(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    },
    [],
  );

  function resetThumbnail(fallback: string | null = null) {
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = null;
    setThumbnailFile(null);
    setThumbnailPreview(fallback);
  }

  async function saveBlog(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSaving(true);
    const form = event.currentTarget;
    const submitter = (event.nativeEvent as SubmitEvent)
      .submitter as HTMLButtonElement | null;
    const action = submitter?.value ?? "save";
    const values = new FormData(form);
    const input: SaveMarketingBlogInput = {
      title: String(values.get("title") ?? ""),
      description: String(values.get("description") ?? ""),
      details: String(values.get("details") ?? ""),
      published:
        action === "publish"
          ? true
          : action === "draft"
            ? false
            : editing?.published ?? false,
    };
    if (!thumbnailFile && !editing) {
      setError("Choose a thumbnail image before saving this story.");
      setSaving(false);
      return;
    }
    try {
      const saved = editing
        ? await MarketingService.updateBlog(
            editing._id,
            input,
            thumbnailFile ?? undefined,
          )
        : await MarketingService.createBlog(input, thumbnailFile!);
      setBlogs((current) => [
        saved,
        ...current.filter((blog) => blog._id !== saved._id),
      ]);
      setFormOpen(false);
      setEditing(null);
      resetThumbnail();
    } catch (saveError) {
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function startNew() {
    setEditing(null);
    resetThumbnail();
    setFormOpen(true);
    setError("");
  }

  function startEdit(blog: MarketingBlog) {
    setEditing(blog);
    resetThumbnail(blog.thumbnail);
    setFormOpen(true);
    setError("");
  }

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-extrabold">Ricoz stories</h2>
          <p className="mt-1 text-xs text-[#657795]">
            Create blog posts and publish them to the public landing page.
          </p>
        </div>
        {!formOpen ? (
          <button
            type="button"
            onClick={startNew}
            className="inline-flex h-9 items-center rounded-md bg-[#1645a2] px-3 text-xs font-bold text-white transition-colors hover:bg-[#123b8b]"
          >
            New story
          </button>
        ) : null}
      </div>

      {error ? (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700"
        >
          {error}
        </p>
      ) : null}

      {formOpen ? (
        <form
          key={editing?._id ?? "new"}
          onSubmit={saveBlog}
          className="grid gap-4 rounded-xl border border-[#dce4ef] bg-white p-4 sm:p-5"
        >
          <h3 className="text-sm font-extrabold">
            {editing ? "Edit story" : "Create a story"}
          </h3>
          <label className="grid gap-1.5 text-xs font-bold">
            Title
            <input
              required
              name="title"
              minLength={2}
              maxLength={160}
              defaultValue={editing?.title ?? ""}
              className="h-10 rounded-md border border-[#dce4ef] px-3 text-sm font-normal outline-none focus:border-[#1645a2]"
            />
          </label>
          <label className="grid gap-1.5 text-xs font-bold">
            Description
            <textarea
              required
              name="description"
              minLength={2}
              maxLength={500}
              rows={3}
              defaultValue={editing?.description ?? ""}
              className="rounded-md border border-[#dce4ef] px-3 py-2 text-sm font-normal outline-none focus:border-[#1645a2]"
            />
          </label>
          <div className="grid gap-2">
            <label className="grid gap-1.5 text-xs font-bold">
              Thumbnail image
              <input
                required={!editing}
                name="thumbnail"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(event) => {
                  const file = event.target.files?.[0] ?? null;
                  if (
                    file &&
                    !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
                      file.type,
                    )
                  ) {
                    setError("Choose a JPEG, PNG, WebP, or GIF image.");
                    event.target.value = "";
                    return;
                  }
                  if (file && file.size > 5 * 1024 * 1024) {
                    setError("Thumbnail images must be 5 MB or smaller.");
                    event.target.value = "";
                    return;
                  }
                  setError("");
                  if (previewUrl.current)
                    URL.revokeObjectURL(previewUrl.current);
                  previewUrl.current = file ? URL.createObjectURL(file) : null;
                  setThumbnailPreview(
                    previewUrl.current ?? editing?.thumbnail ?? null,
                  );
                  setThumbnailFile(file);
                }}
                className="max-w-full text-sm font-normal file:mr-3 file:rounded-md file:border-0 file:bg-[#eef4ff] file:px-3 file:py-2 file:text-xs file:font-bold file:text-[#1645a2]"
              />
            </label>
            <p className="text-[10px] font-normal text-[#657795]">
              JPEG, PNG, WebP, or GIF · up to 5 MB
              {editing ? " · Leave empty to keep the current image" : ""}
            </p>
            {thumbnailPreview ? (
              <div className="relative aspect-[16/7] max-w-sm overflow-hidden rounded-lg bg-[#f1f5f9]">
                <Image
                  src={thumbnailPreview}
                  alt="Thumbnail preview"
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : null}
          </div>
          <label className="grid gap-1.5 text-xs font-bold">
            Details <span className="font-normal text-[#657795]">Optional</span>
            <textarea
              name="details"
              maxLength={10000}
              rows={5}
              defaultValue={editing?.details ?? ""}
              className="rounded-md border border-[#dce4ef] px-3 py-2 text-sm font-normal outline-none focus:border-[#1645a2]"
            />
          </label>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
                resetThumbnail();
                setError("");
              }}
              className="h-9 rounded-md border border-[#dce4ef] px-3 text-xs font-bold text-[#475569] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              value="draft"
              disabled={saving}
              className="h-9 rounded-md border border-[#dce4ef] px-3 text-xs font-bold text-[#34445f] disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save draft"}
            </button>
            <button
              type="submit"
              value="publish"
              disabled={saving}
              className="h-9 rounded-md bg-[#1645a2] px-3 text-xs font-bold text-white disabled:opacity-50"
            >
              {saving
                ? "Saving..."
                : editing?.published
                  ? "Save & publish"
                  : "Publish"}
            </button>
          </div>
        </form>
      ) : null}

      {loading ? (
        <p className="rounded-xl border border-[#e6ebf2] p-5 text-xs text-[#657795]">
          Loading stories...
        </p>
      ) : blogs.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {blogs.map((blog) => (
            <article
              key={blog._id}
              className="flex gap-4 rounded-xl border border-[#e6ebf2] bg-white p-3"
            >
              <div className="relative h-24 w-32 shrink-0 overflow-hidden rounded-lg bg-[#f1f5f9]">
                <Image
                  src={blog.thumbnail}
                  alt=""
                  fill
                  unoptimized
                  sizes="128px"
                  className="object-cover"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="truncate text-xs font-extrabold">
                    {blog.title}
                  </h3>
                  <span
                    className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold ${
                      blog.published
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {blog.published ? "Published" : "Draft"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[#657795]">
                  {blog.description}
                </p>
                <button
                  type="button"
                  onClick={() => startEdit(blog)}
                  className="mt-2 text-[11px] font-bold text-[#1645a2] hover:underline"
                >
                  Edit story
                </button>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-[#dce4ef] p-6 text-center text-xs text-[#657795]">
          No stories yet. Create one to share news on the landing page.
        </p>
      )}
    </section>
  );
}
