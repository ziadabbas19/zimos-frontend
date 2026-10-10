import type { Website } from "@store-builder/api-client";
import { Button } from "@store-builder/ui";
import { AccordionSection } from "@/components/Accordion";
import { IconDelete, IconEdit, IconWebsite } from "@/components/icons";
import { StatusBadge } from "@/components/StatusBadge";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { pluralOf } from "@/lib/plural";
import { useCodeLabel } from "./codes";

const STRINGS = {
  en: {
    title: "Your other sites",
    sites_one: "1 more site",
    sites_other: "{n} more sites",
    edit: "Edit",
    editSite: "Edit {name}",
    deleteSite: "Delete {name}",
  },
  ar: {
    title: "مواقعك الأخرى",
    sites_one: "موقع واحد آخر",
    sites_two: "موقعان آخران",
    sites_few: "{n} مواقع أخرى",
    sites_other: "{n} موقعًا آخر",
    edit: "تعديل",
    editSite: "تعديل {name}",
    deleteSite: "حذف {name}",
  },
} satisfies Messages;

const STATUS_TONE: Record<Website["status"], "neutral" | "success" | "danger"> = {
  draft: "neutral",
  published: "success",
  suspended: "danger",
};

/**
 * The sites a store has beyond the one in the hero — rare, so they fold into
 * one row («مواقعك التانية · ٢ مواقع كمان») and open to a list. Each keeps
 * what the old list gave it: its name, address and state, Edit, its own order
 * emails, and Delete (behind the page's confirmation).
 */
export function OtherSites({ sites, onDelete }: { sites: ReadonlyArray<Website>; onDelete: (site: Website) => void }) {
  const t = useT(STRINGS);
  const codeLabel = useCodeLabel();
  if (sites.length === 0) return null;

  return (
    <AccordionSection
      title={t.title}
      summary={pluralOf(t, "sites", sites.length)}
      icon={IconWebsite}
      persistKey="website:other-sites"
      flush
    >
      <ul className="divide-y divide-line">
        {sites.map((site) => (
          <li key={site.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
            <div className="min-w-0 flex-1 basis-44">
              <p className="truncate text-sm font-semibold text-ink">{site.name}</p>
              <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-soft">
                <StatusBadge value={site.status} tone={STATUS_TONE[site.status]} text={codeLabel("status", site.status)} />
                <bdi dir="ltr" className="min-w-0 truncate">
                  {site.subdomain}
                </bdi>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button asChild size="sm" variant="outline" className="min-h-11 rounded-full px-4 sm:min-h-9">
                <ViewLink to={`/website/${site.id}/edit`} aria-label={fmt(t.editSite, { name: site.name })}>
                  <IconEdit className="size-4" aria-hidden />
                  {t.edit}
                </ViewLink>
              </Button>
              <button
                type="button"
                aria-label={fmt(t.deleteSite, { name: site.name })}
                title={fmt(t.deleteSite, { name: site.name })}
                onClick={() => onDelete(site)}
                className="inline-flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-danger transition-[background-color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
              >
                <IconDelete className="size-[18px]" aria-hidden />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </AccordionSection>
  );
}
