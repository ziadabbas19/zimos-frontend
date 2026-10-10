import { useState, type ReactNode } from "react";
import { Button, Input, Label } from "@store-builder/ui";
import { funnelSettingsGet, funnelSettingsSave, type FunnelOwnSettings } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useT } from "@/i18n/LocaleContext";
import { DataState } from "@/components/DataState";
import { SheetBody } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useFunnelErrorMessage } from "../funnelAdapter";
import { FunnelCodeFields, FunnelLinkSetting, FunnelShippingFields } from "../FunnelSettingsMore";
import { Fold, PartFooter, useSheetDirty } from "./sheetKit";
import { SHEET_STRINGS } from "./sheetStrings";

type SettingsDraft = Partial<Record<keyof FunnelOwnSettings, string>>;

/**
 * Funnel settings sheet → «الإعدادات»: the funnel's link (its own button),
 * its currency, shipping group and free-shipping threshold, what its orders
 * are reported as (saved on pick), and — folded — how it shows in search and
 * the merchant's own code. The fields share one draft and one Save, sent
 * exactly as before: only the keys that changed, an empty one as null.
 */
export function SettingsPart({
  funnelId,
  nav,
  onLinkSaved,
}: {
  funnelId: string;
  /** The sheet's part switch, drawn above the scrolling body. */
  nav: ReactNode;
  onLinkSaved?: (subdomain: string) => void;
}) {
  const t = useT(SHEET_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const describeError = useFunnelErrorMessage();
  const loaded = useAsync(() => funnelSettingsGet(apiClient, workspaceId, funnelId), [workspaceId, funnelId]);
  const [draft, setDraft] = useState<SettingsDraft>({});
  const [busy, setBusy] = useState(false);
  // Bumped on discard and after a save: the fields below mount afresh.
  const [resetKey, setResetKey] = useState(0);

  const savedValue = (key: keyof FunnelOwnSettings) => String(loaded.data?.[key] ?? "");
  const value = (key: keyof FunnelOwnSettings) => String(draft[key] ?? loaded.data?.[key] ?? "");
  // A field put back to what is saved is no longer a change.
  const setField = (key: keyof FunnelOwnSettings, next: string) =>
    setDraft((prev) => {
      const copy: SettingsDraft = { ...prev };
      if (next === savedValue(key)) delete copy[key];
      else copy[key] = next;
      return copy;
    });

  const dirty = Object.keys(draft).length > 0;
  useSheetDirty("funnel-settings", dirty);

  const field = (key: keyof FunnelOwnSettings, label: string, props: { dir?: "ltr"; maxLength: number }, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`fs-${key}`}>{label}</Label>
      <Input
        id={`fs-${key}`}
        {...props}
        className="h-11"
        value={value(key)}
        disabled={busy}
        aria-describedby={hint ? `fs-${key}-hint` : undefined}
        onChange={(e) => setField(key, e.target.value)}
      />
      {hint && (
        <p id={`fs-${key}-hint`} className="text-xs leading-5 text-ink-soft">
          {hint}
        </p>
      )}
    </div>
  );

  async function save() {
    setBusy(true);
    try {
      const saved = await funnelSettingsSave(
        apiClient,
        workspaceId,
        funnelId,
        Object.fromEntries(Object.entries(draft).map(([k, v]) => [k, v.trim() || null]))
      );
      loaded.setData(saved);
      setDraft({});
      setResetKey((n) => n + 1);
      toast.success(t.saved);
    } catch (err) {
      toast.error(describeError(err));
    } finally {
      setBusy(false);
    }
  }

  const hasCode = Boolean(value("headCode").trim() || value("bodyCode").trim());

  return (
    <>
      {nav}
      <SheetBody>
        <DataState loading={loaded.loading} error={loaded.error} onRetry={() => void loaded.refresh()}>
          <div className="space-y-5">
            <FunnelLinkSetting funnelId={funnelId} onSaved={onLinkSaved} />
            {field("currency", t.currency, { dir: "ltr", maxLength: 3 }, t.currencyHint)}
            <FunnelShippingFields key={resetKey} value={value} onChange={setField} disabled={busy} />
            <Fold title={t.searchFold} summary={t.searchFoldSummary}>
              {field("title", t.seoTitle, { maxLength: 200 })}
              {field("description", t.seoDescription, { maxLength: 320 })}
              {field("faviconUrl", t.favicon, { dir: "ltr", maxLength: 1000 })}
            </Fold>
            <Fold title={t.advancedFold} summary={hasCode ? t.advancedSummaryOn : t.advancedSummary}>
              <FunnelCodeFields value={value} onChange={setField} disabled={busy} />
            </Fold>
          </div>
        </DataState>
      </SheetBody>
      {(dirty || busy) && (
        <PartFooter message={t.settingsUnsaved}>
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => {
              setDraft({});
              setResetKey((n) => n + 1);
            }}
          >
            {t.discard}
          </Button>
          <Button type="button" disabled={busy || !dirty} onClick={() => void save()}>
            {busy ? t.saving : t.save}
          </Button>
        </PartFooter>
      )}
    </>
  );
}
