import { useEffect, useRef } from "react";

/** What each key does on the order being called. */
export interface StationKeyHandlers {
  call: () => void;
  whatsapp: () => void;
  confirmed: () => void;
  noAnswer: () => void;
  later: () => void;
  cancelled: () => void;
  skip: () => void;
}

type StationAction = keyof StationKeyHandlers;

/** What is printed on each keycap. Enter's word comes from the strings, like Esc and Ctrl elsewhere. */
export const STATION_KEYCAPS: Record<Exclude<StationAction, "confirmed">, string> = {
  call: "C",
  whatsapp: "W",
  noAnswer: "U",
  later: "L",
  cancelled: "X",
  skip: "S",
};

/*
 * Matched by physical key, so they work on an Arabic layout too (the key that
 * types «ؤ» is still KeyC). The dashboard's own shortcuts
 * (components/KeyboardShortcuts.tsx) hold N, P, F, G and "/": none is used here.
 */
const BY_CODE: Partial<Record<string, StationAction>> = {
  KeyC: "call",
  KeyW: "whatsapp",
  Enter: "confirmed",
  NumpadEnter: "confirmed",
  KeyU: "noAnswer",
  KeyL: "later",
  KeyX: "cancelled",
  KeyS: "skip",
};

const TYPING = /^(INPUT|TEXTAREA|SELECT)$/;
/** Enter on one of these is that control's own key, never "confirmed". */
const PRESSABLE =
  'a[href], button, summary, [role="button"], [role="radio"], [role="tab"], [role="menuitem"], [role="option"], [role="checkbox"], [role="switch"]';
/** Something is open over the page: its keys are its own. */
const OVERLAY = '[role="dialog"], [role="alertdialog"], [role="menu"], [role="listbox"]';
/** A new order's keys wait this long, so a second press meant for the last order cannot land on the next one. */
const ARM_DELAY_MS = 450;
/** After G the dashboard waits this long for the letter of a page ("G then S" is Settings): that letter is not ours. */
const GO_PREFIX_MS = 1500;

/**
 * The station's keyboard: C call · W WhatsApp · Enter confirmed · U no answer ·
 * L later · X cancelled · S skip. One listener on `window` while `enabled`.
 *
 * It listens in the capture phase and stops the keys it handles, so the
 * dashboard's own shortcuts never see them; everything else passes through
 * untouched. Nothing fires while a field has focus, while a sheet, dialog or
 * menu is open, on a held key, or with Ctrl / Cmd / Alt / Shift down.
 */
export function useStationKeys(handlers: StationKeyHandlers, enabled: boolean): void {
  // The listener reads the latest handlers without subscribing again on every render.
  const latest = useRef(handlers);
  latest.current = handlers;

  useEffect(() => {
    if (!enabled) return undefined;
    const armedAt = performance.now() + ARM_DELAY_MS;
    let goPrefixAt = Number.NEGATIVE_INFINITY;

    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.repeat || e.isComposing) return;
      const target = e.target instanceof HTMLElement ? e.target : null;
      if (target && (target.isContentEditable || TYPING.test(target.tagName))) return;
      if (document.querySelector(OVERLAY)) return;

      if (e.code === "KeyG") {
        goPrefixAt = performance.now();
        return;
      }
      if (performance.now() - goPrefixAt < GO_PREFIX_MS) {
        goPrefixAt = Number.NEGATIVE_INFINITY;
        return;
      }

      const action = BY_CODE[e.code];
      if (!action) return;
      if (action === "confirmed" && target?.closest(PRESSABLE)) return;

      e.preventDefault();
      e.stopImmediatePropagation();
      if (performance.now() < armedAt) return;
      latest.current[action]();
    };

    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
