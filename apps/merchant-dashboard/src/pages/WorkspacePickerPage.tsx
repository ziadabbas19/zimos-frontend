import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, PartyPopper, PencilRuler } from "lucide-react";
import { Button, Card, CardContent, Input, Label, Alert, ZLoader } from "@store-builder/ui";
import { apiErrorDetails, isApiErrorCode, type BusinessType, type PublicPlan, type Workspace } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useSlugCheck } from "@/lib/useSlugCheck";
import { suggestSlug, storeHost, storeUrl } from "@/lib/storeAddress";
import { useErrorMessage } from "@/lib/errorMessages";
import { apiClient } from "@/lib/apiClient";
import { StoreAddressField } from "@/components/StoreAddressField";
import { CopyButton } from "@/components/CopyButton";
import { SignOutButton } from "@/components/SignOutButton";
import { PlanPicker, type PlanChoice } from "@/components/plans/PlanPicker";
import { BusinessTypeField } from "@/components/BusinessTypeField";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { AuthShell } from "./AuthShell";
import { PlansStep } from "./subscription/PlansStep";

const STRINGS = {
  en: {
    choose: "Choose a store",
    setUp: "Let's set up your store",
    signedInAs: "Signed in as {email}.",
    signOut: "Sign out",
    open: "Open",
    createTitle: "Create a new store",
    storeName: "Store name",
    planTitle: "Plan for this store",
    create: "Create store",
    creating: "Creating…",
    createFailed: "Couldn't create the store. Try again.",
    limitStores: "You've reached your plan's store limit ({used} of {max}). Upgrade one of your stores' plans to add another.",
    limitDrafts: "Subscribe to one of your stores before starting another.",
    planGone: "That plan is no longer available. Choose another one.",
    planRequired: "Choose a plan for this store.",
    liveTitle: "{name} is live",
    liveBody: "Your store has its own address. This is the link to share with customers.",
    draftTitle: "{name} is ready to build",
    draftBody:
      "Your store is in draft mode: add your products and design your website as you like. When you're ready, subscribe to publish it at this address.",
    addressError: "We couldn't give your store the address you picked — {error} It was created at the address below instead.",
    linkLabel: "Your store link",
    linkHint: "You can always find this link at the top of your dashboard.",
    visit: "Visit store",
    copyLink: "Copy link",
  },
  ar: {
    choose: "اختر متجرًا",
    setUp: "لنُعدّ متجرك",
    signedInAs: "مسجّل الدخول باسم {email}.",
    signOut: "تسجيل الخروج",
    open: "فتح",
    createTitle: "إنشاء متجر جديد",
    storeName: "اسم المتجر",
    planTitle: "خطة هذا المتجر",
    create: "إنشاء المتجر",
    creating: "جارٍ الإنشاء…",
    createFailed: "تعذّر إنشاء المتجر. حاول مرة أخرى.",
    limitStores: "بلغت الحد الأقصى لعدد المتاجر في خطتك ({used} من {max}). رقِّ خطة أحد متاجرك لإضافة متجر آخر.",
    limitDrafts: "اشترك في أحد متاجرك قبل بدء متجر جديد.",
    planGone: "هذه الخطة لم تعد متاحة. اختر خطة أخرى.",
    planRequired: "اختر خطة لهذا المتجر.",
    liveTitle: "{name} يعمل الآن",
    liveBody: "أصبح لمتجرك عنوانه الخاص. هذا هو الرابط الذي تشاركه مع عملائك.",
    draftTitle: "{name} جاهز للبناء",
    draftBody:
      "متجرك في وضع المسودة: أضف منتجاتك وصمّم موقعك كما تشاء. وعندما تكون جاهزًا، اشترك لنشره على هذا العنوان.",
    addressError: "تعذّر منح متجرك العنوان الذي اخترته — {error} وأُنشئ على العنوان أدناه بدلًا منه.",
    linkLabel: "رابط متجرك",
    linkHint: "تجد هذا الرابط دائمًا أعلى لوحة التحكم.",
    visit: "زيارة المتجر",
    copyLink: "نسخ الرابط",
  },
} satisfies Messages;

