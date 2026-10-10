import { useMemo, useState } from "react";
import { Button } from "@store-builder/ui";
import { IconSearch } from "@/components/icons";
import { EmptyState } from "@/components/EmptyState";
import { ListToolbar } from "@/components/list";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { OfferToolCard, type OfferTool } from "./OfferToolCard";
import { matchesFolded } from "./foldText";

const STRINGS = {
  en: {
    searchLabel: "Search the offer tools",
    searchPlaceholder: "Search: bundles, free gift, wheel…",
    count: "{n}",
    noMatchTitle: "No tool by that name",
    noMatchBody: "Try another word, or see all the tools.",
    showAll: "Show all tools",
  },
  ar: {
    searchLabel: "ابحث في أدوات العروض",
    searchPlaceholder: "ابحث: باقات، إضافات، مشتركون…",
    count: "{n}",
    noMatchTitle: "لا توجد أداة بهذا الاسم",
    noMatchBody: "جرّب كلمة أخرى، أو اعرض كل الأدوات.",
    showAll: "عرض كل الأدوات",
  },
} satisfies Messages;

export interface OfferToolGroup {
  id: string;
  /** What the tools of the group are for: "Raise the order's value". */
  title: string;
  tools: OfferTool[];
}

/**
 * The offers tab: every tool as a card, grouped by what it is for, under one
 * search field that filters by name and description (Arabic letters folded, so
 * «اضافات» finds «إضافات»). One column of compact rows on a phone; two cards a
 * row from sm, three from xl. A group with nothing left by the search is not
 * drawn; with nothing left at all the page says so and offers the way back.
 */
export function OfferTools({ groups, note }: { groups: OfferToolGroup[]; note?: string }) {
  const t = useT(STRINGS);
  const [q, setQ] = useState("");

  const shown = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          tools: group.tools.filter((tool) => matchesFolded(`${tool.title} ${tool.hint} ${group.title}`, q)),
        }))
        .filter((group) => group.tools.length > 0),
    [groups, q]
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <ListToolbar search={{ value: q, onChange: setQ, placeholder: t.searchPlaceholder, label: t.searchLabel }} className="sm:max-w-md" />
        {note && <p className="mt-2 px-1 text-xs leading-5 text-ink-soft">{note}</p>}
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={<IconSearch aria-hidden />}
          title={t.noMatchTitle}
          description={t.noMatchBody}
          action={
            <Button variant="outline" className="min-h-11 rounded-full px-5" onClick={() => setQ("")}>
              {t.showAll}
            </Button>
          }
        />
      ) : (
        shown.map((group) => (
          <section key={group.id} aria-labelledby={`offer-group-${group.id}`} className="min-w-0">
            <h2 id={`offer-group-${group.id}`} className="zimos-offer-group mb-2 flex items-center gap-2 px-1 text-[13px] leading-5 font-semibold text-ink-soft">
              <span>{group.title}</span>
              <span className="tabular-nums" aria-hidden>
                {fmt(t.count, { n: group.tools.length })}
              </span>
            </h2>
            <ul className="grid gap-2.5 sm:grid-cols-2 sm:gap-3 xl:grid-cols-3">
              {group.tools.map((tool) => (
                <li key={tool.to} className="min-w-0">
                  <OfferToolCard tool={tool} />
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </div>
  );
}
