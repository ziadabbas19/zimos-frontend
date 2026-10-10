import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ChipRow, type ChipItem } from "@/components/list";
import { PageHeader } from "@/components/PageHeader";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useIsPhone } from "@/pages/returns/rowkit/useScreen";
import { BlockedEntriesTab } from "./BlockedEntriesTab";
import { FlaggedOrdersTab } from "./FlaggedOrdersTab";
import { ProtectionRulesTab } from "./ProtectionRulesTab";
import { ProtectionStatsTab } from "./ProtectionStatsTab";

const TABS = ["rules", "flagged", "blocklist", "stats"] as const;
type FraudTab = (typeof TABS)[number];

const STRINGS = {
  en: {
    title: "Protection",
    description: "Decide which store orders get held for review or refused, and manage who is blocked.",
    tabsLabel: "Protection sections",
    rules: "Rules",
    flagged: "Flagged",
    blocklist: "Blocked",
    stats: "Statistics",
  },
  ar: {
    title: "الحماية من الاحتيال",
    description: "حدّد أي طلبات المتجر تُعلَّق للمراجعة أو تُرفض، وأدِر أرقام الهواتف المحظورة.",
    tabsLabel: "أقسام الحماية من الاحتيال",
    rules: "القواعد",
    flagged: "المشتبه بها",
    blocklist: "المحظورون",
    stats: "الإحصائيات",
  },
} satisfies Messages;

function isFraudTab(value: unknown): value is FraudTab {
  return typeof value === "string" && (TABS as readonly string[]).includes(value);
}

/**
 * /fraud — the rules, the flagged orders, the blocked list and what all of it
 * stopped. The four sections are one row of chips; the chosen one lives in
 * `?tab=` (absent = rules), so a link or a refresh lands on the same section.
 *
 * The rules, once opened, stay mounted while another section is looked at:
 * an edit that is not saved yet is still there — with its save bar — when the
 * merchant comes back to them.
 */
export function FraudPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const phone = useIsPhone();
  const [params, setParams] = useSearchParams();
  const raw = params.get("tab");
  const tab: FraudTab = isFraudTab(raw) ? raw : "rules";

  const [rulesOpened, setRulesOpened] = useState(tab === "rules");
  if (tab === "rules" && !rulesOpened) setRulesOpened(true);

  function selectTab(next: FraudTab) {
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

  const chips: ChipItem<FraudTab>[] = TABS.map((key) => ({ value: key, label: t[key] }));

  return (
    <div className="max-w-5xl">
      {/* A phone keeps the first screen for the work: the sentence is for wider screens. */}
      <PageHeader title={t.title} description={phone ? undefined : t.description} />

      <ChipRow items={chips} value={tab} onChange={selectTab} label={t.tabsLabel} collapseEmpty={false} />

      {/* Keyed on the workspace so switching stores resets every section's local state. */}
      <div className="pt-4">
        {rulesOpened && (
          <div hidden={tab !== "rules"}>
            <ProtectionRulesTab key={workspaceId} />
          </div>
        )}
        {tab === "flagged" && <FlaggedOrdersTab key={workspaceId} />}
        {tab === "blocklist" && <BlockedEntriesTab key={workspaceId} />}
        {tab === "stats" && <ProtectionStatsTab key={workspaceId} />}
      </div>
    </div>
  );
}
