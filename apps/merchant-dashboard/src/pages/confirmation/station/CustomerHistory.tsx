import { protectionNetworkScores, type Customer, type NetworkScore } from "@store-builder/api-client";
import { cn } from "@store-builder/ui";
import { fmt } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { isPermissionError } from "@/lib/errors";
import { formatPercentValue } from "@/lib/format";
import { countOf, pluralOf } from "@/lib/plural";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useOrderLabels } from "@/pages/orders/orderLabels";
import { useStationStrings } from "./stationStrings";

/*
 * A role that may not read customers (or the network score) is told so once:
 * after the first 403 in a store the station stops asking for the rest of the
 * visit, instead of failing two requests on every order.
 */
const customersDenied = new Set<string>();
const networkDenied = new Set<string>();

/**
 * What the store already knows about the customer on the line, from data that
 * exists and was never shown here: their record in this store (orders so far,
 * rejected, blocked) and their delivery record across the platform. Kept for
 * the session per customer, so going back to an order shows it at once.
 *
 * Mount it per customer (a `key`): the cache hook keeps the last answer while
 * the next one loads, and one customer's history must never stand under
 * another's name.
 */
function useCustomerHistory(customerId: string) {
  const workspaceId = useWorkspaceId();

  const customer = useCachedAsync<Customer | null>(
    customerId ? `confirm-customer:${workspaceId}:${customerId}` : null,
    async () => {
      if (!customerId || customersDenied.has(workspaceId)) return null;
      try {
        return await apiClient.getCustomer(workspaceId, customerId);
      } catch (err) {
        if (!isPermissionError(err)) throw err;
        customersDenied.add(workspaceId);
        return null;
      }
    },
    [workspaceId, customerId]
  );

  const network = useCachedAsync<NetworkScore | null>(
    customerId ? `confirm-network:${workspaceId}:${customerId}` : null,
    async () => {
      if (!customerId || networkDenied.has(workspaceId)) return null;
      try {
        const result = await protectionNetworkScores(apiClient, workspaceId, [customerId]);
        // Off for the store: no score, and no bar pretending there is one.
        return result.enabled ? (result.scores[customerId] ?? null) : null;
      } catch (err) {
        if (!isPermissionError(err)) throw err;
        networkDenied.add(workspaceId);
        return null;
      }
    },
    [workspaceId, customerId]
  );

  return {
    // An error is not a history: nothing is shown for it.
    customer: customer.error ? null : customer.data,
    score: network.error ? null : network.data,
    pending:
      (customer.loading && !customersDenied.has(workspaceId)) || (network.loading && !networkDenied.has(workspaceId)),
  };
}

type ChipTone = "neutral" | "good" | "warn" | "danger";

interface HistoryChip {
  id: string;
  tone: ChipTone;
  label: string;
  title?: string;
}

// The solid look (glass off): the soft token fills. glass/confirm.css mixes each tone over the pane.
const TONE: Record<ChipTone, string> = {
  neutral: "bg-paper-sunken text-ink-soft",
  good: "bg-success-soft text-success",
  warn: "bg-accent-soft text-accent-dark",
  danger: "bg-danger-soft text-danger",
};

/** Risk flags beyond this many fold into "+n" (their names stay in its tooltip). */
const MAX_FLAGS = 2;

/**
 * The chips under the customer's name: "Their first order", "3 orders before this —
 * rejected 1", "Number is flagged"… Every chip is a fact the API returned; where it
 * returned nothing (no access, the feature off, a failed call) there is no
 * chip — never a guess.
 */
export function CustomerHistory({
  customerId,
  countsThisOrder,
  riskFlags,
  className,
}: {
  customerId: string;
  /** The order on screen is already in the customer's order count (a cash order is, from the moment it is placed). */
  countsThisOrder: boolean;
  /** Why the order itself was flagged; shown beside the history, in the same row. */
  riskFlags: readonly string[];
  className?: string;
}) {
  const t = useStationStrings();
  const orderLabels = useOrderLabels();
  const { customer, score, pending } = useCustomerHistory(customerId);

  const chips: HistoryChip[] = [];

  if (customer?.isBlacklisted) {
    chips.push({ id: "blocked", tone: "danger", label: t.flaggedNumber, title: customer.blacklistReason ?? undefined });
  }
  if (customer) {
    const before = Math.max(0, customer.totalOrders - (countsThisOrder ? 1 : 0));
    const rejected = Math.max(0, customer.totalRejectedOrders);
    if (before === 0 && rejected === 0) {
      chips.push({ id: "orders", tone: "neutral", label: t.firstOrder });
    } else if (before > 0) {
      chips.push({
        id: "orders",
        tone: rejected > 0 ? "warn" : "good",
        label:
          rejected > 0
            ? fmt(t.beforeRejected, { orders: countOf("order", before), n: rejected })
            : fmt(t.before, { orders: countOf("order", before) }),
      });
    }
    if (customer.reliabilityScore < 100) {
      chips.push({ id: "reliability", tone: "warn", label: fmt(t.reliability, { n: customer.reliabilityScore, max: 100 }) });
    }
  }
  if (score) {
    if (score.rate !== null) {
      chips.push({
        id: "rate",
        tone: score.rate < 50 ? "danger" : score.rate < 75 ? "warn" : "good",
        label: fmt(t.receives, { rate: formatPercentValue(score.rate / 100, 0) }),
        title: fmt(t.receivesTitle, { delivered: score.delivered, finished: score.finished }),
      });
    }
    if (score.recommendDeposit) chips.push({ id: "deposit", tone: "danger", label: t.deposit, title: t.depositTitle });
    if (score.spamReports > 0) chips.push({ id: "spam", tone: "danger", label: pluralOf(t, "spam", score.spamReports) });
  }

  const flagNames = riskFlags.map((flag) => orderLabels.riskFlag(flag));
  flagNames.slice(0, MAX_FLAGS).forEach((name, index) => chips.push({ id: `flag-${index}`, tone: "danger", label: name }));
  if (flagNames.length > MAX_FLAGS) {
    chips.push({
      id: "flags-more",
      tone: "danger",
      label: fmt(t.moreFlags, { n: flagNames.length - MAX_FLAGS }),
      title: flagNames.slice(MAX_FLAGS).join(" · "),
    });
  }

  // While the answer is on its way the row keeps its line, so nothing under it moves when the chips arrive.
  if (chips.length === 0 && !pending) return null;

  return (
    <ul aria-label={t.historyLabel} aria-busy={pending || undefined} className={cn("flex min-h-6 flex-wrap items-center gap-1.5", className)}>
      {chips.map((chip) => (
        <li
          key={chip.id}
          title={chip.title}
          data-tone={chip.tone}
          className={cn(
            "zimos-station-chip inline-flex h-6 max-w-full items-center rounded-full px-2.5 text-xs leading-none font-medium whitespace-nowrap",
            TONE[chip.tone]
          )}
        >
          <span className="min-w-0 truncate">{chip.label}</span>
        </li>
      ))}
    </ul>
  );
}
