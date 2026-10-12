export type ChatTheme = "light" | "dark";

const storageKey = "ricoz-chat-theme";
const listeners = new Set<() => void>();

export function getChatTheme(): ChatTheme {
  if (typeof window === "undefined") return "light";
  try { const saved = window.localStorage.getItem(storageKey); return saved === "dark" || saved === "light" ? saved : window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"; }
  catch { return "light"; }
}

export function subscribeChatTheme(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

export function setChatTheme(theme: ChatTheme) {
  try { window.localStorage.setItem(storageKey, theme); } catch {}
  document.documentElement.classList.toggle("dark", theme === "dark");
  document.documentElement.style.colorScheme = theme;
  listeners.forEach((listener) => listener());
}