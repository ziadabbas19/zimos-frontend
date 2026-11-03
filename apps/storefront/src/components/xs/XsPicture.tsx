import type { CSSProperties } from "react";
import { DEVICES, perDevice, wholeIn, type Device, type PerDevice } from "@/lib/deviceValue";
import { xsCopy, xsPicturePath, xsSources } from "@/lib/xsPicture";

/** A picture's own size, in pixels, per screen — set by dragging its corner on the editor's canvas. */
export interface XsPictureSize {
  width: PerDevice<number> | null;
  height: PerDevice<number> | null;
}

const isWidth = wholeIn(16, 2400);
const isHeight = wholeIn(16, 2000);

/**
 * The size saved beside a picture: `<field>W` and `<field>H` in the object
 * that holds it ("imageW" beside "image", in the band or in one of its items).
 * Null when it has none — the look's own rules size it.
 */
export function pictureSize(owner: Record<string, unknown>, field: string): XsPictureSize | null {
  const width = perDevice(owner[`${field}W`], isWidth);
  const height = perDevice(owner[`${field}H`], isHeight);
  return width || height ? { width, height } : null;
}

/** The size of the picture at `at` in a list of addresses (`images`), kept in `imagesW` / `imagesH` by the same place. */
export function listPictureSize(props: Record<string, unknown>, list: string, at: number): XsPictureSize | null {
  const pick = (key: string) => (Array.isArray(props[key]) ? (props[key] as unknown[])[at] : undefined);
  const width = perDevice(pick(`${list}W`), isWidth);
  const height = perDevice(pick(`${list}H`), isHeight);
  return width || height ? { width, height } : null;
}

const SUFFIX: Record<Device, string> = { base: "", tablet: "-t", mobile: "-m" };

/** The custom properties and markers app/xs-sections.css turns into the size, screen by screen. */
function sizeAttributes(size: XsPictureSize | null | undefined): { style?: CSSProperties; marks: Record<string, string> } {
  const marks: Record<string, string> = {};
  if (!size) return { marks };
  const style: Record<string, string> = {};
  for (const [axis, values] of [
    ["w", size.width],
    ["h", size.height],
  ] as const) {
    for (const device of DEVICES) {
      const value = values?.[device];
      if (value === undefined) continue;
      style[`--xs-${axis}${SUFFIX[device]}`] = `${value}px`;
      marks[`data-xs-${axis}${SUFFIX[device]}`] = "";
    }
  }
  return { style: style as CSSProperties, marks };
}

/**
 * A picture in an imported template's band. A template picture comes as its
 * AVIF or WebP copy — a smaller one on a phone — at the size it always had
 * (lib/xsPicture xsSources); anything else — a merchant's upload — is the
 * plain <img> it always was. The <picture> takes no
 * box of its own (`.xs-pic`, display: contents), so every rule written for the
 * <img> still holds.
 *
 * `box` is the picture's own width and height when the server knows them
 * (lib/xsImages), so the browser keeps its place before it arrives. `eager`
 * is for a picture a shopper sees first: fetched straight away, ahead of the
 * rest. `pic` is where the picture is saved in its band's props
 * ("image", "items.2.image", "images.1"): the editor's canvas finds and
 * resizes it by that (data-xs-pic), and `size` is what it set there.
 */
export function XsPicture({
  src,
  alt,
  className,
  box,
  eager = false,
  width,
  height,
  pic,
  size,
  loading,
}: {
  src: string;
  alt: string;
  className?: string;
  box?: readonly [number, number] | null;
  eager?: boolean;
  /** Drawn size, for a small picture (an icon) that has one. */
  width?: number;
  height?: number;
  pic?: string;
  size?: XsPictureSize | null;
  /** "eager" for a picture lazy loading never reaches (one under another, as in a stack of cards), without the first-paint priority `eager` gives. */
  loading?: "eager" | "lazy";
}) {
  const path = xsPicturePath(src);
  const own = sizeAttributes(size);
  // Bundled or merchant media: arbitrary URLs (no next/image allowlist).
  // eslint-disable-next-line @next/next/no-img-element
  const img = (
    <img
      src={src}
      alt={alt}
      className={className}
      // The picture's own size: Tailwind's base rule (height: auto) and the
      // look's own rules size it; these only give it its shape before it loads.
      width={width ?? box?.[0]}
      height={height ?? box?.[1]}
      loading={loading ?? (eager ? undefined : "lazy")}
      decoding="async"
      fetchPriority={eager ? "high" : undefined}
      data-xs-pic={pic}
      data-xs-tpl={path ? "" : undefined}
      style={own.style}
      {...own.marks}
    />
  );
  if (!path) return img;
  return (
    <picture className="xs-pic">
      {xsSources(path, box?.[0]).map((source) => (
        <source key={`${source.media ?? ""}${source.type}`} media={source.media} type={source.type} srcSet={source.srcSet} />
      ))}
      {img}
    </picture>
  );
}

/**
 * Asks for a band's background picture (a slide, a page-title banner) ahead
 * of the stylesheet that names it: the copy lib/xsPicture's xsBackground
 * gives a wider screen, or the one it gives a phone. For the page's opening
 * band only — its picture is the page's largest paint.
 */
export function XsBackgroundPreload({ src }: { src: string }) {
  const path = xsPicturePath(src);
  if (!path) return <link rel="preload" as="image" href={src} fetchPriority="high" />;
  return (
    <>
      <link rel="preload" as="image" href={xsCopy(path, 1600, "avif")} type="image/avif" media="(min-width: 768px)" fetchPriority="high" />
      <link rel="preload" as="image" href={xsCopy(path, 1200, "avif")} type="image/avif" media="(max-width: 767px)" fetchPriority="high" />
    </>
  );
}
