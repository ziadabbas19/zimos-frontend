import { useEffect, useRef } from "react";

/** Shortcuts leave text fields alone — those have their own undo and their own Backspace. */
function isTextEntry(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select");
}

/**
 * A sheet, dialog, menu or popover is open: Escape and Delete are its own.
 * (The phone's inspector is not one of them — it is a pane that looks like a
 * sheet and locks nothing; it is marked `data-peek`.)
 */
function overlayOpen(): boolean {
  return (
    document.querySelector('[data-slot="sheet"]:not([data-peek]), [data-slot="popover"], [role="dialog"], [role="alertdialog"], [role="menu"]') !==
    null
  );
}

/**
 * The editor's keys:
 *
 *  - Ctrl/⌘+S        save now (even from inside a field);
 *  - Ctrl/⌘+Z        undo, Ctrl/⌘+Shift+Z or Ctrl/⌘+Y redo — not inside a
 *                    text field, which has its own;
 *  - Escape          one step up through the selection (`escape` answers
 *                    whether there was anything to let go of);
 *  - Delete / Backspace  on a selected section (`remove` answers whether it
 *                    took the key) — never while typing, never with a sheet or
 *                    dialog open.
 *
 * Keys pressed inside the preview never arrive here: the storefront is
 * another document, with its own typing in place.
 *
 * A key another listener already took (`defaultPrevented` — the Undo toast
 * answers Ctrl/⌘+Z itself while it shows) is left alone, so one press never
 * undoes twice.
 */
export function useEditorShortcuts(actions: {
  save: () => void;
  undo: () => void;
  redo: () => void;
  escape: () => boolean;
  remove: () => boolean;
}) {
  // The listener is attached once and reaches the newest actions through this.
  const latest = useRef(actions);
  useEffect(() => {
    latest.current = actions;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const act = latest.current;
      if ((event.ctrlKey || event.metaKey) && !event.altKey) {
        const key = event.key.toLowerCase();
        // The physical key when the layout types no Latin letter: on an Arabic keyboard Z is «ئ» and S is «س».
        const latin = /^[a-z]$/.test(key);
        const pressed = (letter: string, code: string) => (latin ? key === letter : event.code === code);
        if (pressed("s", "KeyS")) {
          event.preventDefault();
          act.save();
          return;
        }
        if (isTextEntry(event.target)) return;
        if (pressed("z", "KeyZ") && !event.shiftKey) {
          event.preventDefault();
          act.undo();
        } else if ((pressed("z", "KeyZ") && event.shiftKey) || pressed("y", "KeyY")) {
          event.preventDefault();
          act.redo();
        }
        return;
      }
      if (event.altKey || isTextEntry(event.target) || overlayOpen()) return;
      if (event.key === "Escape") {
        if (act.escape()) event.preventDefault();
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        if (act.remove()) event.preventDefault();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}

/**
 * Guards what is not stored yet (`unsafe`: the draft's last second and a
 * half, a save that failed, a look that is not saved).
 *
 *  - Closing or reloading the tab: the browser's own "leave?" (it only honours
 *    this after a real user gesture, but it is the standard guard).
 *  - Leaving for another screen of the app: the app uses a plain
 *    BrowserRouter (no route blockers), so a click on any link that would
 *    leave is caught before React Router sees it and handed to `onLeave`,
 *    which stores what it can and asks about the rest.
 *
 * The browser's Back button is not caught; useAutosave sends what is left
 * when the editor closes.
 */
export function useLeaveGuard(unsafe: boolean, onLeave: (to: string) => void) {
  const latest = useRef(onLeave);
  useEffect(() => {
    latest.current = onLeave;
  });

  useEffect(() => {
    if (!unsafe) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsafe]);

  useEffect(() => {
    if (!unsafe) return undefined;
    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || (link.target && link.target !== "_self") || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      event.preventDefault();
      latest.current(`${url.pathname}${url.search}${url.hash}`);
    }
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [unsafe]);
}
