import { useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@store-builder/ui";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { PageHeader } from "@/components/PageHeader";
import { FraudRulesTab } from "./FraudRulesTab";
import { FlaggedOrdersTab } from "./FlaggedOrdersTab";
import { BlocklistTab } from "./BlocklistTab";

const TABS = ["rules", "flagged", "blocklist"] as const;
type FraudTab = (typeof TABS)[number];

const STRINGS = {
  en: {
    title: "Fraud protection",
    description: "Decide which storefront orders get held for review or refused, and manage blocked phones.",
    tabsLabel: "Fraud sections",
    rules: "Rules",
    flagged: "Flagged",
    blocklist: "Blocklist",
  },
  ar: {
    title: "الحماية من الاحتيال",
    description: "حدّد أي أوردرات المتجر تُعلَّق للمراجعة أو تُرفض، وأدِر أرقام الهواتف المحظورة.",
    tabsLabel: "أقسام الحماية من الاحتيال",
    rules: "القواعد",
    flagged: "المشتبه بها",
    blocklist: "قائمة الحظر",
  },
} satisfies Messages;

function isFraudTab(value: unknown): value is FraudTab {
  return typeof value === "string" && (TABS as readonly string[]).includes(value);
}

/**
 * /fraud — rules, the flagged-order queue and the phone blocklist. The active
 * tab lives in `?tab=` so a link (or a refresh) lands on the same section.
 */
export function FraudPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: FraudTab = isFraudTab(raw) ? raw : "rules";

  function selectTab(next: unknown) {
    if (!isFraudTab(next)) return;
    setParams(
      (prev) => {
        const out = new URLSearchParams(prev);
        if (next === "rules") out.delete("tab");
        else out.set("tab", next);
        return out;
      },
      { replace: true }
    );
  }

  return (
    <div className="max-w-4xl">
      <PageHeader title={t.title} description={t.description} />

      <Tabs value={tab} onValueChange={selectTab}>
        <TabsList
          aria-label={t.tabsLabel}
          className="w-full max-w-full overflow-x-auto sm:w-fit group-data-horizontal/tabs:h-auto"
        >
          {TABS.map((key) => (
            <TabsTrigger key={key} value={key} className="min-h-11 px-4">
              {t[key]}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Keyed on the workspace so switching stores resets every tab's local state. */}
        <TabsContent value="rules" className="pt-4">
          <FraudRulesTab key={workspaceId} />
        </TabsContent>
        <TabsContent value="flagged" className="pt-4">
          <FlaggedOrdersTab key={workspaceId} />
        </TabsContent>
        <TabsContent value="blocklist" className="pt-4">
          <BlocklistTab key={workspaceId} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
