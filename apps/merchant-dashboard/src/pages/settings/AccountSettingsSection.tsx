import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { accountSettingsGet, accountSettingsSave, type AccountSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Account settings",
    description: "The store's clock, where contact-form messages go, and the business printed on invoices.",
    timezone: "Time zone",
    timezoneHint: "Reports, exports and daily numbers count days on this clock.",
    contactEmail: "Email for contact-form messages",
    contactEmailHint: "Each message sent through a contact form on your store is emailed here. Leave empty to only see them in Form submissions.",
    legalTitle: "Business details on invoices",
    legalHint: "Printed under the store name on every invoice.",
    legalName: "Name",
    company: "Company",
    phone: "Phone",
    address: "Address",
    country: "Country",
    noCountry: "—",
    save: "Save",
    saving: "Saving…",
    saved: "Account settings saved.",
  },
  ar: {
    title: "إعدادات الحساب",
    description: "توقيت المتجر، والبريد الذي تصل إليه رسائل نماذج التواصل، وبيانات النشاط على الفواتير.",
    timezone: "المنطقة الزمنية",
    timezoneHint: "التقارير والتصدير والأرقام اليومية تحسب الأيام على هذا التوقيت.",
    contactEmail: "بريد رسائل نماذج التواصل",
    contactEmailHint: "تصل كل رسالة من نماذج التواصل في متجرك إلى هذا البريد. اتركه فارغًا لتراها في «رسائل النماذج» فقط.",
    legalTitle: "بيانات النشاط على الفواتير",
    legalHint: "تُطبع تحت اسم المتجر في كل فاتورة.",
    legalName: "الاسم",
    company: "الشركة",
    phone: "الهاتف",
    address: "العنوان",
    country: "الدولة",
    noCountry: "—",
    save: "حفظ",
    saving: "جارٍ الحفظ…",
    saved: "تم حفظ إعدادات الحساب.",
  },
} satisfies Messages;

const COUNTRIES = ["EG", "SA", "AE", "KW", "QA", "BH", "OM", "JO", "LB", "IQ", "MA", "DZ", "TN", "LY", "SD", "TR", "GB", "US"];
const FALLBACK_ZONES = ["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai", "Asia/Kuwait", "Asia/Qatar", "Asia/Bahrain", "Asia/Muscat", "Asia/Amman", "Asia/Beirut", "Asia/Baghdad", "Africa/Casablanca", "Africa/Algiers", "Africa/Tunis", "Africa/Tripoli", "Europe/Istanbul", "Europe/London", "UTC"];

function timeZones(current: string): string[] {
  const all = (Intl as unknown as { supportedValuesOf?: (key: string) => string[] }).supportedValuesOf?.("timeZone") ?? FALLBACK_ZONES;
  return all.includes(current) ? all : [current, ...all];
}

/** SPEC §17.3 account settings that live with the store: time zone, contact-form email, legal details. */
export function AccountSettingsSection() {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const loaded = useAsync(() => accountSettingsGet(apiClient, workspaceId), [workspaceId]);
  const [form, setForm] = useState<AccountSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loaded.data) setForm(loaded.data);
  }, [loaded.data]);

  const zones = useMemo(() => timeZones(form?.timezone ?? "Africa/Cairo"), [form?.timezone]);
  const countryName = (code: string) => {
    try {
      return new Intl.DisplayNames([locale], { type: "region" }).of(code) ?? code;
    } catch {
      return code;
    }
  };

  const setLegal = (key: keyof AccountSettings["legal"], value: string) =>
    setForm((f) => (f ? { ...f, legal: { ...f.legal, [key]: value } } : f));

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!form) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await accountSettingsSave(apiClient, workspaceId, {
        timezone: form.timezone,
        contactFormEmail: form.contactFormEmail?.trim() || null,
        legal: form.legal,
      });
      loaded.setData(saved);
      toast.success(t.saved);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">{t.title}</h2>
      <p className="mt-1 text-sm text-ink-soft">{t.description}</p>
      <div className="mt-4">
        <DataState loading={loaded.loading && !form} error={loaded.error} onRetry={() => void loaded.refresh()}>
          {form && (
            <form onSubmit={save} className="max-w-2xl space-y-5">
              <Field label={t.timezone} hint={t.timezoneHint}>
                {({ id, ...aria }) => (
                  <Select id={id} {...aria} data-search-anchor="timezone" dir="ltr" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
                    {zones.map((zone) => (
                      <option key={zone} value={zone}>
                        {zone}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <TextField
                label={t.contactEmail}
                data-search-anchor="contact-email"
                hint={t.contactEmailHint}
                type="email"
                dir="ltr"
                value={form.contactFormEmail ?? ""}
                onChange={(e) => setForm({ ...form, contactFormEmail: e.target.value })}
              />
              <fieldset className="space-y-3" data-search-anchor="invoice-details">
                <legend className="text-sm font-medium text-ink">{t.legalTitle}</legend>
                <p className="text-xs text-ink-soft">{t.legalHint}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <TextField label={t.legalName} value={form.legal.name ?? ""} onChange={(e) => setLegal("name", e.target.value)} />
                  <TextField label={t.company} value={form.legal.company ?? ""} onChange={(e) => setLegal("company", e.target.value)} />
                  <TextField label={t.phone} type="tel" dir="ltr" value={form.legal.phone ?? ""} onChange={(e) => setLegal("phone", e.target.value)} />
                  <Field label={t.country}>
                    {({ id, ...aria }) => (
                      <Select id={id} {...aria} value={form.legal.country ?? ""} onChange={(e) => setLegal("country", e.target.value)}>
                        <option value="">{t.noCountry}</option>
                        {[...new Set([...(form.legal.country ? [form.legal.country] : []), ...COUNTRIES])].map((code) => (
                          <option key={code} value={code}>
                            {countryName(code)}
                          </option>
                        ))}
                      </Select>
                    )}
                  </Field>
                  <TextField className="sm:col-span-2" label={t.address} value={form.legal.address ?? ""} onChange={(e) => setLegal("address", e.target.value)} />
                </div>
              </fieldset>
              {error && <Alert variant="danger">{error}</Alert>}
              <Button type="submit" className="min-h-11" disabled={busy}>
                {busy ? t.saving : t.save}
              </Button>
            </form>
          )}
        </DataState>
      </div>
    </section>
  );
}
