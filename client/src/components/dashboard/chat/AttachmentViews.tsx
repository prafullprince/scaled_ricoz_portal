"use client";

import { FileText, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import Image from "next/image";
import type { ChatAttachment, ChatLocation } from "@/services/chat.service";
import { attachmentImageLoader, formatFileSize } from "./chatHelpers";

export function AttachmentOption({
  icon,
  label,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-sm px-3 py-2.5 text-left text-sm font-semibold text-[#344054] hover:bg-[#f1f3f6]"
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

export function AttachmentView({ attachment }: { attachment: ChatAttachment }) {
  if (attachment.mimeType.startsWith("image/"))
    return (
      <a href={attachment.url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-sm bg-[#eef1f4]">
        <Image loader={attachmentImageLoader} unoptimized src={attachment.url} alt={attachment.name} width={640} height={480} className="h-auto max-h-80 w-full object-cover" />
      </a>
    );
  if (attachment.mimeType.startsWith("video/"))
    return <video src={attachment.url} controls preload="metadata" className="max-h-80 w-full rounded-sm bg-black" aria-label={attachment.name} />;
  if (attachment.mimeType.startsWith("audio/"))
    return (
      <div className="min-w-64 rounded-md border border-black/10 bg-white/75 px-3 py-3">
        <audio src={attachment.url} controls preload="metadata" className="h-10 w-full" aria-label={attachment.name} />
      </div>
    );
  return (
    <a href={attachment.url} target="_blank" rel="noreferrer" download className="flex min-w-56 items-center gap-3 rounded-sm border border-black/10 bg-white/70 p-3 hover:bg-white">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm bg-[#fce8e5] text-[#c91d20]"><FileText size={21} /></span>
      <span className="min-w-0"><span className="block truncate text-xs font-bold text-[#344054]">{attachment.name}</span><span className="text-[10px] text-[#7b8494]">{formatFileSize(attachment.size)}</span></span>
    </a>
  );
}

export function LocationView({ location }: { location: ChatLocation }) {
  const mapUrl = `https://www.openstreetmap.org/?mlat=${location.latitude}&mlon=${location.longitude}#map=16/${location.latitude}/${location.longitude}`;
  return (
    <a href={mapUrl} target="_blank" rel="noreferrer" className="mb-2 flex min-w-60 items-center gap-3 rounded-sm border border-black/10 bg-white/70 p-3 hover:bg-white">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#fce8e5] text-[#c91d20]"><MapPin size={23} /></span>
      <span><span className="block text-sm font-bold text-[#344054]">{location.label ?? "Shared location"}</span><span className="text-xs text-[#667085]">Open in map</span></span>
    </a>
  );
}
