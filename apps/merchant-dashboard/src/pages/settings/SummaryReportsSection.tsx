import { useId, useState, type FormEvent } from "react";
import { IconEye, IconSend } from "@/components/icons";
import { Alert, Button } from "@store-builder/ui";
import {
  SCHEDULED_REPORT_MAX_RECIPIENTS,
  scheduledReportSendTest,
  scheduledReportsGet,
  scheduledReportsSave,
  type ScheduledReportKind,
  type ScheduledReportSchedule,
  type ScheduledReportSettings,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useAuth } from "@/context/AuthContext";
import { useAsync } from "@/lib/useAsync";
import { canViewAnalytics } from "@/lib/analyticsAccess";
import { useErrorMessage } from "@/lib/errorMessages";
import { getFieldErrors, isPermissionError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { SettingsCard } from "./sections/SettingsCard";
import { SummaryReportPreviewDialog } from "./SummaryReportPreviewDialog";

const STRINGS = {
  en: {
    title: "Summary reports by email",
    description:
      "An email with your store's numbers against the period before — sales, orders, average order, confirmation and delivery rates, new customers, lost orders, net profit — and the top 5 products.",
    daily: "Daily report",
    dailyHint: "Covers yesterday.",
    weekly: "Weekly report",
    weeklyHint: "Covers the 7 days before the day it is sent.",
    on: "On",
    off: "Off",
    hour: "Send at",
    weekday: "Send every",
    storeTime: "Store time ({city})",
    recipients: "Who gets it",
    recipientsHint: "Team members who can see analytics. Each gets the report in their own dashboard language.",
    noMembers: "No team member can see analytics",
    you: "you",
    recipientsRequired: "Choose who gets the report",
    recipientsRefused: "Only active team members who can see analytics can get reports. Reload the page and choose again.",
    maxRecipients: "A report goes to {max} members at most.",
    preview: "Preview",
    sendNow: "Send it to me now",
    sending: "Sending…",
    sentTo: "Sent to {email}.",
    notSent: "The report couldn't be emailed to {email} right now. Try again in a while.",
    lastSent: "Last sent: {when}",
    lastSentTo_one: "{kind}, to 1 member",
    lastSentTo_other: "{kind}, to {n} members",
    neverSent: "No report has been sent yet.",
    kind_daily: "the daily report",
    kind_weekly: "the weekly report",
    readOnly: "Only the store owner or a manager can change the schedule. You can still preview a report or send one to yourself.",
    save: "Save",
    saving: "Saving…",
    saved: "Summary reports saved.",
  },
  ar: {
    title: "تقارير ملخّصة بالبريد الإلكتروني",
    description:
      "بريد إلكتروني بأرقام متجرك مقارنةً بالفترة السابقة: المبيعات، الطلبات، متوسط الطلب، نسبة التأكيد والتسليم، العملاء الجدد، الطلبات الضائعة، صافي الربح، وأعلى ٥ منتجات.",
    daily: "تقرير يومي",
    dailyHint: "يغطي يوم أمس.",
    weekly: "تقرير أسبوعي",
    weeklyHint: "يغطي الأيام السبعة السابقة ليوم الإرسال.",
    on: "مفعّل",
    off: "متوقف",
    hour: "يُرسل الساعة",
    weekday: "يُرسل كل",
    storeTime: "بتوقيت المتجر ({city})",
    recipients: "من يستلم التقرير",
    recipientsHint: "أعضاء الفريق الذين يمكنهم رؤية التحليلات. يصل التقرير لكل منهم بلغة لوحة التحكم الخاصة به.",
    noMembers: "لا يوجد في الفريق من يمكنه رؤية التحليلات",
    you: "أنت",
    recipientsRequired: "اختر من يستلم التقرير",
    recipientsRefused: "تُرسل التقارير فقط لأعضاء الفريق النشطين الذين يمكنهم رؤية التحليلات. أعد تحميل الصفحة واختر من جديد.",
    maxRecipients: "يُرسل التقرير إلى {max} عضوًا بحد أقصى.",
    preview: "معاينة",
    sendNow: "إرساله إليّ الآن",
    sending: "جارٍ الإرسال…",
    sentTo: "تم الإرسال إلى {email}.",
    notSent: "لم يُرسل التقرير إلى {email} الآن. حاول مرة أخرى بعد قليل.",
    lastSent: "آخر تقرير أُرسل: {when}",
    lastSentTo_one: "{kind}، لعضو واحد",
    lastSentTo_two: "{kind}، لعضوين",
    lastSentTo_few: "{kind}، لـ {n} أعضاء",
    lastSentTo_other: "{kind}، لـ {n} عضوًا",
    neverSent: "لم يُرسل أي تقرير بعد.",
    kind_daily: "التقرير اليومي",
    kind_weekly: "التقرير الأسبوعي",
    readOnly: "مالك المتجر أو مديره فقط من يمكنه تغيير المواعيد. يمكنك أيضًا معاينة التقرير أو إرساله إلى نفسك.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ التقارير الملخّصة.",
  },
} satisfies Messages;

/** The Arabic names of the cities our merchants' stores keep time by; any other zone shows its own name. */
const CITY_AR: Record<string, string> = {
  Cairo: "القاهرة",
  Riyadh: "الرياض",
  Dubai: "دبي",
  Kuwait: "الكويت",
  Qatar: "الدوحة",
  Bahrain: "المنامة",
  Muscat: "مسقط",
  Amman: "عمّان",
  Beirut: "بيروت",
  Baghdad: "بغداد",
  Damascus: "دمشق",
  Tripoli: "طرابلس",
  Tunis: "تونس",
  Algiers: "الجزائر",
  Casablanca: "الدار البيضاء",
  Khartoum: "الخرطوم",
  Istanbul: "إسطنبول",
  London: "لندن",
};

/** "Africa/Cairo" → "Cairo" / «القاهرة». */
function zoneCity(timeZone: string, locale: "ar" | "en"): string {
  const city = (timeZone.split("/").pop() ?? timeZone).replace(/_/g, " ");
  return locale === "ar" ? (CITY_AR[city] ?? city) : city;
}

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6];

