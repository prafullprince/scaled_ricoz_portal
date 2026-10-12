"use client";

import { Moon, Sun } from "lucide-react";
import styles from "./ChatWorkspace.module.css";
import type { ChatTheme } from "@/lib/chat/theme";

export function ChatThemeToggle({ theme, onChange, compact = false, className = "" }: { theme: ChatTheme; onChange: (theme: ChatTheme) => void; compact?: boolean; className?: string }) {
  if (compact) {
    const nextTheme = theme === "light" ? "dark" : "light";
    const Icon = nextTheme === "light" ? Sun : Moon;
    return <div className={`${styles.themeToggle} ${styles.themeToggleCompact} ${className}`}>
      <button type="button" aria-label={`Switch to ${nextTheme} mode`} title={`Switch to ${nextTheme} mode`} onClick={() => onChange(nextTheme)}>
        <Icon size={17} />
      </button>
    </div>;
  }
  return (
    <div role="group" aria-label="Chat appearance" className={`${styles.themeToggle} ${className}`}>
      <button type="button" aria-label="Light mode" title="Light mode" aria-pressed={theme === "light"} onClick={() => onChange("light")}>
        <Sun size={17} />
      </button>
      <button type="button" aria-label="Dark mode" title="Dark mode" aria-pressed={theme === "dark"} onClick={() => onChange("dark")}>
        <Moon size={16} />
      </button>
    </div>
  );
}