import { useEffect, useRef } from "react";

/**
 * Runs `tick` every `ms` while `enabled` and the tab is in view, and once more
 * when the tab comes back into view; nothing runs while it is hidden. The same
 * rule the inbox's poll follows (pages/inbox/inboxScreen.ts), for the screens
 * that follow a job on the server (an export, a shipment batch) or poll while
 * their live stream is down.
 */
export function useVisibleInterval(tick: () => void, ms: number, enabled = true): void {
  const ref = useRef(tick);
  useEffect(() => {
    ref.current = tick;
  });
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const id = window.setInterval(run, ms);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [ms, enabled]);
}
