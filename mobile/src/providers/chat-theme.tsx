import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';

export type ChatTheme = 'light' | 'dark';

const storageKey = 'ricoz-chat-theme';
const ChatThemeContext = createContext<{ theme: ChatTheme; setTheme: (theme: ChatTheme) => void } | null>(null);

export const chatPalette = {
  light: {
    panel: '#ffffff', raised: '#f0f2f5', input: '#f0f2f5', history: '#efeae2', composer: '#f0f2f5',
    line: '#e3e8eb', text: '#111b21', secondary: '#667781', accent: '#008069', ownMessage: '#d9fdd3', otherMessage: '#ffffff',
  },
  dark: {
    panel: '#161817', raised: '#252826', input: '#2a2d2b', history: '#111413', composer: '#1b1e1c',
    line: '#303431', text: '#e9edef', secondary: '#a1a7a3', accent: '#21c063', ownMessage: '#144d37', otherMessage: '#252826',
  },
} as const;

async function readTheme(): Promise<ChatTheme> {
  try {
    const saved = Platform.OS === 'web'
      ? globalThis.localStorage?.getItem(storageKey)
      : await SecureStore.getItemAsync(storageKey);
    return saved === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function persistTheme(theme: ChatTheme) {
  try {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(storageKey, theme);
    else void SecureStore.setItemAsync(storageKey, theme).catch(() => undefined);
  } catch {
    return;
  }
}

export function ChatThemeProvider({ children }: PropsWithChildren) {
  const [theme, setThemeState] = useState<ChatTheme>('light');

  useEffect(() => {
    let mounted = true;
    void readTheme().then((saved) => { if (mounted) setThemeState(saved); });
    return () => { mounted = false; };
  }, []);

  const setTheme = (nextTheme: ChatTheme) => {
    setThemeState(nextTheme);
    persistTheme(nextTheme);
  };

  return <ChatThemeContext.Provider value={{ theme, setTheme }}>{children}</ChatThemeContext.Provider>;
}

export function useChatTheme() {
  const value = useContext(ChatThemeContext);
  if (!value) throw new Error('useChatTheme must be used within ChatThemeProvider');
  return value;
}