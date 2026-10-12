"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Archive,
  Check,
  Pin,
  Search,
  ShieldCheck,
  ShieldOff,
  UserMinus,
  UserPlus,
  Video,
  VolumeX,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  ChatService,
  type ChatMember,
  type ChatMessage,
  type ChatUser,
  type Conversation,
} from "@/services/chat.service";
import { Avatar } from "./Avatar";
import { attachmentImageLoader, formatRole, populatedMembers } from "./chatHelpers";
import type { ChatTheme } from "@/lib/chat/theme";
import styles from "./ChatWorkspace.module.css";

export function DetailsPanel({
  conversation,
  title,
  theme,
  currentUserId,
  messages,
  onClose,
  onConversationChange,
  onPin,
  onMute,
  onArchive,
  canViewProfiles,
  onOpenProfile,
}: {
  conversation: Conversation;
  title: string;
  theme: ChatTheme;
  currentUserId: string;
  messages: ChatMessage[];
  onClose: () => void;
  onConversationChange: (conversation: Conversation) => void;
  onPin: () => void;
  onMute: () => void;
  onArchive: () => void;
  canViewProfiles: boolean;
  onOpenProfile: (userId: string) => void;
}) {
  const [addingMembers, setAddingMembers] = useState(false);
  const [memberSearch, setMemberSearch] = useState("");
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selectedContacts, setSelectedContacts] = useState<string[]>([]);
  const [savingMembers, setSavingMembers] = useState(false);
  const isCollective = conversation.type !== "DIRECT";
  const isAdmin = conversation.admins.some((adminId) => String(adminId) === currentUserId);
  const members = populatedMembers(conversation.members);
  const existingMemberIds = new Set(members.map((member) => member.userId._id));
  const availableContacts = contacts.filter(
    (contact) => !existingMemberIds.has(contact._id),
  );
  const displayedMembers = isCollective
    ? members
    : members.filter((member) => member.userId._id !== currentUserId);
  const media = messages
    .flatMap((message) => message.attachments)
    .filter((attachment) => attachment.mimeType.startsWith("image/") || attachment.mimeType.startsWith("video/"));
  const documents = messages
    .flatMap((message) => message.attachments)
    .filter((attachment) => !attachment.mimeType.startsWith("image/") && !attachment.mimeType.startsWith("video/"));

  useEffect(() => {
    if (!addingMembers) return;
    let active = true;
    ChatService.contacts(memberSearch).then((users) => active && setContacts(users));
    return () => { active = false; };
  }, [addingMembers, memberSearch]);

  async function addSelectedMembers() {
    if (!selectedContacts.length) {
      toast.error("Select at least one person");
      return;
    }
    setSavingMembers(true);
    try {
      const updated = await ChatService.addMembers(conversation._id, selectedContacts);
      onConversationChange(updated);
      setSelectedContacts([]);
      setAddingMembers(false);
      toast.success("Members added");
    } finally {
      setSavingMembers(false);
    }
  }

  async function removeConversationMember(member: ChatMember & { userId: ChatUser }) {
    if (!window.confirm(`Remove ${member.userId.name} from this ${conversation.type.toLowerCase()}?`)) return;
    const updated = await ChatService.removeMember(conversation._id, member.userId._id);
    onConversationChange(updated);
    toast.success(`${member.userId.name} removed`);
  }

  async function toggleAdmin(member: ChatMember & { userId: ChatUser }, isCurrentlyAdmin: boolean) {
    const updated = isCurrentlyAdmin
      ? await ChatService.demoteAdmin(conversation._id, member.userId._id)
      : await ChatService.promoteAdmin(conversation._id, member.userId._id);
    onConversationChange(updated);
    toast.success(
      isCurrentlyAdmin
        ? `${member.userId.name} is no longer an admin`
        : `${member.userId.name} is now an admin`,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-40 flex justify-end bg-[#101a2c]/35 backdrop-blur-[2px]">
      <button type="button" aria-label="Close details" onClick={onClose} className="absolute inset-0 cursor-default" />
      <aside data-theme={theme} className={`${styles.detailsPanel} relative h-full w-full max-w-md overflow-y-auto border-l border-[#dfe3e8] bg-[#f0f2f5] shadow-[0_0_50px_rgba(16,26,44,0.18)]`}>
        <header className="flex h-18 items-center gap-4 border-b border-[#e3e6eb] bg-white px-4">
          <button type="button" onClick={onClose} aria-label="Close details" className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] hover:bg-[#f1f3f6]">
            <X size={20} />
          </button>
          <h2 className="font-extrabold text-[#18243a]">
            {conversation.type === "DIRECT" ? "Contact info" : `${conversation.type === "GROUP" ? "Group" : "Community"} info`}
          </h2>
        </header>
        <div className="flex flex-col items-center bg-white px-6 py-8">
          <Avatar name={title} community={conversation.type !== "DIRECT"} />
          <h3 className="mt-4 text-xl font-extrabold text-[#18243a]">{title}</h3>
          <p className="mt-1 text-center text-sm text-[#667085]">
            {conversation.description ||
              (conversation.type === "DIRECT"
                ? members.find((member) => member.userId._id !== currentUserId)?.userId.about || "Ricoz contact"
                : `${members.length} participant${members.length === 1 ? "" : "s"}`)}
          </p>
        </div>
        <section className="mt-2 bg-white p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#344054]">Media, links and docs</h4>
            <span className="text-xs font-semibold text-[#667085]">{media.length + documents.length}</span>
          </div>
          {media.length ? (
            <div className="mt-3 grid grid-cols-4 gap-1.5">
              {media.slice(0, 8).map((attachment, index) => (
                <a key={`${attachment.url}-${index}`} href={attachment.url} target="_blank" rel="noreferrer" className="aspect-square overflow-hidden rounded-sm bg-[#e9edf2]">
                  {attachment.mimeType.startsWith("image/") ? (
                    <Image loader={attachmentImageLoader} unoptimized src={attachment.url} alt={attachment.name} width={96} height={96} className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex h-full items-center justify-center text-[#667085]"><Video size={22} /></span>
                  )}
                </a>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-xs text-[#8a93a3]">No shared media yet</p>
          )}
          {documents.length ? <p className="mt-3 text-xs font-semibold text-[#667085]">{documents.length} shared document{documents.length === 1 ? "" : "s"}</p> : null}
        </section>
        <div className="mt-2 bg-white p-3">
          <DetailAction
            icon={Pin}
            label={
              conversation.mySettings?.pinned
                ? "Unpin conversation"
                : "Pin conversation"
            }
            onClick={onPin}
          />
          <DetailAction
            icon={VolumeX}
            label={
              conversation.mySettings?.mutedUntil
                ? "Unmute notifications"
                : "Mute for 8 hours"
            }
            onClick={onMute}
          />
          <DetailAction
            icon={Archive}
            label={
              conversation.mySettings?.archived
                ? "Restore from archive"
                : "Archive conversation"
            }
            onClick={onArchive}
          />
        </div>
        <section className="mt-2 bg-white p-4">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-[#344054]">
              {isCollective ? `${conversation.members.length} participants` : "Contact details"}
            </h4>
            {isCollective && isAdmin ? (
              <button type="button" onClick={() => setAddingMembers((current) => !current)} className="flex h-9 items-center gap-2 rounded-md px-2 text-xs font-bold text-[#c91d20] hover:bg-[#fff0ed]">
                <UserPlus size={17} /> Add
              </button>
            ) : null}
          </div>
          {addingMembers ? (
            <div className="mt-3 rounded-md border border-[#dfe3e8] bg-[#f8f9fb] p-3">
              <label className="flex h-10 items-center gap-2 rounded-md border border-[#dfe3e8] bg-white px-3 text-[#667085]">
                <Search size={15} />
                <input value={memberSearch} onChange={(event) => setMemberSearch(event.target.value)} placeholder="Search people" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
              </label>
              <div className="mt-2 max-h-52 space-y-1 overflow-y-auto">
                {availableContacts.map((contact) => {
                  const checked = selectedContacts.includes(contact._id);
                  return <button key={contact._id} type="button" onClick={() => setSelectedContacts((current) => checked ? current.filter((id) => id !== contact._id) : [...current, contact._id])} className={`flex w-full items-center gap-2 rounded-sm p-2 text-left ${checked ? "bg-[#fff0ed]" : "hover:bg-white"}`}><Avatar name={contact.name} small /><span className="min-w-0 flex-1"><span className="block truncate text-xs font-bold text-[#344054]">{contact.name}</span><span className="block truncate text-[10px] text-[#667085]">{contact.email}</span></span><span className={`flex h-5 w-5 items-center justify-center rounded-sm border ${checked ? "border-[#c91d20] bg-[#c91d20] text-white" : "border-[#b7c0cc]"}`}>{checked ? <Check size={13} /> : null}</span></button>;
                })}
                {!availableContacts.length ? <p className="py-4 text-center text-xs text-[#8a93a3]">No people to add</p> : null}
              </div>
              <button type="button" disabled={savingMembers} onClick={() => void addSelectedMembers()} className="mt-3 h-9 w-full rounded-md bg-[#c91d20] text-xs font-bold text-white disabled:opacity-50">{savingMembers ? "Adding..." : `Add ${selectedContacts.length || "members"}`}</button>
            </div>
          ) : null}
          <div className="mt-3 space-y-3">
            {displayedMembers.map((member) => {
              const memberIsAdmin = conversation.admins.some(
                (adminId) => String(adminId) === member.userId._id,
              );
              const isCreator = String(conversation.createdBy) === member.userId._id;
              const canManage =
                isCollective && isAdmin && !isCreator && member.userId._id !== currentUserId;
              return (
              <div key={member.userId._id} className="flex items-center gap-3">
                <button
                  type="button"
                  disabled={!canViewProfiles}
                  onClick={() => onOpenProfile(member.userId._id)}
                  title={canViewProfiles ? `View ${member.userId.name}'s profile` : undefined}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                >
                  <Avatar name={member.userId.name} small />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 truncate text-sm font-semibold">
                      <span className="truncate">{member.userId._id === currentUserId ? "You" : member.userId.name}</span>
                      {memberIsAdmin ? <span className="rounded-sm bg-[#ecfdf3] px-1.5 py-0.5 text-[9px] font-extrabold text-[#16803c]">ADMIN</span> : null}
                    </span>
                    <span className="block truncate text-xs text-[#667085]">
                      {member.userId.about || formatRole(member.userId.roles[0]) || member.userId.email}
                    </span>
                  </span>
                </button>
                {canManage ? (
                  <button
                    type="button"
                    onClick={() => void toggleAdmin(member, memberIsAdmin)}
                    aria-label={memberIsAdmin ? `Remove ${member.userId.name} as admin` : `Make ${member.userId.name} admin`}
                    title={memberIsAdmin ? "Remove as admin" : "Make admin"}
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[#98a2b3] hover:bg-[#ecfdf3] hover:text-[#16803c]"
                  >
                    {memberIsAdmin ? <ShieldOff size={16} /> : <ShieldCheck size={16} />}
                  </button>
                ) : null}
                {canManage ? (
                  <button type="button" onClick={() => void removeConversationMember(member)} aria-label={`Remove ${member.userId.name}`} className="flex h-8 w-8 items-center justify-center rounded-full text-[#98a2b3] hover:bg-[#fef3f2] hover:text-[#d92d20]"><UserMinus size={16} /></button>
                ) : null}
              </div>
              );
            })}
          </div>
        </section>
      </aside>
    </div>,
    document.body,
  );
}

function DetailAction({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof Pin;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-4 rounded-md px-3 py-3 text-left text-sm font-semibold text-[#18243a] transition hover:bg-[#f1f3f6]"
    >
      <Icon size={19} className="text-[#667085]" />
      {label}
    </button>
  );
}
