import { useState } from "react";
import { useSheetDirty } from "./sheet/sheetKit";
import { Button, Input, Label } from "@store-builder/ui";
import { funnelsGet, funnelsUpdate, isApiErrorCode, shippingProfilesList, type FunnelOwnSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useToast } from "@/components/Toast";
import { Select } from "@/components/Select";
import { Textarea } from "@/components/Textarea";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useFunnelErrorMessage } from "./funnelAdapter";
import { FunnelPublicLink } from "./FunnelPublicLink";

const STRINGS = {
  en: {
    link: "Funnel link",
    linkIrreversible: "Changing the link takes effect at once, on its own button.",
    linkHint: "Lowercase letters, numbers and dashes. The old link stops working once you change it — update your ads.",
    saveLink: "Change link",
    linkSaved: "Link changed.",
    linkTaken: "Another funnel already uses this link.",
    linkInvalid: "Use 3–63 lowercase letters, numbers or dashes.",
    shipping: "Shipping group",
    shippingNone: "Each product's own shipping",
    shippingHint: "Every order placed in this funnel is priced with this group (Shipping → Shipping groups).",
    headCode: "Code in <head> (every step)",
    bodyCode: "Code at the end of the page (every step)",
    codeHint: "Runs on this funnel's pages only, after the store's own custom code. Not on payment or preview pages.",
  },
  ar: {
    link: "رابط الفانل",
    linkIrreversible: "تغيير الرابط يُنفَّذ فورًا من زره الخاص.",
    linkHint: "حروف إنجليزي صغيرة وأرقام وشرطات. الرابط القديم هيبطل يشتغل أول ما تغيّره — حدّث إعلاناتك.",
    saveLink: "تغيير الرابط",
    linkSaved: "اتغيّر الرابط.",
    linkTaken: "فيه فانل تاني مستخدم الرابط ده.",
    linkInvalid: "استخدم من 3 لـ 63 حرف إنجليزي صغير أو رقم أو شرطة.",
    shipping: "مجموعة الشحن",
    shippingNone: "شحن كل منتج زي ما هو",
    shippingHint: "كل طلب من الفانل ده بيتحسب شحنه بالمجموعة دي (الشحن ← مجموعات الشحن).",
    headCode: "كود في <head> (كل الخطوات)",
    bodyCode: "كود في آخر الصفحة (كل الخطوات)",
    codeHint: "بيشتغل على صفحات الفانل ده بس، بعد الكود الخاص بالمتجر. مش على صفحات الدفع أو المعاينة.",
  },
} satisfies Messages;

const LINK = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** The funnel's link (SPEC §9.7 "domain or subdomain"): /f/<subdomain>, changeable. */
export function FunnelLinkSetting({
  funnelId,
  onSaved,
}: {
  funnelId: string;
  /** Optional: told the new link once it is saved (the open editor can then show it). */
  onSaved?: (subdomain: string) => void;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const loaded = useAsync(() => funnelsGet(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const current = loaded.data?.funnel.subdomain ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const value = draft ?? current;
  // Typed and not changed yet: the sheet asks before it closes over it.
  useSheetDirty("funnel-link", draft !== null && draft.trim() !== current);

  async function save() {
    const next = value.trim().toLowerCase();
    if (next.length < 3 || next.length > 63 || !LINK.test(next)) {
      setError(t.linkInvalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await funnelsUpdate(apiClient, workspaceId, funnelId, { subdomain: next });
      await loaded.refresh({ silent: true });
      setDraft(null);
      toast.success(t.linkSaved);
      onSaved?.(next);
    } catch (err) {
      setError(isApiErrorCode(err, "FUNNEL_SUBDOMAIN_TAKEN") ? t.linkTaken : describeError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-1.5">
      <Label htmlFor="fs-link">{t.link}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id="fs-link"
          dir="ltr"
          className="h-11 min-w-0 flex-1"
          maxLength={63}
          value={value}
          disabled={busy || loaded.loading}
          aria-invalid={error ? true : undefined}
          aria-describedby="fs-link-hint"
          onChange={(e) => {
            setError(null);
            setDraft(e.target.value);
          }}
        />
        <Button type="button" variant="outline" className="min-h-11 rounded-full px-4" disabled={busy || !value.trim() || value.trim() === current} onClick={() => void save()}>
          {t.saveLink}
        </Button>
      </div>
      <p id="fs-link-hint" className={error ? "text-sm text-danger" : "text-xs leading-5 text-ink-soft"} role={error ? "alert" : undefined}>
        {error ?? `${t.linkHint} ${t.linkIrreversible}`}
      </p>
      {/* The address shoppers open, on the store's own domain, with a button to copy it. */}
      {loaded.data && <FunnelPublicLink funnel={loaded.data.funnel} />}
    </div>
  );
}

interface SettingsFieldsProps {
  value: (key: keyof FunnelOwnSettings) => string;
  onChange: (key: keyof FunnelOwnSettings, next: string) => void;
  disabled?: boolean;
}

/** The funnel's shipping group, edited with the rest of the funnel settings (same draft, same Save). */
export function FunnelShippingFields({ value, onChange, disabled }: SettingsFieldsProps) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // Shipping groups need shipping.manage; without it the select just offers "none".
  const profiles = useAsync(() => shippingProfilesList(apiClient, workspaceId).catch(() => []), [workspaceId]);
  return (
    <div className="space-y-1.5">
      <Label htmlFor="fs-shipping">{t.shipping}</Label>
      <Select id="fs-shipping" className="h-11" value={value("shippingProfileId")} disabled={disabled} onChange={(e) => onChange("shippingProfileId", e.target.value)}>
        <option value="">{t.shippingNone}</option>
        {(profiles.data ?? []).map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </Select>
      <p className="text-xs leading-5 text-ink-soft">{t.shippingHint}</p>
    </div>
  );
}

/** The funnel's own scripts, on every step — same draft, same Save as the rest of the settings. */
export function FunnelCodeFields({ value, onChange, disabled }: SettingsFieldsProps) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="fs-head">{t.headCode}</Label>
        <Textarea id="fs-head" dir="ltr" rows={4} className="font-mono text-xs" maxLength={20000} value={value("headCode")} disabled={disabled} onChange={(e) => onChange("headCode", e.target.value)} />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="fs-body">{t.bodyCode}</Label>
        <Textarea id="fs-body" dir="ltr" rows={4} className="font-mono text-xs" maxLength={20000} value={value("bodyCode")} disabled={disabled} onChange={(e) => onChange("bodyCode", e.target.value)} />
        <p className="text-xs leading-5 text-ink-soft">{t.codeHint}</p>
      </div>
    </div>
  );
}

/**
 * The funnel's scripts and shipping group together, as one block (the shape
 * this file had before the settings sheet folded the code under «متقدّم»).
 */
export function FunnelCodeAndShippingFields(props: SettingsFieldsProps) {
  return (
    <div className="space-y-4">
      <FunnelShippingFields {...props} />
      <FunnelCodeFields {...props} />
    </div>
  );
}
