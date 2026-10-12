"use client";

import { Pencil, Reply, X } from "lucide-react";
import type { ChatMessage } from "@/services/chat.service";

export function ReplyEditBanner({
  replyTo,
  editingMessage,
  onCancel,
}: {
  replyTo: ChatMessage | null;
  editingMessage: ChatMessage | null;
  onCancel: () => void;
}) {
  if (!replyTo && !editingMessage) return null;
  return (
    <div className="flex items-center gap-3 border-t border-[#e3e6eb] bg-white px-4 pt-3">
      <div
        className={`min-w-0 flex-1 rounded-sm border-l-4 bg-[#f8f9fb] px-3 py-2 ${editingMessage ? "border-[#175cd3]" : "border-[#c91d20]"}`}
      >
        <p className={`flex items-center gap-1.5 text-xs font-bold ${editingMessage ? "text-[#175cd3]" : "text-[#c91d20]"}`}>
          {editingMessage ? <Pencil size={12} /> : <Reply size={12} />}
          {editingMessage
            ? "Editing message"
            : `Replying to ${!replyTo!.senderId || typeof replyTo!.senderId === "string" ? "message" : replyTo!.senderId.name}`}
        </p>
        <p className="truncate text-xs text-[#667085]">
          {editingMessage?.text ?? replyTo?.text}
        </p>
      </div>
      <button
        type="button"
        onClick={onCancel}
        aria-label={editingMessage ? "Cancel edit" : "Cancel reply"}
        className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a]"
      >
        <X size={18} />
      </button>
    </div>
  );
}
