import { AccessToken, RoomServiceClient } from "livekit-server-sdk";

const apiKey = process.env.LIVEKIT_API_KEY;
const apiSecret = process.env.LIVEKIT_API_SECRET;
const httpUrl = process.env.LIVEKIT_URL;

function requireConfig() {
  if (!apiKey || !apiSecret || !httpUrl)
    throw new Error("LiveKit is not configured");
  return { apiKey, apiSecret, httpUrl };
}

export async function createLiveKitToken(
  roomName: string,
  identity: string,
  name: string,
) {
  const { apiKey: key, apiSecret: secret } = requireConfig();
  const token = new AccessToken(key, secret, { identity, name, ttl: "4h" });
  token.addGrant({
    room: roomName,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
  });
  return token.toJwt();
}

let roomService: RoomServiceClient | null = null;
function getRoomService() {
  const { apiKey: key, apiSecret: secret, httpUrl: url } = requireConfig();
  roomService ??= new RoomServiceClient(url.replace(/^ws/, "http"), key, secret);
  return roomService;
}

export async function endLiveKitRoom(roomName: string) {
  try {
    await getRoomService().deleteRoom(roomName);
  } catch {
    // The room may already be empty or expired — nothing further to clean up.
  }
}
