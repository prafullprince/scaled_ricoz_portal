import type { Metadata } from "next";
import { MyHrDocuments } from "@/components/dashboard/MyHrDocuments";

export const metadata: Metadata = { title: "Documents | Ricoz" };

export default function EmployeeDocumentsPage() {
  return <MyHrDocuments />;
}
