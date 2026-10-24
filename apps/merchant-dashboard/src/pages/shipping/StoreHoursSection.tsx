import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { StoreHoursPeriod, StoreHoursSettings } from "@store-builder/api-client";
import { hoursProblem, MAX_PERIODS, periodsOf, toSavedDay } from "./storeHoursPeriods";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Opening hours and delivery time",
    description:
      "In Cairo time. While the store is closed, the checkout refuses orders and the store shows your message. Orders you type in yourself are never refused.",
    enabled: "Take orders only during opening hours",
    override: "Accepting orders",
    override_auto: "Follow the opening hours",
    override_open: "Open now (ignore the hours)",
    override_closed: "Closed now (stop taking orders)",
    closed: "Closed",
    open: "Opens",
    close: "Closes",
    overnightHint: "A closing time at or before the opening time runs past midnight.",
    periodsHint: "Up to 3 periods a day, for example morning and evening. Periods must not overlap.",
    addPeriod: "Add a period",
    removePeriod: "Remove this period",
    copyToAll: "Copy to all days",
    overlap: "The periods on {day} overlap. Fix them before saving.",
    message: "Message while closed (optional)",
    eta: "Usual delivery time in minutes (optional)",
    etaHint: "Shown at checkout and after the order. A delivery zone's own time wins.",
    save: "Save hours",
    saving: "Saving…",
    saved: "Opening hours saved.",
    invalidEta: "Enter minutes between 1 and 1440, or leave it blank.",
    day0: "Sunday",
    day1: "Monday",
    day2: "Tuesday",
    day3: "Wednesday",
    day4: "Thursday",
    day5: "Friday",
    day6: "Saturday",
  },
  ar: {
    title: "مواعيد العمل ووقت التوصيل",
    description:
      "بتوقيت القاهرة. أثناء إغلاق المتجر ترفض صفحة الدفع الطلبات ويعرض المتجر رسالتك. الطلبات التي تضيفها بنفسك لا تُرفض أبدًا.",
    enabled: "استقبال الطلبات في مواعيد العمل فقط",
    override: "استقبال الطلبات",
    override_auto: "حسب مواعيد العمل",
    override_open: "مفتوح الآن (تجاهل المواعيد)",
    override_closed: "مغلق الآن (إيقاف استقبال الطلبات)",
    closed: "مغلق",
    open: "يفتح",
    close: "يغلق",
    overnightHint: "إذا كان وقت الإغلاق قبل وقت الفتح أو مساويًا له فإنه يمتد بعد منتصف الليل.",
    periodsHint: "حتى 3 فترات في اليوم، مثل فترة صباحية وأخرى مسائية. يجب ألا تتداخل الفترات.",
    addPeriod: "إضافة فترة",
    removePeriod: "حذف هذه الفترة",
    copyToAll: "نسخ إلى كل الأيام",
    overlap: "فترات يوم {day} متداخلة. صحّحها قبل الحفظ.",
    message: "رسالة أثناء الإغلاق (اختياري)",
    eta: "وقت التوصيل المعتاد بالدقائق (اختياري)",
    etaHint: "يظهر عند الدفع وبعد الطلب. وقت منطقة التوصيل له الأولوية.",
    save: "حفظ المواعيد",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ مواعيد العمل.",
    invalidEta: "أدخل دقائق بين 1 و1440، أو اتركه فارغًا.",
    day0: "الأحد",
    day1: "الاثنين",
    day2: "الثلاثاء",
    day3: "الأربعاء",
    day4: "الخميس",
    day5: "الجمعة",
    day6: "السبت",
  },
} satisfies Messages;

const DAY_KEYS = ["day0", "day1", "day2", "day3", "day4", "day5", "day6"] as const;

const DEFAULT_HOURS: StoreHoursSettings = {
  enabled: false,
  override: "auto",
  days: Array.from({ length: 7 }, () => ({ closed: false, open: "09:00", close: "23:00" })),
  message: "",
};

const timeInput = "h-11 rounded-md border border-line bg-paper-raised px-2 text-sm text-ink";

/** Opening hours (Africa/Cairo), the "accepting orders" switch and the usual delivery time — shipping settings. */
export function StoreHoursSection() {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const data = useAsync(() => apiClient.getShippingSettings(workspaceId), [workspaceId]);
  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5" data-search-anchor="store-hours">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <DataState loading={data.loading} error={data.error} empty={false} onRetry={() => data.refresh()}>
        {data.data && (
          <HoursForm
            key={JSON.stringify([data.data.settings.storeHours, data.data.settings.deliveryEtaMinutes])}
            initialHours={data.data.settings.storeHours ?? DEFAULT_HOURS}
            initialEta={data.data.settings.deliveryEtaMinutes ?? null}
            onSaved={() => data.refresh()}
          />
        )}
      </DataState>
    </section>
  );
}

