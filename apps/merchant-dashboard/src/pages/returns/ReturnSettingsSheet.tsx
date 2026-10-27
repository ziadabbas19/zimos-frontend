import { useEffect, useId, useState, type FormEvent } from "react";
import { IconLock } from "@/components/icons";
import { Alert, Button, Input, ZLoader } from "@store-builder/ui";
import {
  RETURN_REASON_CODES,
  shopperReturnsSettingsGet,
  shopperReturnsSettingsSave,
  type ReturnReasonCode,
  type ShopperReturnsSettings,
  type ShopperReturnsSettingsWithExchanges,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { isPermissionError } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { RETURN_REASON_TEXT } from "./ReturnExtras";

const STRINGS = {
  en: {
    sheetTitle: "Returns from the customer",
    title: "Let customers ask for a return",
    hintOff: "Off: customers contact you about a return, and you open it from the order.",
    hintOn: "Customers see “Return items” on their order's tracking page once it's delivered. Their requests land here as “From customer” for you to approve or reject.",
    days: "Days after delivery",
    daysHint: "Returns close this many days after the order is delivered.",
    daysError: "Enter a number of days from 1 to 365.",
    photoTitle: "Photo required when the reason is",
    photoHint: "The customer has to add a photo of the problem for these reasons.",
    exchanges: "Allow exchanges (another size or colour)",
    exchangesHint: "Shoppers can ask for another size or colour of the same product instead of their money back",
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    saving: "Saving…",
    saved: "Saved. Customers see the change on their tracking page right away.",
    loading: "Loading the return setting…",
    loadError: "We couldn't load this setting.",
    retry: "Try again",
    noAccess: "Changing this needs the “manage orders” permission. Ask the store owner.",
    days1: "Open for 1 day after delivery",
    days2: "Open for 2 days after delivery",
    daysFew: "Open for {days} days after delivery",
    daysMany: "Open for {days} days after delivery",
    photoFor: "Photo needed for: {reasons}",
    noPhoto: "No photo needed",
    summary: "{days} · {photos}",
    listSep: ", ",
  },
  ar: {
    sheetTitle: "مرتجع من العميل",
    title: "السماح للعملاء بطلب مرتجع",
    hintOff: "متوقفة: يتواصل العميل معك بخصوص المرتجع، وتفتحه أنت من صفحة الطلب.",
    hintOn: "يجد العميل «إرجاع منتجات» في صفحة تتبع الطلب بعد الاستلام، ويصلك طلبه هنا «من العميل» لتقبله أو ترفضه.",
    days: "عدد الأيام بعد الاستلام",
    daysHint: "يُغلق طلب المرتجع بعد هذا العدد من الأيام من يوم الاستلام.",
    daysError: "أدخل عدد أيام من ١ إلى ٣٦٥.",
    photoTitle: "تلزم صورة إذا كان السبب",
    photoHint: "يجب أن يضيف العميل صورة للمشكلة إذا اختار أحد هذه الأسباب.",
    exchanges: "السماح بالاستبدال (مقاس أو لون آخر)",
    exchangesHint: "يستطيع العميل طلب مقاس أو لون آخر من المنتج نفسه بدلًا من استرداد المبلغ",
    save: "حفظ",
    cancel: "إلغاء",
    close: "إغلاق",
    saving: "جارٍ الحفظ…",
    saved: "تم الحفظ. يرى العملاء التغيير في صفحة التتبع مباشرة.",
    loading: "جارٍ تحميل إعداد المرتجع…",
    loadError: "تعذّر تحميل هذا الإعداد.",
    retry: "حاول مرة أخرى",
    noAccess: "تغيير هذا الإعداد يتطلب صلاحية «إدارة الطلبات». اطلبها من مالك المتجر.",
    days1: "مفتوح يوم واحد بعد الاستلام",
    days2: "مفتوح يومين بعد الاستلام",
    daysFew: "مفتوح {days} أيام بعد الاستلام",
    daysMany: "مفتوح {days} يومًا بعد الاستلام",
    photoFor: "تلزم الصورة عند: {reasons}",
    noPhoto: "بدون صور",
    summary: "{days} · {photos}",
    listSep: "، ",
  },
} satisfies Messages;

type Draft = { enabled: boolean; windowDays: string; photoRequiredFor: ReturnReasonCode[]; exchanges: boolean };

const toDraft = (s: ShopperReturnsSettings): Draft => ({
  enabled: s.enabled,
  windowDays: String(s.windowDays),
  photoRequiredFor: [...s.photoRequiredFor],
  exchanges: (s as ShopperReturnsSettingsWithExchanges).exchanges === true,
});

function sameDraft(a: Draft, b: Draft): boolean {
  return (
    a.enabled === b.enabled &&
    a.exchanges === b.exchanges &&
    a.windowDays.trim() === b.windowDays.trim() &&
    a.photoRequiredFor.length === b.photoRequiredFor.length &&
    a.photoRequiredFor.every((r) => b.photoRequiredFor.includes(r))
  );
}

/** A whole number of days the API takes (1–365), or null. */
function parseDays(raw: string): number | null {
  const ascii = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (!/^\d{1,3}$/.test(ascii)) return null;
  const n = Number(ascii);
  return n >= 1 && n <= 365 ? n : null;
}

/**
 * The store's shopper-returns setting (orders.manage), read once
 * for the page: the header says whether it is on, the sheet edits it.
 */
export function useShopperReturnsSettings() {
  const workspaceId = useWorkspaceId();
  return useAsync(() => shopperReturnsSettingsGet(apiClient, workspaceId), [workspaceId]);
}

export type ShopperReturnsSettingsState = ReturnType<typeof useShopperReturnsSettings>;

/**
 * Returns → «مرتجع من العميل»: whether customers may ask for a return from the
 * tracking page, for how many days after delivery, and which reasons need a
 * photo of the problem. One Save for the three. It used to be a card above the
 * queue; it is a setting changed once in a while, so it now waits behind the
 * header button and the queue is the first thing on the page.
 *
 * A `Modal`: the same pane as a sheet (a bottom sheet on the phone), which also
 * asks before a half-made change is thrown away by a stray tap outside.
 */
export function ReturnSettingsSheet({ open, onClose, settings }: { open: boolean; onClose: () => void; settings: ShopperReturnsSettingsState }) {
  const workspaceId = useWorkspaceId();
  const t = useT(STRINGS);
  const { locale, intlLocale } = useLocale();
  const reasonText = RETURN_REASON_TEXT[locale];
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const switchHint = useId();
  const daysId = useId();
  const daysHint = useId();
  const exchangesHint = useId();

  const stored = settings.data;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [daysError, setDaysError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // The sheet opens on what is saved: a change left behind by Cancel never comes back.
  useEffect(() => {
    if (stored) setDraft(toDraft(stored));
    setDaysError(null);
    setSaveError(null);
  }, [stored, open]);

  const saved = stored ? toDraft(stored) : null;
  const dirty = Boolean(draft && saved && !sameDraft(draft, saved));

  // Under the title: what is in force now, while customers can ask.
  let description: string | undefined;
  if (stored?.enabled) {
    const days = stored.windowDays;
    const daysLine = fmt(days === 1 ? t.days1 : days === 2 ? t.days2 : days <= 10 ? t.daysFew : t.daysMany, {
      days: new Intl.NumberFormat(intlLocale).format(days),
    });
    const photoLine = stored.photoRequiredFor.length
      ? fmt(t.photoFor, { reasons: stored.photoRequiredFor.map((code) => reasonText[code]).join(t.listSep) })
      : t.noPhoto;
    description = fmt(t.summary, { days: daysLine, photos: photoLine });
  }

  function togglePhoto(code: ReturnReasonCode, on: boolean) {
    setDraft((d) =>
      d
        ? {
            ...d,
            photoRequiredFor: on
              ? RETURN_REASON_CODES.filter((r) => r === code || d.photoRequiredFor.includes(r))
              : d.photoRequiredFor.filter((r) => r !== code),
          }
        : d
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft || !stored || saving) return;
    setSaveError(null);
    // Days are checked only while the switch is on; off keeps the last good number.
    const days = parseDays(draft.windowDays);
    if (draft.enabled && days === null) {
      setDaysError(t.daysError);
      document.getElementById(daysId)?.focus();
      return;
    }
    setDaysError(null);
    setSaving(true);
    try {
      const body: ShopperReturnsSettingsWithExchanges = {
        enabled: draft.enabled,
        windowDays: days ?? stored.windowDays,
        photoRequiredFor: draft.photoRequiredFor,
        exchanges: draft.exchanges,
      };
      const next = await shopperReturnsSettingsSave(apiClient, workspaceId, body);
      settings.setData(next);
      toast.success(t.saved);
      onClose();
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const loading = settings.loading || (!draft && !settings.error);
  const failed = !loading && (Boolean(settings.error) || !draft || !stored);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.sheetTitle}
      description={description}
      footer={
        !loading && !failed ? (
          <>
            <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
              {t.cancel}
            </Button>
            <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving || !dirty}>
              {saving ? t.saving : t.save}
            </Button>
          </>
        ) : (
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose}>
            {t.close}
          </Button>
        )
      }
    >
      {loading ? (
        <div className="flex min-h-11 items-center">
          <ZLoader label={t.loading} />
        </div>
      ) : failed || !draft ? (
        isPermissionError(settings.error) ? (
          <p className="flex items-start gap-2 text-sm leading-6 text-ink-soft">
            <IconLock className="mt-1 size-4 shrink-0" aria-hidden />
            {t.noAccess}
          </p>
        ) : (
          <div role="alert" className="flex flex-wrap items-center gap-3">
            <p className="text-sm text-danger">{settings.error ? errorMessage(settings.error) : t.loadError}</p>
            <Button variant="outline" size="sm" className="min-h-11 rounded-full px-4" onClick={() => void settings.refresh()}>
              {t.retry}
            </Button>
          </div>
        )
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-5">
          <div>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-semibold text-ink">
              <input
                type="checkbox"
                role="switch"
                className="size-5 shrink-0 cursor-pointer accent-primary"
                checked={draft.enabled}
                aria-describedby={switchHint}
                onChange={(e) => setDraft((d) => (d ? { ...d, enabled: e.target.checked } : d))}
              />
              {t.title}
            </label>
            <p id={switchHint} className="text-xs leading-5 text-ink-soft">
              {draft.enabled ? t.hintOn : t.hintOff}
            </p>
          </div>

          {draft.enabled && (
            <>
              <div className="space-y-1.5">
                <label htmlFor={daysId} className="block text-sm font-medium text-ink">
                  {t.days}
                </label>
                <Input
                  id={daysId}
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  autoComplete="off"
                  maxLength={3}
                  value={draft.windowDays}
                  aria-invalid={daysError ? true : undefined}
                  aria-describedby={daysHint}
                  onChange={(e) => {
                    setDaysError(null);
                    setDraft((d) => (d ? { ...d, windowDays: e.target.value } : d));
                  }}
                  className="h-11 w-28 text-center tabular-nums"
                />
                <p id={daysHint} className={daysError ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                  {daysError ?? t.daysHint}
                </p>
              </div>

              <fieldset>
                <legend className="text-sm font-medium text-ink">{t.photoTitle}</legend>
                <p className="mt-0.5 text-xs text-ink-soft">{t.photoHint}</p>
                <div className="mt-2 grid grid-cols-2 gap-x-3 sm:grid-cols-3">
                  {RETURN_REASON_CODES.map((code) => (
                    <label key={code} className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                      <input
                        type="checkbox"
                        className="size-5 shrink-0 cursor-pointer accent-primary"
                        checked={draft.photoRequiredFor.includes(code)}
                        onChange={(e) => togglePhoto(code, e.target.checked)}
                      />
                      {reasonText[code]}
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label className="flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink">
                  <input
                    type="checkbox"
                    role="switch"
                    className="size-5 shrink-0 cursor-pointer accent-primary"
                    checked={draft.exchanges}
                    aria-describedby={exchangesHint}
                    onChange={(e) => setDraft((d) => (d ? { ...d, exchanges: e.target.checked } : d))}
                  />
                  {t.exchanges}
                </label>
                <p id={exchangesHint} className="text-xs leading-5 text-ink-soft">
                  {t.exchangesHint}
                </p>
              </div>
            </>
          )}

          {saveError && <Alert variant="danger">{saveError}</Alert>}
        </form>
      )}
    </Modal>
  );
}
