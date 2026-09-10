import Link from "next/link";
import { Countdown } from "./Countdown";
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

/**
 * The non-commerce half of the page-tree vocabulary — everything that renders
 * from its own props alone, with no API call. The four commerce types live in
 * `commerce.tsx` because they need real catalogue data.
 *
 * Every block returns `null` when it has nothing to show, so an element the
 * merchant added but never filled in leaves no empty box on the live page.
 */

const HEADING_CLASS: Record<number, string> = {
  1: "text-3xl sm:text-4xl",
  2: "text-2xl sm:text-3xl",
  3: "text-xl sm:text-2xl",
  4: "text-lg sm:text-xl",
  5: "text-base sm:text-lg",
  6: "text-sm sm:text-base",
};

export function HeadingElement({ props }: { props: Props }) {
  const text = str(props, "text");
  if (!text.trim()) return null;
  const level = num(props, "level", 2, 1, 6);
  const Tag = `h${level}` as "h1";
  return (
    <Tag className={`font-display font-medium text-ink ${HEADING_CLASS[level]}`}>{text}</Tag>
  );
}

/** `text` and `rich_text` are both plain strings — the editor has no formatting
 *  controls — so newlines are the only structure to preserve. */
export function TextElement({ props, large }: { props: Props; large?: boolean }) {
  const text = str(props, "text");
  if (!text.trim()) return null;
  return (
    <p
      className={`whitespace-pre-line leading-relaxed text-ink-soft ${large ? "text-base" : "text-sm sm:text-base"}`}
    >
      {text}
    </p>
  );
}

export function ImageElement({ props, workspaceId }: { props: Props; workspaceId: string }) {
  const src = safeUrl(str(props, "src"));
  if (!src) return null;
  const alt = str(props, "alt");
  const href = resolveHref(str(props, "href"), workspaceId);

  const img = (
    // Merchant images are arbitrary remote URLs (the media host is configurable
    // per deployment), which next/image would need an allowlist for.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      loading="lazy"
      className="w-full rounded-[var(--radius-card)] object-cover"
    />
  );

  if (!href) return img;
  return (
    <Link href={href} className="block transition-opacity hover:opacity-90">
      {img}
    </Link>
  );
}

