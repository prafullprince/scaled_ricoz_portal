import type { Metadata } from "next";
import { AssistantView } from "@/components/dashboard/AssistantView";
export const metadata: Metadata = { title: "AI Assistant | Ricoz" };
export default function AssistantPage() { return <AssistantView />; }
