import { useState } from "react";
import { couponsGetOrderRules, couponsSaveOrderRules } from "@store-builder/api-client";
import { IconCourier } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useReportDirty } from "@/lib/useUnsavedGuard";
import { formatMoney, majorToMinor, minorToMajorInput } from "@/lib/format";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { MoneyInput } from "@/components/MoneyInput";
import { SaveBar } from "@/components/SaveBar";
import { SettingsGroup, SettingsLinkRow } from "@/components/settings";
import { useToast } from "@/components/Toast";
import { FormProblem, OfferPage, OfferPreview } from "./OfferKit";

/**
 * Minimum order and free shipping. The minimum is set here; the
 * free-shipping threshold belongs to the shipping settings, and the store
 * shows the customer how far they are from it.
 */

const STRINGS = {
  en: {
    title: "Minimum order and free shipping",
    description: "A floor under small orders, and a reason to add one more thing.",
    minimumGroup: "Minimum order",
    minimum: "Minimum order amount",
    minimumHint: "Leave blank for no minimum. It does not apply to orders your team enters.",
    invalid: "Write an amount in numbers, like 150 — or leave it blank for no minimum.",
    previewWith: "An order under {amount} is not accepted: the shopper is told how much more to add.",
    previewNone: "No minimum: every order is accepted, whatever its amount.",
    saved: "Minimum order saved.",
    freeGroup: "Free shipping",
    freeTitle: "Free shipping from an amount",
    freeHint: "Set in the shipping settings. The cart shows the shopper how much is left to reach it.",
  },
  ar: {
    title: "الحد الأدنى للطلب والشحن المجاني",
    description: "حد أدنى للطلبات الصغيرة، وسبب لإضافة منتج آخر.",
    minimumGroup: "الحد الأدنى للطلب",
    minimum: "الحد الأدنى للطلب",
    minimumHint: "اتركه فارغًا لعدم وضع حد أدنى. لا يُطبَّق على الطلبات التي يُدخلها فريقك.",
    invalid: "اكتب مبلغًا بالأرقام، مثل 150 — أو اتركه فارغًا لعدم وضع حد أدنى.",
    previewWith: "الطلب الأقل من {amount} لا يُقبل: يُخبَر العميل بالمبلغ المتبقي ليكمل.",
    previewNone: "لا يوجد حد أدنى: يُقبل أي طلب مهما كان مبلغه.",
    saved: "تم حفظ الحد الأدنى للطلب.",
    freeGroup: "الشحن المجاني",
    freeTitle: "شحن مجاني من مبلغ معين",
    freeHint: "يُحدَّد من إعدادات الشحن. تعرض السلة للعميل المبلغ المتبقي للوصول إليه.",
  },
} satisfies Messages;

export function OrderRulesPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [minimum, setMinimum] = useState("");
  /** The amount as the server holds it, in the form's own text: the form is dirty once the field differs. */
  const [savedMinimum, setSavedMinimum] = useState("");
  const [busy, setBusy] = useState(false);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rules = useAsync(async () => {
    const loaded = await couponsGetOrderRules(apiClient, workspaceId);
    const text = minorToMajorInput(loaded.minOrderAmount);
    setMinimum(text);
    setSavedMinimum(text);
    return loaded;
  }, [workspaceId]);

  const dirty = minimum.trim() !== savedMinimum.trim();
  useReportDirty(dirty);

  async function save() {
    const amount = minimum.trim() === "" ? null : majorToMinor(minimum);
    if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
      setInvalid(true);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await couponsSaveOrderRules(apiClient, workspaceId, { minOrderAmount: amount || null });
      const text = minorToMajorInput(saved.minOrderAmount);
      setMinimum(text);
      setSavedMinimum(text);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  // The sentence the rule comes to, on the number being typed.
  const typed = minimum.trim() === "" ? null : majorToMinor(minimum);
  const live = typed !== null && Number.isFinite(typed) && typed > 0 ? typed : null;

  return (
    <OfferPage title={t.title} description={t.description} width="form">
      <DataState loading={rules.loading} error={rules.error} onRetry={() => rules.refresh()}>
        <div className="space-y-4">
          <SettingsGroup title={t.minimumGroup}>
            <div className="space-y-3 px-4 py-4">
              <MoneyInput
                label={t.minimum}
                hint={t.minimumHint}
                error={invalid ? t.invalid : undefined}
                value={minimum}
                disabled={busy}
                onChange={(value) => {
                  setMinimum(value);
                  setInvalid(false);
                  setError(null);
                }}
                className="[&_input]:h-11 [&_input]:text-base md:[&_input]:h-10 md:[&_input]:text-sm"
              />
              <OfferPreview>
                <p>
                  <bdi>{live !== null ? fmt(t.previewWith, { amount: formatMoney(live) }) : t.previewNone}</bdi>
                </p>
              </OfferPreview>
            </div>
          </SettingsGroup>

          <SettingsGroup title={t.freeGroup}>
            <SettingsLinkRow to="/shipping" icon={IconCourier} tone="green" label={t.freeTitle} hint={t.freeHint} />
          </SettingsGroup>

          <FormProblem>{error}</FormProblem>
          <SaveBar dirty={dirty} saving={busy} onSave={() => void save()} onDiscard={() => { setMinimum(savedMinimum); setInvalid(false); }} />
        </div>
      </DataState>
    </OfferPage>
  );
}
