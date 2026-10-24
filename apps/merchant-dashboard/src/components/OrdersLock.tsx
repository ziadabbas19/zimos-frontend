import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Lock, Wallet } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import { LOCKED_MASK, type LockedOrdersSummary, type Order, type OrderLockReason } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatMinorMoney } from "@/lib/format";
import { useErrorMessage } from "@/lib/errorMessages";
import { useToast } from "@/components/Toast";
import { LOW_ORDERS, ordersCovered, useWorkspaceAccess } from "@/lib/workspaceAccess";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { countOf } from "@/lib/plural";

/**
 * Locked orders (ORDERS_LOCK_ENABLED on the API; nothing here draws while it
 * is off): a store whose subscription lapsed, or whose pay-per-order balance
 * cannot pay the next fee, keeps selling, and its new orders' customer
 * details come hidden ("••••") until it renews or tops up.
 *
 *   BalanceWidget        the toolbar's balance, on every page, for a store on
 *                        pay per order: the balance, the orders it still
 *                        covers, a warning below LOW_ORDERS and at zero, and
 *                        Top up;
 *   LockedOrdersBanner   home, the orders list, the confirmation queue: how
 *                        many orders are locked and what they are worth, and
 *                        the way to open them;
 *   LockedBadge, HiddenValue, LockedOrderNotice, isHidden: how a locked
 *                        order and a hidden field read in the lists, the
 *                        order page and the queue — hidden, never empty.
 */

const STRINGS = {
  en: {
    balanceLabel: "Prepaid balance",
    covers: "Covers {orders}",
    coversNone: "Balance used up",
    lowTitle: "Your balance covers fewer than {count} orders. Top it up so new orders keep their customer details.",
    emptyTitle: "Your balance can't pay the next order's fee: new orders' customer details are hidden until you top up.",
    okTitle: "Your balance pays {fee} for each order you confirm; free orders go first.",
    topUp: "Top up",
    renew: "Renew",
    lockedBalance: "You have {orders} worth {amount} whose customer details are hidden. Top up your balance to see them.",
    lockedSubscription: "You have {orders} worth {amount} whose customer details are hidden. Renew your subscription to see them.",
    dueReady: "Of them, {orders} were paid online and wait for their fee. Your balance can pay it now.",
    settle: "Pay the fees and open them",
    settling: "Opening…",
    settled: "Opened: {orders}.",
    hidden: "Hidden",
    hiddenTitle: "Hidden until you renew or top up",
    badge: "Locked",
    badgeBalance: "Customer details hidden: your balance can't pay this order's fee.",
    badgeSubscription: "Customer details hidden: your subscription has expired.",
    noticeBalance:
      "This order's customer details are hidden: your balance can't pay its fee. Top up and it opens at once; you can't confirm, ship or message it until then.",
    noticeSubscription:
      "This order's customer details are hidden: your subscription has expired. Renew and it opens at once; you can't confirm, ship or message it until then.",
    confirmBlocked: "Can't be confirmed while its customer details are hidden.",
  },
  ar: {
    balanceLabel: "الرصيد المدفوع مسبقًا",
    covers: "يكفي {orders}",
    coversNone: "نفد الرصيد",
    lowTitle: "رصيدك يكفي أقل من {count} طلبات. اشحنه حتى تظهر بيانات العملاء في الطلبات الجديدة.",
    emptyTitle: "رصيدك لا يكفي لرسم الطلب التالي: بيانات العملاء في الطلبات الجديدة مخفية حتى تشحنه.",
    okTitle: "يُخصم {fee} من رصيدك عن كل طلب تؤكده، وتُستخدم الطلبات المجانية أولًا.",
    topUp: "اشحن الرصيد",
    renew: "جدّد الاشتراك",
    lockedBalance: "لديك {orders} بقيمة {amount} بيانات عملائها مخفية. اشحن رصيدك لتظهر.",
    lockedSubscription: "لديك {orders} بقيمة {amount} بيانات عملائها مخفية. جدّد اشتراكك لتظهر.",
    dueReady: "منها {orders} مدفوعة إلكترونيًا تنتظر رسومها، ورصيدك يكفي الآن.",
    settle: "ادفع الرسوم وافتحها",
    settling: "جارٍ الفتح…",
    settled: "تم فتح {orders}.",
    hidden: "مخفي",
    hiddenTitle: "مخفي حتى تجدّد الاشتراك أو تشحن الرصيد",
    badge: "مقفول",
    badgeBalance: "بيانات العميل مخفية: رصيدك لا يكفي لرسم هذا الطلب.",
    badgeSubscription: "بيانات العميل مخفية: اشتراكك انتهى.",
    noticeBalance:
      "بيانات عميل هذا الطلب مخفية لأن رصيدك لا يكفي لرسمه. اشحن الرصيد ويظهر فورًا؛ وحتى ذلك الحين لا يمكن تأكيده أو شحنه أو مراسلة العميل.",
    noticeSubscription:
      "بيانات عميل هذا الطلب مخفية لأن اشتراكك انتهى. جدّده ويظهر فورًا؛ وحتى ذلك الحين لا يمكن تأكيده أو شحنه أو مراسلة العميل.",
    confirmBlocked: "لا يمكن تأكيده وبيانات عميله مخفية.",
  },
} satisfies Messages;

