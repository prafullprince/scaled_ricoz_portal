"use client";

import { MessageCircle } from "lucide-react";

export function EmptyInbox() {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center text-[#7b8494]">
      <span className="flex h-12 w-12 items-center justify-center rounded-md border border-[#e1e5ea] bg-[#f8f9fb] text-[#18243a]">
        <MessageCircle size={23} />
      </span>
      <p className="mt-4 text-sm font-bold text-[#18243a]">
        No conversations here
      </p>
      <p className="mt-1 text-xs">
        Start a private chat or switch inbox filters.
      </p>
    </div>
  );
}
