"use client";

import Image from "next/image";
import { FileText, LoaderCircle, MapPin, Video, X } from "lucide-react";
import type { ChatAttachment, ChatLocation } from "@/services/chat.service";
import { attachmentImageLoader, formatFileSize } from "./chatHelpers";

export function AttachmentPreviewBar({
  attachments,
  sharedLocation,
  uploadProgress,
  onRemoveAttachment,
  onRemoveLocation,
}: {
  attachments: ChatAttachment[];
  sharedLocation: ChatLocation | null;
  uploadProgress: number | null;
  onRemoveAttachment: (index: number) => void;
  onRemoveLocation: () => void;
}) {
  if (!attachments.length && !sharedLocation && uploadProgress === null) return null;
  return (
    <div className="flex shrink-0 gap-2 overflow-x-auto border-t border-[#e3e6eb] bg-white px-3 py-2">
      {attachments.map((attachment, index) => (
        <div key={`${attachment.url}-${index}`} className="relative flex h-16 min-w-48 items-center gap-2 rounded-md border border-[#dfe3e8] bg-[#f8f9fb] p-2 pr-9">
          {attachment.mimeType.startsWith("image/") ? (
            <Image loader={attachmentImageLoader} unoptimized src={attachment.url} alt="" width={48} height={48} className="h-12 w-12 rounded-sm object-cover" />
          ) : attachment.mimeType.startsWith("video/") ? (
            <Video size={22} className="shrink-0 text-[#c91d20]" />
          ) : (
            <FileText size={22} className="shrink-0 text-[#c91d20]" />
          )}
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-[#344054]">{attachment.name}</p>
            <p className="text-[10px] text-[#7b8494]">{formatFileSize(attachment.size)}</p>
          </div>
          <button
            type="button"
            aria-label={`Remove ${attachment.name}`}
            onClick={() => onRemoveAttachment(index)}
            className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-sm text-[#667085] hover:bg-white"
          >
            <X size={15} />
          </button>
        </div>
      ))}
      {sharedLocation ? (
        <div className="relative flex h-16 min-w-48 items-center gap-2 rounded-md border border-[#dfe3e8] bg-[#f8f9fb] p-2 pr-9">
          <MapPin size={23} className="shrink-0 text-[#c91d20]" />
          <div>
            <p className="text-xs font-bold text-[#344054]">Current location</p>
            <p className="text-[10px] text-[#7b8494]">Ready to share</p>
          </div>
          <button type="button" aria-label="Remove location" onClick={onRemoveLocation} className="absolute right-1 top-1 flex h-7 w-7 items-center justify-center rounded-sm text-[#667085] hover:bg-white">
            <X size={15} />
          </button>
        </div>
      ) : null}
      {uploadProgress !== null ? (
        <div className="flex h-16 min-w-48 items-center gap-3 rounded-md border border-[#dfe3e8] bg-[#f8f9fb] px-3">
          <LoaderCircle size={20} className="animate-spin text-[#c91d20]" />
          <div className="flex-1">
            <p className="text-xs font-bold text-[#344054]">Uploading {uploadProgress}%</p>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[#e3e6eb]">
              <div className="h-full bg-[#c91d20]" style={{ width: `${uploadProgress}%` }} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