/** Where topping up and renewing happen (the Usage tab opens its top-up dialog on ?wallet=topup). */
export const TOP_UP_PATH = "/subscription?tab=usage&wallet=topup";
export const RENEW_PATH = "/subscription?tab=plans";

const BILLING_ROLES = ["owner", "accountant"];

/** A field the API sent hidden ("••••"). */
export const isHidden = (value: unknown): boolean => value === LOCKED_MASK;

export const isLockedOrder = (order: Pick<Order, "contactLocked"> | null | undefined): boolean => order?.contactLocked === true;

/** The toolbar's balance: only for a store on pay per order while locked orders are on. */
export function BalanceWidget({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const access = useWorkspaceAccess(currentWorkspace?.id);
  const wallet = access?.ordersLock ? access.wallet : null;
  if (!wallet || !wallet.fee) return null;

  const count = ordersCovered(wallet);
  const tone = count === 0 ? "danger" : count < LOW_ORDERS ? "low" : "ok";
  const coverText = count === 0 ? t.coversNone : fmt(t.covers, { orders: countOf("order", count) });
  const title =
    tone === "danger"
      ? t.emptyTitle
      : tone === "low"
        ? fmt(t.lowTitle, { count: LOW_ORDERS })
        : fmt(t.okTitle, { fee: formatMinorMoney(wallet.fee, wallet.currency) });
  const canTopUp = BILLING_ROLES.includes(currentWorkspace?.role ?? "");
  const label = `${t.balanceLabel}: ${formatMinorMoney(wallet.balance, wallet.currency)} · ${coverText}`;
  const pill = cn(
    "flex h-9 shrink-0 items-center gap-1.5 rounded-full border ps-2.5 text-xs font-medium focus-visible:outline-2 focus-visible:outline-primary",
    canTopUp ? "pe-2.5 sm:pe-1" : "pe-2.5",
    tone === "danger"
      ? "border-danger/40 bg-danger-soft text-danger"
      : tone === "low"
        ? "border-accent/40 bg-accent-soft text-accent-dark dark:text-accent"
        : "border-line bg-paper-raised text-ink",
    className
  );
  const body = (
    <>
      <Wallet className="size-4 shrink-0" aria-hidden />
      {/* On a phone: the orders it covers only; the whole pill opens the top-up. */}
      <span className="tabular hidden whitespace-nowrap sm:inline">{formatMinorMoney(wallet.balance, wallet.currency)}</span>
      <span className="hidden opacity-60 sm:inline" aria-hidden>
        ·
      </span>
      <span className="whitespace-nowrap">
        <span className="sm:hidden" aria-hidden>
          {count}
        </span>
        <span className="hidden sm:inline">{coverText}</span>
      </span>
      {canTopUp && (
        <span
          className={cn(
            "ms-0.5 hidden h-7 items-center rounded-full px-2.5 font-semibold whitespace-nowrap text-white sm:inline-flex",
            tone === "danger" ? "bg-danger" : "bg-primary"
          )}
        >
          {t.topUp}
        </span>
      )}
    </>
  );

  return canTopUp ? (
    <Link to={TOP_UP_PATH} data-slot="balance" data-tone={tone} title={`${title} ${t.topUp}`} aria-label={`${label} — ${t.topUp}`} className={pill}>
      {body}
    </Link>
  ) : (
    <div data-slot="balance" data-tone={tone} title={title} role="status" aria-label={label} className={pill}>
      {body}
    </div>
  );
}

/**
 * The banner above home, the orders list and the confirmation queue while
 * some open orders are locked: how many and what they are worth, the way to
 * open them, and — when orders paid online wait for their fee and the
 * balance can pay it now — the button that takes it.
 */
export function LockedOrdersBanner({ className, onChanged }: { className?: string; onChanged?: () => void }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const location = useLocation();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const access = useWorkspaceAccess(workspaceId);
  const on = access?.ordersLock === true;
  const [summary, setSummary] = useState<LockedOrdersSummary | null>(null);
  const [settling, setSettling] = useState(false);

  useEffect(() => {
    if (!workspaceId || !on) return;
    let cancelled = false;
    apiClient
      .getLockedOrdersSummary(workspaceId)
      .then((s) => {
        if (!cancelled) setSummary(s);
      })
      .catch(() => {
        // A role without the orders, or an older API: no banner.
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, on, location.pathname]);

  if (!on || !summary || summary.count === 0 || !workspaceId) return null;
  const subscription = summary.reason === "subscription";
  const main = summary.totals[0];
  const amount = summary.totals.map((x) => formatMinorMoney(x.amount, x.currency)).join(" + ") || formatMinorMoney(0, main?.currency ?? "EGP");
  const canAct = BILLING_ROLES.includes(currentWorkspace?.role ?? "");
  const canSettle = canAct && !subscription && summary.due > 0 && summary.canPay;

  async function settle() {
    if (!workspaceId) return;
    setSettling(true);
    try {
      const result = await apiClient.settleLockedOrders(workspaceId);
      setSummary(result.locked);
      toast.success(fmt(t.settled, { orders: countOf("order", result.settled) }));
      onChanged?.();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSettling(false);
    }
  }

  return (
    <div
      role="status"
      data-testid="locked-orders-banner"
      className={cn(
        "mb-4 flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-danger/30 bg-danger-soft px-4 py-3 text-sm text-ink",
        className
      )}
    >
      <Lock className="size-4 shrink-0 text-danger" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p>{fmt(subscription ? t.lockedSubscription : t.lockedBalance, { orders: countOf("order", summary.count), amount })}</p>
        {canSettle && <p className="text-ink-soft">{fmt(t.dueReady, { orders: countOf("order", summary.due) })}</p>}
      </div>
      {canSettle && (
        <Button size="sm" variant="outline" className="min-h-11 w-full sm:w-auto" disabled={settling} onClick={settle}>
          {settling ? t.settling : t.settle}
        </Button>
      )}
      {canAct && (
        <Link
          to={subscription ? RENEW_PATH : TOP_UP_PATH}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-danger px-4 text-sm font-semibold text-white focus-visible:outline-2 focus-visible:outline-primary sm:w-auto"
        >
          {subscription ? t.renew : t.topUp}
        </Link>
      )}
    </div>
  );
}

/** The chip beside a locked order in the lists and the queue. */
export function LockedBadge({ reason, className }: { reason?: OrderLockReason; className?: string }) {
  const t = useT(STRINGS);
  return (
    <span
      data-testid="locked-badge"
      title={reason === "subscription" ? t.badgeSubscription : t.badgeBalance}
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 text-[11px] leading-none font-semibold whitespace-nowrap text-danger",
        className
      )}
    >
      <Lock className="size-3" aria-hidden />
      {t.badge}
    </span>
  );
}

/** A hidden field, said as hidden — never drawn as empty. */
export function HiddenValue({ className }: { className?: string }) {
  const t = useT(STRINGS);
  return (
    <span title={t.hiddenTitle} className={cn("inline-flex items-center gap-1 text-ink-soft", className)}>
      <Lock className="size-3.5 shrink-0" aria-hidden />
      <span>{t.hidden}</span>
    </span>
  );
}

/** The callout on a locked order's page and its queue card, with the way to open it. */
export function LockedOrderNotice({ order, className }: { order: Pick<Order, "contactLocked" | "lockReason">; className?: string }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  if (!isLockedOrder(order)) return null;
  const subscription = order.lockReason === "subscription";
  const canAct = BILLING_ROLES.includes(currentWorkspace?.role ?? "");
  return (
    <div
      role="note"
      data-testid="locked-order-notice"
      className={cn("flex flex-wrap items-start gap-2 rounded-[0.5rem] border border-danger/30 bg-danger-soft px-3 py-2 text-sm text-ink", className)}
    >
      <Lock className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />
      <p className="min-w-0 flex-1">{subscription ? t.noticeSubscription : t.noticeBalance}</p>
      {canAct && (
        <Link to={subscription ? RENEW_PATH : TOP_UP_PATH} className="inline-flex min-h-11 items-center font-semibold text-danger underline underline-offset-2">
          {subscription ? t.renew : t.topUp}
        </Link>
      )}
    </div>
  );
}

/** The reason a confirm button gives while the order is locked. */
export function useConfirmBlockedText(): string {
  return useT(STRINGS).confirmBlocked;
}
