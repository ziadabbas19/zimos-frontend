import { useState, type ReactNode } from "react";
import { Button, Input, Label, cn } from "@store-builder/ui";
import {
  funnelGeoRedirectsCreate,
  funnelGeoRedirectsDelete,
  funnelGeoRedirectsList,
  funnelGeoRedirectsUpdate,
  funnelsList,
  type FunnelGeoRedirect,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { EmptyState } from "@/components/EmptyState";
import { Select } from "@/components/Select";
import { SheetBody } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { IconArrowLeft, IconDelete, IconGlobe } from "@/components/icons";
import { useFunnelErrorMessage } from "../funnelAdapter";
import { PartFooter, useSheetDirty } from "./sheetKit";
import { SHEET_STRINGS } from "./sheetStrings";

/** The countries an Egyptian store most often sells to next: one tap each instead of typing a code. */
const QUICK_COUNTRIES = ["SA", "AE", "KW", "QA", "BH", "OM", "JO", "IQ", "LY", "MA"] as const;

const parseCodes = (text: string) =>
  text
    .split(/[\s,،]+/)
    .map((c) => c.trim().toUpperCase())
    .filter((c) => /^[A-Z]{2}$/.test(c));

/** "السعودية" for "SA" in the viewer's language; the code itself where the browser has no name for it. */
function useCountryName(): (code: string) => string {
  const { intlLocale } = useLocale();
  let names: Intl.DisplayNames | null = null;
  try {
    names = new Intl.DisplayNames([intlLocale], { type: "region" });
  } catch {
    names = null;
  }
  return (code) => {
    try {
      return names?.of(code) ?? code;
    } catch {
      return code;
    }
  };
}

/**
 * Funnel settings sheet → «الدول»: visitors from the listed countries are sent
 * to another funnel. A rule is switched on / off and deleted in place (delete
 * offers Undo: it adds the same rule again); a new one is put together below
 * and added from the sheet's footer. Calls and payloads are the ones the old
 * dialog made.
 */
export function GeoPart({ funnelId, nav }: { funnelId: string; nav: ReactNode }) {
  const t = useT(SHEET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const countryName = useCountryName();
  const { locale } = useLocale();
  const comma = locale === "ar" ? "، " : ", ";
  const rules = useAsync(() => funnelGeoRedirectsList(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const funnels = useAsync(() => funnelsList(apiClient, workspaceId), [workspaceId]);
  const [picked, setPicked] = useState<string[]>([]);
  const [countries, setCountries] = useState("");
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);

  // Tapped chips and typed codes together, each once, in the order they were given.
  const codes = Array.from(new Set([...picked, ...parseCodes(countries)]));
  const formTouched = picked.length > 0 || countries.trim() !== "" || target !== "";
  useSheetDirty("funnel-geo", formTouched);

  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setBusy(true);
    try {
      await action();
      await rules.refresh({ silent: true });
      return true;
    } catch (err) {
      toast.error(describeError(err));
      return false;
    } finally {
      setBusy(false);
    }
  }

  function clearForm() {
    setPicked([]);
    setCountries("");
    setTarget("");
  }

  async function add() {
    const ok = await run(() => funnelGeoRedirectsCreate(apiClient, workspaceId, funnelId, { targetFunnelId: target, countries: codes }));
    if (ok) {
      clearForm();
      toast.success(t.ruleAdded);
    }
  }

  async function remove(rule: FunnelGeoRedirect) {
    const ok = await run(() => funnelGeoRedirectsDelete(apiClient, workspaceId, funnelId, rule.id));
    if (!ok) return;
    // Taking it back is adding the same rule again.
    toast.undo(t.ruleRemoved, async () => {
      await funnelGeoRedirectsCreate(apiClient, workspaceId, funnelId, {
        targetFunnelId: rule.targetFunnelId,
        countries: rule.countries,
        isActive: rule.isActive,
      });
      await rules.refresh({ silent: true });
    });
  }

  const list = rules.data ?? [];
  const otherFunnels = (funnels.data ?? []).filter((f) => f.id !== funnelId);

  return (
    <>
      {nav}
      <SheetBody>
        <DataState loading={rules.loading} error={rules.error} onRetry={() => void rules.refresh()}>
          <div className="space-y-5">
            <p className="text-sm leading-6 text-ink-soft">{t.geoIntro}</p>

            {list.length === 0 ? (
              <EmptyState className="px-4 py-8" icon={<IconGlobe />} title={t.noRules} description={t.noRulesDesc} />
            ) : (
              <ul data-slot="funnel-geo-rules" className="divide-y divide-line rounded-2xl bg-paper-raised ring-1 ring-line">
                {list.map((rule) => {
                  const named = rule.countries.map(countryName).join(comma);
                  return (
                    <li key={rule.id} className="flex items-center gap-2 py-2 ps-4 pe-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm leading-6 font-medium text-ink">{named}</p>
                        <p className="flex min-w-0 items-center gap-1.5 text-xs leading-5 text-ink-soft">
                          <IconArrowLeft className="size-3.5 shrink-0 rotate-180 rtl:rotate-0" aria-hidden />
                          <span className="shrink-0">{t.ruleTo}</span>
                          <span className="min-w-0 truncate font-medium text-ink" dir="auto">
                            {rule.targetFunnelName ?? rule.targetFunnelId}
                          </span>
                        </p>
                      </div>
                      <label className="flex min-h-11 shrink-0 cursor-pointer items-center gap-2 px-1 text-sm text-ink">
                        <input
                          type="checkbox"
                          className="size-5 accent-primary"
                          checked={rule.isActive}
                          disabled={busy}
                          aria-label={fmt(t.ruleActive, { countries: named })}
                          onChange={(e) =>
                            void run(() => funnelGeoRedirectsUpdate(apiClient, workspaceId, funnelId, rule.id, { isActive: e.target.checked }))
                          }
                        />
                        <span aria-hidden>{t.active}</span>
                      </label>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="size-11 shrink-0 rounded-full"
                        aria-label={fmt(t.removeRule, { countries: named })}
                        title={fmt(t.removeRule, { countries: named })}
                        disabled={busy}
                        onClick={() => void remove(rule)}
                      >
                        <IconDelete className="size-4 text-danger" aria-hidden />
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            <section aria-labelledby="geo-add-title" className="space-y-4 rounded-2xl bg-paper-raised p-4 ring-1 ring-line">
              <h3 id="geo-add-title" className="text-sm font-semibold text-ink">
                {t.addTitle}
              </h3>
              <div className="space-y-1.5">
                <p id="geo-quick-label" className="text-xs text-ink-soft">
                  {t.quickPick}
                </p>
                <div role="group" aria-labelledby="geo-quick-label" className="flex flex-wrap gap-2">
                  {QUICK_COUNTRIES.map((code) => {
                    const on = picked.includes(code);
                    return (
                      <button
                        key={code}
                        type="button"
                        aria-pressed={on}
                        data-slot="funnel-geo-chip"
                        disabled={busy}
                        onClick={() => setPicked((prev) => (on ? prev.filter((c) => c !== code) : [...prev, code]))}
                        className={cn(
                          "inline-flex min-h-11 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium ring-1 transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none",
                          on ? "bg-primary text-primary-foreground ring-primary" : "bg-paper-sunken text-ink ring-line hover:bg-primary-soft"
                        )}
                      >
                        {countryName(code)}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="geo-countries">{t.countries}</Label>
                <Input
                  id="geo-countries"
                  dir="ltr"
                  className="h-11"
                  autoCapitalize="characters"
                  value={countries}
                  placeholder={t.countriesPlaceholder}
                  disabled={busy}
                  onChange={(e) => setCountries(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="geo-target">{t.target}</Label>
                <Select id="geo-target" className="h-11" value={target} disabled={busy} onChange={(e) => setTarget(e.target.value)}>
                  <option value="">{t.chooseFunnel}</option>
                  {otherFunnels.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </Select>
                <p className="text-xs leading-5 text-ink-soft">{t.onlyPublished}</p>
              </div>
            </section>
          </div>
        </DataState>
      </SheetBody>
      {formTouched && !rules.loading && !rules.error && (
        <PartFooter message={t.geoUnsaved}>
          <Button type="button" variant="outline" disabled={busy} onClick={clearForm}>
            {t.discard}
          </Button>
          <Button type="button" disabled={busy || codes.length === 0 || !target} onClick={() => void add()}>
            {busy ? t.adding : t.addRule}
          </Button>
        </PartFooter>
      )}
    </>
  );
}
