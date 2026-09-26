import { useState } from "react";
import { cn } from "@store-builder/ui";
import { providerInitials, providerLogoUrl, providerName } from "@/lib/providers";

const SIZE_CLASS = {
  sm: "h-7 w-10 rounded-[0.375rem] text-[0.625rem]",
  md: "h-10 w-14 rounded-[0.5rem] text-xs",
} as const;

interface ProviderLogoProps {
  code: string;
  /** Alt text and the source of the fallback's initials. Defaults to the known name, else the code. */
  name?: string;
  size?: keyof typeof SIZE_CLASS;
  className?: string;
}

/**
 * The logo on a fixed white tile: logos are drawn for light backgrounds, so
 * the tile keeps them legible in the dark theme too, and one box size keeps
 * wide and square marks aligned. Without a file (or if it fails to load) a
 * neutral badge with the name's initials takes its place.
 */
export function ProviderLogo({ code, name, size = "md", className }: ProviderLogoProps) {
  const label = name || providerName(code);
  const url = providerLogoUrl(code);
  const [broken, setBroken] = useState<string | null>(null);

  if (!url || broken === url) {
    return (
      <span
        role="img"
        aria-label={label}
        data-provider-logo={code}
        data-fallback=""
        className={cn(
          "inline-flex shrink-0 select-none items-center justify-center border border-line bg-paper font-semibold text-ink-soft",
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

  return (
    <span
      data-provider-logo={code}
      className={cn(
        "inline-flex shrink-0 items-center justify-center overflow-hidden border border-line bg-white p-0.5",
        SIZE_CLASS[size],
        className
      )}
    >
      <img
        src={url}
        alt={label}
        loading="lazy"
        decoding="async"
        draggable={false}
        onError={() => setBroken(url)}
        className="h-full w-full object-contain"
      />
    </span>
  );
}
