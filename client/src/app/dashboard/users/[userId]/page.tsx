import type { Metadata } from "next";
import { UserProfileView } from "@/components/dashboard/UserProfileView";

export const metadata: Metadata = { title: "User profile | Ricoz" };

export default async function UserProfilePage({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  return <UserProfileView userId={userId} />;
}
