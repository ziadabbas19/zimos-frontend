"use client";

import { useCallback, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/provider";
import { Moon, Sun } from "./duo-icons";

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

/**
 * Put the theme back on <html>. Switching the language mounts the other
 * language's root layout, and React rebuilds <html>'s attributes from its
 * props — the class the pre-paint script set is gone. Same choice as that
 * script: the stored one, else the system's.
 */
export function restoreTheme(): void {
  apply(storedTheme() ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  emit();
}

/** The round light/dark switch of the header (`lz-top__icon` in landing.css). */
export function ThemeToggle({ className = "lz-top__icon" }: { className?: string }) {
  const { dict } = useI18n();

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

  const label = theme === "dark" ? dict.nav.switchToLight : dict.nav.switchToDark;

  return (
    <button type="button" onClick={toggle} aria-label={label} title={label} className={className}>
      <span suppressHydrationWarning>{theme === "dark" ? <Sun size={20} /> : <Moon size={20} />}</span>
    </button>
  );
}
