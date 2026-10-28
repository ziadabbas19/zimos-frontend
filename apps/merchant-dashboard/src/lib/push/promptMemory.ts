/**
 * What this device remembers of the home page's offer to turn device
 * notifications on (components/push/PushPrompt.tsx): how many times "Not now"
 * was pressed, and until when it stays away. Kept in local storage, read and
 * written inside try/catch; storage that cannot be written and read back means
 * the offer is never shown, rather than coming back on every visit.
 */

export const PROMPT_KEY = "zimos.push.prompt";
export const SNOOZE_DAYS = 7;
export const MAX_DISMISSALS = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface PromptMemory {
  /** How many times "Not now" was pressed on this device. */
  dismissals: number;
  /** Not shown before this moment (epoch ms), or null. */
  until: number | null;
}

/** The memory, or null when local storage cannot be used. */
export function readPromptMemory(): PromptMemory | null {
  try {
    const probe = `${PROMPT_KEY}.probe`;
    localStorage.setItem(probe, "1");
    if (localStorage.getItem(probe) !== "1") return null;
    localStorage.removeItem(probe);
    const raw = localStorage.getItem(PROMPT_KEY);
    if (!raw) return { dismissals: 0, until: null };
    const saved = JSON.parse(raw) as Partial<PromptMemory>;
    const dismissals = Number.isInteger(saved.dismissals) && (saved.dismissals as number) >= 0 ? (saved.dismissals as number) : 0;
    const until = typeof saved.until === "number" && Number.isFinite(saved.until) ? saved.until : null;
    return { dismissals, until };
  } catch {
    return null;
  }
}

/** Shown on this device at `now`: storage works, fewer than 3 "Not now", and the last one is over 7 days old. */
export function promptDue(memory: PromptMemory | null, now: number): boolean {
  return memory !== null && memory.dismissals < MAX_DISMISSALS && (memory.until === null || now >= memory.until);
}

/** "Not now" at `now`: one more, and away for 7 days. A write that fails leaves storage unusable, so the offer stays away. */
export function snoozePrompt(now: number): void {
  const memory = readPromptMemory();
  try {
    localStorage.setItem(PROMPT_KEY, JSON.stringify({ dismissals: (memory?.dismissals ?? 0) + 1, until: now + SNOOZE_DAYS * DAY_MS }));
  } catch {
    /* the next read finds storage unusable, and the offer stays away */
  }
}
