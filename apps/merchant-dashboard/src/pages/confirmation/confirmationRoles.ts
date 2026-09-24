import { useEffect, useState } from "react";

/**
 * Role keys by what they may do in the confirmation queue (Backend
 * core/security/permissions.js SYSTEM_ROLES; owner holds "*"). The dashboard
 * only sees the role key, so a custom role reads as neither — the server
 * still decides, and a 403 comes back as a translated message.
 *
 * - orders.confirm: claim, record outcomes, confirm from the order page.
 * - orders.manage: correct a finished outcome, release another agent's claim.
 */
export const CONFIRM_ROLES: ReadonlySet<string> = new Set(["owner", "confirmation_agent"]);
export const MANAGE_ROLES: ReadonlySet<string> = new Set(["owner", "workspace_manager", "order_operator"]);

/** The current time, re-read every `intervalMs` — for lock countdowns. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Whole minutes from `now` until `iso`, at least 0. */
export function minutesUntil(iso: string | null, now: number): number {
  if (!iso) return 0;
  return Math.max(0, Math.ceil((new Date(iso).getTime() - now) / 60_000));
}
