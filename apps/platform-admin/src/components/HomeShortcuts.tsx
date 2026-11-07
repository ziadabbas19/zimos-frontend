import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { SlidersHorizontal } from "lucide-react";
import { Button } from "@store-builder/ui";
import { useNavLabel } from "@/components/shell/SidebarNav";
import { useT } from "@/i18n/LocaleContext";
import { useConsoleRow } from "@/lib/consoleShortcuts";
import { SHELL_STRINGS } from "@/lib/shellStrings";

// Its own chunk, with the drag library: nothing of it loads until someone customizes the row.
const ShortcutRowEditor = lazy(() => import("@/components/ShortcutRowEditor").then((module) => ({ default: module.ShortcutRowEditor })));

/**
 * The pages an account opens most, one tap from its first page, in the order it
 * arranged them (lib/consoleShortcuts); an account that never did sees the
 * default row. The merchant dashboard's Home row (its pages/home/QuickActions.tsx),
 * tile for tile. A page the account cannot open is never on it.
 */
export function HomeShortcuts({ className }: { className?: string }) {
  const t = useT(SHELL_STRINGS);
  const label = useNavLabel();
  const { answer, entries } = useConsoleRow("home");
  const [editor, setEditor] = useState({ open: false, opened: 0 });

  return (
    <div className={className}>
      {answer && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t.customizeShortcuts}
            className="h-7 text-xs text-ink-soft pointer-coarse:h-11"
            onClick={() => setEditor((current) => ({ open: true, opened: current.opened + 1 }))}
          >
            <SlidersHorizontal className="size-3.5" aria-hidden />
            {t.customize}
          </Button>
        </div>
      )}
      <nav aria-label={t.shortcuts} className={answer ? "mt-1.5" : "mt-3"} data-testid="home-shortcuts">
        {entries.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft">{t.noShortcuts}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
            {entries.map(({ id, to, icon: Icon, label: name }) => (
              <li key={id}>
                <Link
                  to={to}
                  className="quick-action flex h-full min-h-[4.5rem] flex-col justify-between gap-2 rounded-xl border border-line bg-paper-raised/75 p-3 text-sm font-medium text-ink transition-transform hover:-translate-y-0.5 hover:border-primary/50"
                >
                  <Icon className="size-[18px] text-primary" strokeWidth={1.75} aria-hidden />
                  <span className="leading-tight">{label(name)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </nav>
      {answer && editor.opened > 0 && (
        <Suspense fallback={null}>
          {/* A new key per opening: it starts from the row as it is now. */}
          <ShortcutRowEditor key={editor.opened} open={editor.open} onClose={() => setEditor((current) => ({ ...current, open: false }))} row="home" answer={answer} />
        </Suspense>
      )}
    </div>
  );
}
