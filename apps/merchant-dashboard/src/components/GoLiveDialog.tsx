import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Rocket, X } from "lucide-react";
import { Alert, Button, ZLoader } from "@store-builder/ui";
import { ApiError, apiErrorDetails, type WorkspaceBilling } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { closeGoLive, getGoLiveState, subscribeGoLive } from "@/lib/goLive";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useToast } from "@/components/Toast";
import { PlanSummary } from "@/components/plans/PlanPicker";
import { legalUrl } from "@/lib/legalLinks";
import { formatDays } from "@/lib/planDisplay";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "Subscribe to publish your store",
    intro: "Your store is in draft mode: build as much as you like, and subscribe to publish it.",
    held: "Publishing needs an active subscription. Start it here and we'll finish what you were doing.",
    yourPlan: "Your plan",
    startTrial: "Start the free trial ({days})",
    starting: "Starting…",
    trialNote: "Nothing to pay now. The trial starts today, and your store goes live at once.",
    trialUsed: "You've already had this plan's free trial.",
    activateFree: "Activate the free plan",
    activating: "Activating…",
    payTitle: "Pay by transfer",
    paySteps: "How to pay",
    payFallback: "Contact the Zimos team to complete your payment. We'll activate your store as soon as the payment arrives.",
    refundLink: "Refund policy",
    sentPayment: "I've sent the payment",
    sending: "Sending…",
    sentDone: "Thanks — we've opened a ticket for your payment. We'll activate your store once it's confirmed.",
    viewTicket: "View the ticket",
    later: "Not now",
    close: "Close",
    trialStarted: "Your free trial has started. Your store can now be published.",
    freeActivated: "Your plan is active. Your store can now be published.",
    askOwner: "Only the store owner can subscribe. Ask them to start the subscription from this banner.",
    loadFailed: "We couldn't load your plan.",
    retry: "Try again",
    ticketSubject: "Subscription payment sent",
    ticketBody: "I've sent the payment for the {plan} plan ({cycle}). Please activate my store.",
    monthly: "monthly",
    yearly: "yearly",
    noPlan: "This store has no plan yet. Contact the Zimos team to choose one.",
    trialNotAvailable: "The free trial isn't available for this account.",
  },
  ar: {
    title: "اشترك لنشر متجرك",
    intro: "متجرك في وضع المسودة: ابنِ كما تشاء، واشترك لتنشره.",
    held: "يتطلب النشر اشتراكًا فعّالًا. فعّله من هنا وسنكمل ما كنت تفعله.",
    yourPlan: "خطتك",
    startTrial: "ابدأ التجربة المجانية ({days})",
    starting: "جارٍ البدء…",
    trialNote: "لا شيء لتدفعه الآن. تبدأ الفترة التجريبية اليوم ويُنشر متجرك فورًا.",
    trialUsed: "استخدمت الفترة التجريبية لهذه الخطة من قبل.",
    activateFree: "فعّل الخطة المجانية",
    activating: "جارٍ التفعيل…",
    payTitle: "الدفع بالتحويل",
    paySteps: "خطوات الدفع",
    payFallback: "تواصل مع فريق Zimos لإتمام الدفع، وسنفعّل متجرك فور وصول المبلغ.",
    refundLink: "سياسة الاسترجاع",
    sentPayment: "أرسلت الدفع",
    sending: "جارٍ الإرسال…",
    sentDone: "شكرًا لك — فتحنا تذكرة بخصوص دفعتك، وسنفعّل متجرك فور التحقق منها.",
    viewTicket: "عرض التذكرة",
    later: "ليس الآن",
    close: "إغلاق",
    trialStarted: "بدأت فترتك التجريبية المجانية، ويمكنك الآن نشر متجرك.",
    freeActivated: "تم تفعيل خطتك، ويمكنك الآن نشر متجرك.",
    askOwner: "مالك المتجر وحده يمكنه الاشتراك. اطلب منه تفعيل الاشتراك من هذا الشريط.",
    loadFailed: "تعذّر تحميل خطتك.",
    retry: "حاول مرة أخرى",
    ticketSubject: "تم إرسال دفعة الاشتراك",
    ticketBody: "أرسلت دفعة اشتراك خطة {plan} ({cycle}). أرجو تفعيل متجري.",
    monthly: "شهري",
    yearly: "سنوي",
    noPlan: "لا توجد خطة لهذا المتجر بعد. تواصل مع فريق Zimos لاختيار خطة.",
    trialNotAvailable: "الفترة التجريبية المجانية غير متاحة لهذا الحساب.",
  },
} satisfies Messages;

