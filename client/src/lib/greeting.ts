"use client";

import { useSyncExternalStore } from "react";

export function greetingFor(date: Date) {
  const hour = date.getHours();
  if (hour >= 21 || hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function subscribe(onChange: () => void) {
  const timer = window.setInterval(onChange, 60_000);
  document.addEventListener("visibilitychange", onChange);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener("visibilitychange", onChange);
  };
}

// The server cannot know the viewer's local time, so it renders a neutral greeting.
export function useGreeting() {
  return useSyncExternalStore(subscribe, () => greetingFor(new Date()), () => "Welcome back");
}
