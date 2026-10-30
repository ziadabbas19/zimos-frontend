import type { MouseEvent } from "react";
import { animateThemeChange } from "../theme-reveal";
import { toggleScheme, useAppearance } from "./store";

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

/**
 * The sun / moon switch of the toolbar: Light, or the dark look chosen last in
 * Settings → Language and look (Black or Dark). One store with that screen
 * (lib/appearance.ts), so the two never disagree. The new look grows over the
 * old one as a circle from the press (../theme-reveal).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  const dark = useAppearance().look !== "light";
  const label = dark ? "Switch to light mode" : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={(event: MouseEvent<HTMLButtonElement>) => animateThemeChange(event, toggleScheme)}
      aria-label={label}
      title={label}
      className={`cursor-pointer inline-flex size-9 shrink-0 items-center justify-center rounded-full border border-line bg-paper-raised text-ink-soft transition-colors hover:border-ink-soft hover:text-ink ${className}`}
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
