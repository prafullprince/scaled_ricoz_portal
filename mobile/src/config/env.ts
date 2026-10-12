const trimTrailingSlash = (value: string) => value.replace(/\/+$/, '');

export const env = {
  apiUrl: trimTrailingSlash(
    process.env.EXPO_PUBLIC_API_URL ?? 'https://innovationapi.ricoz.in/api/v1',
  ),
  chatWebSocketUrl: trimTrailingSlash(
    process.env.EXPO_PUBLIC_CHAT_WS_URL ?? 'wss://innovationapi.ricoz.in/ws/chat',
  ),
} as const;