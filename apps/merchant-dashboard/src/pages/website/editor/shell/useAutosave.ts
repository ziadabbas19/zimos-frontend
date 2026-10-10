import { useCallback, useEffect, useRef, useState } from "react";

/** How long after the last change the draft is saved. */
export const AUTOSAVE_DELAY_MS = 1500;

/**
 * What the toolbar says about the draft:
 *  - `idle`    nothing has changed since the page opened;
 *  - `saving`  there are changes on their way (waiting out the pause, or being sent);
 *  - `saved`   the last save went through and nothing changed since;
 *  - `failed`  the last save was refused or never arrived — the changes are
 *              still here, in memory, and go out again with the next change
 *              or when the merchant asks.
 */
export type SaveState = "idle" | "saving" | "saved" | "failed";

/**
 * Saves by itself, shortly after the last change.
 *
 * `signature` is a text that changes whenever what would be saved changes;
 * `isDirty` and `save` are read fresh each time they are needed, so a save
 * always sends the newest content. One save runs at a time: a change made
 * while one is on its way gets its own save after it.
 *
 * A failed save is not repeated on a timer — a refused tree would be refused
 * again — but the next change tries again, and `flush` tries at once.
 */
export function useAutosave({
  signature,
  dirty,
  isDirty,
  save,
  scope,
  delay = AUTOSAVE_DELAY_MS,
}: {
  signature: string;
  /** Whether there is something to save, as of this render (drives the words shown). */
  dirty: boolean;
  /** The same answer, asked at the moment a save is about to start. */
  isDirty: () => boolean;
  /** Sends the newest content; resolves to whether it was stored. Must not throw. */
  save: () => Promise<boolean>;
  /** What is being edited (the page id): a new one starts with a clean slate of words. */
  scope: string | null;
  delay?: number;
}) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);
  const [scopeSeen, setScopeSeen] = useState(scope);
  if (scopeSeen !== scope) {
    setScopeSeen(scope);
    setSavedOnce(false);
    setFailed(false);
  }

  const latest = useRef({ isDirty, save });
  useEffect(() => {
    latest.current = { isDirty, save };
  });

  const inFlight = useRef<Promise<boolean> | null>(null);
  const timer = useRef<number | null>(null);
  const alive = useRef(true);

  const flush = useCallback((): Promise<boolean> => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    const running = inFlight.current;
    if (running) return running.then(() => flush());
    if (!latest.current.isDirty()) return Promise.resolve(true);

    if (alive.current) setBusy(true);
    const attempt = latest.current
      .save()
      .catch(() => false)
      .then((stored) => {
        inFlight.current = null;
        if (alive.current) {
          setBusy(false);
          setFailed(!stored);
          if (stored) setSavedOnce(true);
        }
        return stored;
      });
    inFlight.current = attempt;
    return attempt;
  }, []);

  // Each change restarts the pause; the save goes out when the merchant stops.
  useEffect(() => {
    if (!dirty) return undefined;
    const handle = window.setTimeout(() => {
      if (timer.current === handle) timer.current = null;
      void flush();
    }, delay);
    timer.current = handle;
    return () => {
      window.clearTimeout(handle);
      if (timer.current === handle) timer.current = null;
    };
  }, [signature, dirty, delay, flush]);

  // Back to what is stored (an undo, say): an old failure no longer describes anything.
  useEffect(() => {
    if (!dirty) setFailed(false);
  }, [dirty]);

  // A phone that switches apps may never come back to this tab: save on the way out.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  // Leaving the editor by the browser's Back button skips every guard: send what is left.
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      if (!inFlight.current && latest.current.isDirty()) void latest.current.save().catch(() => false);
    };
  }, []);

  const state: SaveState = !dirty ? (savedOnce ? "saved" : "idle") : failed && !busy ? "failed" : "saving";
  return { state, flush, busy };
}
