import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { FileText, Languages, LayoutTemplate, Megaphone, PackagePlus, ScanSearch, Sparkles, Store } from "lucide-react";
import { Alert, Button, Card, ZLoader } from "@store-builder/ui";
import {
  AI_DIALECTS,
  ApiError,
  aiApply,
  aiStart,
  aiUsage,
  aiWaitForJob,
  type AiDialect,
  type AiFeature,
  type AiInputs,
  type AiJob,
  type AiPageOutput,
  type AiPoliciesOutput,
  type AiProductOutput,
  type AiTranslateOutput,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { FilterTabs } from "@/components/FilterTabs";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { StatusBadge } from "@/components/StatusBadge";
import { CopyButton } from "@/components/CopyButton";
import { useToast } from "@/components/Toast";
import { ImageListField } from "@/pages/website/editor/ImageField";
import { AdCreativesTool, PageReviewTool, StoreBuilderTool } from "./AiStudioP2";

const STRINGS = {
  en: {
    title: "AI studio",
    description: "Draft product listings, landing pages, translations, policies, ads and a whole store, and review your pages. Everything it writes is a draft until you publish it.",
    tabs: "AI tool",
    tab_product: "Product",
    tab_page: "Landing page",
    tab_translate: "Translate",
    tab_policies: "Policies",
    tab_page_review: "Page review",
    tab_ad_creatives: "Ad creatives",
    tab_store_builder: "Build a store",
    testProvider: "Test provider",
    testProviderHint: "The test provider returns sample text so you can try the flow. Real generation starts when an AI provider is connected.",
    unavailable: "AI is not available on this store yet.",
    usage: "{used} requests this month",
    usageOf: "{used} of {limit} requests this month",
    dialect: "Language",
    dialect_egyptian: "Egyptian Arabic",
    dialect_gulf: "Gulf Arabic",
    dialect_msa: "Modern Standard Arabic",
    dialect_english: "English",
    dialect_french: "French",
    generate: "Generate",
    generating: "Generating…",
    again: "Generate again",
    failed: "The generation failed: {error}",
    limitMonth: "This month's AI requests are used up.",
    limitHour: "Too many requests in the last hour. Try again later.",
    result: "Draft",
    copy: "Copy",
    productName: "Product name or idea",
    price: "Price (optional)",
    link: "Source link (optional)",
    notes: "What should it know? (optional)",
    notesHint: "Material, sizes, who it is for, what is in the box.",
    photos: "Product photos (optional)",
    photosHint: "Up to 6. The AI describes what they show, and they become the draft product's photos.",
    fName: "Name",
    fDescription: "Description",
    fFeatures: "Features",
    fFaqs: "Questions",
    fMeta: "Search description",
    fOffer: "Offer line",
    createDraft: "Create draft product",
    creating: "Creating…",
    draftCreated: "Draft product created.",
    openDraft: "Open the draft product",
    product: "Product",
    chooseProduct: "Choose a product",
    audience: "Who is it for? (optional)",
    template: "Layout",
    template_classic: "Classic: hero, features, guarantee, questions",
    template_problem_solution: "Problem and solution",
    template_short: "Short: hero, features, order",
    sections: "{count} sections",
    pagePath: "Page address",
    pagePathHint: "Letters, numbers and dashes — e.g. summer-offer.",
    createPage: "Add as a draft page",
    pageCreated: "Draft page added to your website.",
    openEditor: "Open it in the website editor",
    websiteRequired: "Create your store website first, then add the page to it.",
    pathTaken: "A page already exists at that address. Choose another.",
    source: "Text to translate",
    target: "Translate into",
    policiesStore: "Store name",
    policiesSells: "What you sell",
    policiesCountry: "Country",
    policiesDelivery: "Delivery time (days)",
    policiesReturn: "Return window (days)",
    policiesContact: "Contact (phone or email)",
    policiesNote: "A starting draft, not legal advice. Review it, then paste it into your store policies.",
    policy_shipping: "Shipping policy",
    policy_returns: "Returns policy",
    policy_privacy: "Privacy policy",
    goPolicies: "Open store policies",
  },
  ar: {
    title: "استوديو الذكاء الاصطناعي",
    description: "جهّز مسودات للمنتجات وصفحات الهبوط والترجمة والسياسات والإعلانات ومتجر كامل، وقيّم صفحاتك. كل ما يكتبه يبقى مسودة حتى تنشره أنت.",
    tabs: "أداة الذكاء الاصطناعي",
    tab_product: "منتج",
    tab_page: "صفحة هبوط",
    tab_translate: "ترجمة",
    tab_policies: "السياسات",
    tab_page_review: "تقييم صفحة",
    tab_ad_creatives: "إعلانات",
    tab_store_builder: "بناء متجر",
    testProvider: "مزوّد تجريبي",
    testProviderHint: "المزوّد التجريبي يرجّع نصًا نموذجيًا لتجربة الخطوات. التوليد الحقيقي يبدأ عند ربط مزوّد ذكاء اصطناعي.",
    unavailable: "الذكاء الاصطناعي غير متاح على هذا المتجر بعد.",
    usage: "{used} طلب هذا الشهر",
    usageOf: "{used} من {limit} طلب هذا الشهر",
    dialect: "اللغة",
    dialect_egyptian: "العامية المصرية",
    dialect_gulf: "الخليجية",
    dialect_msa: "العربية الفصحى",
    dialect_english: "الإنجليزية",
    dialect_french: "الفرنسية",
    generate: "ولّد",
    generating: "جارٍ التوليد…",
    again: "ولّد مرة أخرى",
    failed: "فشل التوليد: {error}",
    limitMonth: "استُنفدت طلبات الذكاء الاصطناعي لهذا الشهر.",
    limitHour: "طلبات كثيرة في الساعة الأخيرة. حاول لاحقًا.",
    result: "المسودة",
    copy: "نسخ",
    productName: "اسم المنتج أو فكرته",
    price: "السعر (اختياري)",
    link: "رابط المصدر (اختياري)",
    notes: "ما الذي يجب أن يعرفه؟ (اختياري)",
    notesHint: "الخامة، المقاسات، لمن المنتج، محتويات العبوة.",
    photos: "صور المنتج (اختياري)",
    photosHint: "حتى 6 صور. يصف الذكاء الاصطناعي ما يظهر فيها، وتصبح صور مسودة المنتج.",
    fName: "الاسم",
    fDescription: "الوصف",
    fFeatures: "المميزات",
    fFaqs: "الأسئلة",
    fMeta: "وصف محركات البحث",
    fOffer: "سطر العرض",
    createDraft: "إنشاء منتج كمسودة",
    creating: "جارٍ الإنشاء…",
    draftCreated: "تم إنشاء المنتج كمسودة.",
    openDraft: "افتح المنتج المسودة",
    product: "المنتج",
    chooseProduct: "اختر منتجًا",
    audience: "لمن الصفحة؟ (اختياري)",
    template: "التخطيط",
    template_classic: "كلاسيك: واجهة، مميزات، ضمان، أسئلة",
    template_problem_solution: "المشكلة والحل",
    template_short: "قصير: واجهة، مميزات، طلب",
    sections: "{count} أقسام",
    pagePath: "عنوان الصفحة",
    pagePathHint: "حروف إنجليزية وأرقام وشرطات — مثل summer-offer.",
    createPage: "أضفها كصفحة مسودة",
    pageCreated: "أُضيفت الصفحة كمسودة إلى موقعك.",
    openEditor: "افتحها في محرر الموقع",
    websiteRequired: "أنشئ موقع متجرك أولًا ثم أضف الصفحة إليه.",
    pathTaken: "توجد صفحة بهذا العنوان. اختر عنوانًا آخر.",
    source: "النص المراد ترجمته",
    target: "الترجمة إلى",
    policiesStore: "اسم المتجر",
    policiesSells: "ماذا تبيع",
    policiesCountry: "الدولة",
    policiesDelivery: "مدة التوصيل (أيام)",
    policiesReturn: "مدة الإرجاع (أيام)",
    policiesContact: "وسيلة التواصل (هاتف أو بريد)",
    policiesNote: "مسودة للبدء وليست استشارة قانونية. راجعها ثم الصقها في سياسات متجرك.",
    policy_shipping: "سياسة الشحن",
    policy_returns: "سياسة الإرجاع",
    policy_privacy: "سياسة الخصوصية",
    goPolicies: "افتح سياسات المتجر",
  },
} satisfies Messages;

type T = Record<keyof (typeof STRINGS)["en"], string>;
/** The studio's tools; the suggested WhatsApp reply lives in the inbox. */
type StudioTab = Exclude<AiFeature, "wa_reply">;
const TABS: { value: StudioTab; icon: typeof Sparkles }[] = [
  { value: "product", icon: PackagePlus },
  { value: "page", icon: LayoutTemplate },
  { value: "translate", icon: Languages },
  { value: "policies", icon: FileText },
  // P2 (AiStudioP2.tsx).
  { value: "page_review", icon: ScanSearch },
  { value: "ad_creatives", icon: Megaphone },
  { value: "store_builder", icon: Store },
];

/** Runs one generation and keeps its job: start → poll → result or error. */
export function useGeneration<F extends AiFeature>(feature: F, onDone: () => void) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const [job, setJob] = useState<AiJob<F> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(input: AiInputs[F]) {
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const started = await aiStart(apiClient, workspaceId, feature, input);
      const finished = await aiWaitForJob<F>(apiClient, workspaceId, started.id);
      if (finished.status === "failed") setError(fmt(t.failed, { error: finished.error ?? "" }));
      else setJob(finished);
    } catch (err) {
      if (err instanceof ApiError && err.code === "AI_LIMIT_REACHED") {
        setError((err.details as { scope?: string } | undefined)?.scope === "hour" ? t.limitHour : t.limitMonth);
      } else setError(errorMessage(err));
    } finally {
      setBusy(false);
      onDone();
    }
  }
  return { job, setJob, busy, error, setError, run };
}

