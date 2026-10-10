import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import { waBotGet, waBotPreview, waBotSave, type WaBotDialect, type WaBotSettings } from "@store-builder/api-client";
import { AccordionSection } from "@/components/Accordion";
import { CardSkeleton, DataState } from "@/components/DataState";
import { IconInfo, IconLock, IconRobot, IconSpinner } from "@/components/icons";
import { PageHeader } from "@/components/PageHeader";
import { SaveBar } from "@/components/SaveBar";
import { Segmented } from "@/components/Segmented";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useAsync } from "@/lib/useAsync";
import { invalidateCached } from "@/lib/useCachedAsync";
import { UnsavedGuardProvider, useReportDirty } from "@/lib/useUnsavedGuard";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { LeaveGuard } from "@/pages/catalog/product/LeaveGuard";
import { useInboxPhone } from "./inboxScreen";

const STRINGS = {
  en: {
    title: "WhatsApp bot",
    lead: "Answers your customers on WhatsApp from your products, your policies and their own orders.",
    back: "Messages",
    enabled: "Let the bot answer customers",
    enabledOn: "It answers new messages by itself. You can take any conversation over from the inbox.",
    enabledOff: "It is quiet: every message waits for your team.",
    usage: "Replies this month",
    usageOf: "{used} of {limit}",
    unlimited: "{used} (no limit on your plan)",
    hoursGroup: "Answering hours",
    hours: "When it answers",
    always: "All the time",
    scheduled: "Working hours only",
    from: "From",
    to: "To",
    days: "Days",
    day0: "Sun",
    day1: "Mon",
    day2: "Tue",
    day3: "Wed",
    day4: "Thu",
    day5: "Fri",
    day6: "Sat",
    timezone: "On your store's clock ({tz}).",
    voiceGroup: "How it talks and what it knows",
    dialect: "Tone and language",
    egyptian: "Egyptian Arabic",
    gulf: "Gulf Arabic",
    msa: "Modern Standard Arabic",
    english: "English",
    french: "French",
    extra: "What else it should know",
    extraHint: "Delivery times, working hours, sizes, anything customers often ask. It answers from this and your store's policies only.",
    save: "Save",
    saving: "Saving…",
    saved: "Bot settings saved.",
    tryTitle: "Try it",
    tryHint: "Write what a customer might send. Nothing is sent to anyone.",
    tryPlaceholder: "e.g. How much is the t-shirt?",
    ask: "Ask the bot",
    asking: "Thinking…",
    botSays: "The bot",
    handoff: "It would hand this chat to your team:",
    aboutTitle: "What the bot does",
    aboutSummary: "Answers, takes cash-on-delivery orders, and hands over when it should",
    about1: "It answers from your products, prices, stock, policies and the customer's own orders.",
    about2: "It can take a cash-on-delivery order in the chat, confirming every detail first. The order is tagged whatsapp-bot.",
    about3: "It never gives discounts.",
    about4: "It hands the chat to your team when it can't help, when a customer asks for a person, or is upset.",
    readOnly: "Only the store owner or a manager can change the bot's settings.",
  },
  ar: {
    title: "بوت واتساب",
    lead: "يرد على عملائك في واتساب من منتجاتك وسياساتك وطلباتهم.",
    back: "صندوق واتساب",
    enabled: "السماح للبوت بالرد على العملاء",
    enabledOn: "يرد على الرسائل الجديدة تلقائيًا. ويمكنك استلام أي محادثة من صندوق الرسائل.",
    enabledOff: "متوقف الآن: كل رسالة تنتظر فريقك.",
    usage: "ردود هذا الشهر",
    usageOf: "{used} من {limit}",
    unlimited: "{used} (بلا حد في باقتك)",
    hoursGroup: "مواعيد الرد",
    hours: "متى يرد",
    always: "طوال الوقت",
    scheduled: "في مواعيد العمل فقط",
    from: "من",
    to: "إلى",
    days: "الأيام",
    day0: "الأحد",
    day1: "الإثنين",
    day2: "الثلاثاء",
    day3: "الأربعاء",
    day4: "الخميس",
    day5: "الجمعة",
    day6: "السبت",
    timezone: "بتوقيت متجرك ({tz}).",
    voiceGroup: "كيف يتحدث وماذا يعرف",
    dialect: "الأسلوب واللغة",
    egyptian: "العامية المصرية",
    gulf: "اللهجة الخليجية",
    msa: "العربية الفصحى",
    english: "الإنجليزية",
    french: "الفرنسية",
    extra: "معلومات إضافية يعرفها",
    extraHint: "مدة التوصيل، مواعيد العمل، المقاسات، وكل ما يسأل عنه العملاء كثيرًا. يرد من هذه المعلومات ومن سياسات متجرك فقط.",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات البوت.",
    tryTitle: "جرّبه",
    tryHint: "اكتب رسالة قد يرسلها عميل. لن يُرسل شيء إلى أحد.",
    tryPlaceholder: "مثلًا: كم سعر التيشيرت؟",
    ask: "اسأل البوت",
    asking: "جارٍ التفكير…",
    botSays: "البوت",
    handoff: "سيحوّل هذه المحادثة إلى فريقك:",
    aboutTitle: "ماذا يفعل البوت",
    aboutSummary: "يرد، ويستقبل طلبات الدفع عند الاستلام، ويحوّل إلى فريقك عند اللزوم",
    about1: "يرد من منتجاتك وأسعارك ومخزونك وسياساتك وطلبات العميل نفسه.",
    about2: "يستقبل طلب دفع عند الاستلام داخل المحادثة بعد تأكيد كل التفاصيل. يُوسَم الطلب بـ whatsapp-bot.",
    about3: "لا يمنح خصومات أبدًا.",
    about4: "يحوّل المحادثة إلى فريقك عندما لا يستطيع المساعدة، أو يطلب العميل موظفًا، أو يكون منزعجًا.",
    readOnly: "مالك المتجر أو المدير فقط يمكنه تغيير إعدادات البوت.",
  },
} satisfies Messages;

