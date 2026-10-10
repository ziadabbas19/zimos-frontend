import { useId, useRef, useState, type ReactNode } from "react";
import { IconLink } from "@/components/icons";
import { Button, Input, cn } from "@store-builder/ui";
import {
  engagementGetNewsletter,
  engagementGetSocialProof,
  engagementReferrals,
  engagementSaveNewsletter,
  engagementSaveSocialProof,
  type EngagementNewsletter,
  type EngagementSocialProof,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { formatDate, formatMoney } from "@/lib/format";
import { countOf } from "@/lib/plural";
import { storeUrl } from "@/lib/storeAddress";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { CopyButton } from "@/components/CopyButton";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { TextField } from "@/components/Field";
import { ListRowCard, ListSkeleton } from "@/components/list";
import { useToast } from "@/components/Toast";
import { ProductSelect, useStoreProducts } from "./OfferRuleParts";
import { FormProblem, OfferPage, OfferPreview, TOUCH_FIELD } from "./OfferKit";

/**
 * Three small screens of the offers hub (SPEC §10.7–10.9): sales
 * notifications built from real orders, the newsletter sign-up form, and
 * referral links with what each one brought in. The first two are settings
 * forms — grouped rows, what the shopper sees, a save bar while something
 * changed; the third builds a link and lists what each link brought.
 */

const STRINGS = {
  en: {
    saved: "Saved.",
    stateOn: "On",
    stateOff: "Off",
    // social proof
    spTitle: "Sales notifications",
    spDescription: "A small popup: “Ahmed from Mansoura bought this 12 minutes ago”. Only real, confirmed orders of the last 7 days are ever shown.",
    spEnabled: "Show sales notifications",
    spEnough: "{orders} confirmed in the last 7 days can be shown.",
    spNotEnough: "Only {orders} confirmed in the last 7 days. With fewer than {min}, your store shows nothing — it never invents names.",
    spWhereGroup: "Where and how often",
    spPosition: "Corner",
    spPosition_bottom_start: "Bottom, start side",
    spPosition_bottom_end: "Bottom, end side",
    spPages: "On",
    spPages_all: "Every page",
    spPages_product: "Product pages",
    spDelay: "First one after (seconds)",
    spDelayHint: "From 1 to 120.",
    spInterval: "Then every (seconds)",
    spIntervalHint: "From 5 to 300.",
    spMax: "At most per visit",
    spMaxHint: "From 1 to 20.",
    spWhatGroup: "What it shows",
    spShowName: "Show the customer's first name",
    spShowCity: "Show the governorate",
    spSampleName: "Ahmed",
    spSampleCity: "Mansoura",
    spPreviewBoth: "{name} from {city} bought this {ago} ago",
    spPreviewName: "{name} bought this {ago} ago",
    spPreviewCity: "Someone from {city} bought this {ago} ago",
    spPreviewNone: "Someone bought this {ago} ago",
    // newsletter
    nlTitle: "Newsletter sign-up",
    nlDescription: "A form that collects a mobile number (and name or email) from visitors who want to hear from you. Each one becomes a contact with marketing consent.",
    nlEnabled: "Show the sign-up form",
    nlWhereGroup: "Where",
    nlPlacement: "Where",
    nlPlacement_footer: "Above the footer",
    nlPlacement_popup: "A popup after a delay",
    nlDelay: "Popup delay (seconds)",
    nlDelayHint: "From 3 to 600.",
    nlWordsGroup: "What it says and asks",
    nlHeading: "Title",
    nlHeadingPlaceholder: "Be the first to know",
    nlText: "Text",
    nlTextPlaceholder: "New arrivals and offers, on WhatsApp.",
    nlAskName: "Ask for the name",
    nlAskEmail: "Ask for the email",
    nlCoupon: "Coupon for subscribers",
    nlCouponNone: "No coupon",
    nlCouponHint: "Shown to the visitor right after they subscribe.",
    nlFieldMobile: "Mobile number",
    nlFieldName: "Name",
    nlFieldEmail: "Email",
    nlSubscribe: "Subscribe",
    nlThenCode: "Then they get the code",
    // referrals
    rfTitle: "Referral links",
    rfDescription: "Give each marketer a link of their own and see the orders it brought.",
    rfBuild: "Build a link",
    rfCode: "Marketer's code",
    rfCodePlaceholder: "ahmed1",
    rfCodeHint: "Letters, digits, - and _. It is what appears in the results.",
    rfProduct: "Send visitors to",
    rfWholeStore: "The store's home page",
    rfLink: "The link",
    rfLinkEmpty: "Write the marketer's code and the link shows here, ready to copy.",
    rfCopy: "Copy link",
    rfResults: "Results — last {days} days",
    rfEmptyTitle: "No orders through a referral link yet",
    rfEmptyHint: "Build a link for a marketer and send it to them. Every order that comes through it is counted here.",
    rfEmptyAction: "Build a link",
    rfColCode: "Code",
    rfColOrders: "Orders",
    rfColConfirmed: "Confirmed",
    rfColRevenue: "Sales",
    rfColLast: "Last order",
    rfConfirmed: "{count} confirmed",
    rfLast: "last {date}",
    rfListLabel: "What each link brought",
  },
  ar: {
    saved: "تم الحفظ.",
    stateOn: "مفعّل",
    stateOff: "متوقف",
    spTitle: "إشعارات المبيعات",
    spDescription: "نافذة صغيرة: «أحمد من المنصورة اشترى هذا منذ 12 دقيقة». لا يُعرض إلا طلبات حقيقية مؤكدة من آخر 7 أيام.",
    spEnabled: "إظهار إشعارات المبيعات",
    spEnough: "يمكن عرض {orders} من الطلبات المؤكدة في آخر 7 أيام.",
    spNotEnough: "الطلبات المؤكدة في آخر 7 أيام: {orders} فقط. بأقل من {min} لا يعرض متجرك شيئًا — لا يختلق أسماء أبدًا.",
    spWhereGroup: "أين وكم مرة",
    spPosition: "المكان",
    spPosition_bottom_start: "أسفل، جهة البداية",
    spPosition_bottom_end: "أسفل، جهة النهاية",
    spPages: "في",
    spPages_all: "كل الصفحات",
    spPages_product: "صفحات المنتجات",
    spDelay: "أول إشعار بعد (ثانية)",
    spDelayHint: "من 1 إلى 120.",
    spInterval: "ثم كل (ثانية)",
    spIntervalHint: "من 5 إلى 300.",
    spMax: "الحد الأقصى في الزيارة",
    spMaxHint: "من 1 إلى 20.",
    spWhatGroup: "ماذا يعرض",
    spShowName: "إظهار الاسم الأول للعميل",
    spShowCity: "إظهار المحافظة",
    spSampleName: "أحمد",
    spSampleCity: "المنصورة",
    spPreviewBoth: "{name} من {city} اشترى هذا {ago}",
    spPreviewName: "{name} اشترى هذا {ago}",
    spPreviewCity: "شخص من {city} اشترى هذا {ago}",
    spPreviewNone: "شخص اشترى هذا {ago}",
    nlTitle: "الاشتراك في النشرة",
    nlDescription: "نموذج يجمع رقم الهاتف (والاسم أو البريد الإلكتروني) من الزوار الذين يريدون متابعتك. كل مشترك يصبح جهة اتصال موافقة على التسويق.",
    nlEnabled: "إظهار نموذج الاشتراك",
    nlWhereGroup: "أين",
    nlPlacement: "المكان",
    nlPlacement_footer: "فوق الفوتر",
    nlPlacement_popup: "نافذة بعد مدة",
    nlDelay: "مدة ظهور النافذة (ثانية)",
    nlDelayHint: "من 3 إلى 600.",
    nlWordsGroup: "ما المكتوب فيه وعمّ يسأل",
    nlHeading: "العنوان",
    nlHeadingPlaceholder: "كن أول من يعرف",
    nlText: "النص",
    nlTextPlaceholder: "المنتجات الجديدة والعروض، على واتساب.",
    nlAskName: "طلب الاسم",
    nlAskEmail: "طلب البريد الإلكتروني",
    nlCoupon: "كوبون للمشتركين",
    nlCouponNone: "بدون كوبون",
    nlCouponHint: "يظهر للزائر فور اشتراكه.",
    nlFieldMobile: "رقم الهاتف",
    nlFieldName: "الاسم",
    nlFieldEmail: "البريد الإلكتروني",
    nlSubscribe: "اشترك",
    nlThenCode: "ثم يحصل على الكود",
    rfTitle: "روابط الإحالة",
    rfDescription: "أعطِ كل مسوّق رابطًا خاصًا به وشاهد الطلبات التي جاءت منه.",
    rfBuild: "إنشاء رابط",
    rfCode: "كود المسوّق",
    rfCodePlaceholder: "ahmed1",
    rfCodeHint: "حروف وأرقام و- و_. هو ما يظهر في النتائج.",
    rfProduct: "يوجّه الزائر إلى",
    rfWholeStore: "الصفحة الرئيسية للمتجر",
    rfLink: "الرابط",
    rfLinkEmpty: "اكتب كود المسوّق ليظهر الرابط هنا جاهزًا للنسخ.",
    rfCopy: "نسخ الرابط",
    rfResults: "النتائج — آخر {days} يوم",
    rfEmptyTitle: "لا توجد طلبات من روابط الإحالة بعد",
    rfEmptyHint: "أنشئ رابطًا لمسوّق وأرسله إليه. كل طلب يأتي منه يُحتسب هنا.",
    rfEmptyAction: "إنشاء رابط",
    rfColCode: "الكود",
    rfColOrders: "الطلبات",
    rfColConfirmed: "المؤكدة",
    rfColRevenue: "المبيعات",
    rfColLast: "آخر طلب",
    rfConfirmed: "{count} مؤكدة",
    rfLast: "آخر طلب {date}",
    rfListLabel: "ما جلبه كل رابط",
  },
} satisfies Messages;

const clampInt = (value: string, min: number, max: number) => Math.min(max, Math.max(min, Number.parseInt(value, 10) || min));

const NUMBER_BOX = "h-11 w-24 text-center text-base tabular-nums md:h-10 md:text-sm";

/** A whole number of seconds or of times, in a row of a settings group. */
function NumberRow({
  label,
  hint,
  value,
  min,
  max,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  min: number;
  max: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const id = useId();
  return (
    <SettingsRow
      label={label}
      hint={hint}
      htmlFor={id}
      control={
        <Input
          id={id}
          type="number"
          inputMode="numeric"
          dir="ltr"
          min={min}
          max={max}
          value={String(value)}
          disabled={disabled}
          onChange={(e) => onChange(clampInt(e.target.value, min, max))}
          className={NUMBER_BOX}
        />
      }
    />
  );
}

/** A choice from a short list, in a row of a settings group. */
function SelectRow({
  label,
  hint,
  value,
  disabled,
  stacked,
  onChange,
  children,
}: {
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  stacked?: boolean;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <SettingsRow
      label={label}
      hint={hint}
      htmlFor={id}
      stacked={stacked}
      control={
        <Select id={id} className={TOUCH_FIELD} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
          {children}
        </Select>
      }
    />
  );
}

/** A line of text, under its label, in a row of a settings group. */
function TextRow({
  label,
  value,
  placeholder,
  maxLength,
  disabled,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  maxLength: number;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  const id = useId();
  return (
    <SettingsRow
      stacked
      label={label}
      htmlFor={id}
      control={
        <Input id={id} maxLength={maxLength} placeholder={placeholder} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} className={TOUCH_FIELD} />
      }
    />
  );
}

function StateBadge({ on }: { on: boolean }) {
  const t = useT(STRINGS);
  return <StatusBadge value={on ? "active" : "disabled"} tone={on ? "success" : "neutral"} text={on ? t.stateOn : t.stateOff} />;
}

// ------------------------------------------------------------ social proof --

export function SocialProofPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<EngagementSocialProof | null>(null);
  const [saved, setSaved] = useState<EngagementSocialProof | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const state = useAsync(async () => {
    const loaded = await engagementGetSocialProof(apiClient, workspaceId);
    setDraft(loaded.socialProof);
    setSaved(loaded.socialProof);
    return loaded;
  }, [workspaceId]);
  const set = <K extends keyof EngagementSocialProof>(key: K, value: EngagementSocialProof[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError(null);
  };

  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
  useReportDirty(dirty);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const next = await engagementSaveSocialProof(apiClient, workspaceId, draft);
      setDraft(next);
      setSaved(next);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const real = state.data?.realOrders ?? 0;
  const min = state.data?.minimumOrders ?? 3;
  const off = busy || !draft?.enabled;
  const ago = countOf("minute", 12);

  return (
    <OfferPage title={t.spTitle} description={t.spDescription} width="form" titleBadge={saved ? <StateBadge on={saved.enabled} /> : undefined}>
      <DataState loading={state.loading} error={state.error} onRetry={() => state.refresh()}>
        {draft && (
          <div className="space-y-4">
            <SettingsGroup
              footer={
                <span className={real >= min ? "text-success" : undefined}>
                  <bdi>{fmt(real >= min ? t.spEnough : t.spNotEnough, { orders: countOf("order", real), min })}</bdi>
                </span>
              }
            >
              <SettingsSwitch checked={draft.enabled} onChange={(next) => set("enabled", next)} label={t.spEnabled} disabled={busy} />
            </SettingsGroup>

            {draft.enabled && (
              <OfferPreview>
                <p className="font-medium">
                  <bdi>
                    {fmt(draft.showName ? (draft.showCity ? t.spPreviewBoth : t.spPreviewName) : draft.showCity ? t.spPreviewCity : t.spPreviewNone, {
                      name: t.spSampleName,
                      city: t.spSampleCity,
                      ago,
                    })}
                  </bdi>
                </p>
              </OfferPreview>
            )}

            <SettingsGroup title={t.spWhatGroup}>
              <SettingsSwitch checked={draft.showName} onChange={(next) => set("showName", next)} label={t.spShowName} disabled={off} />
              <SettingsSwitch checked={draft.showCity} onChange={(next) => set("showCity", next)} label={t.spShowCity} disabled={off} />
            </SettingsGroup>

            <SettingsGroup title={t.spWhereGroup}>
              <SelectRow label={t.spPosition} value={draft.position} disabled={off} onChange={(value) => set("position", value as EngagementSocialProof["position"])}>
                <option value="bottom_start">{t.spPosition_bottom_start}</option>
                <option value="bottom_end">{t.spPosition_bottom_end}</option>
              </SelectRow>
              <SelectRow label={t.spPages} value={draft.pages} disabled={off} onChange={(value) => set("pages", value as EngagementSocialProof["pages"])}>
                <option value="all">{t.spPages_all}</option>
                <option value="product">{t.spPages_product}</option>
              </SelectRow>
              <NumberRow label={t.spDelay} hint={t.spDelayHint} value={draft.delaySeconds} min={1} max={120} disabled={off} onChange={(value) => set("delaySeconds", value)} />
              <NumberRow label={t.spInterval} hint={t.spIntervalHint} value={draft.intervalSeconds} min={5} max={300} disabled={off} onChange={(value) => set("intervalSeconds", value)} />
              <NumberRow label={t.spMax} hint={t.spMaxHint} value={draft.maxPerSession} min={1} max={20} disabled={off} onChange={(value) => set("maxPerSession", value)} />
            </SettingsGroup>

            <FormProblem>{error}</FormProblem>
            <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={() => setDraft(saved)} />
          </div>
        )}
      </DataState>
    </OfferPage>
  );
}

// --------------------------------------------------------------- newsletter --

export function NewsletterPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [draft, setDraft] = useState<EngagementNewsletter | null>(null);
  const [saved, setSaved] = useState<EngagementNewsletter | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [settings, discounts] = await Promise.all([engagementGetNewsletter(apiClient, workspaceId), apiClient.listDiscounts(workspaceId)]);
    setDraft(settings);
    setSaved(settings);
    return discounts.filter((d) => d.code);
  }, [workspaceId]);
  const set = <K extends keyof EngagementNewsletter>(key: K, value: EngagementNewsletter[K]) => {
    setDraft((current) => (current ? { ...current, [key]: value } : current));
    setError(null);
  };

  const dirty = Boolean(draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
  useReportDirty(dirty);

  async function save() {
    if (!draft) return;
    setBusy(true);
    setError(null);
    try {
      const next = await engagementSaveNewsletter(apiClient, workspaceId, draft);
      setDraft(next);
      setSaved(next);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const off = busy || !draft?.enabled;
  const coupon = (data.data ?? []).find((d) => d.id === draft?.discountId);
  const mockField = "flex min-h-9 items-center rounded-[0.625rem] bg-paper-raised px-3 text-[13px] text-ink-soft ring-1 ring-line";

  return (
    <OfferPage title={t.nlTitle} description={t.nlDescription} width="form" titleBadge={saved ? <StateBadge on={saved.enabled} /> : undefined}>
      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        {draft && (
          <div className="space-y-4">
            <SettingsGroup>
              <SettingsSwitch checked={draft.enabled} onChange={(next) => set("enabled", next)} label={t.nlEnabled} disabled={busy} />
            </SettingsGroup>

            {draft.enabled && (
              <OfferPreview>
                <p className="font-display text-base font-semibold text-ink">
                  <bdi>{draft.title?.trim() || t.nlHeadingPlaceholder}</bdi>
                </p>
                <p className="text-ink-soft">
                  <bdi>{draft.text?.trim() || t.nlTextPlaceholder}</bdi>
                </p>
                <div aria-hidden className="grid gap-2 pt-1 sm:grid-cols-2">
                  {draft.askName && <span className={mockField}>{t.nlFieldName}</span>}
                  <span className={mockField}>{t.nlFieldMobile}</span>
                  {draft.askEmail && <span className={mockField}>{t.nlFieldEmail}</span>}
                  <span className="flex min-h-9 items-center justify-center rounded-full bg-primary px-4 text-[13px] font-semibold text-primary-foreground">{t.nlSubscribe}</span>
                </div>
                {coupon?.code && (
                  <p className="pt-1 text-xs text-ink-soft">
                    {t.nlThenCode}{" "}
                    <bdi dir="ltr" className="font-semibold text-ink">
                      {coupon.code}
                    </bdi>
                  </p>
                )}
              </OfferPreview>
            )}

            <SettingsGroup title={t.nlWhereGroup}>
              <SelectRow label={t.nlPlacement} value={draft.placement} disabled={off} onChange={(value) => set("placement", value as EngagementNewsletter["placement"])}>
                <option value="footer">{t.nlPlacement_footer}</option>
                <option value="popup">{t.nlPlacement_popup}</option>
              </SelectRow>
              {draft.placement === "popup" && (
                <NumberRow label={t.nlDelay} hint={t.nlDelayHint} value={draft.delaySeconds} min={3} max={600} disabled={off} onChange={(value) => set("delaySeconds", value)} />
              )}
            </SettingsGroup>

            <SettingsGroup title={t.nlWordsGroup}>
              <TextRow label={t.nlHeading} maxLength={120} placeholder={t.nlHeadingPlaceholder} value={draft.title ?? ""} disabled={off} onChange={(value) => set("title", value)} />
              <TextRow label={t.nlText} maxLength={300} placeholder={t.nlTextPlaceholder} value={draft.text ?? ""} disabled={off} onChange={(value) => set("text", value)} />
              <SettingsSwitch checked={draft.askName} onChange={(next) => set("askName", next)} label={t.nlAskName} disabled={off} />
              <SettingsSwitch checked={draft.askEmail} onChange={(next) => set("askEmail", next)} label={t.nlAskEmail} disabled={off} />
              <SelectRow stacked label={t.nlCoupon} hint={t.nlCouponHint} value={draft.discountId ?? ""} disabled={off} onChange={(value) => set("discountId", value || null)}>
                <option value="">{t.nlCouponNone}</option>
                {(data.data ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.code}
                  </option>
                ))}
              </SelectRow>
            </SettingsGroup>

            <FormProblem>{error}</FormProblem>
            <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={() => setDraft(saved)} />
          </div>
        )}
      </DataState>
    </OfferPage>
  );
}

