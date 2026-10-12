import { useSyncExternalStore } from "react";

function noopSubscribe() {
  return () => {};
}

// Reports false during SSR and the first client render, then true once hydrated.
export function useHydrated() {
  return useSyncExternalStore(noopSubscribe, () => true, () => false);
}
