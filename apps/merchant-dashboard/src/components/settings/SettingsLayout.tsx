import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useSearchParams } from "react-router-dom";
import { cn } from "@store-builder/ui";
import { IconCaretLeft, IconCaretRight, IconClose, IconSearch, type IconComponent } from "@/components/icons";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { matchScore, type Searchable } from "@/lib/search/match";
import { revealSearchTarget } from "@/lib/search/reveal";
import { SEARCH_UI_STRINGS } from "@/lib/search/searchStrings";
import { entriesInScope, isEntryShown, type SearchEntry, type SearchScope } from "@/lib/search/siteIndex";
import { usePlanLocks } from "@/lib/search/usePlanLocks";
import { SettingsIconTile, type SettingsTone } from "./SettingsPane";

const STRINGS = {
  en: {
    search: "Search settings…",
    searchLabel: "Search the sections",
    clearSearch: "Clear search",
    nothing: "Nothing by that name",
    sections: "{title}: sections",
    backTo: "Back: {title}",
  },
  ar: {
    search: "ابحث في الإعدادات…",
    searchLabel: "ابحث في الأقسام",
    clearSearch: "مسح البحث",
    nothing: "لا يوجد قسم بهذا الاسم",
    sections: "أقسام {title}",
    backTo: "رجوع: {title}",
  },
} satisfies Messages;

export interface SettingsSectionDef {
  id: string;
  label: string;
  /** One line under the label in the list on a phone, and searchable. */
  description?: string;
  icon?: IconComponent;
  /** A heading the section sits under in the list (sections with the same group are listed together, in order). */
  group?: string;
  /** Extra words the search matches (Arabic and English synonyms). */
  keywords?: string[];
  /** A small mark at the row's end: a count, "جديد", a warning dot. */
  badge?: ReactNode;
  /** A coloured tile behind the icon, like System Settings. Default "blue" (the brand). */
  tone?: SettingsTone;
}

export interface SettingsLayoutProps {
  /** The page's name, shown above the list («الإعدادات»). */
  title: string;
  sections: ReadonlyArray<SettingsSectionDef>;
  /** The section in the pane. null = none chosen: a desktop shows the first section, a phone shows the list. */
  current: string | null;
  /** The caller keeps it in the URL. null = back to the list (phone). */
  onSelect: (id: string | null) => void;
  /** Runs before a switch away from the current section; return false to stay (unsaved edits). */
  canLeave?: () => boolean | Promise<boolean>;
  searchPlaceholder?: string;
  /**
   * The page's part of the dashboard's search index (lib/search/siteIndex.ts):
   * the search then finds the sections by their names in both languages, and
   * the single settings inside them — a match on one opens its section and
   * marks it. Without it, the search reads the sections' own label,
   * description and keywords.
   */
  searchScope?: SearchScope;
  /** Above the list: a store card, an account card. */
  listHeader?: ReactNode;
  /** Under the list: version, sign out. */
  listFooter?: ReactNode;
  /** The current section's pane (usually a `<SettingsPane>`). */
  children: ReactNode;
  className?: string;
}

/** Tailwind's `lg`: from here the list and the pane stand side by side. */
const DESKTOP = "(min-width: 64rem)";

