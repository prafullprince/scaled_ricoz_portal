"use client";

import { useEffect, useState } from "react";

export function NetworkActivityIndicator() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handleActivity = (event: Event) => {
      setActive(Boolean((event as CustomEvent<{ active?: boolean }>).detail?.active));
    };
    window.addEventListener("ricoz-network-activity", handleActivity);
    return () => window.removeEventListener("ricoz-network-activity", handleActivity);
  }, []);

  return <div aria-hidden="true" className={`network-activity-indicator ${active ? "is-active" : ""}`} />;
}
