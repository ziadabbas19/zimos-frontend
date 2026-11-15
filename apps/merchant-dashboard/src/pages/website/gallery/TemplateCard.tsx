import { useEffect, useRef, useState } from "react";
import type { WebsiteTemplateSummary } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { IconCheck } from "@/components/icons";
import { TemplateLivePreview } from "@/components/TemplateLivePreview";
import { useMediaQuery } from "@/components/report/useMediaQuery";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCodeLabel } from "./codes";
import { TemplatePlaceholder } from "./TemplatePlaceholder";
import { useTemplatePreviewTheme, withTemplateTheme } from "./templateLook";

const STRINGS = {
  en: { previewOf: "Preview {name}", current: "Current" },
  ar: { previewOf: "معاينة {name}", current: "الحالي" },
} satisfies Messages;

/** Tailwind's `lg`, where the card's box (its `lg:` class below) turns landscape. */
const WIDE_CARD_QUERY = "(min-width: 64rem)";

/**
 * A template's picture in a box of a fixed shape, so the grid never moves
 * when a picture arrives: 3:4 below `lg`, 16:10 from it. The template's own
 * thumbnail when it has one and it loads (asked for only near the viewport,
 * cropped from the top to the box); otherwise the top of its home page as the
 * storefront renders it — on a phone in the 3:4 box, on a desktop in the
 * 16:10 one — lazily, a couple at a time (TemplateLivePreview), over a sketch
 * that stays if neither can be had.
 */
function TemplateThumb({ template }: { template: WebsiteTemplateSummary }) {
  const workspaceId = useWorkspaceId();
  const theme = useTemplatePreviewTheme(template);
  const wide = useMediaQuery(WIDE_CARD_QUERY);
  const url = template.thumbnailUrl;
  const [image, setImage] = useState<"loading" | "ok" | "broken">(url ? "loading" : "broken");
  const imageRef = useRef<HTMLImageElement>(null);

  // A picture already in the browser's cache may have finished before React listened.
  useEffect(() => {
    const el = imageRef.current;
    if (el && el.complete && el.naturalWidth > 0) setImage("ok");
  }, []);

  return (
    <div className="relative aspect-[3/4] w-full overflow-hidden bg-paper-sunken lg:aspect-[16/10]">
      {url && image !== "broken" ? (
        <>
          {image === "loading" && <TemplatePlaceholder color={template.primaryColor} title={template.name} className="absolute inset-0" />}
          {/* Decorative: the card's button names the template. */}
          <img
            ref={imageRef}
            src={url}
            alt=""
            loading="lazy"
            decoding="async"
            onLoad={() => setImage("ok")}
            onError={() => setImage("broken")}
            className={cn(
              "absolute inset-0 h-full w-full object-cover object-top transition-opacity duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              image === "ok" ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : (
        <TemplateLivePreview
          workspaceId={workspaceId}
          templateId={template.id}
          theme={theme}
          themeFrom={withTemplateTheme}
          title={template.name}
          aspect={wide ? "16/10" : "3/4"}
          cardLayout={wide ? "desktop" : "mobile"}
          fallback={<TemplatePlaceholder color={template.primaryColor} title={template.name} />}
        />
      )}
    </div>
  );
}

/**
 * One template in the grid: its picture, its name, its kind, and «الحالي» on
 * the one the store's site started from. The whole card is one press — it
 * opens the template's sheet (TemplateSheet) — but it is a list item holding a
 * button, not one big button: a button cannot hold the preview frame. The
 * button's ::after covers the card.
 *
 * Structure and motion (2px lift under a pointer, pressed at 97%) are here;
 * the pane, its rim and the glow of the current one are in glass/website.css.
 */
export function TemplateCard({
  template,
  current = false,
  onOpen,
}: {
  template: WebsiteTemplateSummary;
  /** The store's current site was made from this template. */
  current?: boolean;
  onOpen: () => void;
}) {
  const t = useT(STRINGS);
  const codeLabel = useCodeLabel();

  return (
    <li
      data-slot="template-card"
      data-current={current ? "" : undefined}
      className={cn(
        "zimos-template-card relative flex min-w-0 flex-col overflow-hidden rounded-[1.25rem] bg-paper-raised shadow-[var(--shadow-card)] ring-1",
        current ? "ring-primary" : "ring-line",
        "transition-[translate,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        "hover:-translate-y-0.5 active:scale-[0.97] motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100",
        "has-[button:focus-visible]:outline-2 has-[button:focus-visible]:outline-offset-2 has-[button:focus-visible]:outline-primary"
      )}
    >
      <div className="relative">
        <TemplateThumb template={template} />
        {current && (
          <span
            data-slot="template-current"
            className="zimos-template-current absolute start-2 top-2 inline-flex h-6 items-center gap-1 rounded-full bg-primary ps-1.5 pe-2.5 text-xs leading-none font-semibold text-primary-foreground shadow-[var(--shadow-card)]"
          >
            <IconCheck className="size-3.5" aria-hidden />
            {t.current}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col gap-0.5 border-t border-line px-3 pt-2.5 pb-3">
        <button
          type="button"
          onClick={onOpen}
          aria-haspopup="dialog"
          aria-label={fmt(t.previewOf, { name: template.name })}
          className="block w-full min-w-0 cursor-pointer truncate text-start text-sm leading-5 font-semibold text-ink outline-none after:absolute after:inset-0 after:content-['']"
        >
          {template.name}
        </button>
        {template.category && (
          <span data-slot="template-kind" className="block truncate text-xs leading-4 text-ink-soft">
            {codeLabel("category", template.category)}
          </span>
        )}
      </div>
    </li>
  );
}
