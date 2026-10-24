import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, useLocation } from "react-router-dom";
import { AlertTriangle, Ban, PencilRuler, X } from "lucide-react";
import { Button, cn } from "@store-builder/ui";
import type { WorkspaceAccess } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { formatDate, formatDateTime } from "@/lib/format";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { getGoLiveState, openGoLive, subscribeGoLive } from "@/lib/goLive";
import { publishWorkspaceAccess } from "@/lib/workspaceAccess";

/**
 * The subscription / suspension banner shown above every dashboard page, from
 * GET /workspaces/:id/access (workspaces/workspaceAccessService):
 *
 *   expiring     "expires on {date}"          — dismissible for the day
 *   payment_due  "a payment is due"           — dismissible for the day
 *   grace        "expired; restricted {when}" — dismissible for the day
 *   restricted   "store unavailable"          — stays up
 *   suspended    "suspended by Zimos"         — stays up
 *   draft        "your store is a draft"      — stays up, with a Subscribe
 *                button (the subscribe dialog, lib/goLive)
 *
 * A dismissed banner comes back the next day while it still applies. Re-read
 * on every page change, so a payment clears it without a reload.
 */

const STRINGS = {
  en: {
    expiring: "Your subscription expires on {date}. Renew it to keep your store running.",
    expiringTrial: "Your free trial ends on {date}. Choose a plan to keep your store running.",
    paymentDue: "A payment for your subscription is due. Your current period ends on {date}.",
    grace:
      "Your subscription expired on {date}. If it isn't renewed, your store will be restricted on {when}: shoppers won't be able to see it, and you won't be able to add new products or funnels.",
    restricted:
      "Your subscription has expired, so your store is unavailable to shoppers and you can't add new products or funnels. Everything else keeps working. Renew to restore it.",
    notEnforced: "Your subscription has expired. Renew it to keep your store running.",
    suspended:
      "This store has been suspended by Zimos. It's unavailable to shoppers and new products and funnels can't be added. Contact Zimos support.",
    billingLink: "My Plan",
    dismiss: "Dismiss for today",
    draft: "Your store is in draft mode: build as much as you like, and subscribe to publish it.",
    subscribe: "Subscribe to publish your store",
    walletLow: "Your prepaid balance is running low: fewer than 20 orders are left before the overdraft.",
    walletOverdraft: "Your prepaid balance is at or below zero. Your store keeps selling until the overdraft runs out.",
    walletExhausted: "Your prepaid balance has run out, so your store has stopped taking orders. Top it up to reopen it.",
    walletDebt: "Your prepaid balance is below zero. New orders keep coming until the debt limit is reached. Top it up now.",
    walletLimit: "Your prepaid balance has reached its limit, so new orders are refused. Your store stays open. Top it up to take orders again.",
    graceLocked:
      "Your subscription expired on {date}. If it isn't renewed by {when}, your store keeps selling but the customer details on new orders will be hidden until you renew.",
    restrictedLocked:
      "Your subscription has expired. Your store keeps selling, but the customer details on new orders are hidden until you renew it.",
  },
  ar: {
    expiring: "ينتهي اشتراكك في {date}. جدّده حتى يستمر متجرك في العمل.",
    expiringTrial: "تنتهي فترتك التجريبية المجانية في {date}. اختر خطة حتى يستمر متجرك في العمل.",
    paymentDue: "هناك دفعة مستحقة على اشتراكك. تنتهي فترتك الحالية في {date}.",
    grace:
      "انتهى اشتراكك في {date}. إذا لم يُجدَّد، سيُقيَّد متجرك في {when}: لن يتمكن المتسوقون من رؤيته، ولن تتمكن من إضافة منتجات أو مسارات بيع جديدة.",
    restricted:
      "انتهى اشتراكك، لذلك متجرك غير متاح للمتسوقين ولا يمكنك إضافة منتجات أو مسارات بيع جديدة. كل شيء آخر يعمل كالمعتاد. جدّد اشتراكك لاستعادته.",
    notEnforced: "انتهى اشتراكك. جدّده حتى يستمر متجرك في العمل.",
    suspended:
      "أوقفت Zimos هذا المتجر. المتجر غير متاح للمتسوقين ولا يمكن إضافة منتجات أو مسارات بيع جديدة. تواصل مع دعم Zimos.",
    billingLink: "خطتي",
    dismiss: "إخفاء لليوم",
    draft: "متجرك في وضع المسودة: ابنِ كما تشاء، واشترك لتنشره.",
    subscribe: "اشترك لنشر متجرك",
    walletLow: "رصيدك المدفوع مسبقًا يقترب من النفاد: تبقّى أقل من 20 طلبًا قبل السحب على المكشوف.",
    walletOverdraft: "رصيدك المدفوع مسبقًا صفر أو أقل. يواصل متجرك البيع حتى ينفد السحب على المكشوف.",
    walletExhausted: "نفد رصيدك المدفوع مسبقًا، فتوقّف متجرك عن استقبال الطلبات. اشحنه لإعادة فتحه.",
    walletDebt: "رصيدك المدفوع مسبقًا أقل من صفر. تستمر الطلبات الجديدة حتى يُبلغ حد المديونية. اشحنه الآن.",
    walletLimit: "بلغ رصيدك المدفوع مسبقًا الحد، لذلك تُرفض الطلبات الجديدة. يبقى متجرك مفتوحًا. اشحنه لتعود الطلبات.",
    graceLocked:
      "انتهى اشتراكك في {date}. إذا لم يُجدَّد قبل {when}، سيواصل متجرك البيع لكن بيانات العملاء في الطلبات الجديدة ستُخفى حتى تجدّده.",
    restrictedLocked: "انتهى اشتراكك. يواصل متجرك البيع، لكن بيانات العملاء في الطلبات الجديدة مخفية حتى تجدّده.",
  },
} satisfies Messages;

