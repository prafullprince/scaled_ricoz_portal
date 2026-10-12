"use client";

import { useEffect, useState } from "react";
import { Check, LockKeyhole, Search, X } from "lucide-react";
import { toast } from "sonner";
import { ChatService, type ChatUser, type Conversation } from "@/services/chat.service";
import { Avatar } from "./Avatar";

export function NewConversationDialog({
  canCreateCollective,
  onClose,
  onCreated,
  initialMode = "DIRECT",
  forCall = false,
}: {
  initialMode?: "DIRECT" | "GROUP" | "COMMUNITY";
  forCall?: boolean;
  canCreateCollective: boolean;
  onClose: () => void;
  onCreated: (conversation: Conversation) => void;
}) {
  const [mode, setMode] = useState<"DIRECT" | "GROUP" | "COMMUNITY">(initialMode);
  const [contacts, setContacts] = useState<ChatUser[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    ChatService.contacts(search).then((users) => active && setContacts(users));
    return () => {
      active = false;
    };
  }, [search]);
  async function create() {
    if (mode === "DIRECT" && !selected.length) {
      toast.error("Select a person to start a chat");
      return;
    }
    if (mode !== "DIRECT" && name.trim().length < 2) {
      toast.error(`Enter a ${mode.toLowerCase()} name`);
      return;
    }
    setSaving(true);
    try {
      const conversation =
        mode === "DIRECT"
          ? await ChatService.direct(selected[0]!)
          : await ChatService.create({ type: mode, name, memberIds: selected });
      onCreated(conversation);
    } finally {
      setSaving(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#101a2c]/55 p-4 backdrop-blur-sm">
      <section
        role="dialog"
        aria-modal="true"
        aria-label={forCall ? "New call" : "New conversation"}
        className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-md border border-white/20 bg-white shadow-[0_28px_80px_rgba(16,26,44,0.28)]"
      >
        <header className="flex items-center justify-between border-b border-[#e3e6eb] border-t-4 border-t-[#c91d20] px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-[#18243a]">
              {forCall ? "New call" : "New conversation"}
            </h2>
            <p className="mt-1 text-xs text-[#667085]">
              Find anyone in the Ricoz workspace.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="flex h-9 w-9 items-center justify-center rounded-md text-[#667085] hover:bg-[#f1f3f6] hover:text-[#18243a]">
            <X size={20} />
          </button>
        </header>
        {!forCall ? <div className="mx-4 mt-4 flex gap-1 rounded-md border-b border-[#edf0f3] bg-[#f8f9fb] p-1.5">
          {(["DIRECT", "GROUP", "COMMUNITY"] as const).map((value) => {
            const blocked = value !== "DIRECT" && !canCreateCollective;
            return (
            <button
              key={value}
              type="button"
              disabled={blocked}
              title={blocked ? "Your role can only create one-to-one chats" : undefined}
              onClick={() => {
                setMode(value);
                setSelected([]);
              }}
              className={`flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-sm px-3 py-2 text-xs font-bold transition ${mode === value ? "bg-white text-[#18243a] shadow-sm" : blocked ? "cursor-not-allowed text-[#aeb6c2]" : "text-[#667085] hover:text-[#18243a]"}`}
            >
              {blocked ? <LockKeyhole size={12} /> : null}
              {value === "DIRECT"
                ? "One-to-one"
                : value.charAt(0) + value.slice(1).toLowerCase()}
            </button>
            );
          })}
        </div> : null}
        {!canCreateCollective && !forCall ? (
          <p className="mx-4 mt-2 flex items-center gap-2 rounded-md bg-[#fff7ed] px-3 py-2 text-xs font-medium text-[#9a3412]">
            <LockKeyhole size={14} />
            Your role can create one-to-one chats only.
          </p>
        ) : null}
        <div className="space-y-3 p-4">
          {mode !== "DIRECT" ? (
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={`${mode === "GROUP" ? "Group" : "Community"} name`}
              className="h-11 w-full rounded-md border border-[#dfe3e8] px-3 text-sm text-[#18243a] outline-none focus:border-[#98a2b3] focus:shadow-[0_0_0_3px_rgba(24,36,58,0.06)]"
            />
          ) : null}
          <label className="flex h-11 items-center gap-2 rounded-md border border-[#dfe3e8] bg-[#f8f9fb] px-3 text-[#667085] focus-within:border-[#98a2b3] focus-within:bg-white">
            <Search size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search people"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3">
          {contacts.map((contact) => {
            const checked = selected.includes(contact._id);
            return (
              <button
                key={contact._id}
                type="button"
                onClick={() =>
                  setSelected((current) =>
                    mode === "DIRECT"
                      ? [contact._id]
                      : checked
                        ? current.filter((id) => id !== contact._id)
                        : [...current, contact._id],
                  )
                }
                className={`flex w-full items-center gap-3 rounded-md border-l-[3px] px-3 py-2.5 text-left transition ${checked ? "border-[#c91d20] bg-[#fff5f3]" : "border-transparent hover:bg-[#f8f9fb]"}`}
              >
                <Avatar name={contact.name} src={contact.profile_pic} small />
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-sm text-[#18243a]">
                    {contact.name}
                  </strong>
                  <span className="block truncate text-xs text-[#667085]">
                    {contact.email}
                  </span>
                </span>
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-sm border ${checked ? "border-[#c91d20] bg-[#c91d20] text-white" : "border-[#aeb6c2]"}`}
                >
                  {checked ? <Check size={13} /> : null}
                </span>
              </button>
            );
          })}
        </div>
        <footer className="flex justify-end gap-2 border-t border-[#e3e6eb] bg-[#f8f9fb] p-4">
          <button
            type="button"
            onClick={onClose}
            className="h-10 rounded-md px-4 text-sm font-semibold text-[#667085] hover:bg-[#edf0f3]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => void create()}
            className="h-10 rounded-md bg-[#c91d20] px-5 text-sm font-bold text-white shadow-[0_5px_14px_rgba(201,29,32,0.18)] hover:bg-[#ad181b] disabled:opacity-50"
          >
            {saving
              ? "Creating..."
              : forCall ? "Start call" : mode === "DIRECT"
                ? "Start chat"
                : `Create ${mode.toLowerCase()}`}
          </button>
        </footer>
      </section>
    </div>
  );
}
