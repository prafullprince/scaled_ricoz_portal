import type { Metadata } from "next";
import { PersonalTodoWorkspace } from "@/components/dashboard/PersonalTodoWorkspace";

export const metadata: Metadata = { title: "My TODO | Ricoz" };

export default function MyWorkTodoPage() {
  return <PersonalTodoWorkspace view="ACTIVE" />;
}
