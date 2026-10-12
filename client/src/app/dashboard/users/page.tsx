import type { Metadata } from "next";
import { UserDirectoryView } from "@/components/dashboard/UserDirectoryView";

export const metadata: Metadata = { title: "Users Base | Ricoz" };

export default function UsersPage() {
  return <UserDirectoryView />;
}
