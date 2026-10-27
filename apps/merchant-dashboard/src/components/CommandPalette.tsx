import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { useGuardedLeave } from "@/lib/useUnsavedGuard";
import { CornerDownLeft, History, Package, Route, Search, ShoppingBag, User, type LucideIcon } from "lucide-react";
import { cn, ZLoader } from "@store-builder/ui";
import { dashboardSearch, type DashboardSearchResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatMoney } from "@/lib/format";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import {
  SEARCH_INDEX,
  entryForLocation,
  findEntry,
  isEntryShown,
  pageId,
  searchEntries,
  type SearchEntry,
} from "@/lib/search/siteIndex";
import { SEARCH_UI_STRINGS } from "@/lib/search/searchStrings";
import { readRecent, rememberPlace, rememberQuery } from "@/lib/search/recent";
import { revealSearchTarget } from "@/lib/search/reveal";
import { usePlanLocks } from "@/lib/search/usePlanLocks";

const STRINGS = {
  en: {
    open: "Search",
    placeholder: "Search orders, products, customers, pages, settings…",
    hint: "Type an order number, a phone, a name — or the page or setting you want.",
    searching: "Searching…",
    nothing: "Nothing matches “{q}”.",
    pages: "Pages",
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    funnels: "Funnels",
    ordersCount: "{n} orders",
    toSelect: "to open",
    close: "Close search",
  },
  ar: {
    open: "بحث",
    placeholder: "ابحث في الطلبات والمنتجات والعملاء والصفحات والإعدادات…",
    hint: "اكتب رقم طلب أو موبايل أو اسم — أو الصفحة أو الإعداد الذي تريده.",
    searching: "جارٍ البحث…",
    nothing: "لا توجد نتائج لـ «{q}».",
    pages: "الصفحات",
    orders: "الطلبات",
    products: "المنتجات",
    customers: "العملاء",
    funnels: "مسارات البيع",
    ordersCount: "{n} طلب",
    toSelect: "للفتح",
    close: "إغلاق البحث",
  },
} satisfies Messages;

/** What choosing a row does: open a place (and mark a setting on it), or search again for a recent query. */
type Pick = { kind: "go"; to: string; anchor?: string } | { kind: "query"; query: string };

interface Row {
  id: string;
  group: string;
  icon: LucideIcon;
  title: ReactNode;
  detail?: ReactNode;
  /** «Not in your plan», at the row's end. */
  badge?: string;
  /** An order, a product, a customer, a funnel: what was typed to find it is not kept among the recent searches. */
  record?: boolean;
  pick: Pick;
}

const EMPTY: DashboardSearchResult = { orders: [], products: [], customers: [], funnels: [] };
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
/** Where a place the plan holds back leads: the plans. */
const PLANS = "/subscription?tab=plans";
/** Places listed for a search: enough for any word, short enough to read. */
const MAX_PLACES = 30;

/**
 * Global search (SPEC §18.6): ⌘K / Ctrl+K from anywhere in the dashboard.
 *
 * Places — pages, tabs, settings sections and single settings — come from the
 * one index of the dashboard (lib/search/siteIndex.ts), matched in Arabic and
 * English at once whatever the dashboard is shown in, closest first and
 * grouped under their side-menu heading. A setting opens its section and is
 * brought into view and marked there. Records come from GET /search, as
 * before, and are listed after the places, so the list does not shift under
 * the cursor when they arrive.
 *
 * Empty, the window offers the last searches and the last places opened
 * (lib/search/recent.ts), then the actions.
 */