export function DialectField({ value, onChange, label }: { value: AiDialect; onChange: (value: AiDialect) => void; label?: string }) {
  const t = useT(STRINGS);
  return (
    <Field label={label ?? t.dialect}>
      {(props) => (
        <Select {...props} value={value} onChange={(e) => onChange(e.target.value as AiDialect)}>
          {AI_DIALECTS.map((dialect) => (
            <option key={dialect} value={dialect}>
              {t[`dialect_${dialect}`]}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function ToolLayout({ form, result, busy, error }: { form: ReactNode; result: ReactNode; busy: boolean; error: string | null }) {
  const t = useT(STRINGS);
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
      <Card className="gap-0 self-start p-4">{form}</Card>
      <Card className="min-h-64 gap-0 p-4">
        <h2 className="text-sm font-semibold text-ink">{t.result}</h2>
        <div className="mt-3">
          {error && <Alert variant="danger">{error}</Alert>}
          {busy && (
            <div role="status" className="flex min-h-40 items-center justify-center gap-2 text-sm text-ink-soft">
              <ZLoader aria-hidden />
              {t.generating}
            </div>
          )}
          {!busy && result}
        </div>
      </Card>
    </div>
  );
}

export function SubmitRow({ busy, hasResult, disabled }: { busy: boolean; hasResult: boolean; disabled?: boolean }) {
  const t = useT(STRINGS);
  return (
    <Button type="submit" className="w-full" disabled={busy || disabled}>
      <Sparkles className="size-4" aria-hidden />
      {busy ? t.generating : hasResult ? t.again : t.generate}
    </Button>
  );
}

function ProductTool({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const gen = useGeneration("product", onDone);
  const [form, setForm] = useState({ name: "", price: "", link: "", notes: "", imageUrls: [] as string[], dialect: "egyptian" as AiDialect });
  const [draft, setDraft] = useState<AiProductOutput | null>(null);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    setDraft(gen.job?.output ?? null);
  }, [gen.job]);

  function submit(e: FormEvent) {
    e.preventDefault();
    void gen.run({
      name: form.name.trim(),
      price: form.price.trim() || undefined,
      link: form.link.trim() || undefined,
      notes: form.notes.trim() || undefined,
      imageUrls: form.imageUrls.length ? form.imageUrls : undefined,
      dialect: form.dialect,
    });
  }

  async function apply() {
    if (!gen.job || !draft) return;
    setApplying(true);
    try {
      const saved = await aiApply<"product">(apiClient, workspaceId, gen.job.id, {
        overrides: { name: draft.name, description: draft.description, metaDescription: draft.metaDescription, specialOfferText: draft.specialOfferText },
      });
      gen.setJob(saved);
      toast.success(t.draftCreated);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  const applied = gen.job?.applied?.type === "product" ? gen.job.applied : null;

  return (
    <ToolLayout
      busy={gen.busy}
      error={gen.error}
      form={
        <form onSubmit={submit} className="space-y-4">
          <TextField label={t.productName} required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} maxLength={200} />
          <TextField label={t.price} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} maxLength={40} />
          <TextField label={t.link} type="url" dir="ltr" value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} maxLength={1000} />
          <Field label={t.notes} hint={t.notesHint}>
            {(props) => <Textarea {...props} rows={3} maxLength={2000} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />}
          </Field>
          {/* §19.2: the photos go to the model and become the draft's media. */}
          <ImageListField label={t.photos} hint={t.photosHint} value={form.imageUrls} onChange={(imageUrls) => setForm({ ...form, imageUrls: imageUrls.slice(0, 6) })} />
          <DialectField value={form.dialect} onChange={(dialect) => setForm({ ...form, dialect })} />
          <SubmitRow busy={gen.busy} hasResult={Boolean(gen.job)} disabled={form.name.trim().length < 2} />
        </form>
      }
      result={
        draft && (
          <div className="space-y-4">
            <TextField label={t.fName} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={200} disabled={Boolean(applied)} />
            <Field label={t.fDescription}>
              {(props) => (
                <Textarea {...props} rows={6} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} disabled={Boolean(applied)} />
              )}
            </Field>
            <div>
              <h3 className="text-sm font-medium text-ink">{t.fFeatures}</h3>
              <ul className="mt-1 list-disc space-y-1 ps-5 text-sm text-ink">
                {draft.features.map((feature) => (
                  <li key={feature.title} dir="auto">
                    <span className="font-medium">{feature.title}</span>
                    {feature.description && <span className="text-ink-soft"> — {feature.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-ink">{t.fFaqs}</h3>
              <dl className="mt-1 space-y-2 text-sm">
                {draft.faqs.map((faq) => (
                  <div key={faq.question} dir="auto">
                    <dt className="font-medium text-ink">{faq.question}</dt>
                    <dd className="text-ink-soft">{faq.answer}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <TextField label={t.fMeta} value={draft.metaDescription} onChange={(e) => setDraft({ ...draft, metaDescription: e.target.value })} maxLength={300} disabled={Boolean(applied)} />
            <TextField label={t.fOffer} value={draft.specialOfferText} onChange={(e) => setDraft({ ...draft, specialOfferText: e.target.value })} maxLength={200} disabled={Boolean(applied)} />
            {applied ? (
              <Link to={`/catalog/${applied.id}`} className="inline-block text-sm font-medium text-primary hover:underline">
                {t.openDraft} →
              </Link>
            ) : (
              <Button onClick={() => void apply()} disabled={applying || !draft.name.trim()}>
                {applying ? t.creating : t.createDraft}
              </Button>
            )}
          </div>
        )
      }
    />
  );
}

function PageTool({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const gen = useGeneration("page", onDone);
  const products = useAsync(() => apiClient.listProducts(workspaceId, { limit: 100 }).then((r) => r.products), [workspaceId]);
  const [productId, setProductId] = useState("");
  const [audience, setAudience] = useState("");
  const [template, setTemplate] = useState<"classic" | "problem_solution" | "short">("classic");
  const [dialect, setDialect] = useState<AiDialect>("egyptian");
  const [path, setPath] = useState("");
  const [applying, setApplying] = useState(false);

  function submit(e: FormEvent) {
    e.preventDefault();
    void gen.run({ productId, audience: audience.trim() || undefined, template, dialect });
  }

  async function apply() {
    if (!gen.job) return;
    setApplying(true);
    gen.setError(null);
    try {
      const saved = await aiApply<"page">(apiClient, workspaceId, gen.job.id, { path: path.trim() || undefined });
      gen.setJob(saved);
      toast.success(t.pageCreated);
    } catch (err) {
      const code = err instanceof ApiError ? err.code : undefined;
      gen.setError(code === "WEBSITE_REQUIRED" ? t.websiteRequired : code === "PAGE_PATH_TAKEN" ? t.pathTaken : errorMessage(err));
    } finally {
      setApplying(false);
    }
  }

  const output: AiPageOutput | null = gen.job?.output ?? null;
  const applied = gen.job?.applied?.type === "page" ? gen.job.applied : null;
  const outline = output
    ? output.tree.sections.map((section) =>
        section.rows.flatMap((row) => row.columns.flatMap((column) => column.elements.map((element) => element.type)))
      )
    : [];

  return (
    <ToolLayout
      busy={gen.busy}
      error={gen.error}
      form={
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.product} required>
            {(props) => (
              <Select {...props} value={productId} onChange={(e) => setProductId(e.target.value)}>
                <option value="">{t.chooseProduct}</option>
                {(products.data ?? []).map((product: Product) => (
                  <option key={product.id} value={product.id}>
                    {product.name}
                  </option>
                ))}
              </Select>
            )}
          </Field>
          <TextField label={t.audience} value={audience} onChange={(e) => setAudience(e.target.value)} maxLength={500} />
          <Field label={t.template}>
            {(props) => (
              <Select {...props} value={template} onChange={(e) => setTemplate(e.target.value as typeof template)}>
                <option value="classic">{t.template_classic}</option>
                <option value="problem_solution">{t.template_problem_solution}</option>
                <option value="short">{t.template_short}</option>
              </Select>
            )}
          </Field>
          <DialectField value={dialect} onChange={setDialect} />
          <SubmitRow busy={gen.busy} hasResult={Boolean(gen.job)} disabled={!productId} />
        </form>
      }
      result={
        output && (
          <div className="space-y-4">
            <div>
              <p dir="auto" className="text-base font-semibold text-ink">
                {output.title}
              </p>
              <p className="text-xs text-ink-soft">{fmt(t.sections, { count: output.tree.sections.length })}</p>
            </div>
            <ol className="space-y-2">
              {outline.map((types, index) => (
                <li key={index} className="flex flex-wrap items-center gap-1.5 rounded-[0.5rem] border border-line bg-paper px-3 py-2">
                  <span className="tabular-nums me-1 text-xs font-semibold text-ink-soft">{index + 1}</span>
                  {types.map((type, i) => (
                    <span key={i} dir="ltr" className="rounded-full border border-line bg-paper-raised px-2 py-0.5 text-xs text-ink">
                      {type}
                    </span>
                  ))}
                </li>
              ))}
            </ol>
            {applied ? (
              <Link to={`/website/${applied.websiteId}/edit`} className="inline-block text-sm font-medium text-primary hover:underline">
                {t.openEditor} (<bdi dir="ltr">{applied.path}</bdi>) →
              </Link>
            ) : (
              <div className="flex flex-wrap items-end gap-3">
                <TextField
                  className="min-w-48 flex-1"
                  label={t.pagePath}
                  hint={t.pagePathHint}
                  dir="ltr"
                  value={path}
                  onChange={(e) => setPath(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  maxLength={80}
                />
                <Button onClick={() => void apply()} disabled={applying}>
                  {applying ? t.creating : t.createPage}
                </Button>
              </div>
            )}
          </div>
        )
      }
    />
  );
}

function TranslateTool({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const gen = useGeneration("translate", onDone);
  const [source, setSource] = useState("");
  const [target, setTarget] = useState<AiDialect>("english");
  const output: AiTranslateOutput | null = gen.job?.output ?? null;

  function submit(e: FormEvent) {
    e.preventDefault();
    void gen.run({ fields: { text: source }, targetLanguage: target });
  }

  return (
    <ToolLayout
      busy={gen.busy}
      error={gen.error}
      form={
        <form onSubmit={submit} className="space-y-4">
          <Field label={t.source} required>
            {(props) => <Textarea {...props} rows={8} maxLength={5000} value={source} onChange={(e) => setSource(e.target.value)} />}
          </Field>
          <DialectField value={target} onChange={setTarget} label={t.target} />
          <SubmitRow busy={gen.busy} hasResult={Boolean(gen.job)} disabled={!source.trim()} />
        </form>
      }
      result={
        output && (
          <div className="space-y-3">
            <p dir="auto" className="whitespace-pre-wrap break-words text-sm text-ink">
              {output.fields.text}
            </p>
            <CopyButton value={output.fields.text ?? ""} label={t.copy} />
          </div>
        )
      }
    />
  );
}

function PoliciesTool({ onDone }: { onDone: () => void }) {
  const t = useT(STRINGS);
  const { currentWorkspace } = useWorkspace();
  const gen = useGeneration("policies", onDone);
  const [form, setForm] = useState({
    storeName: currentWorkspace?.name ?? "",
    sells: "",
    country: "",
    deliveryDays: "",
    returnDays: "",
    contact: "",
    dialect: "egyptian" as AiDialect,
  });
  const output: AiPoliciesOutput | null = gen.job?.output ?? null;
  const set = (key: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [key]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    const { dialect, ...rest } = form;
    void gen.run({ ...Object.fromEntries(Object.entries(rest).map(([key, value]) => [key, value.trim() || undefined])), dialect });
  }

  return (
    <ToolLayout
      busy={gen.busy}
      error={gen.error}
      form={
        <form onSubmit={submit} className="space-y-4">
          <TextField label={t.policiesStore} value={form.storeName} onChange={set("storeName")} maxLength={200} />
          <TextField label={t.policiesSells} value={form.sells} onChange={set("sells")} maxLength={500} />
          <TextField label={t.policiesCountry} value={form.country} onChange={set("country")} maxLength={60} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label={t.policiesDelivery} value={form.deliveryDays} onChange={set("deliveryDays")} maxLength={40} />
            <TextField label={t.policiesReturn} value={form.returnDays} onChange={set("returnDays")} maxLength={40} />
          </div>
          <TextField label={t.policiesContact} value={form.contact} onChange={set("contact")} maxLength={200} />
          <DialectField value={form.dialect} onChange={(dialect) => setForm({ ...form, dialect })} />
          <SubmitRow busy={gen.busy} hasResult={Boolean(gen.job)} />
        </form>
      }
      result={
        output && (
          <div className="space-y-5">
            <p className="text-xs text-ink-soft">{t.policiesNote}</p>
            {(["shipping", "returns", "privacy"] as const).map((key) => (
              <section key={key}>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-ink">{t[`policy_${key}`]}</h3>
                  <CopyButton value={output[key]} label={t.copy} />
                </div>
                <p dir="auto" className="mt-1 whitespace-pre-wrap break-words text-sm text-ink">
                  {output[key]}
                </p>
              </section>
            ))}
            <Link to="/store-settings" className="inline-block text-sm font-medium text-primary hover:underline">
              {t.goPolicies} →
            </Link>
          </div>
        )
      }
    />
  );
}

function usageText(t: T, used: number, limit: number | null) {
  return limit === null ? fmt(t.usage, { used }) : fmt(t.usageOf, { used, limit });
}

/** AI studio (SPEC §19): seven tools over one job flow; every result is a draft. */
export function AiStudioPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const usage = useAsync(() => aiUsage(apiClient, workspaceId), [workspaceId]);
  const [tab, setTab] = useState<StudioTab>("product");
  const refreshUsage = () => void usage.refresh({ silent: true });
  const provider = usage.data?.provider;

  return (
    <div className="max-w-6xl">
      <PageHeader
        title={t.title}
        description={t.description}
        titleBadge={provider?.sandbox ? <StatusBadge value="sandbox" tone="warning" text={t.testProvider} /> : undefined}
        actions={usage.data ? <span className="text-sm text-ink-soft">{usageText(t, usage.data.used, usage.data.limit)}</span> : undefined}
      />
      <DataState loading={usage.loading} error={usage.error} onRetry={() => void usage.refresh()}>
        {provider && !provider.available ? (
          <Alert variant="danger">{t.unavailable}</Alert>
        ) : (
          <>
            {provider?.sandbox && <p className="mb-4 max-w-3xl text-sm text-ink-soft">{t.testProviderHint}</p>}
            <FilterTabs className="mb-4" label={t.tabs} value={tab} onChange={setTab} tabs={TABS.map(({ value }) => ({ value, label: t[`tab_${value}`] }))} />
            {tab === "product" && <ProductTool onDone={refreshUsage} />}
            {tab === "page" && <PageTool onDone={refreshUsage} />}
            {tab === "translate" && <TranslateTool onDone={refreshUsage} />}
            {tab === "policies" && <PoliciesTool onDone={refreshUsage} />}
            {tab === "page_review" && <PageReviewTool onDone={refreshUsage} />}
            {tab === "ad_creatives" && <AdCreativesTool onDone={refreshUsage} />}
            {tab === "store_builder" && <StoreBuilderTool onDone={refreshUsage} />}
          </>
        )}
      </DataState>
    </div>
  );
}