export function GalleryElement({ props }: { props: Props }) {
  const images = strList(props, "images").map(safeUrl).filter((u): u is string => u !== null);
  if (images.length === 0) return null;
  const columns = num(props, "columns", 3, 1, 6);
  const title = str(props, "title");

  return (
    <div>
      {title.trim() && (
        <h3 className="mb-3 font-display text-xl font-medium text-ink">{title}</h3>
      )}
      <div className={`grid gap-3 ${COLUMN_CLASS[columns]}`}>
        {images.map((src, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${src}-${i}`}
            src={src}
            alt=""
            loading="lazy"
            className="aspect-square w-full rounded-[var(--radius-card)] object-cover"
          />
        ))}
      </div>
    </div>
  );
}

const BUTTON_CLASS: Record<string, string> = {
  primary: "bg-primary text-paper-raised hover:bg-primary-dark",
  secondary: "bg-accent text-ink hover:bg-accent-dark",
  outline: "border border-line bg-transparent text-ink hover:border-primary hover:text-primary-dark",
};

export function ButtonElement({ props, workspaceId }: { props: Props; workspaceId: string }) {
  const label = str(props, "label");
  if (!label.trim()) return null;
  const href = resolveHref(str(props, "href"), workspaceId);
  const variant = str(props, "variant", "primary");
  // `self-start` because a column is a stretching flex container — without it a
  // button would run the full width of the column instead of hugging its label.
  const className = `inline-flex w-fit self-start items-center justify-center rounded-[0.5rem] px-5 py-2.5 text-sm font-medium transition-colors ${
    BUTTON_CLASS[variant] ?? BUTTON_CLASS.primary
  }`;

  // A button with no destination is content, not a control — rendering a dead
  // anchor would just frustrate the shopper.
  if (!href) return <span className={className}>{label}</span>;
  return (
    <Link href={href} className={className}>
      {label}
    </Link>
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

export function VideoElement({ props }: { props: Props }) {
  const url = safeUrl(str(props, "url"));
  if (!url) return null;
  const title = str(props, "title");
  const embed = embedUrlFor(url);

  return (
    <div>
      {title.trim() && (
        <h3 className="mb-2 font-display text-lg font-medium text-ink">{title}</h3>
      )}
      <div className="aspect-video w-full overflow-hidden rounded-[var(--radius-card)] bg-primary-soft">
        {embed ? (
          <iframe
            src={embed}
            title={title || "Video"}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <video src={url} controls preload="metadata" className="h-full w-full">
            Your browser can&rsquo;t play this video.
          </video>
        )}
      </div>
    </div>
  );
}

export function EmbedElement({ props }: { props: Props }) {
  const url = safeUrl(str(props, "url"));
  if (!url) return null;
  const title = str(props, "title");
  return (
    <div>
      {title.trim() && (
        <h3 className="mb-2 font-display text-lg font-medium text-ink">{title}</h3>
      )}
      <iframe
        src={url}
        title={title || "Embedded content"}
        loading="lazy"
        referrerPolicy="no-referrer"
        className="aspect-video w-full rounded-[var(--radius-card)] border border-line"
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
      {title.trim() && (
        <h3 className="mb-2 font-display text-lg font-medium text-ink">{title}</h3>
      )}
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-ink-soft">
            <span className="mt-2 size-1.5 shrink-0 rounded-full bg-primary" aria-hidden />
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
function Disclosures({ title, items }: { title: string; items: QaItem[] }) {
  if (items.length === 0) return null;
  return (
    <div>
      {title.trim() && (
        <h3 className="mb-3 font-display text-xl font-medium text-ink">{title}</h3>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised">
        {items.map((item, i) => (
          <details key={i} className="group">
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-ink marker:hidden">
              <span className="flex items-center justify-between gap-3">
                {item.q || `Item ${i + 1}`}
                <span
                  className="shrink-0 text-ink-soft transition-transform group-open:rotate-180"
                  aria-hidden
                >
                  ▾
                </span>
              </span>
            </summary>
            {item.a.trim() && (
              <p className="whitespace-pre-line px-4 pb-3 text-sm leading-relaxed text-ink-soft">
                {item.a}
              </p>
            )}
          </details>
        ))}
      </div>
    </div>
  );
}

export function AccordionElement({ props }: { props: Props }) {
  return <Disclosures title={str(props, "title")} items={qaList(props, "items")} />;
}

export function FaqElement({ props }: { props: Props }) {
  return <Disclosures title={str(props, "title")} items={qaList(props, "items")} />;
}

export function TestimonialElement({ props }: { props: Props }) {
  const quote = str(props, "quote");
  const author = str(props, "author");
  if (!quote.trim() && !author.trim()) return null;
  const rating = num(props, "rating", 0, 0, 5);

  return (
    <figure className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
      {rating > 0 && (
        <p className="mb-2 text-accent" aria-label={`${rating} out of 5`}>
          <span aria-hidden>{"★".repeat(rating) + "☆".repeat(5 - rating)}</span>
        </p>
      )}
      {quote.trim() && (
        <blockquote className="whitespace-pre-line text-base leading-relaxed text-ink">
          &ldquo;{quote}&rdquo;
        </blockquote>
      )}
      {author.trim() && (
        <figcaption className="mt-3 text-sm font-medium text-ink-soft">— {author}</figcaption>
      )}
    </figure>
  );
}

export function CountdownElement({ props }: { props: Props }) {
  return (
    <Countdown
      label={str(props, "label")}
      endsInHours={num(props, "endsInHours", 24, 1, 8760)}
    />
  );
}

/**
 * The `form` element is presentational only, and says so on the page.
 *
 * Two reasons it cannot submit: the element carries no field definitions at all
 * (its props are just `{ title, submitLabel }`), and the backend exposes no
 * endpoint for generic form submissions — there is nothing to POST to. Showing
 * a working-looking form would quietly drop every enquiry a shopper sends, so
 * the submit button stays disabled and the notice below is deliberate, not
 * placeholder text to tidy away later.
 */
export function FormElement({ props }: { props: Props }) {
  const title = str(props, "title");
  const submitLabel = str(props, "submitLabel", "Send");

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
      {title.trim() && (
        <h3 className="mb-3 font-display text-xl font-medium text-ink">{title}</h3>
      )}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-sm text-ink-soft" htmlFor="page-form-name">
            Name
          </label>
          <input
            id="page-form-name"
            type="text"
            disabled
            className="h-10 w-full rounded-[0.5rem] border border-line bg-paper px-3 text-sm text-ink disabled:opacity-70"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-soft" htmlFor="page-form-email">
            Email
          </label>
          <input
            id="page-form-email"
            type="email"
            disabled
            className="h-10 w-full rounded-[0.5rem] border border-line bg-paper px-3 text-sm text-ink disabled:opacity-70"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-ink-soft" htmlFor="page-form-message">
            Message
          </label>
          <textarea
            id="page-form-message"
            rows={3}
            disabled
            className="w-full rounded-[0.5rem] border border-line bg-paper px-3 py-2 text-sm text-ink disabled:opacity-70"
          />
        </div>
        <button
          type="button"
          disabled
          title="Form submissions aren't available yet"
          className="w-full cursor-not-allowed rounded-[0.5rem] bg-primary px-5 py-2.5 text-sm font-medium text-paper-raised opacity-50"
        >
          {submitLabel}
        </button>
        <p className="text-xs text-ink-soft">
          This form is a preview — submissions aren&rsquo;t being collected yet.
        </p>
      </div>
    </div>
  );
}

/**
 * `map` renders the address plus a link out to a map, rather than an embedded
 * one: no map provider key is configured anywhere in this project, and a keyless
 * embed renders as a grey error tile on the merchant's live storefront.
 */
export function MapElement({ props }: { props: Props }) {
  const address = str(props, "address");
  if (!address.trim()) return null;
  const query = encodeURIComponent(address);

  return (
    <div className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
      <p className="text-sm leading-relaxed text-ink">{address}</p>
      <a
        href={`https://www.google.com/maps/search/?api=1&query=${query}`}
        target="_blank"
        rel="noreferrer noopener"
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
      >
        Open in maps
        <span aria-hidden>↗</span>
      </a>
    </div>
  );
}

/**
 * Platform names are free text in the editor, so these render as labelled
 * links rather than brand glyphs — a name the storefront doesn't recognise
 * still reads correctly instead of showing a blank square.
 */
export function SocialIconsElement({ props }: { props: Props }) {
  const links: LinkItem[] = linkList(props, "links");
  if (links.length === 0) return null;

  return (
    <ul className="flex flex-wrap gap-2">
      {links.map((link, i) => {
        const href = safeUrl(link.url);
        const label = link.platform.trim() || "Link";
        if (!href) return null;
        return (
          <li key={`${link.url}-${i}`}>
            <a
              href={href}
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center rounded-full border border-line px-3 py-1.5 text-sm text-ink-soft transition-colors hover:border-primary hover:text-primary-dark"
            >
              {label}
            </a>
          </li>
        );
      })}
    </ul>
  );
}
