import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { cn } from "cn";
import { FONT_CATEGORIES, fontFitsRole, type FontCategory, type FontOption, type FontRole } from "../fonts";
import { loadPreviewFont, previewFamily } from "./previewFonts";
import { FONT_PICKER_STRINGS, fill, type FontPickerLocale } from "./strings";

/**
 * Picks one font from the store font catalog for one script — the store's
 * Arabic face, or its English one — or "the store default" (null).
 *
 * A button shows the current pick in its own face; pressing it opens a panel
 * with a search box, the styles (sans, serif, kufi, naskh…) and which letters
 * a font has, and the list. The search box is a combobox over the list:
 * ↑/↓, Home/End and Page Up/Down move through it, Enter picks, Escape closes
 * and gives the focus back to the button. Every row is drawn in its own face,
 * loaded only once the row scrolls into view or is pointed at
 * (previewFonts.ts) — never the whole catalog at once.
 *
 * The labels come in Arabic and English (`locale`); the layout follows the
 * document direction (logical properties only); every target is at least
 * 44px tall.
 */

export interface FontPickerProps {
  /** The catalog (GET /fonts); null while it loads. */
  fonts: readonly FontOption[] | null;
  /** Which letters the pick is for. Only fonts with those letters are offered. */
  role: FontRole;
  /** The picked font's id; null is "the store default". */
  value: string | null;
  onChange: (id: string | null) => void;
  locale: FontPickerLocale;
  label: string;
  hint?: string;
  /** What "store default" stands for here, shown beside it (a font's name, or a level above this one). */
  defaultName?: string | null;
  disabled?: boolean;
  className?: string;
}

type ScriptFilter = "all" | "only" | "both";

const PAGE = 8;

