"use client";

import { useState, useTransition, type MouseEvent } from "react";
import { useRouter } from "next/navigation";
import { animateThemeChange } from "@store-builder/ui/theme-reveal";
import { COLOR_MODE_COOKIE } from "@/lib/colorModeCookie";
import { useStore } from "@/lib/StoreContext";
import type { ColorMode } from "@/lib/storeColorMode";
import { MoonIcon, SunIcon } from "./ThemeToggle";
import { iconBtn } from "./ui";

/**
 * The light/dark button of a store that wears an imported template and shows
 * it (Languages → shoppers' look). Like the language switch, the choice is a
 * cookie the server reads, so every page after this one — and this one, on
 * the refresh — is drawn in it from its first paint (lib/storeColorMode). The
 * dark stylesheet is already linked on such a store, so the wrapper turns at
 * once while the server's render catches up.
 *
 * `mode` is what the server drew; `partId` its place in the template's header
 * (lib/xsLayout), for the editor's canvas.
 */
export function ColorModeSwitch({ mode, partId }: { mode: ColorMode; partId?: string }) {
  const { t } = useStore();
  const router = useRouter();
  const [, startTransition] = useTransition();
  // The pick until the server's render says the same.
  const [picked, setPicked] = useState<ColorMode | null>(null);
  const current = picked ?? mode;
  const next: ColorMode = current === "dark" ? "light" : "dark";
  const label = next === "dark" ? t.common.themeDark : t.common.themeLight;

  function toggle() {
    document.cookie = `${COLOR_MODE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    const wrapper = document.querySelector<HTMLElement>(".brand-theme");
    if (next === "dark") wrapper?.setAttribute("data-color-mode", "dark");
    else wrapper?.removeAttribute("data-color-mode");
    setPicked(next);
    startTransition(() => router.refresh());
  }

  // The new look grows over the old one as a circle from where the button was pressed (@store-builder/ui/theme-reveal).
  const onClick = (event: MouseEvent<HTMLButtonElement>) => animateThemeChange(event, toggle);

  return (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={iconBtn} data-xs-part={partId} data-color-mode-switch="">
      {current === "dark" ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
