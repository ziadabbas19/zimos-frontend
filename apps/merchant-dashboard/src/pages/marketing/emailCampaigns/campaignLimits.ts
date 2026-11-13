import type { EmailCampaignOverview } from "@store-builder/api-client";
import { formatCount } from "@/lib/analytics";
import { formatDate } from "@/lib/format";
import { fmt } from "@/i18n/LocaleContext";
import type { CampaignText } from "./campaignStrings";

/**
 * What would stop this campaign going out now, besides the emails left this
 * month (the editor checks those itself): the plan's campaigns this month
 * are used, or the audience is larger than one campaign may have. Null when
 * nothing does, or when the API is older and sends neither limit.
 * `alreadyScheduled`: the campaign holds a place of its own already.
 */
export type CampaignLimitProblem =
  | { kind: "campaigns"; max: number; used: number; resetsAt: string }
  | { kind: "audience"; size: number; max: number };

export function campaignLimitProblem(
  overview: EmailCampaignOverview,
  { audienceSize, alreadyScheduled = false }: { audienceSize: number | null; alreadyScheduled?: boolean }
): CampaignLimitProblem | null {
  const campaigns = overview.quota.campaigns;
  if (campaigns && campaigns.max !== null) {
    const used = Math.max(0, campaigns.used - (alreadyScheduled ? 1 : 0));
    if (used >= campaigns.max) return { kind: "campaigns", max: campaigns.max, used, resetsAt: campaigns.resetsAt };
  }
  const max = overview.quota.recipientsPerCampaign;
  if (max !== null && max !== undefined && audienceSize !== null && audienceSize > max) return { kind: "audience", size: audienceSize, max };
  return null;
}

/** The sentence that says why sending is off. */
export function campaignLimitText(t: CampaignText, problem: CampaignLimitProblem): string {
  return problem.kind === "campaigns"
    ? fmt(t.limitCampaigns, { max: formatCount(problem.max), used: formatCount(problem.used), date: formatDate(problem.resetsAt) })
    : fmt(t.limitAudience, { count: formatCount(problem.size), max: formatCount(problem.max) });
}