export function WorkspacePickerPage() {
  const t = useT(STRINGS);
  const { user } = useAuth();
  const { workspaces, loading, selectWorkspace, createWorkspace } = useWorkspace();
  const navigate = useNavigate();
  const errorMessage = useErrorMessage();
  const addressId = useId();
  const planHeadingId = useId();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Until the merchant touches the address it follows the name, so the common
  // case needs no thought. Once they have edited it, it is theirs and the name
  // stops overwriting it.
  const [slugEdited, setSlugEdited] = useState(false);
  // What the store sells: optional, one tap ("other" adds a few words).
  const [businessType, setBusinessType] = useState<BusinessType | null>(null);
  const [businessOther, setBusinessOther] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<{ workspace: Workspace; addressError?: string; draft: boolean } | null>(null);
  // While the server requires plans, a store after the first is created on a
  // plan chosen here (the first one takes the plan chosen at sign-up).
  const [plans, setPlans] = useState<PublicPlan[]>([]);
  const [planRequired, setPlanRequired] = useState(false);
  const [plan, setPlan] = useState<PlanChoice>({ planId: null, billingCycle: "monthly" });

  const slugCheck = useSlugCheck(slug);
  const askForPlan = planRequired && plans.length > 0 && workspaces.length > 0;

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([apiClient.getSignupOptions(), apiClient.listPublicPlans()]).then(([opts, list]) => {
      if (cancelled) return;
      setPlanRequired(opts.status === "fulfilled" && opts.value.planRequired);
      setPlans(list.status === "fulfilled" ? list.value : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  function onNameChange(value: string) {
    setName(value);
    if (!slugEdited) setSlug(suggestSlug(value));
  }

  function onSlugChange(value: string) {
    setSlugEdited(true);
    setSlug(value);
  }

  function goToDashboard(workspaceId: string) {
    selectWorkspace(workspaceId);
    navigate("/");
  }

  function describe(err: unknown): string {
    if (isApiErrorCode(err, "PLAN_LIMIT_REACHED")) {
      const details = apiErrorDetails<{ limit?: string; max?: number; used?: number }>(err);
      if (details?.limit === "draft_stores") return t.limitDrafts;
      return fmt(t.limitStores, { max: details?.max ?? "", used: details?.used ?? "" });
    }
    if (isApiErrorCode(err, "PLAN_NOT_AVAILABLE")) return t.planGone;
    if (isApiErrorCode(err, "PLAN_REQUIRED")) return t.planRequired;
    return errorMessage(err) || t.createFailed;
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (askForPlan && !plan.planId) {
      setError(t.planRequired);
      return;
    }
    setCreating(true);
    try {
      const result = await createWorkspace(name.trim(), slug, {
        plan: askForPlan && plan.planId ? { planId: plan.planId, billingCycle: plan.billingCycle } : undefined,
        businessType,
        businessTypeOther: businessType === "other" ? businessOther.trim() || null : null,
      });
      // A store made while subscriptions are required starts as a draft.
      const access = await apiClient.getWorkspaceAccess(result.workspace.id).catch(() => null);
      setCreated({ ...result, draft: Boolean(access?.draft) });
    } catch (err) {
      setError(describe(err));
    } finally {
      setCreating(false);
    }
  }

  // The address has to be known-good before the store is created: a store can
  // be moved afterwards, but the merchant should not find that out by being
  // given an address they didn't choose.
  const canSubmit = name.trim().length > 0 && slugCheck.status === "available" && !creating;

  if (created) {
    return <StoreCreated {...created} onOpenDashboard={() => goToDashboard(created.workspace.id)} />;
  }

  return (
    <AuthShell size="lg">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium text-ink">{workspaces.length > 0 ? t.choose : t.setUp}</h1>
            <p className="mt-2 text-sm text-ink-soft">
              {fmt(t.signedInAs, { email: user?.email ?? "" })}{" "}
              <SignOutButton className="min-h-11 cursor-pointer text-primary hover:underline">{t.signOut}</SignOutButton>
            </p>
          </div>
        </div>

        {loading ? (
          <div className="mt-10 flex justify-center text-ink-soft">
            <ZLoader />
          </div>
        ) : (
          <>
            {workspaces.length > 0 && (
              <div className="mt-8 space-y-3">
                {workspaces.map((workspace) => (
                  <button
                    key={workspace.id}
                    onClick={() => goToDashboard(workspace.id)}
                    className="flex min-h-11 w-full cursor-pointer items-center justify-between rounded-[var(--radius-card)] border border-line bg-paper-raised px-5 py-4 text-start transition-colors hover:border-primary"
                  >
                    <div>
                      <p className="font-medium text-ink">{workspace.name}</p>
                      <p className="text-xs text-ink-soft" dir="ltr">
                        {storeHost(workspace.slug)}
                      </p>
                    </div>
                    <span className="text-sm text-primary">
                      {t.open} <span aria-hidden className="inline-block rtl:rotate-180">→</span>
                    </span>
                  </button>
                ))}
              </div>
            )}

            <Card className="mt-8">
              <CardContent className="pt-6">
                <h2 className="font-display text-lg font-medium text-ink">{t.createTitle}</h2>
                <form onSubmit={handleCreate} className="mt-4 space-y-4">
                  {error && <Alert variant="danger">{error}</Alert>}
                  <div className="space-y-1.5">
                    <Label htmlFor="workspaceName">{t.storeName}</Label>
                    <Input
                      id="workspaceName"
                      required
                      value={name}
                      onChange={(e) => onNameChange(e.target.value)}
                      placeholder={t.storeName}
                      className="min-h-11"
                    />
                  </div>

                  <StoreAddressField id={addressId} value={slug} onChange={onSlugChange} state={slugCheck} disabled={creating} />

                  <BusinessTypeField
                    value={businessType}
                    other={businessOther}
                    onChange={setBusinessType}
                    onOtherChange={setBusinessOther}
                    disabled={creating}
                  />

                  {askForPlan && (
                    <div className="space-y-2">
                      <h3 id={planHeadingId} className="text-sm font-medium text-ink">
                        {t.planTitle}
                      </h3>
                      <PlanPicker plans={plans} value={plan} onChange={setPlan} disabled={creating} labelledBy={planHeadingId} />
                    </div>
                  )}

                  <Button type="submit" className="min-h-11" disabled={!canSubmit}>
                    {creating ? t.creating : t.create}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </>
        )}
    </AuthShell>
  );
}

/**
 * What a merchant sees the moment their store exists: the store's link (the
 * first time it has a public address, and the thing they will need to send to
 * someone), then the plans (PlansStep) with "Explore first, decide later",
 * which goes straight to the dashboard. A draft store's address works once it
 * is subscribed, which the screen says instead of calling it live.
 */
function StoreCreated({
  workspace,
  addressError,
  draft,
  onOpenDashboard,
}: {
  workspace: Workspace;
  addressError?: string;
  draft: boolean;
  onOpenDashboard: () => void;
}) {
  const t = useT(STRINGS);
  const url = storeUrl(workspace.slug);

  return (
    <AuthShell size="lg" className="max-w-5xl">
      <div className="max-w-2xl">
        <div className={draft ? "flex size-12 items-center justify-center rounded-full bg-primary-soft" : "flex size-12 items-center justify-center rounded-full bg-success-soft"}>
          {draft ? <PencilRuler className="size-6 text-primary" aria-hidden /> : <PartyPopper className="size-6 text-success" aria-hidden />}
        </div>
        <h1 className="mt-4 font-display text-3xl font-medium text-ink">
          {fmt(draft ? t.draftTitle : t.liveTitle, { name: workspace.name })}
        </h1>
        <p className="mt-2 text-sm text-ink-soft">{draft ? t.draftBody : t.liveBody}</p>

        {addressError && (
          <Alert variant="danger" className="mt-6">
            {fmt(t.addressError, { error: addressError })}
          </Alert>
        )}

        <div className="mt-6 rounded-[var(--radius-card)] border border-line bg-paper-raised p-5">
          <Label>{t.linkLabel}</Label>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {draft ? (
              <span className="font-display text-lg font-medium break-all text-ink" dir="ltr">
                {storeHost(workspace.slug)}
              </span>
            ) : (
              <a href={url} target="_blank" rel="noreferrer" className="font-display text-lg font-medium break-all text-primary hover:underline" dir="ltr">
                {storeHost(workspace.slug)}
              </a>
            )}
            <CopyButton value={url} label={t.copyLink} />
            {!draft && (
              <Button variant="outline" className="min-h-11" asChild>
                <a href={url} target="_blank" rel="noreferrer">
                  <ExternalLink className="size-4" aria-hidden />
                  {t.visit}
                </a>
              </Button>
            )}
          </div>
          <p className="mt-3 text-xs text-ink-soft">{t.linkHint}</p>
        </div>
      </div>

      <div className="mt-10">
        <PlansStep onExplore={onOpenDashboard} />
      </div>
    </AuthShell>
  );
}
