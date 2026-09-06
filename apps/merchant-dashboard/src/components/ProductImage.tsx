import { useState } from "react";
import { ImageIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import type { ProductMedia } from "@store-builder/api-client";
import { mediaSrc } from "@/lib/media";

interface ProductImageProps {
  media: ProductMedia | null | undefined;
  alt: string;
  /** Sizing / shape classes for the square container. */
  className?: string;
  /** Icon size class for the placeholder. */
  iconClassName?: string;
}

/**
 * A product thumbnail. Falls back to a neutral placeholder box (never a broken
 * image glyph) when there's no media or the file fails to load.
 */
export function ProductImage({ media, alt, className, iconClassName }: ProductImageProps) {
  // Track which src failed so a prop change to a new src clears the error
  // without needing an effect.
  const [erroredSrc, setErroredSrc] = useState<string | null>(null);
  const src = media ? mediaSrc(media) : null;

  const box = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-[0.5rem] border border-line bg-paper",
    className
  );

  if (!src || erroredSrc === src) {
    return (
      <div className={box} aria-label={`${alt} (no image)`} role="img">
        <ImageIcon className={cn("text-ink-soft/40", iconClassName ?? "size-5")} aria-hidden />
      </div>
    );
  }

  return (
    <div className={box}>
      <img
        src={src}
        alt={alt}
        loading="lazy"
        className="h-full w-full object-cover"
        onError={() => setErroredSrc(src)}
      />
    </div>
  );
}
