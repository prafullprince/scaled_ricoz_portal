let audioContext: AudioContext | null = null;
let limiter: DynamicsCompressorNode | null = null;

function soundOutput(context: AudioContext) {
  if (!limiter) {
    limiter = context.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.2;
    limiter.connect(context.destination);
  }
  return limiter;
}

const notificationKey = "ricoz:last-chat-notification";
const activeChatKey = "ricoz:active-chat";
const mutedChatsKey = "ricoz:muted-chats";
let tabId: string | null = null;

type ActiveChat = {
  conversationId: string;
  tabId: string;
  updatedAt: number;
};

type MutedChats = Record<string, string>;

function getTabId() {
  tabId ??= crypto.randomUUID();
  return tabId;
}

function getAudioContext() {
  if (typeof window === "undefined") return null;
  audioContext ??= new AudioContext();
  return audioContext;
}

export function enableChatNotificationSound() {
  const enable = () => {
    const context = getAudioContext();
    if (context?.state === "suspended") void context.resume();
  };

  window.addEventListener("pointerdown", enable, { passive: true });
  window.addEventListener("keydown", enable);
  return () => {
    window.removeEventListener("pointerdown", enable);
    window.removeEventListener("keydown", enable);
  };
}

export function playIncomingMessageSound(messageId: string) {
  const context = getAudioContext();
  if (!context || context.state !== "running") return;

  const previous = localStorage.getItem(notificationKey);
  if (previous === messageId) return;
  localStorage.setItem(notificationKey, messageId);

  const startedAt = context.currentTime;
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.0001, startedAt);
  gain.gain.exponentialRampToValueAtTime(0.98, startedAt + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0011, startedAt + 0.34);
  gain.connect(soundOutput(context));

  [880, 1174].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const noteStart = startedAt + index * 0.11;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, noteStart);
    oscillator.connect(gain);
    oscillator.start(noteStart);
    oscillator.stop(noteStart + 0.2);
  });
}

export function startIncomingCallRingtone() {
  const context = getAudioContext();
  if (!context || context.state !== "running") return () => undefined;

  let stopped = false;
  const ring = () => {
    if (stopped) return;
    const startedAt = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, startedAt);
    gain.gain.exponentialRampToValueAtTime(0.65, startedAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + 1.15);
    gain.connect(soundOutput(context));

    [660, 880].forEach((frequency) => {
      const oscillator = context.createOscillator();
      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, startedAt);
      oscillator.connect(gain);
      oscillator.start(startedAt);
      oscillator.stop(startedAt + 1.2);
    });
  };

  ring();
  const interval = window.setInterval(ring, 2200);
  return () => {
    stopped = true;
    window.clearInterval(interval);
  };
}

export function setActiveChat(conversationId: string | null) {
  const currentTabId = getTabId();
  if (!conversationId) {
    const current = readActiveChat();
    if (current?.tabId === currentTabId) localStorage.removeItem(activeChatKey);
    return;
  }

  localStorage.setItem(
    activeChatKey,
    JSON.stringify({
      conversationId,
      tabId: currentTabId,
      updatedAt: Date.now(),
    } satisfies ActiveChat),
  );
}

export function isChatActive(conversationId: string) {
  const activeChat = readActiveChat();
  return Boolean(
    activeChat?.conversationId === conversationId &&
      Date.now() - activeChat.updatedAt < 15000,
  );
}

export function setMutedChats(
  conversations: Array<{ _id: string; mySettings?: { mutedUntil?: string | null } }>,
) {
  const mutedChats: MutedChats = {};
  for (const conversation of conversations) {
    const mutedUntil = conversation.mySettings?.mutedUntil;
    if (mutedUntil && new Date(mutedUntil).getTime() > Date.now())
      mutedChats[conversation._id] = mutedUntil;
  }
  localStorage.setItem(mutedChatsKey, JSON.stringify(mutedChats));
}

export function isChatMuted(conversationId: string) {
  const stored = localStorage.getItem(mutedChatsKey);
  if (!stored) return false;
  try {
    const mutedChats = JSON.parse(stored) as MutedChats;
    const mutedUntil = mutedChats[conversationId];
    if (!mutedUntil) return false;
    if (new Date(mutedUntil).getTime() > Date.now()) return true;
    delete mutedChats[conversationId];
    localStorage.setItem(mutedChatsKey, JSON.stringify(mutedChats));
  } catch {
    localStorage.removeItem(mutedChatsKey);
  }
  return false;
}

function readActiveChat(): ActiveChat | null {
  const stored = localStorage.getItem(activeChatKey);
  if (!stored) return null;
  try {
    return JSON.parse(stored) as ActiveChat;
  } catch {
    localStorage.removeItem(activeChatKey);
    return null;
  }
}