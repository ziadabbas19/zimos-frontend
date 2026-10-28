import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Eye, EyeOff } from "lucide-react";
import { Button, Input, Label, Alert, ZLoader } from "@store-builder/ui";
import {
  isApiErrorCode,
  type BillingCycle,
  type PublicPlan,
  type SignupOptions,
  type VerificationChallenge,
} from "@store-builder/api-client";
import { useAuth, ApiError } from "@/context/AuthContext";
import { apiBaseUrl, apiClient } from "@/lib/apiClient";
import { AuthDivider, AuthFooter, AuthHeading, AuthLink, AuthShell, GoogleMark } from "./AuthShell";
import { passwordRuleLabel, unmetPasswordRules } from "@/lib/passwordRules";
import { UsernameField } from "@/components/UsernameField";
import { normalizeUsername, usernameSubmittable, type UsernameStatus } from "@/lib/username";
import { useLocale, useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PlanPicker, PlanSummary, type PlanChoice } from "@/components/plans/PlanPicker";
import { TermsConsent } from "@/components/plans/TermsConsent";
import { VerifyCodePanel } from "@/components/VerifyCodePanel";
import { rememberPlanChoice } from "@/lib/planChoice";
import { afterSignInPath, readPendingInvite } from "@/lib/pendingInvite";

// Same shape the API accepts for siteSessionId; anything else is not sent.
const SITE_SESSION_PATTERN = /^[A-Za-z0-9-]{8,64}$/;

const STRINGS = {
  en: {
    title: "Create your account",
    subtitle: "Start building your store in a few minutes.",
    google: "Continue with Google",
    or: "or",
    fullName: "Full name",
    fullNamePlaceholder: "Your name",
    email: "Email",
    phone: "Phone",
    invalidPhone: "Enter a valid mobile number (at least 8 digits).",
    password: "Password",
    passwordPlaceholder: "At least 8 characters",
    confirm: "Confirm password",
    show: "Show password",
    hide: "Hide password",
    passwordRules: "The password still misses some of the rules listed below it.",
    mismatch: "The password and its confirmation don't match.",
    chooseUsername: "Choose an available username first.",
    usernameTaken: "Someone just took this username. Choose another one.",
    emailTaken: "An account with this email already exists. Sign in instead.",
    planGone: "That plan is no longer available. Choose another one.",
    planRequired: "Choose a plan to continue.",
    termsRequired: "Agree to the terms to continue.",
    unavailable: "Sign-up isn't available right now. Try again later.",
    tooMany: "Too many attempts. Try again later.",
    generic: "Something went wrong. Please try again.",
    create: "Create account",
    creating: "Creating account…",
    haveAccount: "Already have an account?",
    signIn: "Sign in",
    planStepTitle: "Choose your plan",
    planStepSubtitle: "You can change it later. Subscribe when you're ready to publish.",
    continue: "Continue",
    yourPlan: "Your plan",
    change: "Change",
    stepOf: "Step {n} of {total}",
    loading: "Loading plans…",
  },
  ar: {
    title: "أنشئ حسابك",
    subtitle: "ابدأ بناء متجرك في دقائق.",
    google: "المتابعة بحساب جوجل",
    or: "أو",
    fullName: "الاسم الكامل",
    fullNamePlaceholder: "اسمك",
    email: "البريد الإلكتروني",
    phone: "رقم الهاتف",
    invalidPhone: "أدخل رقم موبايل صحيحًا (8 أرقام على الأقل).",
    password: "كلمة المرور",
    passwordPlaceholder: "8 أحرف على الأقل",
    confirm: "تأكيد كلمة المرور",
    show: "إظهار كلمة المرور",
    hide: "إخفاء كلمة المرور",
    passwordRules: "كلمة المرور لا تستوفي بعض الشروط المذكورة أسفلها.",
    mismatch: "كلمة المرور وتأكيدها غير متطابقين.",
    chooseUsername: "اختر اسم مستخدم متاحًا أولًا.",
    usernameTaken: "استخدم شخص آخر هذا الاسم للتو. اختر اسمًا آخر.",
    emailTaken: "يوجد حساب بهذا البريد الإلكتروني. سجّل الدخول بدلًا من ذلك.",
    planGone: "هذه الخطة لم تعد متاحة. اختر خطة أخرى.",
    planRequired: "اختر خطة للمتابعة.",
    termsRequired: "وافق على الشروط للمتابعة.",
    unavailable: "التسجيل غير متاح حاليًا. حاول مرة أخرى لاحقًا.",
    tooMany: "محاولات كثيرة. حاول مرة أخرى لاحقًا.",
    generic: "حدث خطأ ما. حاول مرة أخرى.",
    create: "إنشاء الحساب",
    creating: "جارٍ إنشاء الحساب…",
    haveAccount: "لديك حساب بالفعل؟",
    signIn: "تسجيل الدخول",
    planStepTitle: "اختر خطتك",
    planStepSubtitle: "يمكنك تغييرها لاحقًا. اشترك عندما تكون جاهزًا لنشر متجرك.",
    continue: "متابعة",
    yourPlan: "خطتك",
    change: "تغيير",
    stepOf: "الخطوة {n} من {total}",
    loading: "جارٍ تحميل الخطط…",
  },
} satisfies Messages;

