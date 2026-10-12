import { createContext, useContext } from "react";

export type CallType = "audio" | "video";

export type DirectCall = {
  kind: "direct";
  callId: string;
  conversationId: string;
  peerUserId: string;
  peerName: string;
  type: CallType;
  status: "incoming" | "calling" | "connecting" | "active";
};

export type GroupCall = {
  kind: "group";
  conversationId: string;
  conversationName: string;
  token: string;
  url: string;
  roomName: string;
  type: CallType;
  isAdmin: boolean;
};

export type CallContextValue = {
  callsSupported: boolean;
  directCall: DirectCall | null;
  groupCall: GroupCall | null;
  activeGroupCalls: Map<string, { type: CallType; startedByName: string }>;
  syncActiveGroupCall: (conversationId: string, call: { type: CallType; startedByName: string } | null) => void;
  startDirectCall: (input: { conversationId: string; peerUserId: string; peerName: string; type: CallType }) => Promise<void>;
  acceptDirectCall: () => Promise<void>;
  declineDirectCall: () => void;
  endDirectCall: () => void;
  startGroupCall: (input: { conversationId: string; conversationName: string; type: CallType }) => Promise<void>;
  joinGroupCall: (input: { conversationId: string; conversationName: string }) => Promise<void>;
  endGroupCall: () => Promise<void>;
};

export const CallContext = createContext<CallContextValue | null>(null);

export function useChatCalls() {
  const context = useContext(CallContext);
  if (!context) throw new Error("useChatCalls must be used inside CallProvider");
  return context;
}