export function FontPicker({ fonts, role, value, onChange, locale, label, hint, defaultName, disabled = false, className }: FontPickerProps) {
  const t = FONT_PICKER_STRINGS[locale];
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const triggerId = `${baseId}-trigger`;
  const listId = `${baseId}-list`;
  const hintId = `${baseId}-hint`;
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FontCategory | "all">("all");
  const [script, setScript] = useState<ScriptFilter>("all");
  const [active, setActive] = useState(0);

  const eligible = useMemo(() => (fonts ?? []).filter((font) => fontFitsRole(font, role)), [fonts, role]);
  const selected = value ? (eligible.find((font) => font.id === value) ?? null) : null;
  const categories = useMemo(() => FONT_CATEGORIES.filter((c) => eligible.some((font) => font.category === c)), [eligible]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return eligible.filter(
      (font) =>
        (category === "all" || font.category === category) &&
        (script === "all" || (script === "both" ? font.script === "both" : font.script !== "both")) &&
        (q === "" || font.family.toLowerCase().includes(q) || font.id.includes(q) || t.category[font.category].toLowerCase().includes(q))
    );
  }, [eligible, category, script, query, t]);

  // Row 0 is "store default"; rows 1… the fonts.
  const rowCount = filtered.length + 1;
  const optionId = (index: number) => `${baseId}-opt-${index}`;
  const activeIndex = Math.min(active, rowCount - 1);

  // The picked font's own face on the button.
  useEffect(() => {
    if (selected) void loadPreviewFont(selected);
  }, [selected]);

  // Opening: the search box takes the focus, the list starts at the pick.
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const at = value ? filtered.findIndex((font) => font.id === value) + 1 : 0;
    setActive(Math.max(at, 0));
    // Only when the panel opens: later filtering keeps the row the merchant moved to.
  }, [open]);

  // The active row stays in view.
  useEffect(() => {
    if (!open) return;
    const row = document.getElementById(optionId(activeIndex));
    if (row && typeof row.scrollIntoView === "function") row.scrollIntoView({ block: "nearest" });
    // optionId only reads baseId, which never changes.
  }, [activeIndex, open]);

  // A press outside the picker closes it.
  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  function close(focusTrigger = true) {
    setOpen(false);
    setQuery("");
    if (focusTrigger) triggerRef.current?.focus();
  }

  function pick(index: number) {
    onChange(index === 0 ? null : (filtered[index - 1]?.id ?? null));
    close();
  }

  function onSearchKey(event: KeyboardEvent<HTMLInputElement>) {
    const move = (to: number) => {
      event.preventDefault();
      setActive(Math.max(0, Math.min(rowCount - 1, to)));
    };
    switch (event.key) {
      case "ArrowDown":
        return move(activeIndex + 1);
      case "ArrowUp":
        return move(activeIndex - 1);
      case "PageDown":
        return move(activeIndex + PAGE);
      case "PageUp":
        return move(activeIndex - PAGE);
      case "Home":
        return move(0);
      case "End":
        return move(rowCount - 1);
      case "Enter":
        event.preventDefault();
        return pick(activeIndex);
      case "Escape":
        event.preventDefault();
        return close();
    }
  }

  const defaultText = defaultName ? fill(t.storeDefaultNamed, { name: defaultName }) : t.storeDefault;
  const chip = (pressed: boolean) =>
    cn(
      "inline-flex min-h-11 shrink-0 cursor-pointer items-center rounded-full px-3 text-sm whitespace-nowrap ring-1 ring-inset transition-colors",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      pressed ? "bg-primary text-on-primary ring-primary" : "bg-paper text-ink ring-line hover:bg-paper-sunken"
    );

  return (
    <div ref={rootRef} className={cn("relative space-y-1.5", className)} data-slot="font-picker">
      <span id={labelId} className="block text-sm font-medium text-ink">
        {label}
      </span>
      <div className="flex items-stretch gap-2">
        <button
          ref={triggerRef}
          id={triggerId}
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          aria-labelledby={`${labelId} ${triggerId}`}
          aria-describedby={hint ? hintId : undefined}
          onClick={() => (open ? close(false) : setOpen(true))}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown" && !open) {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={cn(
            "flex min-h-11 min-w-0 flex-1 cursor-pointer items-center justify-between gap-2 rounded-[0.5rem] bg-paper px-3 text-start text-ink ring-1 ring-line ring-inset",
            "hover:bg-paper-sunken focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-60"
          )}
        >
          <span className="min-w-0 truncate text-base" style={selected ? { fontFamily: previewStack(selected.id) } : undefined}>
            {fonts === null ? t.loading : selected ? selected.family : defaultText}
          </span>
          <ChevronDown className="size-4 shrink-0 text-ink-soft" aria-hidden />
        </button>
        {value && !disabled && (
          <button
            type="button"
            onClick={() => onChange(null)}
            aria-label={`${t.useDefault} — ${label}`}
            title={t.useDefault}
            className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[0.5rem] text-ink-soft ring-1 ring-line ring-inset hover:bg-paper-sunken hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>
      {hint && (
        <p id={hintId} className="text-xs text-ink-soft">
          {hint}
        </p>
      )}

      {open && (
        <div
          role="dialog"
          aria-labelledby={labelId}
          className="absolute inset-x-0 top-full z-50 mt-1 overflow-hidden rounded-[0.75rem] bg-paper-raised text-ink shadow-xl ring-1 ring-line"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            }
          }}
        >
          <div className="space-y-2 border-b border-line p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" aria-hidden />
              <input
                ref={searchRef}
                type="search"
                role="combobox"
                aria-label={t.searchLabel}
                aria-expanded
                aria-controls={listId}
                aria-autocomplete="list"
                aria-activedescendant={optionId(activeIndex)}
                placeholder={t.search}
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setActive(0);
                }}
                onKeyDown={onSearchKey}
                className="min-h-11 w-full rounded-[0.5rem] bg-paper ps-9 pe-3 text-sm text-ink ring-1 ring-line ring-inset placeholder:text-ink-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              />
            </div>
            <div role="group" aria-label={t.categories} className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
              {(["all", ...categories] as const).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={category === c}
                  className={chip(category === c)}
                  onClick={() => {
                    setCategory(c);
                    setActive(0);
                  }}
                >
                  {c === "all" ? t.allCategories : t.category[c]}
                </button>
              ))}
            </div>
            <div role="group" aria-label={t.scripts} className="-mx-2 flex gap-1.5 overflow-x-auto px-2 pb-1">
              {(["all", "only", "both"] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={script === s}
                  className={chip(script === s)}
                  onClick={() => {
                    setScript(s);
                    setActive(0);
                  }}
                >
                  {s === "all" ? t.scriptAll : s === "both" ? t.scriptBoth : role === "ar" ? t.scriptOnlyAr : t.scriptOnlyEn}
                </button>
              ))}
            </div>
          </div>

          <ul ref={listRef} id={listId} role="listbox" aria-labelledby={labelId} className="max-h-[min(22rem,55vh)] overflow-y-auto overscroll-contain p-1">
            <li
              id={optionId(0)}
              role="option"
              aria-selected={value === null}
              data-active={activeIndex === 0 ? "" : undefined}
              onPointerMove={() => setActive(0)}
              onClick={() => pick(0)}
              className={rowClass(activeIndex === 0)}
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium">{t.useDefault}</span>
                {defaultName && <span className="block text-xs text-ink-soft">{defaultText}</span>}
              </span>
              {value === null && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
            </li>
            {filtered.map((font, i) => (
              <FontRow
                key={font.id}
                font={font}
                id={optionId(i + 1)}
                active={activeIndex === i + 1}
                selected={font.id === value}
                categoryLabel={t.category[font.category]}
                root={listRef}
                onHover={() => setActive(i + 1)}
                onPick={() => pick(i + 1)}
              />
            ))}
          </ul>
          {fonts !== null && filtered.length === 0 && <p className="px-3 pb-3 text-sm text-ink-soft">{t.none}</p>}
          <p className="sr-only" aria-live="polite">
            {fonts === null ? t.loading : fill(t.count, { n: filtered.length })}
          </p>
        </div>
      )}
    </div>
  );
}

