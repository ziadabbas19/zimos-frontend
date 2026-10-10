import { useEffect, useRef, type RefObject } from "react";
import { useMediaQuery } from "@/components/report/useMediaQuery";

/**
 * The three shapes of the inbox:
 *  - a phone (below md): the conversations are cards in the page, and an open
 *    conversation covers the screen above the dock, with a back arrow;
 *  - a tablet (md up to lg): one pane that shows the list or the conversation;
 *  - a desktop (lg up): the list and the open conversation side by side.
 */
const PHONE_QUERY = "(max-width: 47.99rem)";
const SPLIT_QUERY = "(min-width: 64rem)";

/** Below md: the dock is up and an open conversation covers the screen. */
export function useInboxPhone(): boolean {
  return useMediaQuery(PHONE_QUERY);
}

/** From lg: the list and the conversation stand side by side. */
export function useInboxSplit(): boolean {
  return useMediaQuery(SPLIT_QUERY);
}

/** How long WhatsApp lets a store answer in free text after the customer's last message. */
export const WINDOW_HOURS = 24;

/** A round tool beside the message box: 44px under a thumb, 40px with a mouse. */
export const CHAT_TOOL =
  "zimos-chat-tool inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] disabled:cursor-progress disabled:opacity-60 aria-expanded:bg-paper-sunken aria-expanded:text-ink motion-reduce:transition-none motion-reduce:active:scale-100 pointer-fine:size-10";

/**
 * A conversation's number as a dialer wants it. The inbox keeps numbers the
 * way WhatsApp does — digits only, country code first, no "+" — and a phone
 * would dial that as a local number: the plus is put back.
 */
export function dialNumber(phone: string): string {
  return /^[1-9][0-9]{9,14}$/.test(phone) ? `+${phone}` : phone;
}

/** Whether Enter should send: with a real keyboard. Under a thumb Enter is a new line and the button sends. */
export function entersSend(): boolean {
  return typeof window.matchMedia !== "function" || !window.matchMedia("(pointer: coarse)").matches;
}

/** Taller than any browser bar that comes and goes: only a keyboard takes this much of the screen. */
const KEYBOARD_MIN = 120;

/**
 * Keeps a full-screen layer (the open conversation on a phone) inside what the
 * screen really shows. While the keyboard is up the layer is as tall as the
 * visible part and starts where it starts, so the composer sits on the
 * keyboard and the header stays in sight — on iOS too, where a fixed box is
 * otherwise left behind the keys. With the keyboard down the inline styles go
 * and the layer is back on its own classes (full screen, room for the dock).
 *
 * The page behind stands still while the layer is up: it cannot be scrolled
 * through the header or the composer, and it is where it was on the way back.
 */
export function useChatLayer(ref: RefObject<HTMLElement | null>, active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const el = ref.current;
    const view = window.visualViewport;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const clear = () => {
      if (!el) return;
      el.style.top = "";
      el.style.height = "";
      el.style.bottom = "";
      el.style.paddingBottom = "";
      delete el.dataset.keyboard;
    };

    const sync = () => {
      if (!el || !view) return;
      // A pinch zoom also makes the visible part smaller: that is not a keyboard.
      const keyboardUp = view.scale <= 1.01 && window.innerHeight - view.height > KEYBOARD_MIN;
      if (!keyboardUp) {
        clear();
        return;
      }
      el.style.top = `${view.offsetTop}px`;
      el.style.height = `${view.height}px`;
      el.style.bottom = "auto";
      el.style.paddingBottom = "0px";
      el.dataset.keyboard = "";
    };

    sync();
    view?.addEventListener("resize", sync);
    view?.addEventListener("scroll", sync);
    return () => {
      view?.removeEventListener("resize", sync);
      view?.removeEventListener("scroll", sync);
      clear();
      document.body.style.overflow = previousOverflow;
    };
  }, [ref, active]);
}

/** There is no realtime channel to rely on alone, so the inbox also polls while the tab is visible. */
const POLL_MS = 10_000;

/** Runs `tick` every POLL_MS while the tab is visible, and again on return. */
export function usePolling(tick: () => void, enabled = true): void {
  const ref = useRef(tick);
  useEffect(() => {
    ref.current = tick;
  });
  useEffect(() => {
    if (!enabled) return;
    const run = () => {
      if (document.visibilityState === "visible") ref.current();
    };
    const id = window.setInterval(run, POLL_MS);
    document.addEventListener("visibilitychange", run);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", run);
    };
  }, [enabled]);
}