function subscribeDesktop(onChange: () => void): () => void {
  const query = window.matchMedia(DESKTOP);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function isDesktopNow(): boolean {
  return window.matchMedia(DESKTOP).matches;
}

function useIsDesktop(): boolean {
  return useSyncExternalStore(subscribeDesktop, isDesktopNow, () => true);
}

/** A section the search found, and the single setting in it that matched best, when that is what matched. */
interface Found {
  id: string;
  score: number;
  at: number;
  via?: SearchEntry;
}

/** An entry as the list's own search reads it: without the page's name, which every one of them carries. */
function withinPage(entry: SearchEntry): Searchable {
  return {
    titles: entry.searchable.titles,
    keywords: entry.searchable.keywords,
    details: entry.searchable.details,
    trail: entry.trail.slice(1).flatMap((place) => [place.en, place.ar]),
  };
}

interface ListGroup {
  heading: string | null;
  items: SettingsSectionDef[];
}

/** Sections under their headings, each heading where its first section stands; sections without one share a block. */
function groupSections(sections: ReadonlyArray<SettingsSectionDef>): ListGroup[] {
  const groups: ListGroup[] = [];
  const byHeading = new Map<string | null, ListGroup>();
  for (const section of sections) {
    const heading = section.group ?? null;
    let group = byHeading.get(heading);
    if (!group) {
      group = { heading, items: [] };
      byHeading.set(heading, group);
      groups.push(group);
    }
    group.items.push(section);
  }
  return groups;
}

function shown(node: ReactNode): boolean {
  return node !== null && node !== undefined && node !== false && node !== "";
}

/** A count or a word becomes a small bead (the number in the language's digits); anything else is drawn as given. */
function ListBadge({ value }: { value: ReactNode }) {
  if (typeof value === "number" || typeof value === "string") {
    return (
      <span className="zimos-settings-badge inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-ink/8 px-1.5 text-[11px] leading-none font-semibold text-ink-soft tabular-nums lg:group-aria-[current=page]/item:bg-white/25 lg:group-aria-[current=page]/item:text-current">
        {typeof value === "number" ? fmt("{n}", { n: value }) : value}
      </span>
    );
  }
  return <span className="flex shrink-0 items-center">{value}</span>;
}

/** What came into view last, so only that part plays its entrance. */
type Entrance = "none" | "push" | "list" | "swap";

/**
 * The System Settings layout every settings-like page shares (Settings, Store
 * settings, Shipping, Payments, Apps): a searchable list of sections and one
 * section in the pane.
 *
 * From `lg` up: two columns inside the page — the list as a pane 17rem wide
 * that stays under the toolbar and scrolls by itself, and the section beside
 * it (46rem at most). With no section chosen the first one is shown, and
 * asked for through `onSelect` so the URL says so too.
 *
 * Below `lg`: one column, like Settings on an iPhone. With no section chosen
 * the list is the page (cards of 52px rows); with one chosen only the pane is
 * shown, under a back row. The pane slides in from the end side and the list
 * comes back from the start. The page scrolls to the top on every switch.
 *
 * The list is a `nav` with roving focus: ↑ ↓ Home End move, Enter chooses;
 * from the search field ↓ enters the list and Enter opens the first match.
 *
 * It never reads or writes the URL: the caller owns `current` and `onSelect`
 * (`useSettingsSection` below keeps them in a search param). Before any
 * switch away from a section it asks `canLeave()` and stays on a `false` —
 * pass `useUnsavedGuard().confirmLeave`.
 *
 * Material (the list pane, the tiles' gradients, the current row) is in
 * glass/settings.css; without the glass layer everything is solid.
 */
export function SettingsLayout({
  title,
  sections,
  current,
  onSelect,
  canLeave,
  searchPlaceholder,
  searchScope,
  listHeader,
  listFooter,
  children,
  className,
}: SettingsLayoutProps) {
  const t = useT(STRINGS);
  const ui = useT(SEARCH_UI_STRINGS);
  const { locale } = useLocale();
  const { currentWorkspace } = useWorkspace();
  const role = currentWorkspace?.role;
  const isDesktop = useIsDesktop();
  const navId = useId();
  const headingBase = useId();

  const rootRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  // The row buttons by section id, for the arrow keys and for putting the focus back.
  const [rows] = useState(() => new Map<string, HTMLButtonElement>());

  const [query, setQuery] = useState("");
  // The row the arrow keys left the focus on: the one stop the Tab key makes in the list.
  const [focusId, setFocusId] = useState<string | null>(null);

  const firstId = sections[0]?.id ?? null;
  // On a desktop there is always a section in the pane: with none chosen, the first.
  const shownId = current ?? (isDesktop ? firstId : null);
  // Below lg, nothing chosen: the list is the whole page.
  const listIsPage = current === null;

  // Which part just came into view — decided while rendering, so its first frame already carries the animation.
  const [seen, setSeen] = useState(current);
  const [entrance, setEntrance] = useState<Entrance>("none");
  if (seen !== current) {
    setSeen(current);
    setEntrance(current === null ? "list" : seen === null ? "push" : "swap");
  }

  // This page's part of the index, for this role: each section, and the single settings in it.
  const targets = useMemo(() => {
    const entries = searchScope ? entriesInScope(searchScope).filter((entry) => isEntryShown(entry, role)) : [];
    return entries.map((entry) => ({ entry, searchable: withinPage(entry) }));
  }, [searchScope, role]);
  const searching = query.trim() !== "";
  const locked = usePlanLocks(currentWorkspace?.id, searching && targets.some(({ entry }) => entry.plan));

  // While searching: the sections that match, closest first, each with the setting that matched in it.
  const found = useMemo<Found[] | null>(() => {
    if (!searching) return null;
    const out: Found[] = [];
    sections.forEach((section, at) => {
      const own = targets.find(({ entry }) => entry.kind === "section" && entry.section === section.id);
      let best: Found = {
        id: section.id,
        at,
        score: matchScore(
          query,
          own?.searchable ?? { titles: [section.label], keywords: section.keywords, details: section.description ? [section.description] : [] }
        ),
      };
      for (const { entry, searchable } of targets) {
        if (entry.kind !== "setting" || entry.section !== section.id) continue;
        const score = matchScore(query, searchable);
        if (score > best.score) best = { id: section.id, at, score, via: entry };
      }
      if (best.score > 0) out.push(best);
    });
    return out.sort((a, b) => b.score - a.score || a.at - b.at);
  }, [searching, query, sections, targets]);
  const viaOf = useMemo(() => new Map((found ?? []).flatMap((hit) => (hit.via ? [[hit.id, hit.via] as const] : []))), [found]);

  const groups = useMemo<ListGroup[]>(() => {
    if (!found) return groupSections(sections);
    // Ranked: one list without headings, the closest first.
    const byId = new Map(sections.map((section) => [section.id, section]));
    return [{ heading: null, items: found.flatMap((hit) => byId.get(hit.id) ?? []) }];
  }, [found, sections]);
  // The rows in the order they are drawn: what the arrow keys walk.
  const order = useMemo(() => groups.flatMap((group) => group.items.map((section) => section.id)), [groups]);

  const tabStop =
    focusId !== null && order.includes(focusId)
      ? focusId
      : shownId !== null && order.includes(shownId)
        ? shownId
        : (order[0] ?? null);

  // One question at a time: a second press while «تسيب التعديلات؟» is open does nothing.
  const asking = useRef(false);
  // `anchor`: a single setting the search found in the section, brought into view and marked once it is drawn.
  async function request(id: string | null, anchor?: string) {
    if (asking.current) return;
    if (id === current) {
      if (anchor) revealSearchTarget(anchor);
      return;
    }
    if (canLeave && current !== null) {
      asking.current = true;
      let leave = false;
      try {
        leave = await canLeave();
      } catch {
        // A guard that failed is not a yes: the edits stay.
        leave = false;
      } finally {
        asking.current = false;
      }
      if (!leave) return;
    }
    onSelect(id);
    if (anchor) revealSearchTarget(anchor);
  }

  // A desktop with no section chosen: ask for the first, so the URL names what is on screen.
  // In an effect (not a layout effect): the caller's router is only ready to navigate after its own.
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  });
  useEffect(() => {
    if (isDesktop && current === null && firstId !== null) onSelectRef.current(firstId);
  }, [isDesktop, current, firstId]);

  // Every switch starts at the top of the page. On a phone the focus follows the view:
  // into the pane (its back row), or back to the row that was left.
  const previous = useRef(current);
  useLayoutEffect(() => {
    const from = previous.current;
    if (from === current) return;
    previous.current = current;
    window.scrollTo({ top: 0, behavior: "instant" });
    if (isDesktopNow()) return;
    const active = document.activeElement;
    // Only when the focus was ours to move (in the layout, or nowhere).
    if (active && active !== document.body && !rootRef.current?.contains(active)) return;
    if (current !== null) backRef.current?.focus({ preventScroll: true });
    else if (from !== null) rows.get(from)?.focus({ preventScroll: true });
  }, [current, rows]);

  // Keep the current row inside the list's own scroll (a deep link to a late section).
  // By hand, on the list alone: scrollIntoView would move the page too.
  useEffect(() => {
    const nav = navRef.current;
    const row = shownId !== null ? rows.get(shownId) : undefined;
    if (!nav || !row || nav.scrollHeight <= nav.clientHeight) return;
    const box = nav.getBoundingClientRect();
    const rect = row.getBoundingClientRect();
    if (rect.top < box.top) nav.scrollTop -= box.top - rect.top + 8;
    else if (rect.bottom > box.bottom) nav.scrollTop += rect.bottom - box.bottom + 8;
  }, [shownId, rows]);

  function onListKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const row = (event.target as HTMLElement).closest<HTMLElement>("[data-section-id]");
    if (!row) return;
    const at = order.indexOf(row.dataset.sectionId ?? "");
    if (at < 0) return;
    let next: number;
    switch (event.key) {
      case "ArrowDown":
        next = at + 1;
        break;
      case "ArrowUp":
        next = at - 1;
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = order.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    // Up from the first row goes back to the search field, the way it came.
    if (next < 0) {
      searchRef.current?.focus();
      return;
    }
    const id = order[Math.min(next, order.length - 1)];
    if (id !== undefined) rows.get(id)?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return;
    const first = order[0];
    if (event.key === "ArrowDown") {
      if (first === undefined) return;
      event.preventDefault();
      rows.get(first)?.focus();
    } else if (event.key === "Enter") {
      // Only with something typed: the first match. An empty field is not a choice.
      if (first === undefined || query.trim() === "") return;
      event.preventDefault();
      void request(first, viaOf.get(first)?.anchor);
    } else if (event.key === "Escape" && query !== "") {
      // Escape empties the field first; with nothing in it the key belongs to whatever is around.
      event.preventDefault();
      event.stopPropagation();
      setQuery("");
    }
  }

  return (
    <div
      ref={rootRef}
      data-slot="settings"
      data-view={listIsPage ? "list" : "section"}
      className={cn(
        // --settings-dir: which way "the end side" is, for the two slides (glass/settings.css keyframes).
        "zimos-settings mx-auto w-full max-w-[46rem] [--settings-dir:1] rtl:[--settings-dir:-1]",
        "lg:grid lg:max-w-[64.5rem] lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start lg:gap-6",
        className
      )}
    >
      <div
        data-slot="settings-list"
        className={cn(
          "zimos-settings-list min-w-0",
          !listIsPage && "max-lg:hidden",
          entrance === "list" &&
            "max-lg:motion-safe:animate-[settings-list-in_var(--dur-move)_var(--ease-spring)_backwards]",
          // From lg: a pane that stays under the toolbar; its header is fixed and the sections scroll inside it.
          "lg:sticky lg:top-22 lg:flex lg:max-h-[calc(100dvh-7.5rem)] lg:flex-col lg:rounded-3xl lg:bg-paper-raised lg:shadow-[var(--shadow-card)] lg:ring-1 lg:ring-line"
        )}
      >
        <div className="lg:px-3 lg:pt-4">
          {/* The dashboard sizes every h1 in a page at 1.75rem; in the 17rem pane it is one step smaller. */}
          <h1 className="px-1 font-display text-2xl font-semibold text-balance text-ink lg:px-2 lg:text-[1.375rem]! lg:leading-7!">
            {title}
          </h1>
          {/* A label, so a press anywhere on the pill lands in the field. */}
          <label
            data-slot="settings-search"
            className={cn(
              "zimos-settings-search mt-3 flex h-11 cursor-text items-center rounded-full bg-paper-raised text-ink ring-1 ring-line lg:h-10 lg:bg-paper-sunken lg:pointer-coarse:h-11",
              "transition-[background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
              "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-primary"
            )}
          >
            <IconSearch className="ms-3.5 size-4 shrink-0 text-ink-soft" aria-hidden />
            <input
              ref={searchRef}
              type="search"
              inputMode="search"
              enterKeyHint="search"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder={searchPlaceholder ?? t.search}
              aria-label={t.searchLabel}
              aria-controls={navId}
              className={cn(
                // The native clear cross is hidden: the round button after the field is the one way to clear.
                "h-full min-w-0 flex-1 appearance-none bg-transparent ps-2.5 text-sm text-ink outline-none placeholder:text-ink-soft pointer-coarse:text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
                query !== "" ? "pe-1" : "pe-4"
              )}
            />
            {query !== "" && (
              <button
                type="button"
                aria-label={t.clearSearch}
                title={t.clearSearch}
                onClick={() => {
                  setQuery("");
                  searchRef.current?.focus();
                }}
                // 32px to the eye, 44px to the thumb: the ring of air around it is part of the target.
                className="relative me-1 flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1.5 before:content-[''] hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <IconClose className="size-4" aria-hidden />
              </button>
            )}
          </label>
        </div>

        {shown(listHeader) && <div className="mt-4 lg:mt-3 lg:px-3">{listHeader}</div>}

        <nav
          ref={navRef}
          id={navId}
          aria-label={fmt(t.sections, { title })}
          onKeyDown={onListKeyDown}
          className="mt-4 flex flex-col gap-5 lg:mt-2 lg:min-h-0 lg:flex-1 lg:gap-3 lg:overflow-y-auto lg:overscroll-contain lg:px-2 lg:pt-1 lg:pb-3"
        >
          {groups.map((group, index) => {
            const headingId = `${headingBase}-${index}`;
            return (
              <div key={group.heading === null ? "none" : `group:${group.heading}`}>
                {group.heading !== null && (
                  <h2
                    id={headingId}
                    className="zimos-settings-heading mb-1.5 px-4 text-[13px] leading-5 font-semibold text-ink-soft lg:mb-1 lg:px-2.5 lg:text-[11px] lg:leading-4"
                  >
                    {group.heading}
                  </h2>
                )}
                {/* On a phone the group is a card of rows; from lg the rows lie straight on the list pane. */}
                <ul
                  role="list"
                  aria-labelledby={group.heading !== null ? headingId : undefined}
                  className="zimos-settings-list-group max-lg:rounded-[1.25rem] max-lg:bg-card max-lg:shadow-[var(--shadow-card)] max-lg:ring-1 max-lg:ring-line lg:flex lg:flex-col lg:gap-0.5"
                >
                  {group.items.map((section) => {
                    const selected = section.id === shownId;
                    const via = viaOf.get(section.id);
                    return (
                      <li
                        key={section.id}
                        className={cn(
                          // Phone: a hairline over every row but the first, starting where the words do.
                          "group/li relative max-lg:before:pointer-events-none max-lg:before:absolute max-lg:before:end-0 max-lg:before:top-0 max-lg:before:h-px max-lg:before:bg-line max-lg:before:content-[''] max-lg:first:before:hidden",
                          section.icon ? "max-lg:before:start-14" : "max-lg:before:start-4"
                        )}
                      >
                        <button
                          type="button"
                          ref={(node) => {
                            if (node) rows.set(section.id, node);
                            else rows.delete(section.id);
                          }}
                          data-section-id={section.id}
                          aria-current={selected ? "page" : undefined}
                          // Roving focus: Tab stops once in the list, the arrow keys do the rest.
                          tabIndex={section.id === tabStop ? 0 : -1}
                          onClick={() => void request(section.id, via?.anchor)}
                          onFocus={() => setFocusId(section.id)}
                          className={cn(
                            "zimos-settings-item group/item relative flex w-full cursor-pointer items-center gap-3 text-start select-none",
                            // Phone: a 52px row of the card.
                            "min-h-13 px-4 py-2 max-lg:group-first/li:rounded-t-[1.25rem] max-lg:group-last/li:rounded-b-[1.25rem]",
                            // From lg: a 40px pill, the tile tucked into its start.
                            "lg:h-10 lg:min-h-0 lg:gap-2.5 lg:rounded-full lg:py-0 lg:pe-3 lg:pointer-coarse:h-11",
                            section.icon ? "lg:ps-1.5" : "lg:ps-3.5",
                            "transition-[background-color,color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
                            "focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-primary lg:focus-visible:outline-offset-2",
                            "max-lg:hover:bg-ink/4 max-lg:active:bg-ink/8 lg:active:scale-[0.97] motion-reduce:active:scale-100",
                            selected ? "text-ink lg:bg-primary lg:text-primary-foreground" : "text-ink lg:hover:bg-ink/5"
                          )}
                        >
                          {section.icon && (
                            <SettingsIconTile
                              icon={section.icon}
                              tone={section.tone}
                              // On the selection fill the tile keeps its colour; a light rim sets it off (blue on blue).
                              className="lg:group-aria-[current=page]/item:ring-1 lg:group-aria-[current=page]/item:ring-white/40"
                            />
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] leading-5 font-medium lg:text-sm">{section.label}</span>
                            {via ? (
                              // The setting the search found in this section, at every width.
                              <span className="mt-0.5 block truncate text-[13px] leading-[1.125rem] text-ink-soft lg:text-xs lg:leading-4 lg:group-aria-[current=page]/item:text-primary-foreground/80">
                                {via.title[locale]}
                              </span>
                            ) : (
                              section.description && (
                                <span className="mt-0.5 block truncate text-[13px] leading-[1.125rem] text-ink-soft lg:hidden">
                                  {section.description}
                                </span>
                              )
                            )}
                          </span>
                          {via && locked(via) ? <ListBadge value={ui.notInPlan} /> : shown(section.badge) && <ListBadge value={section.badge} />}
                          {/* The row leads into the section: a caret toward the end side, phone only. */}
                          <IconCaretRight
                            className="size-4 shrink-0 text-ink-soft lg:hidden rtl:-scale-x-100"
                            aria-hidden
                          />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
          {query.trim() !== "" && order.length === 0 && (
            <p role="status" className="px-4 py-6 text-center text-sm text-ink-soft lg:px-2.5 lg:py-2 lg:text-start">
              {t.nothing}
            </p>
          )}
        </nav>

        {shown(listFooter) && <div className="mt-5 lg:mt-0 lg:px-3 lg:pt-1 lg:pb-3">{listFooter}</div>}
      </div>

      {/* The pane. On a phone it is only there once a section is chosen; a desktop always has one. */}
      {(current !== null || isDesktop) && (
        <div
          // A new section is a new pane: its entrance plays again and nothing of the last one lingers.
          key={shownId ?? "none"}
          data-slot="settings-detail"
          className={cn(
            "zimos-settings-detail min-w-0 lg:max-w-[46rem]",
            listIsPage && "max-lg:hidden",
            entrance === "push" &&
              "max-lg:motion-safe:animate-[settings-pane-in_var(--dur-move)_var(--ease-spring)_backwards]",
            entrance === "swap" && "motion-safe:animate-[settings-pane-swap_var(--dur-fade)_var(--ease-out)_backwards]"
          )}
        >
          <button
            ref={backRef}
            type="button"
            onClick={() => void request(null)}
            aria-label={fmt(t.backTo, { title })}
            // Pulled back by its own padding so the caret lines up with the pane's edge.
            className="-ms-2 mb-2 inline-flex h-11 max-w-full cursor-pointer items-center gap-1 rounded-full ps-2 pe-3.5 text-[15px] font-medium text-primary transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-primary-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100 lg:hidden"
          >
            {/* Points back toward the start side: it flips with the reading direction. */}
            <IconCaretLeft className="size-4 shrink-0 rtl:-scale-x-100" aria-hidden />
            <span className="truncate">{title}</span>
          </button>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * Keeps the current section in a URL search param (`?tab=` by default) for a
 * page that uses `SettingsLayout`: `current` is the param when it names one
 * of the sections (anything else reads as none), and `select` writes it with
 * `replace: true` — switching sections does not pile up history — or removes
 * it for `null`. The other params are left alone.
 *
 *   const { current, select } = useSettingsSection(sections);
 *   <SettingsLayout sections={sections} current={current} onSelect={select} … />
 *
 * A page that keeps the section in the path (`/store-settings/:tab`) does not
 * need this: it passes its own `current` and `onSelect`.
 */
export function useSettingsSection(
  sections: ReadonlyArray<Pick<SettingsSectionDef, "id">>,
  param: string = "tab"
): { current: string | null; select: (id: string | null) => void } {
  const [params, setParams] = useSearchParams();
  const raw = params.get(param);
  const current = raw !== null && sections.some((section) => section.id === raw) ? raw : null;
  const select = useCallback(
    (id: string | null) => {
      setParams(
        (previous) => {
          const next = new URLSearchParams(previous);
          if (id === null) next.delete(param);
          else next.set(param, id);
          return next;
        },
        { replace: true }
      );
    },
    [setParams, param]
  );
  return { current, select };
}