/** The roles holding billing.manage (GET /workspaces/:id/billing, start-trial). */
const BILLING_ROLES: ReadonlySet<string> = new Set(["owner", "accountant"]);

/**
 * The subscribe screen of a draft store (lib/goLive opens it — from the draft
 * banner, or when something that would go live was refused). Its plan with
 * the price and limits, then the way out of draft that applies: the free
 * trial when the owner can still take it, a free plan's activation, or the
 * manual payment steps with "I've sent the payment" (a support ticket) and
 * the refund policy beside them.
 */
export function GoLiveDialog() {
  const state = useSyncExternalStore(subscribeGoLive, getGoLiveState);
  if (!state.open) return null;
  return <GoLivePanel holding={state.holding} />;
}

function GoLivePanel({ holding }: { holding: boolean }) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const { currentWorkspace } = useWorkspace();
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const workspaceId = currentWorkspace?.id ?? "";
  const canBill = BILLING_ROLES.has(currentWorkspace?.role ?? "");

  const [billing, setBilling] = useState<WorkspaceBilling | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [busy, setBusy] = useState<"trial" | "free" | "ticket" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ticketId, setTicketId] = useState<string | null>(null);

  const load = () => {
    if (!workspaceId || !canBill) return;
    setLoadError(false);
    apiClient
      .getWorkspaceBilling(workspaceId)
      .then((b) => {
        setBilling(b);
        // Already live (another tab, or the console): nothing left to do.
        if (b.draft === false) closeGoLive(true);
      })
      .catch(() => setLoadError(true));
  };

  useEffect(load, [workspaceId, canBill]);

  // Focus moves into the dialog when it opens, and back where it was when it closes.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    return () => previous?.focus?.();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) closeGoLive(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy]);

  async function goLive(kind: "trial" | "free") {
    setBusy(kind);
    setError(null);
    try {
      if (kind === "trial") await apiClient.startTrial(workspaceId);
      else await apiClient.activateFreePlan(workspaceId);
      toast.success(kind === "trial" ? t.trialStarted : t.freeActivated);
      closeGoLive(true);
    } catch (err) {
      const reason = apiErrorDetails<{ reason?: string }>(err)?.reason;
      setError(err instanceof ApiError && err.code === "TRIAL_NOT_AVAILABLE" ? (reason === "used" ? t.trialUsed : t.trialNotAvailable) : (err as Error).message);
      setBusy(null);
    }
  }

  async function sentPayment() {
    if (!billing?.subscription.plan) return;
    setBusy("ticket");
    setError(null);
    try {
      const cycle = billing.subscription.billingCycle === "yearly" ? t.yearly : t.monthly;
      const thread = await apiClient.openSupportTicket(workspaceId, {
        subject: t.ticketSubject,
        body: fmt(t.ticketBody, { plan: billing.subscription.plan.name, cycle }),
        category: "billing",
      });
      setTicketId(thread.ticket.id);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const plan = billing?.subscription.plan ?? null;
  const goLiveInfo = billing?.goLive ?? null;
  const instructions = goLiveInfo?.paymentInstructions ? goLiveInfo.paymentInstructions[locale] ?? goLiveInfo.paymentInstructions.ar ?? goLiveInfo.paymentInstructions.en : null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-ink/40 p-4 py-8 sm:py-12" onMouseDown={() => !busy && closeGoLive(false)}>
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-lg rounded-[var(--radius-card)] border border-line bg-paper-raised shadow-xl outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 border-b border-line px-5 py-4">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary">
            <Rocket className="size-4" aria-hidden />
          </span>
          <div className="flex-1">
            <h2 id={titleId} className="font-display text-lg font-medium text-ink">
              {t.title}
            </h2>
            <p className="mt-1 text-sm text-ink-soft">{holding ? t.held : t.intro}</p>
          </div>
          <button
            type="button"
            onClick={() => closeGoLive(false)}
            disabled={busy !== null}
            aria-label={t.close}
            className="-me-2 -mt-1 flex size-11 cursor-pointer items-center justify-center rounded-md text-ink-soft hover:text-ink"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <Alert variant="danger" role="alert">
              {error}
            </Alert>
          )}

          {!canBill ? (
            <p className="text-sm text-ink">{t.askOwner}</p>
          ) : loadError ? (
            <div className="space-y-3">
              <Alert variant="danger">{t.loadFailed}</Alert>
              <Button variant="outline" className="min-h-11" onClick={load}>
                {t.retry}
              </Button>
            </div>
          ) : !billing ? (
            <div className="flex justify-center py-6">
              <ZLoader />
            </div>
          ) : !plan ? (
            <p className="text-sm text-ink">{t.noPlan}</p>
          ) : (
            <>
              <section className="rounded-[var(--radius-card)] border border-line p-4" aria-label={t.yourPlan}>
                <p className="text-xs font-medium tracking-wide text-ink-soft uppercase">{t.yourPlan}</p>
                <p className="mt-1 font-display text-lg font-medium text-ink">{plan.name}</p>
                <div className="mt-2">
                  <PlanSummary plan={{ ...plan, features: plan.features ?? billing.features }} billingCycle={billing.subscription.billingCycle} />
                </div>
              </section>

              {goLiveInfo?.free ? (
                <Button className="min-h-11 w-full" onClick={() => void goLive("free")} disabled={busy !== null}>
                  {busy === "free" ? t.activating : t.activateFree}
                </Button>
              ) : (
                <>
                  {goLiveInfo?.trial.eligible && (
                    <div>
                      <Button className="min-h-11 w-full" onClick={() => void goLive("trial")} disabled={busy !== null}>
                        {busy === "trial" ? t.starting : fmt(t.startTrial, { days: formatDays(goLiveInfo.trial.days, locale) })}
                      </Button>
                      <p className="mt-2 text-xs text-ink-soft">{t.trialNote}</p>
                    </div>
                  )}
                  {goLiveInfo && !goLiveInfo.trial.eligible && goLiveInfo.trial.days > 0 && (
                    <p className="text-sm text-ink-soft">{t.trialUsed}</p>
                  )}

                  <section className="rounded-[var(--radius-card)] border border-line p-4">
                    <h3 className="text-sm font-medium text-ink">{t.payTitle}</h3>
                    <p className="mt-2 text-sm whitespace-pre-line text-ink-soft" dir="auto">
                      {instructions || t.payFallback}
                    </p>
                    <a
                      href={legalUrl("refund-policy")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex min-h-11 items-center gap-1 text-sm font-medium text-primary underline underline-offset-2"
                    >
                      {t.refundLink}
                      <ExternalLink className="size-3.5" aria-hidden />
                    </a>
                    {ticketId ? (
                      <Alert variant="success" className="mt-2">
                        {t.sentDone}{" "}
                        <Link to={`/support/${ticketId}`} onClick={() => closeGoLive(false)} className="font-medium underline">
                          {t.viewTicket}
                        </Link>
                      </Alert>
                    ) : (
                      <Button
                        variant={goLiveInfo?.trial.eligible ? "outline" : "default"}
                        className="mt-2 min-h-11 w-full"
                        onClick={() => void sentPayment()}
                        disabled={busy !== null}
                      >
                        {busy === "ticket" ? t.sending : t.sentPayment}
                      </Button>
                    )}
                  </section>
                </>
              )}
            </>
          )}
        </div>

        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button variant="ghost" className="min-h-11" onClick={() => closeGoLive(false)} disabled={busy !== null}>
            {t.later}
          </Button>
        </div>
      </div>
    </div>
  );
}