// ---------------------------------------------------------------- referrals --

const REFERRAL_DAYS = 30;

export function ReferralLinksPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const products = useStoreProducts();
  // Shown at once from the session's copy on the way back from the hub, and read again behind it.
  const results = useCachedAsync(`offer-referrals:${workspaceId}`, () => engagementReferrals(apiClient, workspaceId, REFERRAL_DAYS), [workspaceId]);
  const [code, setCode] = useState("");
  const [productId, setProductId] = useState<string | null>(null);
  const builder = useRef<HTMLDivElement>(null);

  const cleanCode = code.trim().replace(/[^A-Za-z0-9_-]/g, "");
  const product = (products.data ?? []).find((p) => p.id === productId);
  const baseUrl = currentWorkspace?.slug ? storeUrl(currentWorkspace.slug) : "";
  const link = cleanCode && baseUrl ? `${baseUrl}${product ? `/products/${product.slug}` : "/"}?ref=${encodeURIComponent(cleanCode)}` : "";

  const rows = results.data ?? [];
  const head = "px-3 py-3 text-start font-medium whitespace-nowrap";

  return (
    <OfferPage title={t.rfTitle} description={t.rfDescription} className="space-y-4">
      <SettingsGroup title={t.rfBuild}>
        <div ref={builder} className="space-y-4 px-4 py-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label={t.rfCode}
              hint={t.rfCodeHint}
              dir="ltr"
              autoCapitalize="none"
              autoComplete="off"
              spellCheck={false}
              maxLength={60}
              placeholder={t.rfCodePlaceholder}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="[&_input]:h-11 [&_input]:text-base md:[&_input]:h-10 md:[&_input]:text-sm"
            />
            <ProductSelect
              id="ref-product"
              label={t.rfProduct}
              anyLabel={t.rfWholeStore}
              products={products.data ?? []}
              value={productId}
              onChange={setProductId}
              disabled={products.loading}
            />
          </div>
          {link ? (
            <div className="space-y-1.5">
              <label htmlFor="ref-link" className="text-sm font-medium text-ink">
                {t.rfLink}
              </label>
              <div className="flex items-center gap-2">
                <Input id="ref-link" dir="ltr" readOnly value={link} onFocus={(e) => e.target.select()} className={cn("min-w-0 flex-1", TOUCH_FIELD)} />
                <CopyButton value={link} label={t.rfCopy} className="zimos-offer-copy min-h-11 shrink-0 bg-paper-sunken px-3.5 text-sm text-ink" />
              </div>
            </div>
          ) : (
            <p className="text-[13px] leading-5 text-ink-soft">{t.rfLinkEmpty}</p>
          )}
        </div>
      </SettingsGroup>

      <section aria-labelledby="ref-results-title" className="space-y-2">
        <h2 id="ref-results-title" className="px-4 text-[13px] leading-5 font-semibold text-ink-soft">
          {fmt(t.rfResults, { days: REFERRAL_DAYS })}
        </h2>
        <DataState loading={results.loading} error={results.error} onRetry={() => results.refresh()} skeleton={<ListSkeleton rows={3} />}>
          {rows.length === 0 ? (
            <EmptyState
              icon={<IconLink />}
              title={t.rfEmptyTitle}
              description={t.rfEmptyHint}
              action={
                <Button
                  type="button"
                  className="min-h-11 rounded-full px-5"
                  onClick={() => {
                    builder.current?.scrollIntoView({ block: "center" });
                    builder.current?.querySelector<HTMLInputElement>("input")?.focus({ preventScroll: true });
                  }}
                >
                  {t.rfEmptyAction}
                </Button>
              }
            />
          ) : (
            <>
              {/* A phone: a card per link — the code and its sales first, then the counts. */}
              <ul aria-label={t.rfListLabel} className="flex flex-col gap-2.5 md:hidden">
                {rows.map((row) => (
                  <li key={row.ref}>
                    <ListRowCard
                      title={<bdi dir="ltr">{row.ref}</bdi>}
                      amount={<bdi>{formatMoney(row.revenue)}</bdi>}
                      status={<span className="font-medium text-ink tabular-nums">{countOf("order", row.orders)}</span>}
                      meta={
                        <span className="tabular-nums">
                          {fmt(t.rfConfirmed, { count: row.confirmedOrders })} · {fmt(t.rfLast, { date: formatDate(row.lastOrderAt) })}
                        </span>
                      }
                    />
                  </li>
                ))}
              </ul>
              <div
                data-slot="offers-table"
                className="zimos-offers-table hidden overflow-x-auto rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line md:block"
              >
                <table className="w-full min-w-[520px] text-sm">
                  <caption className="sr-only">{t.rfListLabel}</caption>
                  <thead>
                    <tr className="border-b border-line bg-paper-sunken/60 text-xs text-ink-soft">
                      <th scope="col" className={cn(head, "ps-5")}>
                        {t.rfColCode}
                      </th>
                      <th scope="col" className={head}>
                        {t.rfColOrders}
                      </th>
                      <th scope="col" className={head}>
                        {t.rfColConfirmed}
                      </th>
                      <th scope="col" className={head}>
                        {t.rfColRevenue}
                      </th>
                      <th scope="col" className={cn(head, "pe-5")}>
                        {t.rfColLast}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.ref} className="zimos-offers-row h-14 border-b border-line last:border-b-0">
                        <td className="ps-5 pe-3 text-[15px] font-semibold text-ink">
                          <bdi dir="ltr">{row.ref}</bdi>
                        </td>
                        <td className="px-3 text-ink tabular-nums">{fmt("{n}", { n: row.orders })}</td>
                        <td className="px-3 text-ink tabular-nums">{fmt("{n}", { n: row.confirmedOrders })}</td>
                        <td className="px-3 font-semibold whitespace-nowrap text-ink tabular-nums">
                          <bdi>{formatMoney(row.revenue)}</bdi>
                        </td>
                        <td className="ps-3 pe-5 whitespace-nowrap text-ink-soft">{formatDate(row.lastOrderAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </DataState>
      </section>

    </OfferPage>
  );
}
