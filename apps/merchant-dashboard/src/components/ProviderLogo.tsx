import { useState } from "react";
import { cn } from "@store-builder/ui";
import { providerInitials, providerLogo, providerName } from "@/lib/providers";

/** One fixed box per size, 2:1, so wide wordmarks and square marks line up. */
const SIZE_CLASS = {
  sm: "h-7 w-14 text-[0.625rem]",
  md: "h-9 w-18 text-xs",
} as const;

interface ProviderLogoProps {
  code: string;
  /** Alt text and the source of the fallback's initials. Defaults to the known name, else the code. */
  name?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

/**
 * The logo straight on the page background, centred and contained in a fixed
 * box so no mark is cropped or stretched. A "<code>.dark.png" variant, when
 * there is one, replaces it in the dark theme (switched in CSS, so the right
 * one shows before any script runs). Without a file, or if it fails to load,
 * a neutral badge with the name's initials fills the same box.
 */
export function ProviderLogo({ code, name, size = "md", className }: ProviderLogoProps) {
  const label = name || providerName(code);
  const logo = providerLogo(code);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const markBroken = (url: string) => setBroken((prev) => new Set(prev).add(url));

  if (!logo || broken.has(logo.light)) {
    return (
      <span
        role="img"
        aria-label={label}
        data-provider-logo={code}
        data-fallback=""
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center rounded-[0.5rem] border border-line bg-paper font-semibold text-ink-soft",
          SIZE_CLASS[size],
          className
        )}
      >
        <span aria-hidden dir="auto">
          {providerInitials(label)}
        </span>
      </span>
    );
  }

  const dark = logo.dark && !broken.has(logo.dark) ? logo.dark : undefined;
  const image = (src: string, variant: "light" | "dark", visibility: string) => (
    <img
      src={src}
      alt={label}
      data-variant={variant}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => markBroken(src)}
      className={cn("h-full w-full object-contain", visibility)}
    />
  );

  return (
    <span data-provider-logo={code} className={cn("inline-flex shrink-0 items-center justify-center", SIZE_CLASS[size], className)}>
      {image(logo.light, "light", dark ? "dark:hidden" : "")}
      {dark && image(dark, "dark", "hidden dark:block")}
    </span>
  );
}
