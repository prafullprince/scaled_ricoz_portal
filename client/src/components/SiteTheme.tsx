"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Moon, Sun } from "lucide-react";
import { getChatTheme, setChatTheme, subscribeChatTheme } from "@/lib/chat/theme";

export function ThemeButton() {
  const theme = useSyncExternalStore(subscribeChatTheme, getChatTheme, () => "light");
  return <button type="button" onClick={() => setChatTheme(theme === "dark" ? "light" : "dark")} title={theme === "dark" ? "Light mode" : "Dark mode"} aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"} className="inline-flex size-9 items-center justify-center rounded-md bg-(--brand-surface) text-(--brand-text) hover:bg-(--brand-surface-hover)">{theme === "dark" ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

export function SiteTheme() {
  const pathname = usePathname();
  const theme = useSyncExternalStore(subscribeChatTheme, getChatTheme, () => "light");
  const isDashboard = pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  useEffect(() => {
    const activeTheme = isDashboard ? theme : "light";
    document.documentElement.classList.toggle("dark", activeTheme === "dark");
    document.documentElement.style.colorScheme = activeTheme;
  }, [isDashboard, theme]);
  return null;
}