type Notice = { key: string; tone: "warning" | "danger" | "draft"; text: string; dismissible: boolean; billing: boolean };

/** Today in the viewer's time zone, as the dismissal stamp. */
function localDay(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function storageKey(workspaceId: string, notice: string) {
  return `zimos.accessBanner.${workspaceId}.${notice}`;
}

function isDismissedToday(workspaceId: string, notice: string): boolean {
  try {
    return localStorage.getItem(storageKey(workspaceId, notice)) === localDay();
  } catch {
    return false;
  }
}

function noticeFor(access: WorkspaceAccess, t: Record<keyof (typeof STRINGS)["en"], string>): Notice | null {
  if (access.suspension.suspended) {
    return { key: "suspended", tone: "danger", text: t.suspended, dismissible: false, billing: false };
  }
  if (access.draft) {
    return { key: "draft", tone: "draft", text: t.draft, dismissible: false, billing: false };
  }
  // Locked orders on: the store keeps selling whatever the balance; the
  // toolbar's balance (BalanceWidget) and LockedOrdersBanner say the rest.
  const locking = access.ordersLock === true;
  // The pay-per-order balance (absent from an API from before it).
  const wallet = locking ? null : access.wallet;
  // A plan with its own debt limit keeps the store open: only new orders stop.
  const debtLimit = wallet?.policy === "debt_limit";
  if (wallet && wallet.phase === "exhausted") {
    return { key: "wallet_exhausted", tone: "danger", text: debtLimit ? t.walletLimit : t.walletExhausted, dismissible: false, billing: true };
  }
  if (wallet && wallet.phase === "overdraft") {
    return { key: "wallet_overdraft", tone: "warning", text: debtLimit ? t.walletDebt : t.walletOverdraft, dismissible: true, billing: true };
  }
  if (wallet && wallet.phase === "low") {
    return { key: "wallet_low", tone: "warning", text: t.walletLow, dismissible: true, billing: true };
  }
  const b = access.billing;
  const date = b.periodEnd ? formatDate(b.periodEnd) : "";
  switch (b.phase) {
    case "expiring":
      return {
        key: "expiring",
        tone: "warning",
        text: fmt(b.trialing ? t.expiringTrial : t.expiring, { date }),
        dismissible: true,
        billing: true,
      };
    case "payment_due":
      return { key: "payment_due", tone: "warning", text: fmt(t.paymentDue, { date }), dismissible: true, billing: true };
    case "grace":
      return {
        key: "grace",
        tone: "danger",
        text: locking
          ? fmt(t.graceLocked, { date, when: b.restrictsAt ? formatDateTime(b.restrictsAt) : "" })
          : b.enforced
            ? fmt(t.grace, { date, when: b.restrictsAt ? formatDateTime(b.restrictsAt) : "" })
            : t.notEnforced,
        dismissible: true,
        billing: true,
      };
    case "restricted":
      if (locking) return { key: "restricted_locked", tone: "danger", text: t.restrictedLocked, dismissible: false, billing: true };
      return b.enforced
        ? { key: "restricted", tone: "danger", text: t.restricted, dismissible: false, billing: true }
        : { key: "restricted_warn", tone: "danger", text: t.notEnforced, dismissible: true, billing: true };
    default:
      return null;
  }
}

export function AccessBanner() {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id;
  const location = useLocation();
  // Re-read when a store goes live from the subscribe dialog, so the draft
  // banner goes away without a reload.
  const { liveVersion } = useSyncExternalStore(subscribeGoLive, getGoLiveState);
  const [access, setAccess] = useState<WorkspaceAccess | null>(null);
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;
    apiClient
      .getWorkspaceAccess(workspaceId)
      .then((a) => {
        if (cancelled) return;
        setAccess(a);
        // The toolbar's balance and the locked-orders banner read the same answer (lib/workspaceAccess).
        publishWorkspaceAccess(workspaceId, a);
      })
      .catch(() => {
        // A banner that can't load is simply not shown.
      });
    return () => {
      cancelled = true;
    };
  }, [workspaceId, location.pathname, liveVersion]);

  if (!workspaceId || !access) return null;
  const notice = noticeFor(access, t);
  if (!notice) return null;
  if (notice.dismissible && (dismissedKey === notice.key || isDismissedToday(workspaceId, notice.key))) return null;

  const canSeeBilling = ["owner", "accountant"].includes(currentWorkspace?.role ?? "");

  return (
    <div
      role={notice.tone === "danger" ? "alert" : "status"}
      data-testid="access-banner"
      className={cn(
        "mb-4 flex items-start gap-3 rounded-[var(--radius-card)] border px-4 py-3 text-sm",
        notice.tone === "danger"
          ? "border-danger/30 bg-danger-soft text-danger"
          : notice.tone === "draft"
            ? "flex-wrap items-center border-primary/30 bg-primary-soft text-ink"
            : "border-accent/30 bg-accent-soft text-ink"
      )}
    >
      {notice.key === "suspended" ? (
        <Ban className="mt-0.5 size-4 shrink-0" aria-hidden />
      ) : notice.key === "draft" ? (
        <PencilRuler className="size-4 shrink-0 text-primary" aria-hidden />
      ) : (
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      )}
      <p className="flex-1">
        {notice.text}
        {notice.billing && canSeeBilling && (
          <>
            {" "}
            <Link
              to={notice.key.startsWith("wallet_") ? "/subscription?tab=usage" : "/subscription?tab=invoices"}
              className="font-medium underline underline-offset-2"
            >
              {t.billingLink}
            </Link>
          </>
        )}
      </p>
      {notice.key === "draft" && (
        <Button size="sm" className="min-h-11 w-full sm:w-auto" onClick={() => openGoLive(access.draftPlan ?? null)}>
          {t.subscribe}
        </Button>
      )}
      {notice.dismissible && (
        <button
          type="button"
          onClick={() => {
            try {
              localStorage.setItem(storageKey(workspaceId, notice.key), localDay());
            } catch {
              // Private mode: dismissed for this visit only.
            }
            setDismissedKey(notice.key);
          }}
          aria-label={t.dismiss}
          title={t.dismiss}
          className="cursor-pointer rounded p-0.5 opacity-70 hover:opacity-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  );
}
