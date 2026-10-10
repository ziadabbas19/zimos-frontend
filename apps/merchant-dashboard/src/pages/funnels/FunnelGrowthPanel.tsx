import { useState } from "react";
import { FlaskConical, Trash2 } from "lucide-react";
import { Alert, Badge, Button, Input, Label, cn } from "@store-builder/ui";
import {
  funnelGeoRedirectsCreate,
  funnelGeoRedirectsDelete,
  funnelGeoRedirectsList,
  funnelGeoRedirectsUpdate,
  funnelSettingsGet,
  funnelSettingsSave,
  funnelsList,
  splitTestsChooseWinner,
  splitTestsCreate,
  splitTestsDelete,
  splitTestsGet,
  splitTestsList,
  splitTestsUpdate,
  type FunnelOwnSettings,
  type PageTree,
  type SplitTest,
  type SplitTestMetric,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatMoney } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useFunnelErrorMessage, type UiStep } from "./funnelAdapter";
import { FunnelCodeAndShippingFields, FunnelLinkSetting } from "./FunnelSettingsMore";
import { FunnelStepPageEditor } from "./FunnelStepPageEditor";
import {
  CONTROL_KEY,
  SharesBar,
  VersionSharesEditor,
  sharesTotal,
  toPayload,
  versionLabel,
  type VersionDraft,
} from "./SplitTestVersions";

/**
 * A funnel's split tests, country redirects and own settings (SPEC §9.6,
 * §9.7), opened from the funnel editor's top bar.
 *
 * Split test: one page of the funnel shown in two to five versions
 * (SplitTestVersions.tsx). A is the page as it is; every other version starts
 * as a copy and is edited here with the same page editor. The
 * numbers are the server's — visits, orders, conversion, revenue per visit —
 * and a test ends when a winner is picked, by hand or automatically.
 */

