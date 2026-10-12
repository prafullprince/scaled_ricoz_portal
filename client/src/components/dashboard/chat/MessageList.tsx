"use client";

import type { RefObject } from "react";
import { ArrowDown, LoaderCircle } from "lucide-react";
import type { ChatMessage } from "@/services/chat.service";
import { senderId } from "./chatHelpers";
import { MessageBubble } from "./MessageBubble";
import { TypingBubble } from "./TypingBubble";

export function MessageList({
  viewportRef,
  endRef,
  messageCursor,
  loadingOlder,
  onLoadOlder,
  loadingMessages,
  messages,
  currentUserId,
  onReply,
  onReact,
  onEdit,
  onDelete,
  typingNames,
  showTypingName,
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  messageCursor: string | null;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  loadingMessages: boolean;
  messages: ChatMessage[];
  currentUserId?: string;
  onReply: (message: ChatMessage) => void;
  onReact: (message: ChatMessage, emoji: string) => void;
  onEdit: (message: ChatMessage) => void;
  onDelete: (message: ChatMessage, scope: "me" | "everyone") => void;
  typingNames: string[];
  showTypingName: boolean;
}) {
  return (
    <div
      ref={viewportRef}
      aria-label="Message history"
      className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#efeae2] bg-[radial-gradient(circle_at_1px_1px,rgba(84,101,111,.06)_1px,transparent_0)] bg-size-[24px_24px] px-3 py-5 sm:px-8 lg:px-12"
    >
      {messageCursor ? (
        <div className="mb-4 flex justify-center">
          <button
            type="button"
            onClick={onLoadOlder}
            disabled={loadingOlder}
            className="inline-flex items-center gap-2 rounded-md border border-[#e1e5ea] bg-white px-4 py-2 text-xs font-bold text-[#667085] shadow-sm hover:text-[#18243a]"
          >
            {loadingOlder ? (
              <LoaderCircle size={14} className="animate-spin" />
            ) : (
              <ArrowDown size={14} className="rotate-180" />
            )}
            {loadingOlder ? "Loading..." : "Load earlier messages"}
          </button>
        </div>
      ) : null}
      {loadingMessages ? (
        <div className="flex h-full items-center justify-center">
          <LoaderCircle className="animate-spin text-[#008069]" />
        </div>
      ) : (
        <div className="mx-auto max-w-5xl space-y-1.5">
          {messages.map((message) => (
            <MessageBubble
              key={message._id}
              message={message}
              own={senderId(message) === currentUserId}
              onReply={() => onReply(message)}
              onReact={(emoji) => onReact(message, emoji)}
              onEdit={() => onEdit(message)}
              onDelete={(scope) => onDelete(message, scope)}
            />
          ))}
          {typingNames.length ? (
            <TypingBubble names={typingNames} showName={showTypingName} />
          ) : null}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