/** Which role keys cannot save the schedule (workspace.manage) although they may read it (analytics.view). */
const READ_ONLY_ROLES: ReadonlySet<string> = new Set(["accountant"]);

/**
 * Settings → My account → "Summary reports", beside the member's
 * own notifications: a daily and a weekly email of the store's numbers, when
 * each goes out (store time) and which team members get it, with a preview
 * and "send it to me now". Reading needs analytics.view, saving
 * workspace.manage; a role known to lack analytics does not get the section.
 */
export function SummaryReportsSection() {
  const { currentWorkspace } = useWorkspace();
  if (!canViewAnalytics(currentWorkspace?.role)) return null;
  return <SummaryReports readOnly={READ_ONLY_ROLES.has(currentWorkspace?.role ?? "")} />;
}

function SummaryReports({ readOnly }: { readOnly: boolean }) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const settings = useAsync(() => scheduledReportsGet(apiClient, workspaceId), [workspaceId]);

  return (
    <SettingsCard id="summary-reports" searchAnchor="summary-reports" title={t.title} description={t.description}>
      <DataState loading={settings.loading} error={settings.error} onRetry={() => void settings.refresh()}>
        {settings.data && <ReportsForm saved={settings.data} readOnly={readOnly} onSaved={(next) => settings.setData(next)} />}
      </DataState>
    </SettingsCard>
  );
}

function scheduleOf(settings: ScheduledReportSettings): ScheduledReportSchedule {
  // Someone chosen earlier who can no longer see analytics would make the API refuse the whole save.
  const allowed = new Set(settings.members.map((m) => m.userId));
  return {
    daily: { enabled: settings.daily.enabled, hour: settings.daily.hour },
    weekly: { enabled: settings.weekly.enabled, weekday: settings.weekly.weekday, hour: settings.weekly.hour },
    recipientUserIds: settings.recipientUserIds.filter((id) => allowed.has(id)),
  };
}