type Step = "plan" | "account" | "code";

/**
 * Sign-up. What it asks for follows the server (GET /auth/signup-options):
 * a plan first, while plans are required and some are on offer (preselected
 * from ?plan=&cycle= when the marketing site sent the visitor); always the
 * terms; and, while sign-up codes are on, the code screen after the form,
 * which signs the new account in. With none of that switched on it behaves
 * as it always has.
 */
export function RegisterPage() {
  const { register, refreshUser } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // The marketing-site session this visit came from (?sv=), sent with the sign-up.
  const siteSessionId = SITE_SESSION_PATTERN.test(params.get("sv") ?? "") ? params.get("sv") : null;
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const planHeadingId = useId();

  const [options, setOptions] = useState<SignupOptions | null>(null);
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [choice, setChoice] = useState<PlanChoice>(() => ({
    planId: params.get("plan"),
    billingCycle: params.get("cycle") === "yearly" ? "yearly" : "monthly",
  }));
  const [step, setStep] = useState<Step>("account");
  const [challenge, setChallenge] = useState<VerificationChallenge | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  // Sent here from a team invite (pages/InviteAcceptPage): its address, and
  // no plan to choose — the server asks none of someone invited to a store.
  const [invite] = useState(readPendingInvite);
  const [email, setEmail] = useState(invite?.email ?? "");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [termsError, setTermsError] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const unmetRules = unmetPasswordRules(password);
  // While the form still holds the invited address (another one needs a plan as usual).
  const invitedAddress = Boolean(invite?.email && email.trim().toLowerCase() === invite.email.toLowerCase());
  const planStep = Boolean(options?.planRequired && plans.length > 0 && !invitedAddress);
  const selectedPlan = plans.find((p) => p.id === choice.planId) ?? null;

  useEffect(() => {
    let cancelled = false;
    // A server or network that can't answer leaves the form as it always was.
    Promise.allSettled([apiClient.getSignupOptions(), apiClient.listPublicPlans()]).then(([opts, list]) => {
      if (cancelled) return;
      const nextOptions = opts.status === "fulfilled" ? opts.value : null;
      const nextPlans = list.status === "fulfilled" ? list.value : [];
      setOptions(nextOptions);
      setPlans(nextPlans);
      setChoice((current) => ({
        ...current,
        planId: nextPlans.some((p) => p.id === current.planId) ? current.planId : null,
      }));
      if (nextOptions?.planRequired && nextPlans.length > 0 && !invite?.email) setStep("plan");
      setLoadingOptions(false);
    });
    return () => {
      cancelled = true;
    };
    // The invite is read once, when the page opens (useState above).
  }, [invite?.email]);

  function handleGoogleLogin() {
    // Kept for the plan page an account made through Google lands on.
    if (choice.planId) rememberPlanChoice(choice);
    window.location.href = `${apiBaseUrl}/auth/google`;
  }

  function describe(err: unknown): string {
    if (isApiErrorCode(err, "USERNAME_TAKEN")) return t.usernameTaken;
    if (isApiErrorCode(err, "EMAIL_TAKEN")) return t.emailTaken;
    if (isApiErrorCode(err, "PLAN_NOT_AVAILABLE")) return t.planGone;
    if (isApiErrorCode(err, "PLAN_REQUIRED")) return t.planRequired;
    if (isApiErrorCode(err, "TERMS_REQUIRED")) return t.termsRequired;
    if (isApiErrorCode(err, "SIGNUP_UNAVAILABLE")) return t.unavailable;
    if (err instanceof ApiError && err.status === 429) return t.tooMany;
    if (err instanceof ApiError) return err.message || t.generic;
    return t.generic;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    // Client-side gate before the API call — the backend enforces the same
    // password rule, so blocking here just spares a round-trip and a raw
    // server error. Typing is never blocked, only submitting.
    if (unmetRules.length > 0) {
      setError(t.passwordRules);
      return;
    }
    if (password !== confirm) {
      setError(t.mismatch);
      return;
    }
    if (!/^\+?\d{8,15}$/.test(phone.replace(/[\s-]/g, ""))) {
      setError(t.invalidPhone);
      document.getElementById("phone")?.focus();
      return;
    }
    if (!usernameSubmittable(usernameStatus)) {
      setError(t.chooseUsername);
      document.getElementById("register-username")?.querySelector("input")?.focus();
      return;
    }
    if (!acceptTerms) {
      setTermsError(true);
      return;
    }
    if (planStep && !selectedPlan) {
      setStep("plan");
      return;
    }

    setSubmitting(true);
    try {
      const next = await register({
        fullName,
        username: normalizeUsername(username),
        email,
        phone,
        password,
        acceptTerms: true,
        locale,
        ...(planStep && selectedPlan ? { planId: selectedPlan.id, billingCycle: choice.billingCycle } : {}),
        ...(siteSessionId ? { siteSessionId } : {}),
      });
      if (next) {
        setChallenge(next);
        setStep("code");
        return;
      }
      // Without sign-up codes the account is already signed in (AuthContext):
      // straight into the store setup, with a code on its way to confirm the
      // email (the dashboard's banner asks for it).
      navigate(afterSignInPath(), { replace: true });
    } catch (err) {
      if (isApiErrorCode(err, "PLAN_NOT_AVAILABLE") || isApiErrorCode(err, "PLAN_REQUIRED")) setStep(planStep ? "plan" : "account");
      setError(describe(err));
    } finally {
      setSubmitting(false);
    }
  }

  const totalSteps = (planStep ? 1 : 0) + 1 + (options?.verificationRequired ? 1 : 0);
  const stepNumber = step === "plan" ? 1 : step === "account" ? (planStep ? 2 : 1) : totalSteps;
  // The account form (the last branch below) takes two columns from lg up, in a
  // wider card; the loader and the code screen keep the narrow one.
  const showsAccountForm = !loadingOptions && step !== "plan" && !(step === "code" && challenge);

  return (
    <AuthShell size={step === "plan" ? "md" : "sm"} className={showsAccountForm ? "lg:max-w-4xl" : undefined}>
      {totalSteps > 1 && (
        <p className="mb-2 text-xs font-medium text-ink-soft tabular-nums">
          {fmt(t.stepOf, { n: stepNumber, total: totalSteps })}
        </p>
      )}

      {loadingOptions ? (
        <div className="flex min-h-11 items-center justify-center">
          <ZLoader label={t.loading} />
        </div>
      ) : step === "code" && challenge ? (
        <VerifyCodePanel
          challenge={challenge}
          onVerified={async () => {
            await refreshUser();
            navigate(afterSignInPath(), { replace: true });
          }}
        />
      ) : step === "plan" ? (
        <div>
          <AuthHeading id={planHeadingId} title={t.planStepTitle}>
            {t.planStepSubtitle}
          </AuthHeading>
          {error && (
            <Alert variant="danger" className="mt-4">
              {error}
            </Alert>
          )}
          <div className="mt-6">
            <PlanPicker plans={plans} value={choice} onChange={setChoice} labelledBy={planHeadingId} />
          </div>
          <Button
            type="button"
            className="mt-6 min-h-11 w-full"
            disabled={!selectedPlan}
            onClick={() => {
              setError(null);
              setStep("account");
            }}
          >
            {t.continue}
          </Button>
          <AuthFooter>
            {t.haveAccount}
            <AuthLink to="/login">{t.signIn}</AuthLink>
          </AuthFooter>
        </div>
      ) : (
        accountForm()
      )}
    </AuthShell>
  );

  // A plain function, not a component: rendered as <AccountForm /> it would be
  // a new component on every render and its inputs would lose focus.
  function accountForm() {
    return (
      <>
        <AuthHeading title={t.title}>{t.subtitle}</AuthHeading>

        {planStep && selectedPlan && (
          <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper-raised p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-ink-soft">
                {t.yourPlan}: <span className="font-medium text-ink">{selectedPlan.name}</span>
              </p>
              <Button type="button" variant="link" className="min-h-11 px-0" onClick={() => setStep("plan")}>
                {t.change}
              </Button>
            </div>
            <PlanSummary plan={selectedPlan} billingCycle={choice.billingCycle as BillingCycle} compact />
          </div>
        )}

        <div className="mt-6">
          <Button type="button" variant="outline" className="min-h-12 w-full text-base" onClick={handleGoogleLogin}>
            <GoogleMark />
            {t.google}
          </Button>
          <AuthDivider>{t.or}</AuthDivider>
        </div>

        {/* One column below lg; from lg two, in the fields' order (name | username,
            email | phone, password | confirm), with the alert, terms and submit full width. */}
        <form onSubmit={handleSubmit} className="space-y-5 lg:grid lg:grid-cols-2 lg:gap-x-6 lg:gap-y-5 lg:space-y-0">
          {error && (
            <Alert variant="danger" className="lg:col-span-2">
              {error}
            </Alert>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="fullName">{t.fullName}</Label>
            <Input
              id="fullName"
              required
              autoComplete="name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t.fullNamePlaceholder}
              className="min-h-11"
            />
          </div>

          <div id="register-username">
            <UsernameField value={username} onChange={setUsername} onStatus={setUsernameStatus} />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">{t.email}</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="min-h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="phone">{t.phone}</Label>
            <Input
              id="phone"
              type="tel"
              autoComplete="tel"
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01XXXXXXXXX"
              className="min-h-11"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">{t.password}</Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t.passwordPlaceholder}
                className="min-h-11 pe-11"
                aria-describedby="password-rules"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? t.hide : t.show}
                aria-pressed={showPassword}
                className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-ink"
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            {password.length > 0 && unmetRules.length > 0 && (
              <ul id="password-rules" className="mt-1 space-y-1 text-xs text-ink-soft">
                {unmetRules.map((rule) => (
                  <li key={rule.id} className="flex items-center gap-1.5">
                    <span aria-hidden>•</span>
                    {passwordRuleLabel(rule, locale)}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="confirm">{t.confirm}</Label>
            <div className="relative">
              <Input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                required
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="••••••••"
                className="min-h-11 pe-11"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                aria-label={showConfirm ? t.hide : t.show}
                aria-pressed={showConfirm}
                className="absolute inset-y-0 end-0 flex w-11 cursor-pointer items-center justify-center text-ink-soft transition-colors hover:text-ink"
              >
                {showConfirm ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            {confirm.length > 0 && password !== confirm && <p className="mt-1 text-xs text-danger">{t.mismatch}</p>}
          </div>

          <div className="lg:col-span-2">
            <TermsConsent
              checked={acceptTerms}
              onChange={(next) => {
                setAcceptTerms(next);
                if (next) setTermsError(false);
              }}
              showError={termsError}
              disabled={submitting}
            />
          </div>

          <Button type="submit" className="min-h-11 w-full lg:col-span-2" disabled={submitting}>
            {submitting ? t.creating : t.create}
          </Button>
        </form>

        <AuthFooter>
          {t.haveAccount}
          <AuthLink to="/login">{t.signIn}</AuthLink>
        </AuthFooter>
      </>
    );
  }
}
