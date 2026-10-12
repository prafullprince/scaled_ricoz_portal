import type { Metadata } from "next";
import { MyHrDocuments } from "@/components/dashboard/MyHrDocuments";

export const metadata: Metadata = { title: "My Documents | Ricoz" };

export default function MyDocumentsPage() {
  return <MyHrDocuments />;
}
