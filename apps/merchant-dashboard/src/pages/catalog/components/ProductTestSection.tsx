import { useState } from "react";
import { FlaskConical, Pause, Play, Trash2, Upload } from "lucide-react";
import { Alert, Badge, Button, Card, CardContent, ZLoader } from "@store-builder/ui";
import {
  ApiError,
  productTestChooseWinner,
  productTestCreate,
  productTestDelete,
  productTestGet,
  productTestUpdate,
  productTestsList,
  type ProductMedia,
  type ProductTest,
  type ProductTestMetric,
  type Variant,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useAsync } from "@/lib/useAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney, majorToMinor, minorToMajorInput, variantLabel } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { MoneyInput } from "@/components/MoneyInput";
import { TextField } from "@/components/Field";
import { Select } from "@/components/Select";

const STRINGS = {
  en: {
    title: "A/B test",
    help: "Show half of your visitors a different price or different pictures, and keep the one that sells better. Each visitor always sees the same version and pays its price.",
    loading: "Loading the test…",
    loadFailed: "The test could not be loaded.",
    retry: "Try again",
    noPermission: "You need permission to view products to see this product's tests.",
    noManage: "Only someone who can manage products can start or change a test.",
    empty: "No test running on this product.",
    start: "Start a test",
    name: "Test name",
    namePlaceholder: "e.g. Lower price",
    share: "Visitors who see version B (%)",
    shareHint: "The rest see the product as it is (version A).",
    priceB: "Version B price — {variant}",
    priceHint: "Now {price}. Leave empty to keep it.",
    pictures: "Try other pictures in version B",
    picturesHint: "Pick the pictures version B shows, in order. Add new ones with the button.",
    addPicture: "Add a picture",
    uploading: "Uploading…",
    noPictures: "This product has no pictures yet — add one for version B.",
    auto: "Pick the winner automatically",
    afterVisits: "After this many visits",
    metric: "By",
    metricRate: "Conversion rate",
    metricRpv: "Revenue per visit",
    create: "Start test",
    creating: "Starting…",
    cancel: "Cancel",
    nothingChanged: "Change a price or the pictures for version B.",
    badShare: "Enter a share from 1 to 99.",
    badPrice: "Enter a valid price.",
    noName: "Give the test a name.",
    started: "Test started.",
    running: "Running",
    paused: "Paused",
    completed: "Finished",
    pause: "Pause",
    resume: "Resume",
    paused_: "Test paused — everyone sees version A until you resume it.",
    remove: "Delete test",
    removeTitle: "Delete this test?",
    removeBody: "Its visits and results are deleted. The product keeps its current prices and pictures.",
    removeConfirm: "Delete",
    working: "Working…",
    removed: "Test deleted.",
    version: "Version",
    control: "A (as it is)",
    changes: "Changes",
    noChange: "—",
    newPictures: "{count} pictures",
    visits: "Visits",
    orders: "Orders",
    rate: "Conversion",
    revenue: "Revenue",
    rpv: "Per visit",
    makeWinner: "Make winner",
    winner: "Winner",
    leading: "Leading",
    winnerTitle: "Make version {key} the winner?",
    winnerBodyA: "The test ends and every visitor sees the product as it is.",
    winnerBodyB: "The test ends and version {key}'s prices and pictures become the product's own.",
    winnerConfirm: "Make winner",
    winnerDone: "Winner picked — the test is finished.",
    confidence: "{pct}% sure the leader really converts better.",
    confidenceLow: "Not enough visits yet to tell the versions apart.",
    past: "Finished tests",
    pastRow: "{name} — winner {key}",
  },
  ar: {
    title: "اختبار A/B",
    help: "اعرض على نص زوارك سعر تاني أو صور تانية، وخلّي اللي بيبيع أكتر. كل زائر بيشوف نفس النسخة دايمًا وبيدفع سعرها.",
    loading: "جارٍ تحميل الاختبار…",
    loadFailed: "مقدرناش نحمّل الاختبار.",
    retry: "حاول تاني",
    noPermission: "محتاج صلاحية عرض المنتجات علشان تشوف اختبارات المنتج ده.",
    noManage: "اللي يقدر يدير المنتجات بس يقدر يبدأ أو يغيّر اختبار.",
    empty: "مفيش اختبار شغال على المنتج ده.",
    start: "ابدأ اختبار",
    name: "اسم الاختبار",
    namePlaceholder: "مثلًا: سعر أقل",
    share: "نسبة الزوار اللي يشوفوا النسخة B (%)",
    shareHint: "الباقي يشوفوا المنتج زي ما هو (النسخة A).",
    priceB: "سعر النسخة B — {variant}",
    priceHint: "دلوقتي {price}. سيبه فاضي علشان يفضل زي ما هو.",
    pictures: "جرّب صور تانية في النسخة B",
    picturesHint: "اختار الصور اللي تظهر في النسخة B بالترتيب. ضيف صور جديدة بالزرار.",
    addPicture: "ضيف صورة",
    uploading: "جارٍ الرفع…",
    noPictures: "المنتج ده مفيهوش صور لسه — ضيف صورة للنسخة B.",
    auto: "اختار الفائز تلقائيًا",
    afterVisits: "بعد عدد الزيارات ده",
    metric: "على حسب",
    metricRate: "معدل التحويل",
    metricRpv: "الإيراد لكل زيارة",
    create: "ابدأ الاختبار",
    creating: "جارٍ البدء…",
    cancel: "إلغاء",
    nothingChanged: "غيّر سعر أو الصور في النسخة B.",
    badShare: "اكتب نسبة من 1 لـ 99.",
    badPrice: "اكتب سعر صحيح.",
    noName: "اكتب اسم للاختبار.",
    started: "الاختبار بدأ.",
    running: "شغال",
    paused: "متوقف",
    completed: "خلص",
    pause: "إيقاف مؤقت",
    resume: "كمّل",
    paused_: "الاختبار متوقف — كل الزوار بيشوفوا النسخة A لحد ما تكمّله.",
    remove: "احذف الاختبار",
    removeTitle: "تحذف الاختبار ده؟",
    removeBody: "زياراته ونتايجه هتتمسح. المنتج هيفضل بأسعاره وصوره الحالية.",
    removeConfirm: "احذف",
    working: "جارٍ التنفيذ…",
    removed: "تم حذف الاختبار.",
    version: "النسخة",
    control: "A (زي ما هو)",
    changes: "التغيير",
    noChange: "—",
    newPictures: "{count} صور",
    visits: "الزيارات",
    orders: "الطلبات",
    rate: "التحويل",
    revenue: "الإيراد",
    rpv: "لكل زيارة",
    makeWinner: "اختاره فائز",
    winner: "الفائز",
    leading: "متصدّر",
    winnerTitle: "تخلّي النسخة {key} هي الفائزة؟",
    winnerBodyA: "الاختبار هيخلص وكل الزوار هيشوفوا المنتج زي ما هو.",
    winnerBodyB: "الاختبار هيخلص وأسعار وصور النسخة {key} هتبقى بتاعة المنتج نفسه.",
    winnerConfirm: "اختاره فائز",
    winnerDone: "تم اختيار الفائز — الاختبار خلص.",
    confidence: "{pct}% ثقة أن المتصدر بيحوّل أحسن فعلًا.",
    confidenceLow: "الزيارات لسه مش كفاية علشان نفرّق بين النسختين.",
    past: "اختبارات خلصت",
    pastRow: "{name} — الفائز {key}",
  },
} satisfies Messages;