function ReportsForm({
  saved,
  readOnly,
  onSaved,
}: {
  saved: ScheduledReportSettings;
  readOnly: boolean;
  onSaved: (next: ScheduledReportSettings) => void;
}) {
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
  const workspaceId = useWorkspaceId();
  const { user } = useAuth();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const recipientsError = useId();
  const [draft, setDraft] = useState<ScheduledReportSchedule>(() => scheduleOf(saved));
  const [problem, setProblem] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState<ScheduledReportKind | null>(null);
  const [previewing, setPreviewing] = useState<ScheduledReportKind | null>(null);

  const baseline = scheduleOf(saved);
  const dirty = JSON.stringify(draft) !== JSON.stringify(baseline);
  const anyOn = draft.daily.enabled || draft.weekly.enabled;
  const full = draft.recipientUserIds.length >= SCHEDULED_REPORT_MAX_RECIPIENTS;
  const locked = readOnly || saving;
  // The page asks before a changed schedule is left behind (lib/useUnsavedGuard.ts).
  useReportDirty(dirty && !readOnly);

  // 9 → "9:00 AM" / «٩:٠٠ ص», Sunday-first weekday names, both in the dashboard's language.
  const hourLabel = (hour: number) => new Date(2000, 0, 1, hour).toLocaleTimeString(intlLocale, { hour: "numeric", minute: "2-digit" });
  const weekdayLabel = (day: number) => new Date(2023, 0, 1 + day).toLocaleDateString(intlLocale, { weekday: "long" });
  const storeTime = fmt(t.storeTime, { city: zoneCity(saved.timeZone, locale) });

  function toggleRecipient(userId: string, on: boolean) {
    setDraft((d) => ({
      ...d,
      recipientUserIds: on ? [...d.recipientUserIds.filter((id) => id !== userId), userId] : d.recipientUserIds.filter((id) => id !== userId),
    }));
    setProblem(null);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving || readOnly) return;
    if (anyOn && draft.recipientUserIds.length === 0) {
      setProblem(t.recipientsRequired);
      document.getElementById(recipientsError)?.scrollIntoView({ block: "center" });
      return;
    }
    setSaving(true);
    setProblem(null);
    setFailure(null);
    try {
      const next = await scheduledReportsSave(apiClient, workspaceId, draft);
      onSaved(next);
      setDraft(scheduleOf(next));
      toast.success(t.saved);
    } catch (err) {
      // The API words the two refusals on `recipientUserIds` in English; say them in the dashboard's language.
      const refused = getFieldErrors(err).recipientUserIds;
      if (refused) setProblem(/choose who/i.test(refused) || draft.recipientUserIds.length === 0 ? t.recipientsRequired : t.recipientsRefused);
      else setFailure(isPermissionError(err) ? t.readOnly : errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function sendNow(kind: ScheduledReportKind) {
    if (sending) return;
    setSending(kind);
    try {
      const result = await scheduledReportSendTest(apiClient, workspaceId, kind);
      if (result.sent) toast.success(fmt(t.sentTo, { email: result.email }));
      else toast.error(fmt(t.notSent, { email: result.email }));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSending(null);
    }
  }

  const last = saved.lastSent[0];

  const actions = (kind: ScheduledReportKind) => (
    <div className="mt-3 flex flex-wrap gap-2">
      <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" onClick={() => setPreviewing(kind)}>
        <IconEye className="size-4" aria-hidden />
        {t.preview}
      </Button>
      <Button type="button" variant="outline" size="sm" className="min-h-11 md:min-h-9" disabled={sending !== null} onClick={() => void sendNow(kind)}>
        <IconSend className="size-4 rtl:-scale-x-100" aria-hidden />
        {sending === kind ? t.sending : t.sendNow}
      </Button>
    </div>
  );

  const hourSelect = (kind: ScheduledReportKind) => (
    <label className="block min-w-0 flex-1 text-xs font-medium text-ink-soft">
      {t.hour}
      <Select
        className="mt-1 h-11"
        value={draft[kind].hour}
        disabled={locked || !draft[kind].enabled}
        onChange={(e) => setDraft((d) => ({ ...d, [kind]: { ...d[kind], hour: Number(e.target.value) } }))}
      >
        {HOURS.map((hour) => (
          <option key={hour} value={hour}>
            {hourLabel(hour)}
          </option>
        ))}
      </Select>
    </label>
  );

  const card = (kind: ScheduledReportKind, title: string, hint: string) => (
    <div className="rounded-[var(--radius)] bg-paper-sunken/60 p-4 ring-1 ring-line">
      <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink has-[:disabled]:cursor-default">
        <input
          type="checkbox"
          role="switch"
          className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
          checked={draft[kind].enabled}
          disabled={locked}
          onChange={(e) => {
            setDraft((d) => ({ ...d, [kind]: { ...d[kind], enabled: e.target.checked } }));
            setProblem(null);
          }}
        />
        <span className="min-w-0 flex-1">{title}</span>
        <span className="text-xs font-normal text-ink-soft">{draft[kind].enabled ? t.on : t.off}</span>
      </label>
      <p className="text-xs text-ink-soft">{hint}</p>
      <div className="mt-3 flex flex-wrap gap-3">
        {kind === "weekly" && (
          <label className="block min-w-0 flex-1 text-xs font-medium text-ink-soft">
            {t.weekday}
            <Select
              className="mt-1 h-11"
              value={draft.weekly.weekday}
              disabled={locked || !draft.weekly.enabled}
              onChange={(e) => setDraft((d) => ({ ...d, weekly: { ...d.weekly, weekday: Number(e.target.value) } }))}
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {weekdayLabel(day)}
                </option>
              ))}
            </Select>
          </label>
        )}
        {hourSelect(kind)}
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">{storeTime}</p>
      {actions(kind)}
    </div>
  );

  function discard() {
    setDraft(baseline);
    setProblem(null);
    setFailure(null);
  }

  const form = (
    <form onSubmit={submit} noValidate className="space-y-5">
      {readOnly && <Alert>{t.readOnly}</Alert>}

      <div className="grid gap-4 md:grid-cols-2">
        {card("daily", t.daily, t.dailyHint)}
        {card("weekly", t.weekly, t.weeklyHint)}
      </div>

      <fieldset aria-describedby={problem ? recipientsError : undefined}>
        <legend className="text-sm font-semibold text-ink">{t.recipients}</legend>
        <p className="mt-0.5 text-xs text-ink-soft">{t.recipientsHint}</p>
        {saved.members.length === 0 ? (
          <p className="mt-2 rounded-[var(--radius)] bg-paper-sunken px-3 py-3 text-sm text-ink-soft">{t.noMembers}</p>
        ) : (
          <ul className="mt-2 max-h-72 divide-y divide-line overflow-y-auto overscroll-contain rounded-[var(--radius)] ring-1 ring-line">
            {saved.members.map((member) => {
              const on = draft.recipientUserIds.includes(member.userId);
              return (
                <li key={member.userId}>
                  <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-paper-sunken has-[:disabled]:cursor-default has-[:disabled]:opacity-70">
                    <input
                      type="checkbox"
                      className="size-5 shrink-0 cursor-pointer accent-primary disabled:cursor-default"
                      checked={on}
                      disabled={locked || (!on && full)}
                      onChange={(e) => toggleRecipient(member.userId, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        <bdi>{member.fullName || member.email}</bdi>
                        {member.userId === user?.id && <span className="font-normal text-ink-soft"> ({t.you})</span>}
                      </span>
                      {member.fullName && (
                        <span className="block truncate text-xs text-ink-soft">
                          <bdi dir="ltr">{member.email}</bdi>
                        </span>
                      )}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
        <p id={recipientsError} role="alert" className="mt-1.5 text-xs font-medium text-danger empty:hidden">
          {problem}
        </p>
        {full && <p className="mt-1.5 text-xs text-ink-soft">{fmt(t.maxRecipients, { max: SCHEDULED_REPORT_MAX_RECIPIENTS })}</p>}
      </fieldset>

      <p className="text-xs text-ink-soft">
        {last
          ? // «آخر تقرير اتبعت: ٧ أكتوبر، ٩:٠٠ ص — التقرير اليومي، لعضوين»
            `${fmt(t.lastSent, { when: formatDateTime(last.sentAt) })} — ${fmt(pluralOf(t, "lastSentTo", last.sentCount), { kind: t[`kind_${last.kind}`] })}`
          : t.neverSent}
      </p>

      {failure && <Alert variant="danger">{failure}</Alert>}

      {!readOnly && <SaveBar dirty={dirty} saving={saving} saveLabel={t.save} savingLabel={t.saving} onDiscard={discard} />}
    </form>
  );

  return (
    <>
      {form}
      <SummaryReportPreviewDialog kind={previewing} onClose={() => setPreviewing(null)} />
    </>
  );
}
