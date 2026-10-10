import { forwardRef, useId, useState, type ReactNode } from "react";
import { cn } from "@store-builder/ui";
import { IconLink, IconWarning, type Icon, type IconProps } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { useEditorLocale } from "../editorLocale";
import { useInspectorEnv, type ContentLanguage } from "./env";
import { inspectorUi, type InspectorUi } from "./strings";

/**
 * Two things every content field may need: both languages of a text or a
 * picture, and a link said in words.
 */

// --- both languages ----------------------------------------------------------

const LANGUAGES: readonly ContentLanguage[] = ["ar", "en"];

/** The hollow ring on a language that has nothing written yet (drawn where a segment's icon goes). */
const EmptyMark: Icon = forwardRef<SVGSVGElement, IconProps>(function EmptyMark({ color, size, ...svg }, ref) {
  void color;
  void size;
  return (
    <svg ref={ref} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" {...svg}>
      <circle cx="8" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
});

export interface LanguageSlot {
  /** Names the input: the language beside its twin, or "field — language" when it stands alone. */
  label: string;
  /** True when a switch above already says which language this is. */
  labelHidden: boolean;
  dir: "rtl" | "ltr";
}

/**
 * A field that holds Arabic and English content. The two values are stored as
 * they always were (two props: `title` and `titleEn`); this only lays their
 * inputs out.
 *
 *  - Wide panel: the two inputs side by side, «عربي» then "English", each in
 *    its own direction.
 *  - A panel under 20rem, or the phone sheet: ONE input and a small language
 *    switch above it. A ring on a language says it is still empty. The switch
 *    is shared by every such field in the panel, so choosing English once
 *    shows the English of all of them.
 */
export function BilingualField({
  label,
  hint,
  filled,
  images = false,
  children,
}: {
  label: string;
  hint?: string;
  /** Whether each language holds something yet. */
  filled: Record<ContentLanguage, boolean>;
  /** Two picture wells need more room than two text boxes. */
  images?: boolean;
  children: (language: ContentLanguage, slot: LanguageSlot) => ReactNode;
}) {
  const t = inspectorUi(useEditorLocale());
  const env = useInspectorEnv();
  const groupId = useId();
  const [own, setOwn] = useState<ContentLanguage>("ar");
  const language = env.contentLanguage ?? own;
  const setLanguage = env.setContentLanguage ?? setOwn;
  const name = (l: ContentLanguage) => (l === "ar" ? t.arabic : t.english);
  const dirOf = (l: ContentLanguage) => (l === "ar" ? "rtl" : "ltr");
  const single = env.compact || (images && !env.pairImages);

  if (!single) {
    return (
      <div role="group" aria-labelledby={groupId} data-slot="inspector-bilingual" className="space-y-1.5">
        <p id={groupId} className="text-sm leading-5 font-medium text-ink">
          {label}
        </p>
        <div className={cn("grid grid-cols-2 gap-2", images ? "items-start" : "items-end")}>
          {LANGUAGES.map((l) => (
            <div key={l} className="min-w-0">
              {children(l, { label: name(l), labelHidden: false, dir: dirOf(l) })}
            </div>
          ))}
        </div>
        {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
      </div>
    );
  }

  const empty = LANGUAGES.filter((l) => !filled[l]);
  return (
    <div role="group" aria-labelledby={groupId} data-slot="inspector-bilingual" className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
        <p id={groupId} className="min-w-0 text-sm leading-5 font-medium text-ink">
          {label}
        </p>
        <Segmented
          size="sm"
          value={language}
          onChange={setLanguage}
          label={t.languageOf(label)}
          options={LANGUAGES.map((l) => ({ value: l, label: name(l), icon: filled[l] ? undefined : EmptyMark }))}
        />
      </div>
      {children(language, { label: t.inLanguage(label, name(language)), labelHidden: true, dir: dirOf(language) })}
      {empty.length > 0 && <p className="sr-only">{empty.map((l) => t.stillEmpty(name(l))).join(t.joiner)}</p>}
      {hint && <p className="text-xs leading-5 text-ink-soft">{hint}</p>}
    </div>
  );
}

/**
 * Pairs each field with its English twin: `title` + `titleEn` become one
 * entry, everything else stays alone. The twin is taken only when it is the
 * same kind of field, and never drawn a second time on its own.
 */
export function pairByLanguage<F extends { key: string; kind: string }>(fields: readonly F[], pairable: readonly string[]): Array<{ field: F; english: F | null }> {
  const byKey = new Map<string, F>(fields.map((f): [string, F] => [f.key, f]));
  const twins = new Set<string>();
  const out: Array<{ field: F; english: F | null }> = [];
  for (const field of fields) {
    const twin = byKey.get(`${field.key}En`);
    if (twin && twin.kind === field.kind && pairable.includes(field.kind)) twins.add(twin.key);
  }
  for (const field of fields) {
    if (twins.has(field.key)) continue;
    const twin = byKey.get(`${field.key}En`);
    out.push({ field, english: twin && twins.has(twin.key) ? twin : null });
  }
  return out;
}

// --- a link, in words --------------------------------------------------------

/** Props that hold where a button or a picture sends the shopper. */
export function isLinkKey(key: string): boolean {
  return /href$/i.test(key);
}

function decoded(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/** What an address means to a merchant: «الصفحة الرئيسية», «موقع تاني: instagram.com». Null for an empty one. */
export function describeLink(raw: string, t: InspectorUi): { words: string; unclear: boolean } | null {
  const href = raw.trim();
  if (!href) return null;
  const ok = (words: string) => ({ words, unclear: false });
  const unclear = { words: t.linkUnclear, unclear: true };

  if (/^#popup-./i.test(href)) return ok(t.linkPopup(href.slice(7)));
  if (href.startsWith("#")) return href.length > 1 ? ok(t.linkAnchor(href.slice(1))) : unclear;
  if (/^tel:/i.test(href)) return ok(t.linkPhone(href.slice(4)));
  if (/^mailto:/i.test(href)) return ok(t.linkEmail(href.slice(7).split("?")[0] ?? ""));
  if (/^https?:\/\//i.test(href)) {
    let host = href;
    try {
      host = new URL(href).hostname.replace(/^www\./, "");
    } catch {
      /* shown as typed */
    }
    if (/(^|\.)wa\.me$|(^|\.)whatsapp\.com$/i.test(host)) return ok(t.linkWhatsApp);
    return ok(t.linkExternal(host));
  }
  if (!href.startsWith("/")) return unclear;

  if (href.includes("collection=")) return ok(t.linkCollection);
  const path = (href.split(/[?#]/)[0] ?? "").replace(/\/+$/, "") || "/";
  if (path === "/") return ok(t.linkHome);
  if (path === "/products") return ok(t.linkProducts);
  if (path.startsWith("/products/")) return ok(t.linkProduct(decoded(path.slice("/products/".length))));
  if (path === "/cart") return ok(t.linkCart);
  if (path === "/checkout") return ok(t.linkCheckout);
  if (path === "/track") return ok(t.linkTrack);
  if (path === "/blog") return ok(t.linkBlog);
  return ok(t.linkPage(decoded(path)));
}

/**
 * Under a link field: where the address goes, in words. While the field is
 * empty and `onPick` is given, three one-tap addresses instead.
 */
export function LinkTargetNote({ href, onPick }: { href: string; onPick?: (href: string) => void }) {
  const t = inspectorUi(useEditorLocale());
  const described = describeLink(href, t);

  if (described) {
    const Glyph = described.unclear ? IconWarning : IconLink;
    return (
      <p className={cn("flex items-start gap-1.5 text-xs leading-5", described.unclear ? "text-accent-dark" : "text-ink-soft")}>
        <Glyph className="mt-[3px] size-3.5 shrink-0" aria-hidden />
        <span className="min-w-0 break-words" dir="auto">
          {described.words}
        </span>
      </p>
    );
  }
  if (!onPick) return null;

  const quick: Array<[string, string]> = [
    ["/", t.linkQuickHome],
    ["/products", t.linkQuickProducts],
    ["/cart", t.linkQuickCart],
  ];
  return (
    <div role="group" aria-label={t.linkQuick} className="flex flex-wrap gap-1.5">
      {quick.map(([target, words]) => (
        <button
          key={target}
          type="button"
          onClick={() => onPick(target)}
          className="inline-flex min-h-8 cursor-pointer items-center rounded-full px-3 text-xs font-medium text-ink-soft ring-1 ring-line-strong transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] ring-inset hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none"
        >
          {words}
        </button>
      ))}
    </div>
  );
}
