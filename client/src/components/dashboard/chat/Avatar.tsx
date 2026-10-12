"use client";

import { Users } from "lucide-react";
import Image from "next/image";
import { initials } from "./chatHelpers";

export function Avatar({
  name,
  community = false,
  small = false,
  src,
}: {
  src?: string;
  name: string;
  community?: boolean;
  small?: boolean;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${small ? "h-10 w-10" : "h-12 w-12"} ${community ? "bg-[#d9fdd3] text-[#008069]" : "bg-[#dfe5e7] text-[#54656f]"}`}
    >
      {src ? <Image src={src} alt={name} width={small ? 40 : 48} height={small ? 40 : 48} unoptimized className="h-full w-full rounded-full object-cover" /> : community ? (
        <Users size={small ? 18 : 21} />
      ) : (
        <span className="text-xs font-bold">{initials(name)}</span>
      )}
    </span>
  );
}