export function CommandPalette() {
  const t = useT(STRINGS);
  const ui = useT(SEARCH_UI_STRINGS);
  const { locale } = useLocale();
  const navigate = useNavigate();
  const location = useLocation();
  const leave = useGuardedLeave();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const role = currentWorkspace?.role;

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<DashboardSearchResult>(EMPTY);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const locked = usePlanLocks(workspaceId, open);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // By the physical key too, so it works on an Arabic layout.
      if ((e.metaKey || e.ctrlKey) && (e.code === "KeyK" || e.key.toLowerCase() === "k")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Every place opened, however it was reached, is the first of the recent ones.
  const here = useMemo(() => entryForLocation(location.pathname, location.search), [location.pathname, location.search]);
  useEffect(() => {
    if (workspaceId && here) rememberPlace(workspaceId, here.id);
  }, [workspaceId, here]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setResults(EMPTY);
    setActive(0);
    // After the dialog is in the DOM.
    const id = window.setTimeout(() => inputRef.current?.focus(), 0);
    return () => window.clearTimeout(id);
  }, [open]);

  const term = query.trim();
  useEffect(() => {
    if (!open || !workspaceId || term.length < 2) {
      setResults(EMPTY);
      setSearching(false);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    const id = window.setTimeout(() => {
      dashboardSearch(apiClient, workspaceId, term, controller.signal)
        .then((found) => {
          setResults(found);
          setSearching(false);
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setResults(EMPTY);
            setSearching(false);
          }
        });
    }, 200);
    return () => {
      controller.abort();
      window.clearTimeout(id);
    };
  }, [open, workspaceId, term]);

  const shown = useMemo(() => SEARCH_INDEX.filter((entry) => isEntryShown(entry, role)), [role]);
  // Read when the window opens: what was opened since the last time is in it.
  const recent = useMemo(() => (open && workspaceId ? readRecent(workspaceId) : null), [open, workspaceId]);

  const rows = useMemo<Row[]>(() => {
    const plansPage = findEntry(pageId("/subscription"));
    const placeRow = (entry: SearchEntry, group: string): Row => {
      const held = locked(entry);
      // Held back by the plan: to the plans, for a role that sees them; otherwise the page says it itself.
      const plans = held && plansPage !== undefined && isEntryShown(plansPage, role);
      return {
        id: entry.id,
        group,
        icon: entry.icon,
        title: entry.title[locale],
        detail: entry.trail.length > 0 ? entry.trail.map((place) => place[locale]).join(" › ") : undefined,
        badge: held ? ui.notInPlan : undefined,
        pick: plans ? { kind: "go", to: PLANS } : { kind: "go", to: entry.to, anchor: entry.anchor },
      };
    };

    if (term === "") {
      const searches: Row[] = (recent?.queries ?? []).map((q, index) => ({
        id: `recent-query-${index}`,
        group: ui.recentSearches,
        icon: History,
        title: <bdi>{q}</bdi>,
        pick: { kind: "query", query: q },
      }));
      const places: Row[] = (recent?.places ?? [])
        .filter((id) => id !== here?.id)
        .map((id) => findEntry(id))
        .filter((entry): entry is SearchEntry => entry !== undefined && isEntryShown(entry, role))
        .slice(0, 5)
        .map((entry) => placeRow(entry, ui.recentPages));
      const actions = shown.filter((entry) => entry.kind === "action").map((entry) => placeRow(entry, ui.actions));
      // Nothing recent yet: the window is a launcher, actions then the first pages of the menu.
      const pages =
        searches.length + places.length === 0
          ? shown
              .filter((entry) => entry.kind === "page" && !entry.parent)
              .slice(0, 8)
              .map((entry) => placeRow(entry, t.pages))
          : [];
      return [...searches, ...places, ...actions, ...pages];
    }

    // Places, closest first, each under its heading; a heading comes where its closest place is.
    const byHeading = new Map<string, Row[]>();
    for (const { entry } of searchEntries(term, shown).slice(0, MAX_PLACES)) {
      const heading = entry.heading[locale];
      const list = byHeading.get(heading) ?? [];
      list.push(placeRow(entry, heading));
      byHeading.set(heading, list);
    }
    const places = [...byHeading.values()].flat();

    const records: Row[] = [
      ...results.orders.map((o) => ({
        id: `order-${o.id}`,
        group: t.orders,
        icon: ShoppingBag,
        title: <bdi dir="ltr">{o.orderNumber}</bdi>,
        detail: (
          <>
            <bdi>{o.customerName}</bdi> · {formatMoney(o.totalAmount, o.currency)}
          </>
        ),
        pick: { kind: "go" as const, to: `/orders/${o.id}` },
      })),
      ...results.products.map((p) => ({
        id: `product-${p.id}`,
        group: t.products,
        icon: Package,
        title: <bdi>{p.name}</bdi>,
        detail: p.productCode ? <bdi dir="ltr">#{p.productCode}</bdi> : undefined,
        pick: { kind: "go" as const, to: `/catalog/${p.id}` },
      })),
      ...results.customers.map((c) => ({
        id: `customer-${c.id}`,
        group: t.customers,
        icon: User,
        title: <bdi>{c.fullName || c.phone}</bdi>,
        detail: (
          <>
            <bdi dir="ltr">{c.phone}</bdi> · {t.ordersCount.replace("{n}", String(c.totalOrders))}
          </>
        ),
        pick: { kind: "go" as const, to: `/customers/${c.id}` },
      })),
      ...results.funnels.map((f) => ({
        id: `funnel-${f.id}`,
        group: t.funnels,
        icon: Route,
        title: <bdi>{f.name}</bdi>,
        pick: { kind: "go" as const, to: `/funnels/${f.id}` },
      })),
    ];

    return [...places, ...records.map((row) => ({ ...row, record: true }))];
  }, [term, results, t, ui, locale, shown, recent, here, locked, role]);

  useEffect(() => {
    setActive(0);
  }, [rows.length, term]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function choose(row: Row | undefined) {
    if (!row) return;
    const { pick } = row;
    if (pick.kind === "query") {
      setQuery(pick.query);
      inputRef.current?.focus();
      return;
    }
    // What found a place is kept; what found a record (a phone, a name) is not.
    if (workspaceId && term && !row.record) rememberQuery(workspaceId, term);
    setOpen(false);
    // Unsaved changes on the page: asks before going.
    leave(() => {
      navigate(pick.to);
      if (pick.anchor) revealSearchTarget(pick.anchor);
    });
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i + 1) % rows.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (rows.length ? (i - 1 + rows.length) % rows.length : 0));
    } else if (e.key === "Enter") {
      if (e.nativeEvent.isComposing) return;
      e.preventDefault();
      choose(rows[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        data-slot="spotlight-trigger"
        onClick={() => setOpen(true)}
        aria-label={t.open}
        aria-keyshortcuts="Control+K Meta+K"
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          "zimos-spotlight-trigger flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-paper-raised text-ink-soft ring-1 ring-line",
          "transition-[background-color,color,box-shadow,translate,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
          "hover:bg-paper-sunken hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-safe:active:scale-[0.97]",
          // A round button below lg (36px for a mouse), a search field from lg up.
          "pointer-fine:max-lg:size-9",
          "lg:h-9 lg:w-[16.25rem] lg:justify-start lg:gap-2 lg:ps-3 lg:pe-1.5 motion-safe:lg:hover:-translate-y-0.5 lg:pointer-coarse:h-11"
        )}
      >
        <Search className="size-5 shrink-0 lg:size-4" aria-hidden />
        <span className="hidden min-w-0 flex-1 truncate text-start text-sm lg:block">{t.open}</span>
        <kbd
          dir="ltr"
          data-slot="spotlight-keycap"
          className="hidden h-6 shrink-0 items-center rounded-full bg-paper-sunken px-2 font-sans text-[11px] leading-none font-medium text-ink-soft ring-1 ring-line lg:inline-flex"
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Mounted on <body>: the trigger sits in the dark top bar, the palette follows the page theme. */}
      {open && createPortal(
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh]" onMouseDown={() => setOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label={t.open}
            onMouseDown={(e) => e.stopPropagation()}
            onKeyDown={onKeyDown}
            className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-xl"
          >
            <div className="flex items-center gap-3 border-b border-line px-4">
              <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
              <input
                ref={inputRef}
                autoFocus
                type="search"
                role="combobox"
                aria-expanded="true"
                aria-controls="command-palette-list"
                aria-activedescendant={rows[active] ? `cp-${rows[active].id}` : undefined}
                aria-label={t.open}
                placeholder={t.placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                autoComplete="off"
                spellCheck={false}
                className="min-h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
              />
            </div>

            <div ref={listRef} id="command-palette-list" role="listbox" aria-label={t.open} className="flex-1 overflow-y-auto p-2">
              {rows.length === 0 ? (
                <p role="status" className="px-3 py-8 text-center text-sm text-ink-soft">
                  {searching ? (
                    <>
                      <ZLoader size="sm" className="mx-auto" aria-hidden />
                      <span className="sr-only">{t.searching}</span>
                    </>
                  ) : term ? (
                    t.nothing.replace("{q}", term)
                  ) : (
                    t.hint
                  )}
                </p>
              ) : (
                rows.map((row, index) => {
                  const heading = index === 0 || rows[index - 1].group !== row.group ? row.group : null;
                  return (
                    <div key={row.id}>
                      {heading && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-soft uppercase rtl:tracking-normal">{heading}</p>}
                      <button
                        type="button"
                        id={`cp-${row.id}`}
                        role="option"
                        aria-selected={index === active}
                        data-index={index}
                        onMouseMove={() => setActive(index)}
                        onClick={() => choose(row)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-[0.5rem] px-3 py-2 text-start text-sm text-ink",
                          index === active && "bg-primary-soft text-primary-dark dark:text-primary"
                        )}
                      >
                        <row.icon className="size-4 shrink-0 text-ink-soft" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{row.title}</span>
                          {row.detail && <span className="block truncate text-xs text-ink-soft">{row.detail}</span>}
                        </span>
                        {row.badge && (
                          <span title={ui.notInPlanHint} className="shrink-0 rounded-full bg-ink/8 px-2 py-0.5 text-[11px] font-medium text-ink-soft">
                            {row.badge}
                          </span>
                        )}
                        {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-ink-soft">
              <span>{searching ? <ZLoader size="sm" aria-hidden /> : " "}</span>
              <span className="flex items-center gap-1.5">
                <kbd className="rounded border border-line px-1.5">↵</kbd> {t.toSelect}
                <kbd className="ms-2 rounded border border-line px-1.5">Esc</kbd>
              </span>
            </div>
          </div>
        </div>
      , document.body)}
    </>
  );
}