type T = (typeof STRINGS)["en"];

const isImage = (m: ProductMedia) => !String((m as { mimeType?: string }).mimeType ?? "image/").startsWith("video/");
const forbidden = (err: unknown) => err instanceof ApiError && err.status === 403;

/**
 * The product page's A/B test (catalog/productTests.js): version B changes
 * some variant prices and/or the pictures; the store pins each visitor to a
 * version and charges its price. One open test per product. Picking the
 * winner writes its prices and pictures into the product.
 */
export function ProductTestSection({
  productId,
  variants,
  media,
  onProductChanged,
}: {
  productId: string;
  variants: Variant[];
  media: ProductMedia[];
  onProductChanged: () => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const tests = useAsync(() => productTestsList(apiClient, workspaceId, productId), [workspaceId, productId]);
  const [creating, setCreating] = useState(false);
  const open = tests.data?.find((x) => x.status !== "completed") ?? null;
  const past = (tests.data ?? []).filter((x) => x.status === "completed");

  return (
    <Card>
      <CardContent className="space-y-4 pt-6">
        <div className="flex items-start gap-3">
          <FlaskConical className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
            <p className="mt-1 text-sm text-ink-soft">{t.help}</p>
          </div>
        </div>

        {tests.loading ? (
          <div className="flex min-h-11 items-center">
            <ZLoader label={t.loading} />
          </div>
        ) : tests.error ? (
          forbidden(tests.error) ? (
            <Alert>{t.noPermission}</Alert>
          ) : (
            <Alert variant="destructive">
              {t.loadFailed}{" "}
              <Button size="sm" variant="ghost" onClick={() => void tests.refresh()}>
                {t.retry}
              </Button>
            </Alert>
          )
        ) : open ? (
          <OpenTest
            key={open.id}
            test={open}
            variants={variants}
            t={t}
            onChanged={() => void tests.refresh({ silent: true })}
            onProductChanged={onProductChanged}
          />
        ) : creating ? (
          <NewTestForm
            productId={productId}
            variants={variants}
            media={media.filter(isImage)}
            t={t}
            onCancel={() => setCreating(false)}
            onCreated={() => {
              setCreating(false);
              void tests.refresh({ silent: true });
            }}
          />
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-ink-soft">{t.empty}</p>
            <Button size="sm" onClick={() => setCreating(true)} disabled={variants.length === 0}>
              {t.start}
            </Button>
          </div>
        )}

        {past.length > 0 && (
          <div className="border-t border-line pt-3">
            <h3 className="text-sm font-medium text-ink">{t.past}</h3>
            <ul className="mt-1 space-y-0.5 text-sm text-ink-soft">
              {past.map((x) => (
                <li key={x.id}>{fmt(t.pastRow, { name: x.name, key: x.winnerVariantKey ?? "—" })}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// --- a new test --------------------------------------------------------------

function NewTestForm({
  productId,
  variants,
  media,
  t,
  onCancel,
  onCreated,
}: {
  productId: string;
  variants: Variant[];
  media: ProductMedia[];
  t: T;
  onCancel: () => void;
  onCreated: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const live = variants.filter((v) => v.status === "active");
  const [name, setName] = useState("");
  const [share, setShare] = useState("50");
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [withPictures, setWithPictures] = useState(false);
  const [library, setLibrary] = useState<ProductMedia[]>(media);
  const [picked, setPicked] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [auto, setAuto] = useState(false);
  const [afterVisits, setAfterVisits] = useState("2000");
  const [metric, setMetric] = useState<ProductTestMetric>("conversion_rate");
  const [problem, setProblem] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function togglePicture(url: string) {
    setPicked((current) => (current.includes(url) ? current.filter((u) => u !== url) : [...current, url]));
  }

  async function addPicture(file: File) {
    setUploading(true);
    try {
      const uploaded = (await apiClient.uploadMedia(workspaceId, file)) as ProductMedia;
      setLibrary((current) => [...current, uploaded]);
      setPicked((current) => [...current, uploaded.url]);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    setProblem(null);
    if (!name.trim()) return setProblem(t.noName);
    const shareB = Number(share);
    if (!Number.isInteger(shareB) || shareB < 1 || shareB > 99) return setProblem(t.badShare);
    const priceB: Record<string, number> = {};
    for (const v of live) {
      const typed = (prices[v.id] ?? "").trim();
      if (!typed) continue;
      const minor = majorToMinor(typed);
      if (!Number.isFinite(minor) || minor < 0) return setProblem(t.badPrice);
      if (minor !== Number(v.priceAmount)) priceB[v.id] = minor;
    }
    const pictures = withPictures ? picked.map((url) => library.find((m) => m.url === url)).filter((m): m is ProductMedia => !!m) : [];
    if (Object.keys(priceB).length === 0 && pictures.length === 0) return setProblem(t.nothingChanged);
    setBusy(true);
    try {
      await productTestCreate(apiClient, workspaceId, {
        productId,
        name: name.trim(),
        variants: [
          { key: "A", name: "A", weight: 100 - shareB },
          { key: "B", name: "B", weight: shareB, prices: priceB, ...(pictures.length > 0 ? { media: pictures } : {}) },
        ],
        autoWinner: auto ? { enabled: true, afterVisits: Math.max(50, Number(afterVisits) || 2000), metric } : null,
      });
      toast.success(t.started);
      onCreated();
    } catch (err) {
      setProblem(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4 rounded-[0.5rem] border border-line p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField label={t.name} placeholder={t.namePlaceholder} value={name} maxLength={200} onChange={(e) => setName(e.target.value)} />
        <TextField label={t.share} hint={t.shareHint} inputMode="numeric" value={share} onChange={(e) => setShare(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {live.map((v) => (
          <MoneyInput
            key={v.id}
            label={fmt(t.priceB, { variant: variantLabel(v) })}
            hint={fmt(t.priceHint, { price: formatMoney(v.priceAmount, v.currency) })}
            currency={v.currency}
            placeholder={minorToMajorInput(v.priceAmount)}
            value={prices[v.id] ?? ""}
            onChange={(value) => setPrices((current) => ({ ...current, [v.id]: value }))}
          />
        ))}
      </div>

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" className="size-4 accent-primary" checked={withPictures} onChange={(e) => setWithPictures(e.target.checked)} />
        {t.pictures}
      </label>
      {withPictures && (
        <div className="space-y-2">
          <p className="text-xs text-ink-soft">{library.length === 0 ? t.noPictures : t.picturesHint}</p>
          <ul className="flex flex-wrap gap-2">
            {library.map((m) => {
              const order = picked.indexOf(m.url);
              return (
                <li key={m.url}>
                  <button
                    type="button"
                    aria-pressed={order >= 0}
                    onClick={() => togglePicture(m.url)}
                    className={`relative block size-20 overflow-hidden rounded-[0.5rem] border-2 focus-visible:outline-2 focus-visible:outline-primary ${order >= 0 ? "border-primary" : "border-line opacity-60"}`}
                  >
                    <img src={m.url} alt="" className="size-full object-cover" />
                    {order >= 0 && (
                      <span className="absolute end-1 top-1 rounded-full bg-primary px-1.5 text-xs font-semibold text-on-primary">{order + 1}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.5rem] border border-line px-4 text-sm font-medium text-ink hover:border-primary has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-primary/40">
            {uploading ? <ZLoader size="sm" /> : <Upload className="size-4" aria-hidden />}
            {uploading ? t.uploading : t.addPicture}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void addPicture(file);
              }}
            />
          </label>
        </div>
      )}

      <label className="flex items-center gap-2 text-sm font-medium text-ink">
        <input type="checkbox" className="size-4 accent-primary" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        {t.auto}
      </label>
      {auto && (
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label={t.afterVisits} inputMode="numeric" value={afterVisits} onChange={(e) => setAfterVisits(e.target.value)} />
          <div className="space-y-1.5">
            <label htmlFor="product-test-metric" className="text-sm font-medium text-ink">
              {t.metric}
            </label>
            <Select id="product-test-metric" value={metric} onChange={(e) => setMetric(e.target.value as ProductTestMetric)}>
              <option value="conversion_rate">{t.metricRate}</option>
              <option value="revenue_per_visit">{t.metricRpv}</option>
            </Select>
          </div>
        </div>
      )}

      {problem && (
        <p role="alert" className="text-sm font-medium text-danger">
          {problem}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void submit()} disabled={busy || uploading}>
          {busy ? t.creating : t.create}
        </Button>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          {t.cancel}
        </Button>
      </div>
    </div>
  );
}

// --- the open test -----------------------------------------------------------

function OpenTest({
  test,
  variants,
  t,
  onChanged,
  onProductChanged,
}: {
  test: ProductTest;
  variants: Variant[];
  t: T;
  onChanged: () => void;
  onProductChanged: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const detail = useAsync(() => productTestGet(apiClient, workspaceId, test.id), [workspaceId, test.id, test.status]);
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);
  const results = detail.data?.results ?? null;
  const currency = variants[0]?.currency ?? "EGP";

  async function run(action: () => Promise<unknown>, message: string) {
    setBusy(true);
    try {
      await action();
      toast.success(message);
      onChanged();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function changesOf(key: string) {
    const v = test.variants.find((x) => x.key === key);
    if (!v || key === "A") return t.noChange;
    const parts = Object.entries(v.prices).map(([variantId, amount]) => {
      const variant = variants.find((x) => x.id === variantId);
      return `${variant ? variantLabel(variant) : "?"} → ${formatMoney(amount, variant?.currency ?? currency)}`;
    });
    if (v.media) parts.push(fmt(t.newPictures, { count: v.media.length }));
    return parts.join(" · ") || t.noChange;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium text-ink">
          {test.name}
          <Badge className="ms-2" variant={test.status === "running" ? "default" : "secondary"}>
            {test.status === "running" ? t.running : t.paused}
          </Badge>
        </p>
        <div className="flex flex-wrap gap-1">
          {test.status === "running" ? (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => productTestUpdate(apiClient, workspaceId, test.id, { status: "paused" }), t.paused)}>
              <Pause className="size-4" aria-hidden /> {t.pause}
            </Button>
          ) : (
            <Button size="sm" variant="ghost" disabled={busy} onClick={() => void run(() => productTestUpdate(apiClient, workspaceId, test.id, { status: "running" }), t.running)}>
              <Play className="size-4" aria-hidden /> {t.resume}
            </Button>
          )}
          <Button size="sm" variant="ghost" className="text-danger hover:bg-danger-soft" disabled={busy} onClick={() => setDeleting(true)}>
            <Trash2 className="size-4" aria-hidden /> {t.remove}
          </Button>
        </div>
      </div>
      {test.status === "paused" && <p className="text-sm text-ink-soft">{t.paused_}</p>}

      {detail.error ? (
        <Alert variant="destructive">{forbidden(detail.error) ? t.noManage : t.loadFailed}</Alert>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="text-xs text-ink-soft">
              <tr>
                <th className="pb-2 text-start font-medium">{t.version}</th>
                <th className="pb-2 text-start font-medium">{t.changes}</th>
                <th className="pb-2 text-end font-medium">{t.visits}</th>
                <th className="pb-2 text-end font-medium">{t.orders}</th>
                <th className="pb-2 text-end font-medium">{t.rate}</th>
                <th className="pb-2 text-end font-medium">{t.revenue}</th>
                <th className="pb-2 text-end font-medium">{t.rpv}</th>
                <th className="pb-2" />
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {test.variants.map((v) => {
                const r = results?.variants.find((x) => x.key === v.key);
                return (
                  <tr key={v.key}>
                    <td className="py-2 font-medium text-ink">
                      {v.key === "A" ? t.control : v.key} <span className="text-xs font-normal text-ink-soft">({v.weight}%)</span>
                      {results?.leaderKey === v.key && <Badge className="ms-2" variant="secondary">{t.leading}</Badge>}
                    </td>
                    <td className="py-2 text-ink-soft">{changesOf(v.key)}</td>
                    <td className="py-2 text-end tabular-nums text-ink-soft">{detail.loading ? <ZLoader size="sm" className="ms-auto" aria-hidden /> : (r?.visits ?? 0)}</td>
                    <td className="py-2 text-end tabular-nums text-ink-soft">{detail.loading ? <ZLoader size="sm" className="ms-auto" aria-hidden /> : (r?.orders ?? 0)}</td>
                    <td className="py-2 text-end tabular-nums text-ink-soft">{r ? `${(r.conversionRateBp / 100).toFixed(2)}%` : "—"}</td>
                    <td className="py-2 text-end tabular-nums text-ink-soft">{r ? formatMoney(r.revenueAmount, currency) : "—"}</td>
                    <td className="py-2 text-end tabular-nums text-ink-soft">{r ? formatMoney(r.revenuePerVisitAmount, currency) : "—"}</td>
                    <td className="py-2 text-end">
                      <Button size="sm" variant="ghost" disabled={busy} onClick={() => setWinner(v.key)}>
                        {t.makeWinner}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {results && (
        <p className="text-xs text-ink-soft">
          {results.confidence !== null && results.confidence > 0.5
            ? fmt(t.confidence, { pct: Math.round(results.confidence * 100) })
            : t.confidenceLow}
        </p>
      )}

      <ConfirmDialog
        open={deleting}
        title={t.removeTitle}
        description={t.removeBody}
        confirmLabel={t.removeConfirm}
        busyLabel={t.working}
        cancelLabel={t.cancel}
        destructive
        onCancel={() => setDeleting(false)}
        onConfirm={async () => {
          await run(() => productTestDelete(apiClient, workspaceId, test.id), t.removed);
          setDeleting(false);
        }}
      />
      <ConfirmDialog
        open={winner !== null}
        title={fmt(t.winnerTitle, { key: winner ?? "" })}
        description={winner === "A" ? t.winnerBodyA : fmt(t.winnerBodyB, { key: winner ?? "" })}
        confirmLabel={t.winnerConfirm}
        busyLabel={t.working}
        cancelLabel={t.cancel}
        onCancel={() => setWinner(null)}
        onConfirm={async () => {
          if (!winner) return;
          await run(() => productTestChooseWinner(apiClient, workspaceId, test.id, winner), t.winnerDone);
          setWinner(null);
          onProductChanged();
        }}
      />
    </div>
  );
}