const STRINGS = {
  en: {
    open: "Tests and settings",
    title: "Tests, redirects and settings",
    tabTests: "Split tests",
    tabGeo: "Country redirects",
    tabSettings: "Funnel settings",
    close: "Close",
    // tests
    testsIntro: "Show one page in two to five versions and keep the one that sells more. A is the page as it is now; every other version starts as a copy you then change.",
    noTests: "No split test on this funnel yet.",
    newTest: "New split test",
    page: "Page",
    name: "Test name",
    namePlaceholder: "Headline test",
    auto: "Pick the winner automatically",
    afterVisits: "After this many visits",
    metric: "By",
    conversion_rate: "Conversion rate",
    revenue_per_visit: "Revenue per visit",
    create: "Start test",
    needsSaved: "Save the funnel first: this page has not been saved yet.",
    running: "Running",
    paused: "Paused",
    completed: "Finished",
    pause: "Pause",
    resume: "Resume",
    editPage: "Edit page",
    editPageOf: "Edit the page of version {key}",
    savePage: "Save the page of version {key}",
    savedPage: "The page of version {key} is saved. Its visitors see it at once.",
    back: "Back to tests",
    remove: "Delete test",
    variant: "Version",
    share: "Share",
    visits: "Visits",
    orders: "Orders",
    rate: "Conversion",
    revenue: "Revenue",
    epc: "Per visit",
    winner: "Winner",
    makeWinner: "Make winner",
    confidence: "{pct}% sure the leader really converts better.",
    confidenceLow: "Not enough visits yet to tell the versions apart.",
    control: "A — original",
    // geo
    geoIntro: "Send visitors from some countries to another funnel — for another language, currency or shipping. Everyone else sees this one.",
    noRules: "No country redirect on this funnel.",
    countries: "Countries (2-letter codes, comma-separated)",
    countriesPlaceholder: "SA, AE, KW",
    target: "Send them to",
    chooseFunnel: "Choose a funnel",
    onlyPublished: "The redirect applies while the target funnel is published.",
    addRule: "Add redirect",
    active: "Active",
    // settings
    settingsIntro: "This funnel's own icon and search title. Left empty, the store's are used.",
    currency: "Currency (3 letters) — what this funnel sells in; its offers must be priced in it",
    favicon: "Icon link",
    seoTitle: "Search title",
    seoDescription: "Search description",
    save: "Save settings",
    saved: "Saved.",
  },
  ar: {
    open: "الاختبارات والإعدادات",
    title: "الاختبارات والتحويلات والإعدادات",
    tabTests: "اختبارات A/B",
    tabGeo: "التحويل حسب الدولة",
    tabSettings: "إعدادات المسار",
    close: "إغلاق",
    testsIntro: "اعرض صفحة واحدة بنسختين إلى خمس نسخ واحتفظ بالتي تبيع أكثر. A هي الصفحة كما هي الآن؛ وكل نسخة أخرى تبدأ نسخةً منها ثم تعدّلها.",
    noTests: "لا يوجد اختبار على هذا المسار بعد.",
    newTest: "اختبار جديد",
    page: "الصفحة",
    name: "اسم الاختبار",
    namePlaceholder: "اختبار العنوان",
    auto: "اختيار الفائز تلقائيًا",
    afterVisits: "بعد هذا العدد من الزيارات",
    metric: "حسب",
    conversion_rate: "معدل التحويل",
    revenue_per_visit: "الإيراد لكل زيارة",
    create: "بدء الاختبار",
    needsSaved: "احفظ المسار أولًا: هذه الصفحة لم تُحفظ بعد.",
    running: "يعمل",
    paused: "متوقف",
    completed: "انتهى",
    pause: "إيقاف",
    resume: "استكمال",
    editPage: "تعديل الصفحة",
    editPageOf: "تعديل صفحة النسخة {key}",
    savePage: "حفظ صفحة النسخة {key}",
    savedPage: "تم حفظ صفحة النسخة {key}. تظهر فورًا لزوارها.",
    back: "رجوع للاختبارات",
    remove: "حذف الاختبار",
    variant: "النسخة",
    share: "النسبة",
    visits: "الزيارات",
    orders: "الطلبات",
    rate: "التحويل",
    revenue: "الإيراد",
    epc: "لكل زيارة",
    winner: "الفائز",
    makeWinner: "اجعله الفائز",
    confidence: "{pct}% ثقة أن المتصدر يحوّل أفضل فعلًا.",
    confidenceLow: "الزيارات غير كافية بعد للتفريق بين النسخ.",
    control: "A — الأصلية",
    geoIntro: "حوّل زوار بعض الدول إلى مسار آخر — للغة أو عملة أو شحن مختلف. الباقون يرون هذا المسار.",
    noRules: "لا يوجد تحويل حسب الدولة على هذا المسار.",
    countries: "الدول (كود من حرفين، مفصولة بفاصلة)",
    countriesPlaceholder: "SA, AE, KW",
    target: "حوّلهم إلى",
    chooseFunnel: "اختر مسارًا",
    onlyPublished: "التحويل يعمل طالما المسار الهدف منشور.",
    addRule: "إضافة تحويل",
    active: "مفعّل",
    settingsIntro: "أيقونة هذا المسار وعنوانه في البحث. إن تُركت فارغة تُستخدم بيانات المتجر.",
    currency: "العملة (3 حروف) — عملة بيع هذا الفانل؛ لازم تكون عروضه مسعّرة بيها",
    favicon: "رابط الأيقونة",
    seoTitle: "عنوان البحث",
    seoDescription: "وصف البحث",
    save: "حفظ الإعدادات",
    saved: "تم الحفظ.",
  },
} satisfies Messages;

type Tab = "tests" | "geo" | "settings";

