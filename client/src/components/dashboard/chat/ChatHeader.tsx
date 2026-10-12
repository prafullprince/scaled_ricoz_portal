"use client";

import { ArrowLeft, MoreVertical, Phone, Video } from "lucide-react";
import type { Conversation } from "@/services/chat.service";
import { Avatar } from "./Avatar";
import { populatedMembers } from "./chatHelpers";

export function ChatHeader({
  conversation,
  title,
  isTyping,
  canStartCall,
  isCollectiveAdmin,
  activeCallType,
  onBack,
  onOpenDetails,
  onStartCall,
  onStartGroupCall,
  onJoinGroupCall,
  currentUserId,
}: {
  currentUserId?: string;
  conversation: Conversation;
  title: string;
  isTyping: boolean;
  canStartCall: boolean;
  isCollectiveAdmin: boolean;
  activeCallType: "audio" | "video" | null;
  onBack: () => void;
  onOpenDetails: () => void;
  onStartCall: (type: "audio" | "video") => void;
  onStartGroupCall: (type: "audio" | "video") => void;
  onJoinGroupCall: () => void;
}) {
  return (
    <header data-chat-header className="flex h-16 shrink-0 items-center gap-3 border-b border-[#d1d7db] bg-[#f0f2f5] px-4">
      <button
        type="button"
        onClick={onBack}
        aria-label="Back to conversations"
        className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] hover:bg-[#f1f3f6] md:hidden"
      >
        <ArrowLeft size={20} />
      </button>
      <Avatar src={conversation.type === "DIRECT" ? populatedMembers(conversation.members).find((member) => member.userId._id !== currentUserId)?.userId.profile_pic : conversation.avatarUrl} name={title} community={conversation.type !== "DIRECT"} small />
      <button type="button" onClick={onOpenDetails} className="min-w-0 flex-1 text-left">
        <p className="truncate text-base font-medium text-[#111b21]">{title}</p>
        <p className={`mt-0.5 truncate text-xs ${isTyping ? "text-[#008069]" : "text-[#667781]"}`}>
          {isTyping
            ? "typing..."
            : conversation.type === "DIRECT"
              ? "tap for contact info"
              : `${conversation.members.length} members`}
        </p>
      </button>
      {conversation.type === "DIRECT" ? (
        <>
          <button
            type="button"
            onClick={() => onStartCall("video")}
            disabled={!canStartCall}
            aria-label="Start video call"
            title={!canStartCall ? "Your role can receive calls but cannot start them" : "Video call"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Video size={19} />
          </button>
          <button
            type="button"
            onClick={() => onStartCall("audio")}
            disabled={!canStartCall}
            aria-label="Start voice call"
            title={!canStartCall ? "Your role can receive calls but cannot start them" : "Voice call"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Phone size={18} />
          </button>
        </>
      ) : activeCallType ? (
        <button
          type="button"
          onClick={onJoinGroupCall}
          className="flex h-9 items-center gap-1.5 rounded-md bg-[#16a34a] px-3 text-xs font-bold text-white hover:bg-[#128a3d]"
        >
          {activeCallType === "video" ? <Video size={16} /> : <Phone size={16} />}
          Join call
        </button>
      ) : (
        <>
          <button
            type="button"
            onClick={() => onStartGroupCall("video")}
            disabled={!isCollectiveAdmin}
            aria-label="Start video call"
            title={!isCollectiveAdmin ? "Only admins can start a call" : "Start video call"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Video size={19} />
          </button>
          <button
            type="button"
            onClick={() => onStartGroupCall("audio")}
            disabled={!isCollectiveAdmin}
            aria-label="Start voice call"
            title={!isCollectiveAdmin ? "Only admins can start a call" : "Start voice call"}
            className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a] disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Phone size={18} />
          </button>
        </>
      )}
      <button
        type="button"
        onClick={onOpenDetails}
        aria-label="Conversation details"
        className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] transition hover:bg-[#f1f3f6] hover:text-[#18243a]"
      >
        <MoreVertical size={19} />
      </button>
    </header>
  );
}