function HoursForm({ initialHours, initialEta, onSaved }: { initialHours: StoreHoursSettings; initialEta: number | null; onSaved: () => Promise<unknown> | void }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [hours, setHours] = useState<StoreHoursSettings>(initialHours);
  const [eta, setEta] = useState(initialEta ? String(initialEta) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setDay = (index: number, patch: Partial<StoreHoursSettings["days"][number]>) =>
    setHours((prev) => ({ ...prev, days: prev.days.map((d, i) => (i === index ? { ...d, ...patch } : d)) }));
  // Every day edited as its list of periods (a day saved with one open/close is one period).
  const setPeriods = (index: number, periods: StoreHoursPeriod[]) => setDay(index, { periods, open: periods[0].open, close: periods[0].close });
  const setPeriod = (index: number, at: number, patch: Partial<StoreHoursPeriod>) =>
    setPeriods(index, periodsOf(hours.days[index]).map((p, j) => (j === at ? { ...p, ...patch } : p)));
  const copyToAll = (index: number) =>
    setHours((prev) => {
      const from = prev.days[index];
      const periods = periodsOf(from);
      return { ...prev, days: prev.days.map(() => ({ closed: from.closed, open: periods[0].open, close: periods[0].close, periods })) };
    });

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const minutes = eta.trim() ? Number(eta) : null;
    if (minutes !== null && (!Number.isInteger(minutes) || minutes < 1 || minutes > 1440)) return setError(t.invalidEta);
    const bad = hours.enabled ? hoursProblem(hours.days) : null;
    if (bad !== null) return setError(t.overlap.replace("{day}", t[DAY_KEYS[bad]]));
    setSaving(true);
    setError(null);
    try {
      await apiClient.updateShippingSettings(workspaceId, {
        storeHours: { ...hours, days: hours.days.map(toSavedDay), message: hours.message.trim() },
        deliveryEtaMinutes: minutes,
      });
      toast.success(t.saved);
      await onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-4 space-y-4">
      {error && <Alert variant="danger">{error}</Alert>}
      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" checked={hours.enabled} onChange={(e) => setHours({ ...hours, enabled: e.target.checked })} />
        {t.enabled}
      </label>
      {hours.enabled && (
        <>
          <Field label={t.override} className="sm:max-w-[calc(50%-0.5rem)]">
            {({ id, ...aria }) => (
              <Select id={id} {...aria} value={hours.override} onChange={(e) => setHours({ ...hours, override: e.target.value as StoreHoursSettings["override"] })}>
                <option value="auto">{t.override_auto}</option>
                <option value="open">{t.override_open}</option>
                <option value="closed">{t.override_closed}</option>
              </Select>
            )}
          </Field>
          <div className="space-y-3">
            {hours.days.map((d, i) => {
              const periods = periodsOf(d);
              return (
                <div key={i} className="flex flex-wrap items-start gap-3 border-b border-line pb-3 text-sm text-ink last:border-b-0">
                  <span className="flex h-11 w-24 items-center">{t[DAY_KEYS[i]]}</span>
                  <label className="flex h-11 items-center gap-2">
                    <input type="checkbox" checked={d.closed} onChange={(e) => setDay(i, { closed: e.target.checked })} />
                    {t.closed}
                  </label>
                  {!d.closed && (
                    <div className="space-y-2">
                      {periods.map((p, j) => (
                        <div key={j} className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2">
                            {t.open}
                            <input type="time" dir="ltr" className={timeInput} value={p.open} onChange={(e) => setPeriod(i, j, { open: e.target.value })} />
                          </label>
                          <label className="flex items-center gap-2">
                            {t.close}
                            <input type="time" dir="ltr" className={timeInput} value={p.close} onChange={(e) => setPeriod(i, j, { close: e.target.value })} />
                          </label>
                          {periods.length > 1 && (
                            <Button type="button" size="sm" variant="outline" onClick={() => setPeriods(i, periods.filter((_, k) => k !== j))}>
                              {t.removePeriod}
                            </Button>
                          )}
                        </div>
                      ))}
                      {periods.length < MAX_PERIODS && (
                        <Button type="button" size="sm" variant="outline" onClick={() => setPeriods(i, [...periods, { open: "18:00", close: "23:00" }])}>
                          {t.addPeriod}
                        </Button>
                      )}
                    </div>
                  )}
                  <Button type="button" size="sm" variant="outline" className="ms-auto" onClick={() => copyToAll(i)}>
                    {t.copyToAll}
                  </Button>
                </div>
              );
            })}
            <p className="text-xs text-ink-soft">{t.periodsHint}</p>
            <p className="text-xs text-ink-soft">{t.overnightHint}</p>
          </div>
          <TextField label={t.message} value={hours.message} maxLength={300} onChange={(e) => setHours({ ...hours, message: e.target.value })} />
        </>
      )}
      <TextField label={t.eta} hint={t.etaHint} value={eta} inputMode="numeric" dir="ltr" maxLength={4} onChange={(e) => setEta(e.target.value)} className="sm:max-w-[calc(50%-0.5rem)]" />
      <div className="flex justify-end">
        <Button type="submit" disabled={saving}>
          {saving ? t.saving : t.save}
        </Button>
      </div>
    </form>
  );
}
