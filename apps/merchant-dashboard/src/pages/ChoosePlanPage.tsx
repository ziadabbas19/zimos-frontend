import { useEffect, useId, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Alert, Button, Spinner } from "@store-builder/ui";
import { isApiErrorCode, type PublicPlan } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAuth } from "@/context/AuthContext";
import { PlanPicker, type PlanChoice } from "@/components/plans/PlanPicker";
import { TermsConsent } from "@/components/plans/TermsConsent";
import { useErrorMessage } from "@/lib/errorMessages";
import { forgetPlanChoice, recallPlanChoice } from "@/lib/planChoice";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { AUTH_SUBMIT, AuthHeading, AuthShell } from "./AuthShell";

const STRINGS = {
  en: {
    title: "Choose your plan",
    body: "Pick the plan for your first store. You subscribe when you're ready to publish it.",
    save: "Continue",
    saving: "Saving…",
    choose: "Choose a plan to continue.",
    planGone: "That plan is no longer available. Choose another one.",
    loading: "Loading plans…",
    loadFailed: "We couldn't load the plans.",
    retry: "Try again",
  },
  ar: {
    title: "اختر خطتك",
    body: "اختر خطة متجرك الأول. ستشترك عندما تكون جاهزًا لنشره.",
    save: "متابعة",
    saving: "جارٍ الحفظ…",
    choose: "اختر خطة للمتابعة.",
    planGone: "هذه الخطة لم تعد متاحة. اختر خطة أخرى.",
    loading: "جارٍ تحميل الخطط…",
    loadFailed: "تعذّر تحميل الخطط.",
    retry: "حاول مرة أخرى",
  },
} satisfies Messages;

/**
 * The step an account made through Google goes through while the server
 * requires a plan at sign-up (ProtectedRoute sends it here after the
 * username step): the plans on offer, and the terms, which the Google
 * sign-in never showed it. Starts from the plan picked on the sign-up form
 * before going to Google, if any.
 */
export function ChoosePlanPage() {
  const t = useT(STRINGS);
  const { needsPlan, refreshUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const errorMessage = useErrorMessage();
  const headingId = useId();
  const from = (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? "/workspaces";

  const [plans, setPlans] = useState<PublicPlan[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [choice, setChoice] = useState<PlanChoice>(() => recallPlanChoice() ?? { planId: null, billingCycle: "monthly" });
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoadError(false);
    apiClient
      .listPublicPlans()
      .then((list) => {
        setPlans(list);
        setChoice((current) => ({ ...current, planId: list.some((p) => p.id === current.planId) ? current.planId : null }));
      })
      .catch(() => setLoadError(true));
  };

  useEffect(load, []);

  // Chosen already (another tab), or no longer required: nothing to do here.
  useEffect(() => {
    if (!needsPlan) navigate(from, { replace: true });
  }, [needsPlan, from, navigate]);

  async function save() {
    setError(null);
    if (!choice.planId) {
      setError(t.choose);
      return;
    }
    if (!acceptTerms) {
      setTermsError(true);
      return;
    }
    setSaving(true);
    try {
      await apiClient.choosePlan({ planId: choice.planId, billingCycle: choice.billingCycle, acceptTerms: true });
      forgetPlanChoice();
      await refreshUser();
      navigate(from, { replace: true });
    } catch (err) {
      setError(isApiErrorCode(err, "PLAN_NOT_AVAILABLE") ? t.planGone : errorMessage(err));
      setSaving(false);
    }
  }

  return (
    <AuthShell size="md">
      <AuthHeading id={headingId} title={t.title}>
        {t.body}
      </AuthHeading>

          {error && (
            <Alert variant="danger" className="mt-4">
              {error}
            </Alert>
          )}

          <div className="mt-6">
            {loadError ? (
              <div className="space-y-3">
                <Alert variant="danger">{t.loadFailed}</Alert>
                <Button variant="outline" className="min-h-11" onClick={load}>
                  {t.retry}
                </Button>
              </div>
            ) : !plans ? (
              <div className="flex items-center gap-2 text-sm text-ink-soft" role="status">
                <Spinner className="size-4" /> {t.loading}
              </div>
            ) : (
              <PlanPicker plans={plans} value={choice} onChange={setChoice} disabled={saving} labelledBy={headingId} />
            )}
          </div>

          <div className="mt-6">
            <TermsConsent
              checked={acceptTerms}
              onChange={(next) => {
                setAcceptTerms(next);
                if (next) setTermsError(false);
              }}
              showError={termsError}
              disabled={saving}
            />
          </div>

          <Button className={`mt-6 ${AUTH_SUBMIT}`} onClick={() => void save()} disabled={saving || !plans}>
            {saving ? t.saving : t.save}
          </Button>
    </AuthShell>
  );
}
