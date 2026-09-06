import type { SVGProps } from "react";

/**
 * Small stroke icons, sized by the parent's `font-size` (1em) unless a class
 * overrides it. Direction-neutral — nothing here implies left/right.
 */

type IconProps = SVGProps<SVGSVGElement>;

const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  focusable: false,
};

export function SunIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

export function MoonIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M20 14.5A8 8 0 0 1 9.5 4a7 7 0 1 0 10.5 10.5Z" />
    </svg>
  );
}

export function MenuIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export function CloseIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

/* --- Order-lifecycle step glyphs --- */

export function ChatIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M20 15a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2Z" />
      <path d="M8 9h8M8 12.5h5" />
    </svg>
  );
}

export function PhoneIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M15.5 3a5.5 5.5 0 0 1 5.5 5.5M15 6.5a2.5 2.5 0 0 1 2.5 2.5" />
      <path d="M6.6 4h2.5l1.3 4-2 1.2a11 11 0 0 0 4.7 4.7l1.2-2 4 1.3v2.5A2 2 0 0 1 20 20 16 16 0 0 1 4 6.6 2 2 0 0 1 6.6 4Z" />
    </svg>
  );
}

export function BarcodeIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M4 6v12M8 6v12M11 6v12M14.5 6v12M18 6v12M21 6v12" />
    </svg>
  );
}

export function PackageCheckIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 8v8l9 5M21 8v4" />
      <path d="M15.5 18.5 18 21l4-4.5" />
    </svg>
  );
}

/* --- Features section stage glyphs --- */

export function StorefrontIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      <path d="M3.5 8.5 5 4.5h14l1.5 4Z" />
      <path d="M5 8.5V20h14V8.5" />
      <path d="M9.5 20v-5h5v5" />
    </svg>
  );
}

export function RepeatIcon({ width = "1em", height = "1em", ...props }: IconProps) {
  return (
    <svg {...base} width={width} height={height} {...props}>
      {/* Two arcs turning full circle — reads as "again", no left/right meaning. */}
      <path d="M19 10a7 7 0 0 0-12-3.4L4 9" />
      <path d="M4 5v4h4" />
      <path d="M5 14a7 7 0 0 0 12 3.4L20 15" />
      <path d="M20 19v-4h-4" />
    </svg>
  );
}
