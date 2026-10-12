import type { ChatMember, ChatMessage, ChatUser } from "@/services/chat.service";

export const emojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

export const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export const senderId = (message: ChatMessage) =>
  typeof message.senderId === "string"
    ? message.senderId
    : message.senderId?._id;

export const populatedMembers = (members: ChatMember[]) =>
  members.filter(
    (member): member is ChatMember & { userId: ChatUser } => member.userId !== null,
  );

// Cloudinary URLs are already optimized; skip Next Image's remote loader restrictions.
export const attachmentImageLoader = ({ src }: { src: string }) => src;

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRole(role?: string) {
  return (
    role
      ?.toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ") ?? ""
  );
}
