import { useId, useState } from "react";
import { Input } from "@store-builder/ui";
import { offersGetExitDownsell, offersSaveExitDownsell, type ExitDownsellSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SaveBar } from "@/components/SaveBar";
import { Select } from "@/components/Select";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { OfferNumbers, useOfferStats } from "./OfferNumbers";
import { FormProblem, OfferPage, OfferPreview, TOUCH_FIELD } from "./OfferKit";

/**
 * The exit popup: a message and a real coupon shown once to a
 * visitor who is about to leave, or after a delay. No countdown, no "only
 * today": the coupon is one of the store's own discounts and works as long as
 * that discount does.
 */

const STRINGS = {
  en: {
    title: "Exit popup",
    description: "One last offer to a visitor who is leaving without ordering. Each visitor sees it once.",
    stateOn: "On",
    stateOff: "Off",
    enabled: "Show the exit popup",
    enabledHintOn: "Each visitor sees it once.",
    enabledHintOff: "Nobody sees it. What you wrote is kept.",
    whenGroup: "When and where",
    trigger: "When",
    trigger_exit_intent: "The visitor is about to leave",
    trigger_delay: "After a delay",
    triggerHint: "“About to leave”: the mouse leaves the page on a computer, or the back button on a phone.",
    delay: "Delay in seconds",
    delayHint: "From 3 to 600.",
    pages: "On",
    pages_all: "Every page",
    pages_product: "Product pages",
    pages_cart: "The cart",
    wordsGroup: "What it says",
    popupTitle: "Title",
    popupTitlePlaceholder: "Before you go…",
    message: "Message",
    messagePlaceholder: "Take 10% off your first order.",
    coupon: "Coupon",
    couponNone: "No coupon — message only",
    couponHint: "One of your discount codes. If it expires or is switched off, the popup stops showing until you choose another.",
    previewCode: "Code",
    saved: "Exit popup saved.",
  },
  ar: {
    title: "نافذة الخروج",
    description: "عرض أخير لزائر يغادر بدون أن يطلب. كل زائر يراها مرة واحدة.",
    stateOn: "مفعّلة",
    stateOff: "متوقفة",
    enabled: "إظهار نافذة الخروج",
    enabledHintOn: "يراها كل زائر مرة واحدة.",
    enabledHintOff: "لا يراها أحد. ما كتبته محفوظ.",
    whenGroup: "متى وأين",
    trigger: "متى",
    trigger_exit_intent: "عندما يهمّ الزائر بالمغادرة",
    trigger_delay: "بعد مدة",
    triggerHint: "«يهمّ بالمغادرة»: خروج الماوس من الصفحة على الكمبيوتر، أو زر الرجوع على الهاتف.",
    delay: "المدة بالثواني",
    delayHint: "من 3 إلى 600.",
    pages: "في",
    pages_all: "كل الصفحات",
    pages_product: "صفحات المنتجات",
    pages_cart: "السلة",
    wordsGroup: "ما المكتوب فيها",
    popupTitle: "العنوان",
    popupTitlePlaceholder: "قبل ما تمشي…",
    message: "الرسالة",
    messagePlaceholder: "خصم 10% على أول طلب.",
    coupon: "الكوبون",
    couponNone: "بدون كوبون — رسالة فقط",
    couponHint: "أحد أكواد الخصم عندك. لو انتهى أو توقف، النافذة تتوقف عن الظهور حتى تختار غيره.",
    previewCode: "الكود",
    saved: "تم حفظ نافذة الخروج.",
  },
} satisfies Messages;

