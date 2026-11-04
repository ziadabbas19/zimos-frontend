import { ChevronIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, input } from "@/components/ui";
import type { Dictionary } from "@/lib/i18n";
import { Countdown } from "./Countdown";
import { GallerySlideshow, PageForm } from "./lazy";
import { pictureFocus, pictureRatio } from "./pictureFrame";
import {
  COLUMN_CLASS,
  type LinkItem,
  type Props,
  type QaItem,
  linkList,
  num,
  qaList,
  resolveHref,
  safeUrl,
  str,
  strList,
} from "./props";
import { StoreImage } from "@/components/StoreImage";

/**
 * The non-commerce half of the page-tree vocabulary — everything that renders
 * from its own props alone, with no API call. The four commerce types live in
 * `commerce.tsx` because they need real catalogue data.
 *
 * Every block returns `null` when it has nothing to show, so an element the
 * merchant added but never filled in leaves no empty box on the live page.
 * Defaults use the storefront tokens (primary / ink / line) so merchant
 * branding flows through, and logical properties so RTL stores mirror.
 */

const HEADING_CLASS: Record<number, string> = {
  1: "text-3xl sm:text-5xl font-bold",
  2: "text-2xl sm:text-3xl font-bold",
  3: "text-xl sm:text-2xl font-semibold",
  4: "text-lg sm:text-xl font-semibold",
  5: "text-base sm:text-lg font-semibold",
  6: "text-sm sm:text-base font-semibold",
};

export function HeadingElement({ props }: { props: Props }) {
  const text = str(props, "text");
  if (!text.trim()) return null;
  const level = num(props, "level", 2, 1, 6);
  const Tag = `h${level}` as "h1";
  return <Tag className={`zt-heading text-ink ${HEADING_CLASS[level]}`}>{text}</Tag>;
}

/** `text` and `rich_text` are both plain strings — the editor has no formatting
 *  controls — so newlines are the only structure to preserve. */
export function TextElement({ props, large }: { props: Props; large?: boolean }) {
  const text = str(props, "text");
  if (!text.trim()) return null;
  return (
    <p className={`whitespace-pre-line leading-relaxed text-ink-soft ${large ? "text-base sm:text-lg" : "text-sm sm:text-base"}`}>
      {text}
    </p>
  );
}

/**
 * How wide each named image size is allowed to get. A picture that never chose
 * one — every image on every page written before this existed — falls through
 * to `full`, which is the plain full-width image this always rendered.
 *
 * The names come from the editor (IMAGE_SIZES in its blocks.ts); an unknown
 * value is treated as "full" rather than dropping the picture.
 */
const IMAGE_MAX_WIDTH: Record<string, string> = {
  large: "44rem",
  medium: "26rem",
  small: "15rem",
  icon: "5.5rem",
};

/**
 * `eager`: the picture sits in the page's opening section, so it is fetched
 * straight away and first (often the page's largest paint) rather than lazily.
 *
 * A picture that names a shape (`ratio`, pictureFrame.ts) is a box of that
 * shape, as wide as its column, whatever file is put in it; the file fills the
 * box, cropped around `focusX` / `focusY`. Without one the picture keeps its
 * own shape and its markup is exactly what it always was.
 */
export function ImageElement({ props, eager = false, rtl = false }: { props: Props; eager?: boolean; rtl?: boolean }) {
  const src = safeUrl(str(props, "src"));
  if (!src) return null;
  const alt = str(props, "alt");
  const href = resolveHref(str(props, "href"));
  // A width in percent of the column — what dragging the picture's corner in
  // the editor sets — wins over a named size; a picture with neither renders
  // as it always did.
  const widthPct = props.width === undefined ? 0 : num(props, "width", 0, 10, 100);
  const maxWidth = widthPct > 0 ? `${widthPct}%` : IMAGE_MAX_WIDTH[str(props, "size", "full")];
  const ratio = pictureRatio(props.ratio);
  const focus = ratio ? pictureFocus(props, rtl) : null;

  const img = (
    <StoreImage
      src={src}
      alt={alt}
      width={1200}
      height={800}
      sizes="(max-width: 768px) 100vw, 1200px"
      loading={eager ? "eager" : "lazy"}
      fetchPriority={eager ? "high" : undefined}
      decoding="async"
      className="zt-img h-auto w-full rounded-2xl object-cover"
      // The shape set on the picture itself: its box no longer follows the file's own size.
      style={ratio ? { aspectRatio: ratio, ...(focus ? { objectPosition: focus } : {}) } : undefined}
    />
  );

  const linked = href ? (
    <StoreLink href={href} className="block rounded-2xl transition-opacity hover:opacity-90">
      {img}
    </StoreLink>
  ) : (
    img
  );

  // A capped picture is centred in its column rather than pinned to one side,
  // so a row of icons or logos reads as a row. Uncapped, nothing wraps it and
  // the markup is exactly what it always was.
  if (!maxWidth) return linked;
  return (
    <div className="mx-auto w-full" style={{ maxWidth }}>
      {linked}
    </div>
  );
}

