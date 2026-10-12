"use client";

import { MessageCircle, Radio, Users } from "lucide-react";

export function EmptyChatPlaceholder({ view = "chats" }: { view?: string }) {
  const Icon = view === "channels" ? Radio : view === "communities" ? Users : MessageCircle;
  return (
    <div className="relative hidden min-w-0 flex-1 flex-col items-center justify-center overflow-hidden bg-[#f0f2f5] px-10 text-center md:flex">
      <span className="flex size-24 items-center justify-center text-[#626a65]">
        <Icon size={54} strokeWidth={1.25} />
      </span>
      <h2 className="mt-7 text-[32px] font-light text-[#41525d]">
        {view === "channels" ? "Channels" : view === "communities" ? "Communities" : "Ricoz Messages"}
      </h2>
    </div>
  );
}