const DIALECTS: WaBotDialect[] = ["egyptian", "gulf", "msa", "english", "french"];
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;
const MANAGERS = new Set(["owner", "workspace_manager"]);
/** The settings a server refusal can point at, in the order they are on the page. */
const FIELDS = ["from", "to", "days", "dialect", "extraInfo"] as const;
type FieldName = (typeof FIELDS)[number];

// A day of the week as a chip of the list kit: the same pane, the same brand fill when it is on.
const DAY_CHIP =
  "zimos-chip inline-flex h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full px-3.5 text-sm font-medium whitespace-nowrap select-none " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100 disabled:cursor-not-allowed disabled:opacity-60 pointer-fine:h-10";

/** The page while the settings load: the shape of its groups. */
function BotSkeleton() {
  return (
    <div className="flex flex-col gap-[var(--bento-gap)]">
      <CardSkeleton lines={1} />
      <CardSkeleton lines={3} />
      <CardSkeleton lines={4} />
    </div>
  );
}

/**
 * Inbox → Bot: the customer service bot's settings and a "Try it"
 * box. Grouped rows, as in the settings: the switch, when it answers, how it
 * talks and what it knows; the save bar shows once something changed and stays
 * in reach, and leaving with a change unsaved asks first.
 */
export function WaBotPage() {
  const workspaceId = useWorkspaceId();
  return (
    <UnsavedGuardProvider key={workspaceId}>
      <WaBotSettings />
    </UnsavedGuardProvider>
  );
}