export function ExitDownsellPage() {
  // Each offer's views, acceptances and added revenue.
  const stats = useOfferStats();
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const ids = useId();
  const [draft, setDraft] = useState<ExitDownsellSettings | null>(null);
  /** What the server holds: the form is dirty once the draft differs from it. */
  const [saved, setSaved] = useState<ExitDownsellSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const data = useAsync(async () => {
    const [settings, discounts] = await Promise.all([offersGetExitDownsell(apiClient, workspaceId), apiClient.listDiscounts(workspaceId)]);
    setDraft(settings);
    setSaved(settings);
    return discounts.filter((d) => d.code);
  }, [workspaceId]);

  const set = <K extends keyof ExitDownsellSettings>(key: K, value: ExitDownsellSettings[K]) => {
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
      const next = await offersSaveExitDownsell(apiClient, workspaceId, draft);
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

  return (
    <OfferPage
      title={t.title}
      description={t.description}
      width="form"
      titleBadge={
        saved ? (
          <StatusBadge value={saved.enabled ? "active" : "disabled"} tone={saved.enabled ? "success" : "neutral"} text={saved.enabled ? t.stateOn : t.stateOff} />
        ) : undefined
      }
    >
      <DataState loading={data.loading} error={data.error} onRetry={() => data.refresh()}>
        {draft && (
          <div className="space-y-4">
            <OfferNumbers stat={stats?.exitDownsell} />

            <SettingsGroup>
              <SettingsSwitch
                checked={draft.enabled}
                onChange={(next) => set("enabled", next)}
                label={t.enabled}
                hint={draft.enabled ? t.enabledHintOn : t.enabledHintOff}
                disabled={busy}
              />
            </SettingsGroup>

            <SettingsGroup title={t.whenGroup}>
              <SettingsRow
                label={t.trigger}
                hint={t.triggerHint}
                htmlFor={`${ids}-trigger`}
                control={
                  <Select
                    id={`${ids}-trigger`}
                    className={TOUCH_FIELD}
                    value={draft.trigger}
                    disabled={off}
                    onChange={(e) => set("trigger", e.target.value as ExitDownsellSettings["trigger"])}
                  >
                    <option value="exit_intent">{t.trigger_exit_intent}</option>
                    <option value="delay">{t.trigger_delay}</option>
                  </Select>
                }
              />
              {draft.trigger === "delay" && (
                <SettingsRow
                  label={t.delay}
                  hint={t.delayHint}
                  htmlFor={`${ids}-delay`}
                  control={
                    <Input
                      id={`${ids}-delay`}
                      type="number"
                      inputMode="numeric"
                      min={3}
                      max={600}
                      dir="ltr"
                      value={String(draft.delaySeconds)}
                      disabled={off}
                      onChange={(e) => set("delaySeconds", Math.min(600, Math.max(3, Number.parseInt(e.target.value, 10) || 3)))}
                      className="h-11 w-28 text-center text-base tabular-nums md:h-10 md:text-sm"
                    />
                  }
                />
              )}
              <SettingsRow
                label={t.pages}
                htmlFor={`${ids}-pages`}
                control={
                  <Select
                    id={`${ids}-pages`}
                    className={TOUCH_FIELD}
                    value={draft.pages}
                    disabled={off}
                    onChange={(e) => set("pages", e.target.value as ExitDownsellSettings["pages"])}
                  >
                    <option value="all">{t.pages_all}</option>
                    <option value="product">{t.pages_product}</option>
                    <option value="cart">{t.pages_cart}</option>
                  </Select>
                }
              />
            </SettingsGroup>

            <SettingsGroup title={t.wordsGroup}>
              <SettingsRow
                stacked
                label={t.popupTitle}
                htmlFor={`${ids}-title`}
                control={
                  <Input
                    id={`${ids}-title`}
                    maxLength={120}
                    placeholder={t.popupTitlePlaceholder}
                    value={draft.title ?? ""}
                    disabled={off}
                    onChange={(e) => set("title", e.target.value)}
                    className={TOUCH_FIELD}
                  />
                }
              />
              <SettingsRow
                stacked
                label={t.message}
                htmlFor={`${ids}-message`}
                control={
                  <Input
                    id={`${ids}-message`}
                    maxLength={300}
                    placeholder={t.messagePlaceholder}
                    value={draft.message ?? ""}
                    disabled={off}
                    onChange={(e) => set("message", e.target.value)}
                    className={TOUCH_FIELD}
                  />
                }
              />
              <SettingsRow
                stacked
                label={t.coupon}
                hint={t.couponHint}
                htmlFor={`${ids}-coupon`}
                control={
                  <Select
                    id={`${ids}-coupon`}
                    className={TOUCH_FIELD}
                    value={draft.discountId ?? ""}
                    disabled={off}
                    onChange={(e) => set("discountId", e.target.value || null)}
                  >
                    <option value="">{t.couponNone}</option>
                    {(data.data ?? []).map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.code}
                      </option>
                    ))}
                  </Select>
                }
              />
            </SettingsGroup>

            {draft.enabled && (
              <OfferPreview>
                <p className="font-display text-base font-semibold text-ink">
                  <bdi>{draft.title?.trim() || t.popupTitlePlaceholder}</bdi>
                </p>
                <p className="text-ink-soft">
                  <bdi>{draft.message?.trim() || t.messagePlaceholder}</bdi>
                </p>
                {coupon?.code && (
                  <p className="pt-1">
                    <span className="inline-flex min-h-9 items-center gap-2 rounded-full bg-primary-soft px-3.5 text-[13px] font-semibold text-primary-dark dark:text-primary">
                      {t.previewCode}
                      <bdi dir="ltr">{coupon.code}</bdi>
                    </span>
                  </p>
                )}
              </OfferPreview>
            )}

            <FormProblem>{error}</FormProblem>
            <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={() => setDraft(saved)} />
          </div>
        )}
      </DataState>
    </OfferPage>
  );
}
