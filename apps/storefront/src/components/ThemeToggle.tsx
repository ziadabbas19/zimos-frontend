"use client";

import { useCallback, useSyncExternalStore, type MouseEvent } from "react";
import { animateThemeChange } from "@store-builder/ui/theme-reveal";
import { useStore } from "@/lib/StoreContext";
import { iconBtn } from "./ui";

type Theme = "light" | "dark";

function storedTheme(): Theme | null {
  try {
    const value = localStorage.getItem("theme");
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function domTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

function apply(theme: Theme) {
  const el = document.documentElement;
  el.classList.toggle("dark", theme === "dark");
  el.style.colorScheme = theme;
}

// Subscribers in this tab — `storage` events only fire in *other* tabs.
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((fn) => fn());

/**
 * Switches the page to light or dark from outside the toggle — the website
 * editor's own preview switch (PreviewBridge). Not remembered: the editor
 * sends its choice with every preview it posts, and a merchant checking dark
 * mode there shouldn't find their own storefront visits switched too. The
 * toggle's icon follows either way.
 */
export function setColorMode(theme: Theme) {
  apply(theme);
  emit();
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);

  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onMedia = () => {
    if (storedTheme() !== null) return; // an explicit choice wins over the OS
    apply(mq.matches ? "dark" : "light");
    emit();
  };
  const onStorage = (event: StorageEvent) => {
    if (event.key !== "theme") return;
    apply(storedTheme() ?? (mq.matches ? "dark" : "light"));
    emit();
  };

  mq.addEventListener("change", onMedia);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    mq.removeEventListener("change", onMedia);
    window.removeEventListener("storage", onStorage);
  };
}

export function MoonIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // The server snapshot is a stable "light" so SSR and the first client render
  // agree; React then re-renders with the real value the pre-paint script set.
  const theme = useSyncExternalStore<Theme>(subscribe, domTheme, () => "light");

  const toggle = useCallback(() => {
    const next: Theme = domTheme() === "dark" ? "light" : "dark";
    apply(next);
    try {
      localStorage.setItem("theme", next);
    } catch {
      /* private mode — the pre-paint script falls back to the system theme */
    }
    emit();
  }, []);

  // The new theme grows over the old one as a circle from where the button was pressed (@store-builder/ui/theme-reveal).
  const onClick = useCallback((event: MouseEvent<HTMLButtonElement>) => animateThemeChange(event, toggle), [toggle]);

  const { t } = useStore();
  const label = theme === "dark" ? t.common.themeLight : t.common.themeDark;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      suppressHydrationWarning
      // In the website editor's preview a click in the header selects the
      // header; this one only switches the preview between light and dark
      // (PreviewBridge lets it through and tells the editor).
      data-zimos-passthrough=""
      className={`${iconBtn} ${className}`}
    >
      <span suppressHydrationWarning>
        {theme === "dark" ? <SunIcon /> : <MoonIcon />}
      </span>
    </button>
  );
}