function WaBotSettings() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const phone = useInboxPhone();
  const ids = useId();
  const canManage = MANAGERS.has(currentWorkspace?.role ?? "");
  const state = useAsync(() => waBotGet(apiClient, workspaceId), [workspaceId]);
  const [draft, setDraft] = useState<WaBotSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<{ action: "reply" | "handoff"; text: string } | null>(null);

  useEffect(() => {
    if (state.data) setDraft(state.data.bot);
  }, [state.data]);

  const saved = state.data?.bot ?? null;
  const dirty = Boolean(canManage && draft && saved && JSON.stringify(draft) !== JSON.stringify(saved));
  useReportDirty(dirty);

  const set = (patch: Partial<WaBotSettings>) => {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setError(null);
    setFieldErrors((prev) => {
      const next = { ...prev };
      for (const key of Object.keys(patch)) delete next[key as FieldName];
      return next;
    });
  };

  function discard() {
    if (saved) setDraft(saved);
    setError(null);
    setFieldErrors({});
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!draft || busy || !canManage) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      state.setData(await waBotSave(apiClient, workspaceId, draft));
      // The inbox keeps its own copy for the header chip and the strip of a conversation.
      invalidateCached("wa-bot:");
      toast.success(t.saved);
    } catch (err) {
      const refused = getFieldErrors(err);
      const named: Partial<Record<FieldName, string>> = {};
      for (const field of FIELDS) if (refused[field]) named[field] = refused[field];
      setFieldErrors(named);
      setError(errorMessage(err));
      // The first setting the server refused, brought into view and given the caret.
      const first = FIELDS.find((field) => named[field]);
      if (first) {
        const control = document.getElementById(`${ids}-${first}`);
        control?.scrollIntoView({ block: "center" });
        control?.focus();
      }
    } finally {
      setBusy(false);
    }
  }

  async function ask(e: FormEvent) {
    e.preventDefault();
    if (asking || !question.trim()) return;
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(await waBotPreview(apiClient, workspaceId, question.trim()));
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setAsking(false);
    }
  }

  const usage = state.data?.usage;
  const locked = !canManage || busy;

  return (
    // While a change is unsaved, the way back to the inbox asks before it is lost.
    <LeaveGuard className="max-w-3xl">
      <PageHeader title={t.title} description={phone ? undefined : t.lead} back={{ to: "/inbox", label: t.back }} />
      <DataState loading={state.loading && !draft} error={draft ? null : state.error} onRetry={() => void state.refresh()} skeleton={<BotSkeleton />}>
        {draft && (
          <div className="flex flex-col gap-[var(--bento-gap)]">
            {!canManage && (
              <Alert>
                <IconLock aria-hidden />
                <p>{t.readOnly}</p>
              </Alert>
            )}

            <form onSubmit={save} noValidate className="flex flex-col gap-[var(--bento-gap)]">
              <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-[var(--bento-gap)] border-0 p-0">
                <SettingsGroup>
                  <SettingsSwitch
                    checked={draft.enabled}
                    onChange={(enabled) => set({ enabled })}
                    label={t.enabled}
                    hint={draft.enabled ? t.enabledOn : t.enabledOff}
                    disabled={locked}
                  />
                  {canManage && (
                    <SettingsRow
                      label={t.usage}
                      control={
                        <span className="text-sm font-medium text-ink tabular-nums">
                          {usage?.limit != null
                            ? fmt(t.usageOf, { used: usage.repliesThisMonth, limit: usage.limit })
                            : fmt(t.unlimited, { used: usage?.repliesThisMonth ?? 0 })}
                        </span>
                      }
                    />
                  )}
                </SettingsGroup>

                <SettingsGroup title={t.hoursGroup} footer={draft.alwaysOn ? undefined : fmt(t.timezone, { tz: state.data?.timezone ?? "UTC" })}>
                  <SettingsRow
                    label={t.hours}
                    stacked
                    control={
                      <Segmented
                        className="w-full"
                        value={draft.alwaysOn ? "always" : "scheduled"}
                        onChange={(value) => set({ alwaysOn: value === "always" })}
                        label={t.hours}
                        options={[
                          { value: "always", label: t.always },
                          { value: "scheduled", label: t.scheduled },
                        ]}
                      />
                    }
                  />
                  {!draft.alwaysOn && (
                    <>
                      <SettingsRow
                        label={t.from}
                        htmlFor={`${ids}-from`}
                        error={fieldErrors.from}
                        control={
                          <Input
                            id={`${ids}-from`}
                            type="time"
                            dir="ltr"
                            value={draft.from}
                            aria-invalid={fieldErrors.from ? true : undefined}
                            onChange={(e) => set({ from: e.target.value })}
                            className="h-11 tabular-nums sm:w-36"
                          />
                        }
                      />
                      <SettingsRow
                        label={t.to}
                        htmlFor={`${ids}-to`}
                        error={fieldErrors.to}
                        control={
                          <Input
                            id={`${ids}-to`}
                            type="time"
                            dir="ltr"
                            value={draft.to}
                            aria-invalid={fieldErrors.to ? true : undefined}
                            onChange={(e) => set({ to: e.target.value })}
                            className="h-11 tabular-nums sm:w-36"
                          />
                        }
                      />
                      <SettingsRow
                        label={t.days}
                        stacked
                        error={fieldErrors.days}
                        control={
                          <div id={`${ids}-days`} tabIndex={-1} className="flex flex-wrap gap-2 outline-none">
                            {DAYS.map((d) => {
                              const on = draft.days.includes(d);
                              return (
                                <button
                                  key={d}
                                  type="button"
                                  aria-pressed={on}
                                  onClick={() => set({ days: on ? draft.days.filter((x) => x !== d) : [...draft.days, d].sort() })}
                                  className={`${DAY_CHIP} ${on ? "bg-primary text-primary-foreground" : "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken"}`}
                                >
                                  {t[`day${d}`]}
                                </button>
                              );
                            })}
                          </div>
                        }
                      />
                    </>
                  )}
                </SettingsGroup>

                <SettingsGroup title={t.voiceGroup}>
                  <SettingsRow
                    label={t.dialect}
                    htmlFor={`${ids}-dialect`}
                    error={fieldErrors.dialect}
                    control={
                      <Select
                        id={`${ids}-dialect`}
                        value={draft.dialect}
                        onChange={(e) => set({ dialect: e.target.value as WaBotDialect })}
                        className="h-11 w-auto min-w-44 text-base md:text-sm"
                      >
                        {DIALECTS.map((d) => (
                          <option key={d} value={d}>
                            {t[d]}
                          </option>
                        ))}
                      </Select>
                    }
                  />
                  <SettingsRow
                    label={t.extra}
                    hint={t.extraHint}
                    htmlFor={`${ids}-extraInfo`}
                    stacked
                    error={fieldErrors.extraInfo}
                    control={
                      <Textarea
                        id={`${ids}-extraInfo`}
                        rows={5}
                        maxLength={2000}
                        dir="auto"
                        value={draft.extraInfo}
                        aria-invalid={fieldErrors.extraInfo ? true : undefined}
                        onChange={(e) => set({ extraInfo: e.target.value })}
                        className="text-base md:text-sm"
                      />
                    }
                  />
                </SettingsGroup>
              </fieldset>

              <SaveBar
                dirty={dirty}
                saving={busy}
                onDiscard={discard}
                saveLabel={t.save}
                savingLabel={t.saving}
                message={error ? <span className="text-danger">{error}</span> : undefined}
              />
            </form>

            <SettingsGroup title={t.tryTitle} description={t.tryHint}>
              <div className="space-y-3 p-4">
                <form onSubmit={ask} className="flex items-center gap-2">
                  <Input
                    aria-label={t.tryTitle}
                    placeholder={t.tryPlaceholder}
                    maxLength={1000}
                    dir="auto"
                    enterKeyHint="send"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    className="h-11 min-w-0 flex-1"
                  />
                  <Button type="submit" aria-busy={asking || undefined} disabled={asking || !question.trim()} className="h-11 shrink-0 gap-1.5 rounded-full px-5">
                    {asking && <IconSpinner className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
                    {asking ? t.asking : t.ask}
                  </Button>
                </form>
                {answer && (
                  <div role="status" data-slot="chat-bubble" data-dir="out" className="w-fit max-w-full rounded-[1.25rem] rounded-es-md bg-primary-soft px-3.5 py-2.5 text-[15px] leading-6 text-ink sm:max-w-[80%]">
                    <p className="mb-1 flex items-center gap-1.5 text-xs leading-4 font-medium text-ink-soft">
                      <IconRobot className="size-3.5 shrink-0" aria-hidden />
                      {answer.action === "handoff" ? t.handoff : t.botSays}
                    </p>
                    <p className="break-words whitespace-pre-wrap" dir="auto">
                      {answer.text}
                    </p>
                  </div>
                )}
              </div>
            </SettingsGroup>

            <AccordionSection title={t.aboutTitle} summary={t.aboutSummary} icon={IconInfo} persistKey="wa-bot:about">
              <ul className="space-y-2 text-sm leading-6 text-ink">
                {[t.about1, t.about2, t.about3, t.about4].map((line) => (
                  <li key={line} className="flex items-start gap-2.5">
                    <span aria-hidden className="mt-2.5 size-1.5 shrink-0 rounded-full bg-primary" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </AccordionSection>
          </div>
        )}
      </DataState>
    </LeaveGuard>
  );
}
