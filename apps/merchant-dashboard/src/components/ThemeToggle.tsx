import { useCallback, useSyncExternalStore } from "react";

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

function MoonIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function ThemeToggle({ className = "" }: { className?: string }) {
  // A stable "light" server snapshot keeps the first render deterministic;
  // React then re-renders with the real value the pre-paint script set.
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

  const label =
    theme === "dark" ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      title={label}
      className={`cursor-pointer inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft transition-colors hover:border-ink-soft hover:text-ink ${className}`}
    >
      {theme === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
