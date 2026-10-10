import type { ReactNode, SVGProps } from "react";

/**
 * The few glyphs the editor's canvas draws over the page (a section's bar,
 * the drag grips, "add a section here"). The storefront carries no icon
 * library, so they are drawn here, in the same stroke as components/Icons.tsx.
 */

type IconProps = Omit<SVGProps<SVGSVGElement>, "width" | "height"> & { size?: number };

function glyph(children: ReactNode) {
  return function Glyph({ size = 18, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        {...props}
      >
        {children}
      </svg>
    );
  };
}

export const ArrowUpIcon = glyph(
  <>
    <path d="M12 19V5" />
    <path d="m5 12 7-7 7 7" />
  </>
);

export const ArrowDownIcon = glyph(
  <>
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </>
);

export const CopySimpleIcon = glyph(
  <>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </>
);

export const EyeIcon = glyph(
  <>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
    <circle cx="12" cy="12" r="3" />
  </>
);

export const EyeSlashIcon = glyph(
  <>
    <path d="M9.9 4.2A10.9 10.9 0 0 1 12 4c6.5 0 10 8 10 8a18 18 0 0 1-2.2 3.2" />
    <path d="M6.6 6.6A18.5 18.5 0 0 0 2 12s3.5 8 10 8a10.7 10.7 0 0 0 5.4-1.6" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="m2 2 20 20" />
  </>
);

export const PlusIcon = glyph(
  <>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </>
);

export const TrashIcon = glyph(
  <>
    <path d="M3 6h18" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M10 11v6" />
    <path d="M14 11v6" />
  </>
);

/** Two columns of three dots: "drag me". */
export const DotsSixVerticalIcon = glyph(
  <g fill="currentColor" stroke="none">
    <circle cx="9" cy="5" r="1.5" />
    <circle cx="9" cy="12" r="1.5" />
    <circle cx="9" cy="19" r="1.5" />
    <circle cx="15" cy="5" r="1.5" />
    <circle cx="15" cy="12" r="1.5" />
    <circle cx="15" cy="19" r="1.5" />
  </g>
);

export const ImageIcon = glyph(
  <>
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="9" cy="9" r="2" />
    <path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
  </>
);
