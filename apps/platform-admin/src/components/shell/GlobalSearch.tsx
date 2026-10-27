import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { CornerDownLeft, Search } from "lucide-react";
import { cn, ZLoader } from "@store-builder/ui";
import { Status } from "@/components/StatusBadge";
import { fmt, useT } from "@/i18n/LocaleContext";
import * as adminApi from "@/lib/adminApi";
import type { AdminWorkspaceRow } from "@/lib/adminApi";
import { SHELL_STRINGS } from "@/lib/shellStrings";

/**
 * The workspace search of the toolbar, drawn like the merchant dashboard's
 * search (its components/CommandPalette.tsx): a round button below `lg`, a
 * search field from `lg` up, and behind it a pane over the dimmed page with
 * the field and what it found. Ctrl / ⌘ K opens it from anywhere.
 *
 * The search itself is what it was: the workspace list by name or address,
 * 180 ms after the last key, arrows and Enter to open a workspace.
 */
export function GlobalSearch() {
  const t = useT(SHELL_STRINGS);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<AdminWorkspaceRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const isMac = typeof navigator !== "undefined" && /mac/i.test(navigator.platform);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const timer = window.setTimeout(() => {
      adminApi
        .searchWorkspaces(q)
        .then((rows) => {
          if (!cancelled) {
            setResults(rows);
            setActive(0);
          }
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function close() {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  }

  function go(row: AdminWorkspaceRow) {
    setOpen(false);
    setQuery("");
    navigate(`/workspaces/${row.workspace.id}`);
  }

  const term = query.trim();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        data-slot="spotlight-trigger"
        onClick={() => setOpen(true)}
        aria-label={t.searchLabel}
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
        <span className="hidden min-w-0 flex-1 truncate text-start text-sm lg:block">{t.searchPlaceholder}</span>
        <kbd
          dir="ltr"
          data-slot="spotlight-keycap"
          className="hidden h-6 shrink-0 items-center rounded-full bg-paper-sunken px-2 font-sans text-[11px] leading-none font-medium text-ink-soft ring-1 ring-line lg:inline-flex"
        >
          {isMac ? "⌘K" : "Ctrl K"}
        </kbd>
      </button>

      {/* Mounted on <body>: the trigger sits in the frosted toolbar, which would hold a fixed pane to its own box. */}
      {open &&
        createPortal(
          <div className="fixed inset-0 z-50 flex items-start justify-center bg-ink/40 p-4 pt-[12vh]" onMouseDown={close}>
            <div
              role="dialog"
              aria-modal="true"
              aria-label={t.searchLabel}
              onMouseDown={(e) => e.stopPropagation()}
              className="flex max-h-[70vh] w-full max-w-xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-xl"
            >
              <div className="flex items-center gap-3 border-b border-line px-4">
                <Search className="size-4 shrink-0 text-ink-soft" aria-hidden />
                <input
                  autoFocus
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "ArrowDown") {
                      e.preventDefault();
                      setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault();
                      setActive((i) => Math.max(i - 1, 0));
                    } else if (e.key === "Enter" && results[active]) {
                      e.preventDefault();
                      go(results[active]);
                    } else if (e.key === "Escape") {
                      e.preventDefault();
                      close();
                    }
                  }}
                  placeholder={t.searchPlaceholder}
                  aria-label={t.searchLabel}
                  role="combobox"
                  aria-expanded="true"
                  aria-controls="global-search-results"
                  className="min-h-12 w-full bg-transparent text-sm text-ink outline-none placeholder:text-ink-soft [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden"
                />
              </div>

              <div id="global-search-results" role="listbox" aria-label={t.searchLabel} className="flex-1 overflow-y-auto p-2">
                {loading ? (
                  <p role="status" className="flex items-center justify-center gap-2 px-3 py-8 text-sm text-ink-soft">
                    <ZLoader size="sm" aria-hidden /> {t.searching}
                  </p>
                ) : results.length === 0 ? (
                  <p role="status" className="px-3 py-8 text-center text-sm text-ink-soft">
                    {term ? fmt(t.noMatch, { query: term }) : t.searchHint}
                  </p>
                ) : (
                  results.map((row, i) => (
                    <button
                      key={row.workspace.id}
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseMove={() => setActive(i)}
                      onClick={() => go(row)}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 rounded-[0.5rem] px-3 py-2 text-start text-sm text-ink",
                        i === active && "bg-primary-soft text-primary-dark dark:text-primary"
                      )}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{row.workspace.name}</span>
                        <span className="block truncate text-xs text-ink-soft">{row.workspace.slug}</span>
                      </span>
                      {row.subscription && <Status value={row.subscription.status} />}
                      {i === active && <CornerDownLeft className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />}
                    </button>
                  ))
                )}
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-line px-4 py-2 text-xs text-ink-soft">
                <span className="flex items-center gap-1.5">
                  <kbd className="rounded border border-line px-1.5">↵</kbd> {t.toSelect}
                  <kbd className="ms-2 rounded border border-line px-1.5">Esc</kbd>
                </span>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
