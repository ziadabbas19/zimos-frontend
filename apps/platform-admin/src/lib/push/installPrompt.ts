import { useEffect, useState } from "react";
import { CONSOLE_PUSH_ENABLED as PUSH_ENABLED } from "@/lib/features";

/**
 * The browser's own "Install app" offer (Chrome and Edge on Android and
 * Windows: `beforeinstallprompt`), kept for the optional "Install the app" tip
 * in Notifications → this device instead of the browser's own bar, as the
 * merchant dashboard's. Safari has no such event: an iPhone gets the "Add to
 * Home Screen" steps instead.
 *
 * Listened for from the moment this module loads (PushBridge imports it),
 * since the browser fires it once, early. Nothing while VITE_CONSOLE_PUSH_ENABLED is off.
 */

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let offer: InstallPromptEvent | null = null;
const listeners = new Set<() => void>();
const tell = () => listeners.forEach((listener) => listener());

export function watchInstallPrompt(target: Window = window): void {
  target.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    offer = event as InstallPromptEvent;
    tell();
  });
  target.addEventListener("appinstalled", () => {
    offer = null;
    tell();
  });
}

if (PUSH_ENABLED && typeof window !== "undefined") watchInstallPrompt();

/** Tests only. */
export function resetInstallPrompt(): void {
  offer = null;
  tell();
}

/** { available, install }: whether the browser offered to install the console, and the offer. */
export function useInstallPrompt(): { available: boolean; install: () => Promise<void> } {
  const [available, setAvailable] = useState(() => offer !== null);
  useEffect(() => {
    const update = () => setAvailable(offer !== null);
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return {
    available,
    async install() {
      const current = offer;
      if (!current) return;
      offer = null;
      tell();
      await current.prompt();
    },
  };
}
