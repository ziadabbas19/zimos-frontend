import { lazy, Suspense, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@store-builder/ui";
import { IconSliders } from "@/components/icons";
import { useAuth } from "@/context/AuthContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useHomeShortcuts } from "@/lib/homeShortcuts";
import { useKnownWorkCounts } from "@/lib/workCounts";
import { DEFAULT_SHORTCUT_IDS, shortcutsOf, type ShortcutBadge } from "@/pages/home/shortcutCatalog";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";

// Its own chunk, with the drag library: nothing of it loads until someone customizes the row.
const CustomizeShortcutsDialog = lazy(() =>
  import("@/pages/home/CustomizeShortcutsDialog").then((module) => ({ default: module.CustomizeShortcutsDialog }))
);

const STRINGS = {
  en: {
    title: "Shortcuts",
    customize: "Customize",
    customizeLabel: "Customize shortcuts",
    empty: "No shortcuts here. Customize to add the pages you use most.",
    waiting: "{count} waiting",
  },
  ar: {
    title: "اختصارات",
    customize: "تخصيص",
    customizeLabel: "تخصيص الاختصارات",
    empty: "لا توجد اختصارات هنا. خصّص الصف لإضافة الصفحات التي تستخدمها أكثر.",
    waiting: "{count} في الانتظار",
  },
} satisfies Messages;

/**
 * The things a merchant does most, one tap from the home page, in the order
 * this member arranged them (lib/homeShortcuts); a member who never did sees
 * the default row. A shortcut is left out when the role cannot open the page
 * it leads to or, by the server's word, the plan does not hold it.
 */
export function QuickActions({ awaiting }: { awaiting: number | null }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const { user } = useAuth();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const permissions = currentWorkspace?.permissions;
  const { answer, hint } = useHomeShortcuts(workspaceId, user?.id);
  const counts = useKnownWorkCounts(workspaceId);
  const [editor, setEditor] = useState({ open: false, opened: 0 });

  const actions = shortcutsOf(answer?.shortcuts ?? hint ?? DEFAULT_SHORTCUT_IDS, { permissions, available: answer?.available });
  const countOf = (badge: ShortcutBadge | undefined) =>
    badge === "awaiting" ? awaiting : badge === "reviews" ? counts.reviews : badge === "unread" ? counts.unread : null;

  return (
    <div className="mt-2">
      {answer && (
        <div className="flex justify-end">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            aria-label={t.customizeLabel}
            className="h-7 text-xs text-ink-soft pointer-coarse:h-11"
            onClick={() => setEditor((current) => ({ open: true, opened: current.opened + 1 }))}
          >
            <IconSliders className="size-3.5" aria-hidden />
            {t.customize}
          </Button>
        </div>
      )}
      <nav aria-label={t.title} className={answer ? "mt-1.5" : "mt-3"}>
        {actions.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-4 py-5 text-center text-sm text-ink-soft">{t.empty}</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
            {actions.map(({ id, to, icon: Icon, primary, badge, title }) => {
              const count = countOf(badge);
              return (
                <li key={id}>
                  <Link
                    to={to}
                    className={
                      primary
                        ? "quick-action flex h-full min-h-[4.5rem] flex-col justify-between gap-2 rounded-xl bg-primary p-3 text-sm font-semibold text-primary-foreground transition-transform hover:-translate-y-0.5"
                        : "quick-action flex h-full min-h-[4.5rem] flex-col justify-between gap-2 rounded-xl border border-line bg-paper-raised/75 p-3 text-sm font-medium text-ink transition-transform hover:-translate-y-0.5 hover:border-primary/50"
                    }
                  >
                    <span className="flex items-center justify-between gap-2">
                      <Icon className={primary ? "size-[18px]" : "size-[18px] text-primary"} strokeWidth={1.75} aria-hidden />
                      {count !== null && count > 0 && (
                        <span className="rounded-full bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-accent-dark" title={fmt(t.waiting, { count })}>
                          {count}
                        </span>
                      )}
                    </span>
                    <span className="leading-tight">{title[locale]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </nav>
      {answer && workspaceId && editor.opened > 0 && (
        <Suspense fallback={null}>
          {/* A new key per opening: it starts from the row as it is now. */}
          <CustomizeShortcutsDialog
            key={editor.opened}
            open={editor.open}
            onOpenChange={(open) => setEditor((current) => ({ ...current, open }))}
            workspaceId={workspaceId}
            answer={answer}
            permissions={permissions}
          />
        </Suspense>
      )}
    </div>
  );
}