/** A row's face, then a generic one for any letter its preview doesn't cover. (`inherit` is not allowed inside a list.) */
function previewStack(id: string): string {
  return `"${previewFamily(id)}", system-ui, sans-serif`;
}

function rowClass(active: boolean): string {
  return cn(
    "flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.5rem] px-3 py-2 text-ink",
    active ? "bg-paper-sunken ring-1 ring-primary ring-inset" : "hover:bg-paper-sunken"
  );
}

/** One font, drawn in its own face once it is on screen or pointed at. */
function FontRow({
  font,
  id,
  active,
  selected,
  categoryLabel,
  root,
  onHover,
  onPick,
}: {
  font: FontOption;
  id: string;
  active: boolean;
  selected: boolean;
  categoryLabel: string;
  root: React.RefObject<HTMLUListElement | null>;
  onHover: () => void;
  onPick: () => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let live = true;
    const load = () => void loadPreviewFont(font).then((ok) => live && ok && setReady(true));
    if (active) load();
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return () => void (live = false);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          load();
          observer.disconnect();
        }
      },
      { root: root.current, rootMargin: "120px 0px" }
    );
    observer.observe(el);
    return () => {
      live = false;
      observer.disconnect();
    };
  }, [font, active, root]);

  const face = ready ? { fontFamily: previewStack(font.id) } : undefined;
  return (
    <li
      ref={ref}
      id={id}
      role="option"
      aria-selected={selected}
      data-active={active ? "" : undefined}
      data-font={font.id}
      onPointerMove={onHover}
      onPointerEnter={() => void loadPreviewFont(font).then((ok) => ok && setReady(true))}
      onClick={onPick}
      className={rowClass(active)}
    >
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline justify-between gap-2">
          <span className="truncate text-base" style={face} lang="en" dir="ltr">
            {font.family}
          </span>
          <span className="shrink-0 text-xs text-ink-soft">{categoryLabel}</span>
        </span>
        <span className="block truncate text-sm text-ink-soft" style={face} dir="auto">
          {font.preview}
        </span>
      </span>
      {selected && <Check className="size-4 shrink-0 text-primary" aria-hidden />}
    </li>
  );
}
