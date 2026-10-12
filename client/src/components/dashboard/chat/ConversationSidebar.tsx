"use client";

import { Archive, MessageSquarePlus, Pin, Search, VolumeX } from "lucide-react";
import type { Conversation } from "@/services/chat.service";
import { Avatar } from "./Avatar";
import { EmptyInbox } from "./EmptyInbox";
import { ChatThemeToggle } from "./ChatThemeToggle";
import type { ChatTheme } from "@/lib/chat/theme";
import { populatedMembers } from "./chatHelpers";

export type ConversationTab = "all" | "unread" | "favourites" | "communities" | "dept" | "archived";

export function ConversationSidebar({
  hidden,
  socketState,
  search,
  onSearchChange,
  tab,
  onTabChange,
  conversations,
  selectedId,
  onSelectConversation,
  onNewConversation,
  title,
  subtitle,
  showDepartmentTab,
  workspaceTitle = "Ricoz",
  hideFilters = false,
  canCreate = true,
  currentUserId,
  theme,
  onThemeChange,
}: {
  currentUserId?: string;
  theme: ChatTheme;
  onThemeChange: (theme: ChatTheme) => void;
  workspaceTitle?: string;
  hideFilters?: boolean;
  canCreate?: boolean;
  hidden: boolean;
  socketState: "connecting" | "online" | "offline";
  search: string;
  onSearchChange: (value: string) => void;
  tab: ConversationTab;
  onTabChange: (tab: ConversationTab) => void;
  conversations: Conversation[];
  selectedId: string | null;
  onSelectConversation: (conversationId: string) => void;
  onNewConversation: () => void;
  title: (conversation: Conversation) => string;
  subtitle: (conversation: Conversation) => string;
  showDepartmentTab: boolean;
}) {
  const tabs: ConversationTab[] = [
    "all",
    "unread",
    "favourites",
    "communities",
    ...(showDepartmentTab ? ["dept" as const] : []),
  ];

  return (
    <aside
      aria-label="Conversations"
      className={`${hidden ? "hidden md:flex" : "flex"} min-h-0 w-full shrink-0 flex-col border-r border-[#d1d7db] bg-white md:w-80 lg:w-96 xl:w-105`}
    >
      <header className="flex h-16 shrink-0 items-center justify-between px-5">
        <div>
          <h1 className="text-[22px] font-bold text-[#111b21]">{workspaceTitle}</h1>
          {socketState !== "online" ? <p role="status" className="text-xs text-[#667781]">{socketState === "connecting" ? "Connecting..." : "Reconnecting..."}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
        <ChatThemeToggle theme={theme} onChange={onThemeChange} />
        {canCreate ? <button
          type="button"
          onClick={onNewConversation}
          aria-label="New conversation"
          title="New conversation"
          className="flex size-10 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f0f2f5]"
        >
          <MessageSquarePlus size={22} strokeWidth={1.75} />
        </button> : null}
        </div>
      </header>
      <div className="shrink-0 border-b border-[#f0f2f5] px-3 pb-3">
        <label className="flex h-9 items-center gap-6 rounded-lg bg-[#f0f2f5] px-4 text-[#54656f]">
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search or start new chat"
            aria-label="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none"
          />
        </label>
        {!hideFilters ? <div
          role="group"
          aria-label="Filter conversations"
          className="mt-2 flex flex-wrap gap-1.5"
        >
          {tabs.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onTabChange(value)}
              aria-pressed={tab === value}
              className={`rounded-full px-3 py-1.5 text-[13px] capitalize ${tab === value ? "bg-[#d9fdd3] text-[#008069]" : "bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]"}`}
            >
              {value === "communities" ? "groups" : value}
            </button>
          ))}
        </div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        {!hideFilters ? <button type="button" onClick={() => onTabChange(tab === "archived" ? "all" : "archived")} aria-pressed={tab === "archived"} className="flex w-full items-center gap-6 px-6 py-3 text-sm text-[#a1a7a3]"><Archive size={20} />{tab === "archived" ? "Back to all chats" : "Archived"}</button> : null}
        {conversations.map((conversation) => (
          <button
            key={conversation._id}
            type="button"
            onClick={() => onSelectConversation(conversation._id)}
            aria-current={selectedId === conversation._id ? "true" : undefined}
            className={`relative flex h-19 w-full items-center gap-3 px-3 text-left ${selectedId === conversation._id ? "bg-[#f0f2f5]" : "hover:bg-[#f5f6f6]"}`}
          >
            <Avatar
              src={conversation.type === "DIRECT" ? populatedMembers(conversation.members).find((member) => member.userId._id !== currentUserId)?.userId.profile_pic : conversation.avatarUrl}
              name={title(conversation)}
              community={conversation.type !== "DIRECT"}
            />
            <div className="flex h-full min-w-0 flex-1 flex-col justify-center border-b border-[#f0f2f5] pr-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-[17px] font-normal text-[#111b21]">
                  {title(conversation)}
                </p>
                <time
                  className={`shrink-0 text-[11px] ${conversation.unreadCount ? "text-[#1fa855]" : "text-[#667781]"}`}
                >
                  {new Date(conversation.lastMessageAt).toLocaleDateString(
                    [],
                    { month: "short", day: "numeric" },
                  )}
                </time>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <p className="min-w-0 flex-1 truncate text-[13px] text-[#667781]">
                  {subtitle(conversation)}
                </p>
                {conversation.mySettings?.pinned ? (
                  <Pin size={12} className="text-[#8696a0]" />
                ) : null}
                {conversation.mySettings?.mutedUntil ? (
                  <VolumeX size={12} className="text-[#8696a0]" />
                ) : null}
                {conversation.unreadCount ? (
                  <span className="flex min-w-5 items-center justify-center rounded-full bg-[#25d366] px-1.5 py-0.5 text-[11px] font-semibold text-[#111b21]">
                    {conversation.unreadCount}
                  </span>
                ) : null}
              </div>
            </div>
          </button>
        ))}
        {!conversations.length ? <EmptyInbox /> : null}
      </div>
    </aside>
  );
}
