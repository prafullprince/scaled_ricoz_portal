import type { Metadata } from "next";
import { PersonalMyWorkView } from "@/components/dashboard/PersonalMyWorkView";

export const metadata: Metadata = { title: "My Work | Ricoz" };

export default function PersonalMyWorkPage() {
  return <PersonalMyWorkView />;
}
