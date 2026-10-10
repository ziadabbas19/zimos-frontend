import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useGuardedLeave } from "@/lib/useUnsavedGuard";
import { CornerDownLeft, Package, Plus, Search, ShoppingBag, Users, Workflow, type LucideIcon } from "lucide-react";
import { cn } from "@store-builder/ui";
import { dashboardSearch, type DashboardSearchResult } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { NAV_ITEMS, NAV_LABELS, isNavItemVisible } from "@/lib/navigation";
import { formatMoney } from "@/lib/format";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    open: "Search",
    placeholder: "Search orders, products, customers, pages…",
    hint: "Type an order number, a phone, a name — or the page you want.",
    searching: "Searching…",
    nothing: "Nothing matches “{q}”.",
    pages: "Pages",
    commands: "Actions",
    orders: "Orders",
    products: "Products",
    customers: "Customers",
    funnels: "Funnels",
    cmdNewProduct: "New product",
    cmdNewOrder: "Go to orders",
    cmdNewDiscount: "Create a discount",
    cmdAllStores: "All my stores",
    cmdForms: "Form submissions",
    cmdSegments: "Contact segments",
    ordersCount: "{n} orders",
    toSelect: "to open",
    close: "Close search",
  },
  ar: {
    open: "بحث",
    placeholder: "ابحث في الطلبات والمنتجات والعملاء والصفحات…",
    hint: "اكتب رقم طلب أو موبايل أو اسم — أو الصفحة التي تريدها.",
    searching: "جارٍ البحث…",
    nothing: "لا توجد نتائج لـ «{q}».",
    pages: "الصفحات",
    commands: "إجراءات",
    orders: "الطلبات",
    products: "المنتجات",
    customers: "العملاء",
    funnels: "مسارات البيع",
    cmdNewProduct: "منتج جديد",
    cmdNewOrder: "الذهاب إلى الطلبات",
    cmdNewDiscount: "إنشاء خصم",
    cmdAllStores: "كل متاجري",
    cmdForms: "رسائل النماذج",
    cmdSegments: "شرائح جهات الاتصال",
    ordersCount: "{n} طلب",
    toSelect: "للفتح",
    close: "إغلاق البحث",
  },
} satisfies Messages;

interface Entry {
  id: string;
  group: string;
  icon: LucideIcon;
  title: ReactNode;
  detail?: ReactNode;
  to: string;
}

const EMPTY: DashboardSearchResult = { orders: [], products: [], customers: [], funnels: [] };
const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

/**
 * Global search (SPEC §18.6): ⌘K / Ctrl+K from anywhere in the dashboard.
 * Records come from GET /search; pages and actions are matched here, in the
 * language the dashboard is shown in.
 */
export function CommandPalette() {
  const t = useT(STRINGS);
  const navLabels = useT(NAV_LABELS);
  const navigate = useNavigate();
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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

  const entries = useMemo<Entry[]>(() => {
    const needle = term.toLowerCase();
    const matches = (label: string) => needle === "" || label.toLowerCase().includes(needle);

    const commands: Entry[] = [
      { id: "cmd-product", group: t.commands, icon: Plus, title: t.cmdNewProduct, to: "/catalog/new" },
      { id: "cmd-discount", group: t.commands, icon: Plus, title: t.cmdNewDiscount, to: "/discounts" },
      { id: "cmd-orders", group: t.commands, icon: ShoppingBag, title: t.cmdNewOrder, to: "/orders" },
      { id: "cmd-stores", group: t.commands, icon: Search, title: t.cmdAllStores, to: "/stores" },
      { id: "cmd-forms", group: t.commands, icon: Search, title: t.cmdForms, to: "/form-submissions" },
      { id: "cmd-segments", group: t.commands, icon: Users, title: t.cmdSegments, to: "/customers?tab=segments" },
    ].filter((c) => matches(String(c.title)));

    const pages: Entry[] = NAV_ITEMS.filter((item) => isNavItemVisible(item, role))
      .filter((item) => matches(navLabels[item.key]) || (needle !== "" && item.to.includes(needle)))
      .map((item) => ({ id: `page-${item.to}`, group: t.pages, icon: item.icon, title: navLabels[item.key], to: item.to }));

    const records: Entry[] = [
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
        to: `/orders/${o.id}`,
      })),
      ...results.products.map((p) => ({
        id: `product-${p.id}`,
        group: t.products,
        icon: Package,
        title: <bdi>{p.name}</bdi>,
        detail: p.productCode ? <bdi dir="ltr">#{p.productCode}</bdi> : undefined,
        to: `/catalog/${p.id}`,
      })),
      ...results.customers.map((c) => ({
        id: `customer-${c.id}`,
        group: t.customers,
        icon: Users,
        title: <bdi>{c.fullName || c.phone}</bdi>,
        detail: (
          <>
            <bdi dir="ltr">{c.phone}</bdi> · {t.ordersCount.replace("{n}", String(c.totalOrders))}
          </>
        ),
        to: `/customers/${c.id}`,
      })),
      ...results.funnels.map((f) => ({ id: `funnel-${f.id}`, group: t.funnels, icon: Workflow, title: <bdi>{f.name}</bdi>, to: `/funnels/${f.id}` })),
    ];

    // With nothing typed the palette is a launcher: actions first, then pages.
    return needle === "" ? [...commands, ...pages.slice(0, 8)] : [...records, ...commands, ...pages];
  }, [term, results, t, navLabels, role]);

  useEffect(() => {
    setActive(0);
  }, [entries.length, term]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  function go(entry: Entry | undefined) {
    if (!entry) return;
    setOpen(false);
    // Unsaved changes on the page: asks before going.
    leave(() => navigate(entry.to));
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (entries.length ? (i + 1) % entries.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (entries.length ? (i - 1 + entries.length) % entries.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(entries[active]);
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
                aria-activedescendant={entries[active] ? `cp-${entries[active].id}` : undefined}
                aria-label={t.open}
                placeholder={t.placeholder}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                maxLength={100}
                className="min-h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft"
              />
            </div>

            <div ref={listRef} id="command-palette-list" role="listbox" aria-label={t.open} className="flex-1 overflow-y-auto p-2">
              {entries.length === 0 ? (
                <p role="status" className="px-3 py-8 text-center text-sm text-ink-soft">
                  {searching ? t.searching : term ? t.nothing.replace("{q}", term) : t.hint}
                </p>
              ) : (
                entries.map((entry, index) => {
                  const heading = index === 0 || entries[index - 1].group !== entry.group ? entry.group : null;
                  return (
                    <div key={entry.id}>
                      {heading && <p className="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-wider text-ink-soft uppercase rtl:tracking-normal">{heading}</p>}
                      <button
                        type="button"
                        id={`cp-${entry.id}`}
                        role="option"
                        aria-selected={index === active}
                        data-index={index}
                        onMouseMove={() => setActive(index)}
                        onClick={() => go(entry)}
                        className={cn(
                          "flex w-full cursor-pointer items-center gap-3 rounded-[0.5rem] px-3 py-2 text-start text-sm text-ink",
                          index === active && "bg-primary-soft text-primary-dark dark:text-primary"
                        )}
                      >
                        <entry.icon className="size-4 shrink-0 text-ink-soft" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-medium">{entry.title}</span>
                          {entry.detail && <span className="block truncate text-xs text-ink-soft">{entry.detail}</span>}
                        </span>
                        {index === active && <CornerDownLeft className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />}
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-line px-4 py-2 text-xs text-ink-soft">
              <span>{searching ? t.searching : " "}</span>
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