export function GalleryElement({ props }: { props: Props }) {
  const images = strList(props, "images").map(safeUrl).filter((u): u is string => u !== null);
  if (images.length === 0) return null;
  const title = str(props, "title");

  // "slideshow" is the one other layout; anything else (including the
  // default-less props an old page-tree carries) is the grid this always was.
  if (str(props, "layout", "grid") === "slideshow") {
    return <GallerySlideshow images={images} title={title} />;
  }

  const columns = num(props, "columns", 3, 1, 6);
  // "whole" shows each picture complete inside its square instead of cropping
  // it to fill — what a strip of logos or icons needs. Anything else, including
  // the galleries written before this existed, crops as it always did.
  const whole = str(props, "fit", "crop") === "whole";

  return (
    <div>
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      <div className={`grid gap-3 ${COLUMN_CLASS[columns]}`}>
        {images.map((src, i) => (
          <StoreImage
            key={`${src}-${i}`}
            src={src}
            alt=""
            width={600}
            height={600}
            sizes="(max-width: 768px) 50vw, 33vw"
            loading="lazy"
            decoding="async"
            className={`zt-img aspect-square w-full rounded-2xl border border-line ${
              whole ? "bg-paper object-contain p-4" : "object-cover"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export const BUTTON_CLASS: Record<string, string> = {
  primary: btnPrimary,
  secondary:
    "zt-btn zt-btn-soft inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary-soft px-5 py-3 text-sm font-semibold text-primary transition-colors hover:bg-primary/15",
  outline:
    "zt-btn zt-btn-outline inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-line bg-transparent px-5 py-3 text-sm font-semibold text-ink transition-colors hover:border-primary hover:text-primary",
};

export function ButtonElement({ props }: { props: Props }) {
  const label = str(props, "label");
  if (!label.trim()) return null;
  const href = resolveHref(str(props, "href"));
  const variant = str(props, "variant", "primary");
  // `self-start` because a column is a stretching flex container — without it a
  // button would run the full width of the column instead of hugging its label.
  const className = `w-fit self-start ${BUTTON_CLASS[variant] ?? BUTTON_CLASS.primary}`;

  // A button with no destination is content, not a control — rendering a dead
  // anchor would just frustrate the shopper.
  if (!href) return <span className={className}>{label}</span>;
  return (
    <StoreLink href={href} className={className}>
      {label}
    </StoreLink>
  );
}

/** youtube.com/watch?v=, youtu.be/ and vimeo.com/ get a real embed; anything
 *  else is treated as a direct media file. */
function embedUrlFor(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, "");
    if (host === "youtube.com" || host === "m.youtube.com") {
      const id = parsed.searchParams.get("v");
      if (id) return `https://www.youtube.com/embed/${id}`;
      if (parsed.pathname.startsWith("/embed/")) return url;
    }
    if (host === "youtu.be") {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${id}`;
    }
    if (host === "vimeo.com") {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      if (id) return `https://player.vimeo.com/video/${id}`;
    }
  } catch {
    return null;
  }
  return null;
}

export function VideoElement({ props, t }: { props: Props; t: Dictionary }) {
  const url = safeUrl(str(props, "url"));
  if (!url) return null;
  const title = str(props, "title");
  const embed = embedUrlFor(url);

  return (
    <div>
      {title.trim() && <h3 className="mb-3 text-lg font-semibold text-ink">{title}</h3>}
      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-line bg-primary-soft">
        {embed ? (
          <iframe
            src={embed}
            title={title || t.renderer.video}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <video src={url} controls preload="metadata" className="h-full w-full">
            {t.renderer.noVideo}
          </video>
        )}
      </div>
    </div>
  );
}

export function EmbedElement({ props, t }: { props: Props; t: Dictionary }) {
  const url = safeUrl(str(props, "url"));
  if (!url) return null;
  const title = str(props, "title");
  return (
    <div>
      {title.trim() && <h3 className="mb-3 text-lg font-semibold text-ink">{title}</h3>}
      <iframe
        src={url}
        title={title || t.renderer.embedded}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="aspect-video w-full rounded-2xl border border-line"
      />
    </div>
  );
}

export function SpacerElement({ props }: { props: Props }) {
  const height = num(props, "height", 48, 4, 400);
  return <div style={{ height }} aria-hidden />;
}

export function DividerElement({ props }: { props: Props }) {
  const dashed = str(props, "style") === "dashed";
  return <hr className={`border-t border-line ${dashed ? "border-dashed" : "border-solid"}`} />;
}

/**
 * `icon.name` is a free-text field in the editor with no picker behind it, so
 * there is no fixed vocabulary to map. Rather than pull an icon library into
 * the storefront for one block, a handful of names shoppers actually see get a
 * real glyph and everything else falls back to a neutral mark — never a broken
 * or missing image.
 */
const ICON_PATHS: Record<string, string> = {
  star: "M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.6L12 17.6 6.1 20.7l1.2-6.6L2.5 9.5l6.6-.9z",
  heart:
    "M12 20.5s-7.5-4.6-7.5-9.7A4.3 4.3 0 0 1 12 8.2a4.3 4.3 0 0 1 7.5 2.6c0 5.1-7.5 9.7-7.5 9.7z",
  check: "M4.5 12.5l5 5 10-11",
  truck: "M3 7h11v9H3zM14 10h4l3 3v3h-7zM7 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 7 19zM18 19a1.6 1.6 0 1 0 0-3.2A1.6 1.6 0 0 0 18 19z",
  shield: "M12 3l7.5 3v5.5c0 4.5-3.2 8.3-7.5 9.5-4.3-1.2-7.5-5-7.5-9.5V6z",
  gift: "M3.5 9h17v3.5h-17zM5 12.5h14V20H5zM12 9v11M12 9c-2.5 0-4-1-4-2.4S9.5 4 12 9zM12 9c2.5 0 4-1 4-2.4S14.5 4 12 9z",
};

export function IconElement({ props }: { props: Props }) {
  const size = num(props, "size", 32, 8, 200);
  const name = str(props, "name").trim().toLowerCase();
  const path = ICON_PATHS[name];

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-primary"
      role={name ? "img" : "presentation"}
      aria-label={name || undefined}
    >
      {path ? <path d={path} /> : <circle cx="12" cy="12" r="8" />}
    </svg>
  );
}

export function ListElement({ props }: { props: Props }) {
  const items = strList(props, "items");
  if (items.length === 0) return null;
  const title = str(props, "title");
  return (
    <div>
      {title.trim() && <h3 className="mb-3 text-lg font-semibold text-ink">{title}</h3>}
      <ul className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2.5 text-sm leading-relaxed text-ink-soft sm:text-base">
            <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * `accordion` and `faq` carry the identical `{ title, items: [{q, a}] }` shape,
 * so they share a renderer. Native <details> means no client JS for either.
 */
function Disclosures({ title, items, t }: { title: string; items: QaItem[]; t: Dictionary }) {
  if (items.length === 0) return null;
  return (
    <div>
      {title.trim() && <h3 className="mb-4 text-xl font-semibold text-ink">{title}</h3>}
      <div className="zt-card divide-y divide-line overflow-hidden rounded-2xl border border-line bg-paper-raised">
        {items.map((item, i) => (
          <details key={i} className="group">
            <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 text-sm font-semibold text-ink [&::-webkit-details-marker]:hidden">
              {item.q || t.renderer.item(i + 1)}
              <ChevronIcon size={18} className="shrink-0 text-ink-soft transition-transform group-open:rotate-180" />
            </summary>
            {item.a.trim() && (
              <p className="whitespace-pre-line px-5 pb-4 text-sm leading-relaxed text-ink-soft">{item.a}</p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

export function AccordionElement({ props, t }: { props: Props; t: Dictionary }) {
  return <Disclosures title={str(props, "title")} items={qaList(props, "items")} t={t} />;
}

export function FaqElement({ props, t }: { props: Props; t: Dictionary }) {
  return <Disclosures title={str(props, "title")} items={qaList(props, "items")} t={t} />;
}

export function TestimonialElement({ props, t }: { props: Props; t: Dictionary }) {
  const quote = str(props, "quote");
  const author = str(props, "author");
  if (!quote.trim() && !author.trim()) return null;
  const rating = num(props, "rating", 0, 0, 5);

  return (
    <figure className="zt-card rounded-2xl border border-line bg-paper-raised p-6">
      {rating > 0 && (
        <p className="mb-3 text-primary" aria-label={t.renderer.rating(rating)}>
          <span aria-hidden>{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>
        </p>
      )}
      {quote.trim() && (
        <blockquote className="whitespace-pre-line text-base leading-relaxed text-ink">&ldquo;{quote}&rdquo;</blockquote>
      )}
      {author.trim() && <figcaption className="mt-4 text-sm font-semibold text-ink-soft">— {author}</figcaption>}
    </figure>
  );
}

export function CountdownElement({ props }: { props: Props }) {
  return (
    <Countdown label={str(props, "label")} endsAt={str(props, "endsAt") || null} endsInHours={num(props, "endsInHours", 24, 1, 8760)} />
  );
}

/**
 * The `form` element: name, phone, email and message, sent to the store's
 * form submissions (and the sender becomes a contact). Props: `title`,
 * `submitLabel`, `successMessage`, `askConsent`, and `tags` — read by the
 * server from the published page, never sent by the browser.
 */
export function FormElement({
  props,
  t,
  workspaceId,
  elementId,
  disabled,
}: {
  props: Props;
  t: Dictionary;
  workspaceId: string;
  elementId: string;
  disabled?: boolean;
}) {
  return (
    <PageForm
      workspaceId={workspaceId}
      elementId={elementId}
      disabled={disabled}
      title={str(props, "title")}
      submitLabel={str(props, "submitLabel", t.renderer.formSend)}
      successMessage={str(props, "successMessage")}
      askConsent={props.askConsent !== false}
      extra={{
        fields: strList(props, "extraFields").slice(0, 8),
        choiceLabel: str(props, "choiceLabel"),
        choices: strList(props, "choices").slice(0, 20),
        checkboxLabel: str(props, "checkboxLabel"),
      }}
      inputs={{ fileLabel: str(props, "fileLabel").trim(), fileRequired: props.fileRequired === true, ratingLabel: str(props, "ratingLabel").trim() }}
      labels={{
        name: t.renderer.formName,
        phone: t.renderer.formPhone,
        email: t.renderer.formEmail,
        message: t.renderer.formMessage,
        send: t.renderer.formSend,
        sending: t.renderer.formSending,
        sent: t.renderer.formSent,
        error: t.renderer.formError,
        invalidPhone: t.renderer.formInvalidPhone,
        needContact: t.renderer.formNeedContact,
        consent: t.renderer.formConsent,
      }}
    />
  );
}

/**
 * `map` renders the address plus a link out to a map, rather than an embedded
 * one: no map provider key is configured anywhere in this project, and a keyless
 * embed renders as a grey error tile on the merchant's live storefront.
 */
export function MapElement({ props, t }: { props: Props; t: Dictionary }) {
  const address = str(props, "address");
  if (!address.trim()) return null;
  const query = encodeURIComponent(address);

  return (
    <div className="zt-card rounded-2xl border border-line bg-paper-raised p-6">
      <p className="text-sm leading-relaxed text-ink">{address}</p>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
      >
        {t.renderer.openInMaps}
        <span aria-hidden className="rtl:-scale-x-100">
          ↗
        </span>
      </a>
    </div>
  );
}

/**
 * Platform names are free text in the editor, so these render as labelled
 * links rather than brand glyphs — a name the storefront doesn't recognise
 * still reads correctly instead of showing a blank square.
 */
export function SocialIconsElement({ props, t }: { props: Props; t: Dictionary }) {
  const links: LinkItem[] = linkList(props, "links");
  if (links.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((link, i) => {
        const href = safeUrl(link.url);
        const label = link.platform.trim() || t.renderer.link;
        if (!href) return null;
        return (
          <li key={`${link.url}-${i}`}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="zt-chip inline-flex min-h-11 items-center rounded-full border border-line px-4 text-sm font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
            >
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
