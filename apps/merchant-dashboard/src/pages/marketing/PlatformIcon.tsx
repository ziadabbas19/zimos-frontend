import { cn } from "@store-builder/ui";
import { platformMark } from "./pixelPlatforms";

/**
 * A tracking platform's mark (pixelPlatforms.ts): its logo, or a circle with
 * its first letter. Always beside the platform's name, so it is decorative.
 * Both take the text colour around them: ink on the page, the brand tint on a
 * highlighted option, light in the dark theme.
 */
export function PlatformIcon({ platform, className }: { platform: string; className?: string }) {
  const mark = platformMark(platform);
  if (mark.kind === "brand") {
    return (
      <svg
        viewBox="0 0 24 24"
        aria-hidden
        focusable="false"
        data-platform-icon={platform}
        data-mark="brand"
        className={cn("size-5 shrink-0 fill-current", className)}
      >
        <path d={mark.path} />
      </svg>
    );
  }
  return (
    <span
      aria-hidden
      data-platform-icon={platform}
      data-mark="letter"
      className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-current", className)}
    >
      <span className="text-[11px] leading-none font-bold text-paper-raised">{mark.letter}</span>
    </span>
  );
}