export function FunnelGrowthButton({
  funnelId,
  steps,
  onLinkChanged,
}: {
  funnelId: string;
  steps: UiStep[];
  /** The funnel's link (subdomain) was changed from the settings tab. */
  onLinkChanged?: (subdomain: string) => void;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("tests");

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => setOpen(true)}>
        <FlaskConical className="size-4" aria-hidden />
        {t.open}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t.title} className="max-w-4xl">
        <div className="mb-4 inline-flex gap-1 rounded-[0.5rem] border border-line bg-paper-raised p-1">
          {(
            [
              ["tests", t.tabTests],
              ["geo", t.tabGeo],
              ["settings", t.tabSettings],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              aria-pressed={tab === value}
              onClick={() => setTab(value)}
              className={cn(
                "cursor-pointer rounded-[0.375rem] px-3 py-1.5 text-sm font-medium",
                tab === value ? "bg-primary-soft text-primary-dark dark:text-primary" : "text-ink-soft hover:text-ink"
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {open && tab === "tests" && <SplitTestsTab funnelId={funnelId} steps={steps} />}
        {open && tab === "geo" && <GeoTab funnelId={funnelId} />}
        {open && tab === "settings" && <SettingsTab funnelId={funnelId} onLinkChanged={onLinkChanged} />}
      </Modal>
    </>
  );
}

// --- split tests ------------------------------------------------------------

/** A new test starts as the page against one copy of it, half the visitors each. */
const DEFAULT_VERSIONS: VersionDraft[] = [
  { key: CONTROL_KEY, name: "", weight: 50 },
  { key: "B", name: "", weight: 50 },
];

function SplitTestsTab({ funnelId, steps }: { funnelId: string; steps: UiStep[] }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const list = useAsync(() => splitTestsList(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const [creating, setCreating] = useState(false);
  /** A version's own page, open in the page editor. */
  const [editing, setEditing] = useState<{ test: SplitTest; key: string; tree: PageTree } | null>(null);
  const [busy, setBusy] = useState(false);

  const [stepKey, setStepKey] = useState(steps[0]?.key ?? "");
  const [name, setName] = useState("");
  // A is the page as it is; the API takes two to five versions whose shares add up to 100.
  const [versions, setVersions] = useState<VersionDraft[]>(DEFAULT_VERSIONS);
  const [auto, setAuto] = useState(false);
  const [afterVisits, setAfterVisits] = useState(2000);
  const [metric, setMetric] = useState<SplitTestMetric>("conversion_rate");
  const [error, setError] = useState<string | null>(null);

  const stepOf = (key: string) => steps.find((s) => s.key === key);

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await list.refresh({ silent: true });
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  async function create() {
    const step = stepOf(stepKey);
    if (!step || !name.trim()) return;
    if (!step.id) return setError(t.needsSaved);
    setError(null);
    setBusy(true);
    try {
      await splitTestsCreate(apiClient, workspaceId, {
        funnelId,
        stepKey,
        name: name.trim(),
        // Every version but A starts as a copy of the page as it is now.
        variants: toPayload(versions.map((v) => ({ ...v, builderData: step.tree }))),
        autoWinner: { enabled: auto, afterVisits, metric },
      });
      setCreating(false);
      setName("");
      setVersions(DEFAULT_VERSIONS);
      await list.refresh({ silent: true });
    } catch (err) {
      setError(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  // Editing a version's page: the same page editor a funnel step uses, on that version's own tree.
  if (editing) {
    const step = stepOf(editing.test.stepKey);
    const host: UiStep | null = step ? { ...step, tree: editing.tree } : null;
    return (
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setEditing(null)} disabled={busy}>
            {t.back}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await splitTestsUpdate(apiClient, workspaceId, editing.test.id, {
                  // Every version but A sends its page back, the edited one with its changes.
                  variants: editing.test.variants.map((v) =>
                    v.key === CONTROL_KEY
                      ? { key: v.key, name: v.name, weight: v.weight }
                      : { key: v.key, name: v.name, weight: v.weight, builderData: v.key === editing.key ? editing.tree : v.builderData }
                  ),
                });
                toast.success(fmt(t.savedPage, { key: editing.key }));
                setEditing(null);
              })
            }
          >
            {fmt(t.savePage, { key: editing.key })}
          </Button>
        </div>
        {host && (
          <div className="h-[65vh] overflow-hidden rounded-[0.5rem] border border-line">
            <FunnelStepPageEditor
              workspaceId={workspaceId}
              steps={[host]}
              step={host}
              offerProduct={null}
              onSelectStep={() => undefined}
              onTreeChange={(tree) => setEditing((prev) => (prev ? { ...prev, tree } : prev))}
              onBack={() => setEditing(null)}
              funnelId={funnelId}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <DataState loading={list.loading} error={list.error} onRetry={() => void list.refresh()}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{t.testsIntro}</p>

        {(list.data ?? []).length === 0 && !creating && <p className="text-sm text-ink-soft">{t.noTests}</p>}

        {(list.data ?? []).map((test) => (
          <SplitTestCard
            key={test.id}
            test={test}
            pageName={stepOf(test.stepKey)?.name ?? test.stepKey}
            busy={busy}
            onPauseResume={() =>
              void run(() => splitTestsUpdate(apiClient, workspaceId, test.id, { status: test.status === "running" ? "paused" : "running" }))
            }
            onWinner={(key) => void run(() => splitTestsChooseWinner(apiClient, workspaceId, test.id, key))}
            onDelete={() => void run(() => splitTestsDelete(apiClient, workspaceId, test.id))}
            onEditVersion={(key) =>
              void run(async () => {
                const { experiment } = await splitTestsGet(apiClient, workspaceId, test.id);
                const version = experiment.variants.find((v) => v.key === key);
                const tree = (version?.builderData ?? { version: 1, sections: [] }) as PageTree;
                setEditing({ test: experiment, key, tree: { ...tree, sections: Array.isArray(tree.sections) ? tree.sections : [] } });
              })
            }
          />
        ))}

        {creating ? (
          <div className="space-y-3 rounded-[0.5rem] border border-line p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="st-page">{t.page}</Label>
                <Select id="st-page" value={stepKey} onChange={(e) => setStepKey(e.target.value)}>
                  {steps.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="st-name">{t.name}</Label>
                <Input id="st-name" maxLength={200} value={name} placeholder={t.namePlaceholder} onChange={(e) => setName(e.target.value)} />
              </div>
            </div>
            <VersionSharesEditor versions={versions} onChange={setVersions} newPage={stepOf(stepKey)?.tree} idPrefix="st" />
            <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
              <input type="checkbox" className="size-4 accent-primary" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              {t.auto}
            </label>
            {auto && (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="st-visits">{t.afterVisits}</Label>
                  <Input
                    id="st-visits"
                    type="number"
                    min={50}
                    value={afterVisits}
                    onChange={(e) => setAfterVisits(Math.max(50, Math.round(Number(e.target.value) || 2000)))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="st-metric">{t.metric}</Label>
                  <Select id="st-metric" value={metric} onChange={(e) => setMetric(e.target.value as SplitTestMetric)}>
                    <option value="conversion_rate">{t.conversion_rate}</option>
                    <option value="revenue_per_visit">{t.revenue_per_visit}</option>
                  </Select>
                </div>
              </div>
            )}
            {error && <Alert variant="danger">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreating(false)} disabled={busy}>
                {t.close}
              </Button>
              <Button type="button" onClick={() => void create()} disabled={busy || !name.trim() || !stepKey || sharesTotal(versions) !== 100}>
                {t.create}
              </Button>
            </div>
          </div>
        ) : (
          <Button type="button" variant="outline" onClick={() => setCreating(true)} disabled={steps.length === 0}>
            {t.newTest}
          </Button>
        )}
      </div>
    </DataState>
  );
}

function SplitTestCard({
  test,
  pageName,
  busy,
  onPauseResume,
  onWinner,
  onDelete,
  onEditVersion,
}: {
  test: SplitTest;
  pageName: string;
  busy: boolean;
  onPauseResume: () => void;
  onWinner: (variantKey: string) => void;
  onDelete: () => void;
  onEditVersion: (variantKey: string) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // Re-read whenever the list hands down a changed test.
  const detail = useAsync(() => splitTestsGet(apiClient, workspaceId, test.id), [workspaceId, test.id, test.updatedAt]);
  const results = detail.data?.results;
  const done = test.status === "completed";

  return (
    <div className="rounded-[0.5rem] border border-line p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">{test.name}</p>
          <p className="text-xs text-ink-soft">
            {t.page}: {pageName}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={test.status === "running" ? "default" : "secondary"}>{t[test.status]}</Badge>
          {!done && (
            <Button type="button" size="sm" variant="outline" disabled={busy} onClick={onPauseResume}>
              {test.status === "running" ? t.pause : t.resume}
            </Button>
          )}
          <Button type="button" size="icon-sm" variant="ghost" aria-label={t.remove} title={t.remove} disabled={busy} onClick={onDelete}>
            <Trash2 className="size-4 text-danger" aria-hidden />
          </Button>
        </div>
      </div>

      <SharesBar versions={test.variants} markKey={test.winnerVariantKey} className="mt-3" />

      <div className="mt-3 overflow-x-auto">
        <table className="w-full min-w-[34rem] text-sm">
          <thead className="text-xs text-ink-soft">
            <tr>
              <th className="pb-2 text-start font-medium">{t.variant}</th>
              <th className="pb-2 text-end font-medium">{t.share}</th>
              <th className="pb-2 text-end font-medium">{t.visits}</th>
              <th className="pb-2 text-end font-medium">{t.orders}</th>
              <th className="pb-2 text-end font-medium">{t.rate}</th>
              <th className="pb-2 text-end font-medium">{t.revenue}</th>
              <th className="pb-2 text-end font-medium">{t.epc}</th>
              <th className="pb-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {test.variants.map((v) => {
              const r = results?.variants.find((x) => x.key === v.key);
              const isWinner = test.winnerVariantKey === v.key;
              return (
                <tr key={v.key}>
                  <td className="py-2 font-medium text-ink">
                    <bdi>{versionLabel(v, t.control)}</bdi>
                    {isWinner && <Badge className="ms-2">{t.winner}</Badge>}
                  </td>
                  <td className="py-2 text-end tabular-nums text-ink-soft">{v.weight}%</td>
                  <td className="py-2 text-end tabular-nums text-ink-soft">{r ? r.visits : "—"}</td>
                  <td className="py-2 text-end tabular-nums text-ink-soft">{r ? r.orders : "—"}</td>
                  <td className="py-2 text-end tabular-nums text-ink-soft">{r ? `${(r.conversionRateBp / 100).toFixed(2)}%` : "—"}</td>
                  <td className="py-2 text-end tabular-nums text-ink-soft">{r ? formatMoney(r.revenueAmount) : "—"}</td>
                  <td className="py-2 text-end tabular-nums text-ink-soft">{r ? formatMoney(r.revenuePerVisitAmount) : "—"}</td>
                  <td className="py-2 text-end">
                    {!done && (
                      <span className="inline-flex flex-wrap justify-end gap-1">
                        {v.key !== CONTROL_KEY && (
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            aria-label={fmt(t.editPageOf, { key: v.key })}
                            onClick={() => onEditVersion(v.key)}
                          >
                            {t.editPage}
                          </Button>
                        )}
                        <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => onWinner(v.key)}>
                          {t.makeWinner}
                        </Button>
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {results && !done && (
        <p className="mt-2 text-xs text-ink-soft">
          {results.confidence !== null && results.confidence > 0.5
            ? fmt(t.confidence, { pct: Math.round(results.confidence * 100) })
            : t.confidenceLow}
        </p>
      )}
    </div>
  );
}

// --- country redirects ------------------------------------------------------

function GeoTab({ funnelId }: { funnelId: string }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const rules = useAsync(() => funnelGeoRedirectsList(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId), [workspaceId]);
  const [countries, setCountries] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  const codes = countries
    .split(/[\s,،]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    try {
      await action();
      await rules.refresh({ silent: true });
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <DataState loading={rules.loading} error={rules.error} onRetry={() => void rules.refresh()}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{t.geoIntro}</p>
        {(rules.data ?? []).length === 0 ? (
          <p className="text-sm text-ink-soft">{t.noRules}</p>
        ) : (
          <ul className="divide-y divide-line rounded-[0.5rem] border border-line">
            {(rules.data ?? []).map((rule) => (
              <li key={rule.id} className="flex flex-wrap items-center justify-between gap-3 p-3">
                <p className="text-sm text-ink">
                  <bdi dir="ltr" className="font-medium">
                    {rule.countries.join(", ")}
                  </bdi>
                  <span className="mx-2 text-ink-soft">→</span>
                  {rule.targetFunnelName ?? rule.targetFunnelId}
                </p>
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-sm text-ink">
                    <input
                      type="checkbox"
                      className="size-4 accent-primary"
                      checked={rule.isActive}
                      disabled={busy}
                      onChange={(e) =>
                        void run(() => funnelGeoRedirectsUpdate(apiClient, workspaceId, funnelId, rule.id, { isActive: e.target.checked }))
                      }
                    />
                    {t.active}
                  </label>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={t.remove}
                    disabled={busy}
                    onClick={() => void run(() => funnelGeoRedirectsDelete(apiClient, workspaceId, funnelId, rule.id))}
                  >
                    <Trash2 className="size-4 text-danger" aria-hidden />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}

        <div className="grid gap-3 rounded-[0.5rem] border border-line p-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="geo-countries">{t.countries}</Label>
            <Input id="geo-countries" dir="ltr" value={countries} placeholder={t.countriesPlaceholder} onChange={(e) => setCountries(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="geo-target">{t.target}</Label>
            <Select id="geo-target" value={target} onChange={(e) => setTarget(e.target.value)}>
              <option value="">{t.chooseFunnel}</option>
              {(funnels.data ?? [])
                .filter((f) => f.id !== funnelId)
                .map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
            </Select>
          </div>
          <p className="text-xs text-ink-soft sm:col-span-2">{t.onlyPublished}</p>
          <div className="flex justify-end sm:col-span-2">
            <Button
              type="button"
              disabled={busy || codes.length === 0 || !target}
              onClick={() =>
                void run(async () => {
                  await funnelGeoRedirectsCreate(apiClient, workspaceId, funnelId, { targetFunnelId: target, countries: codes });
                  setCountries("");
                  setTarget("");
                })
              }
            >
              {t.addRule}
            </Button>
          </div>
        </div>
      </div>
    </DataState>
  );
}

// --- funnel settings --------------------------------------------------------

function SettingsTab({ funnelId, onLinkChanged }: { funnelId: string; onLinkChanged?: (subdomain: string) => void }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const loaded = useAsync(() => funnelSettingsGet(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const [draft, setDraft] = useState<Partial<Record<keyof FunnelOwnSettings, string>>>({});
  const [busy, setBusy] = useState(false);

  const value = (key: keyof FunnelOwnSettings) => draft[key] ?? loaded.data?.[key] ?? "";
  const field = (key: keyof FunnelOwnSettings, label: string, props: { dir?: "ltr"; maxLength: number }) => (
    <div className="space-y-1.5">
      <Label htmlFor={`fs-${key}`}>{label}</Label>
      <Input id={`fs-${key}`} {...props} value={value(key)} disabled={busy} onChange={(e) => setDraft((prev) => ({ ...prev, [key]: e.target.value }))} />
    </div>
  );

  return (
    <DataState loading={loaded.loading} error={loaded.error} onRetry={() => void loaded.refresh()}>
      <div className="space-y-4">
        <p className="text-sm text-ink-soft">{t.settingsIntro}</p>
        <FunnelLinkSetting funnelId={funnelId} onSaved={onLinkChanged} />
        <div className="grid gap-3 sm:grid-cols-2">
          {field("title", t.seoTitle, { maxLength: 200 })}
          {field("currency", t.currency, { dir: "ltr", maxLength: 3 })}
          {field("description", t.seoDescription, { maxLength: 320 })}
          {field("faviconUrl", t.favicon, { dir: "ltr", maxLength: 1000 })}
        </div>
        <FunnelCodeAndShippingFields value={value} onChange={(key, next) => setDraft((prev) => ({ ...prev, [key]: next }))} disabled={busy} />
        <div className="flex justify-end">
          <Button
            type="button"
            disabled={busy || Object.keys(draft).length === 0}
            onClick={async () => {
              setBusy(true);
              try {
                const saved = await funnelSettingsSave(
                  apiClient,
                  workspaceId,
                  funnelId,
                  Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null]))
                );
                loaded.setData(saved);
                setDraft({});
                toast.success(t.saved);
              } catch (err) {
                toast.error(describeError(err));
              } finally {
                setBusy(false);
              }
            }}
          >
            {t.save}
          </Button>
        </div>
      </div>
    </DataState>
  );
}
