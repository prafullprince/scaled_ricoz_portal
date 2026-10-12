import type { Metadata } from "next";
import { ChatWorkspace } from "@/components/dashboard/ChatWorkspace";

export const metadata: Metadata = { title: "First Chat | Ricoz" };

export default function MessagesPage() {
  return <ChatWorkspace />;
}