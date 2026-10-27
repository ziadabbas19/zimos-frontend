import { useId, useMemo, useState, type FormEvent } from "react";
import { IconGift, IconSearch } from "@/components/icons";
import { Alert, Button, Input, ZLoader } from "@store-builder/ui";
import {
  GIFT_CARD_MAX_PRODUCTS,
  giftCardSettingsGet,
  giftCardSettingsSave,
  type GiftCardSettings,
  type Product,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { useErrorMessage } from "@/lib/errorMessages";
import { countOf, pluralOf } from "@/lib/plural";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { AccordionSection } from "@/components/Accordion";
import { Modal } from "@/components/Modal";
import { useToast } from "@/components/Toast";
import { GIFT_CARD_STRINGS } from "./giftCardStrings";

/** A whole number of days the API takes (1–3650), "" for none, or undefined when it is neither. */
function parseDays(raw: string): number | null | undefined {
  const ascii = raw.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  if (ascii === "") return null;
  if (!/^\d{1,4}$/.test(ascii)) return undefined;
  const n = Number(ascii);
  return n >= 1 && n <= 3650 ? n : undefined;
}

/**
 * Gift cards → "Products sold as gift cards" (GET/PUT /gift-cards/settings):
 * which products issue a card per piece sold, worth its price, and how long a
 * bought card stays valid. A section that folds to one row saying what is set
 * («٣ منتجات · صالح لمدة ٣٦٥ يوم»); the choice is made in a sheet with the
 * store's products and a search.
 */
export function GiftCardSettingsCard() {
  const t = useT(GIFT_CARD_STRINGS);
  const common = useCommon();
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const settings = useAsync(() => giftCardSettingsGet(apiClient, workspaceId), [workspaceId]);
  // Names for the chosen ids; the picker reads the same list (the first 200, newest first).
  const catalog = useAsync(() => apiClient.listProducts(workspaceId, { limit: 200 }), [workspaceId]);
  const products = { data: catalog.data?.products ?? null, loading: catalog.loading, error: catalog.error };
  // With every product at hand, an id the list lacks is a deleted product.
  const complete = catalog.data ? catalog.data.nextCursor === null : false;
  const [editing, setEditing] = useState(false);

  const frame = { title: t.settingsTitle, icon: IconGift, persistKey: "gift-cards:sold-as" };

  if (settings.loading) {
    return (
      <AccordionSection {...frame} summary={t.settingsLoading}>
        <div className="flex min-h-11 items-center">
          <ZLoader label={t.settingsLoading} />
        </div>
      </AccordionSection>
    );
  }

  if (settings.error || !settings.data) {
    return (
      <AccordionSection {...frame} summary={errorMessage(settings.error)}>
        <div role="alert" className="flex flex-wrap items-center gap-3">
          <p className="text-sm text-danger">{errorMessage(settings.error)}</p>
          <Button variant="outline" size="sm" className="min-h-11 rounded-full px-4" onClick={() => void settings.refresh()}>
            {common.retry}
          </Button>
        </div>
      </AccordionSection>
    );
  }

  const saved = settings.data;
  const byId = new Map((products.data ?? []).map((p) => [p.id, p]));
  const chosen = saved.productIds.map((id) => byId.get(id)).filter((p): p is Product => Boolean(p));
  const validityLine = saved.validityDays ? fmt(t.validFor, { days: countOf("day", saved.validityDays) }) : t.noEnd;

  return (
    <AccordionSection
      {...frame}
      summary={saved.productIds.length === 0 ? t.noProductsSelected : `${pluralOf(t, "products", saved.productIds.length)} · ${validityLine}`}
    >
      <p className="text-[13px] leading-5 text-ink-soft">{t.settingsHint}</p>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-[1rem] bg-paper-sunken px-3.5 py-2.5">
        <div className="min-w-0">
          {saved.productIds.length === 0 ? (
            <p className="text-sm text-ink-soft">{t.noProductsSelected}</p>
          ) : (
            <>
              <p className="text-sm font-medium text-ink">
                {pluralOf(t, "products", saved.productIds.length)} · <span className="font-normal text-ink-soft">{validityLine}</span>
              </p>
              {chosen.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {chosen.map((p) => (
                    <li key={p.id} className="max-w-full truncate rounded-[var(--radius-pill)] bg-paper-raised px-2.5 py-1 text-xs text-ink ring-1 ring-line" dir="auto">
                      {p.name}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
        <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-full px-4" onClick={() => setEditing(true)}>
          {saved.productIds.length > 0 ? t.changeProducts : t.chooseProducts}
        </Button>
      </div>

      <SettingsDialog
        open={editing}
        saved={saved}
        products={products.data}
        productsLoading={products.loading}
        productsError={products.error}
        productsComplete={complete}
        onClose={() => setEditing(false)}
        onSave={async (next) => {
          const result = await giftCardSettingsSave(apiClient, workspaceId, next);
          settings.setData(result);
          setEditing(false);
          toast.success(t.settingsSaved);
        }}
      />
    </AccordionSection>
  );
}

function SettingsDialog({
  open,
  saved,
  products,
  productsLoading,
  productsError,
  productsComplete,
  onClose,
  onSave,
}: {
  open: boolean;
  saved: GiftCardSettings;
  products: Product[] | null;
  productsLoading: boolean;
  productsError: unknown;
  productsComplete: boolean;
  onClose: () => void;
  onSave: (next: GiftCardSettings) => Promise<void>;
}) {
  const t = useT(GIFT_CARD_STRINGS);
  const errorMessage = useErrorMessage();
  const formId = useId();
  const daysId = useId();
  const daysHint = useId();
  const [selected, setSelected] = useState<string[]>(saved.productIds);
  const [days, setDays] = useState(saved.validityDays ? String(saved.validityDays) : "");
  const [search, setSearch] = useState("");
  const [daysError, setDaysError] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [openedFor, setOpenedFor] = useState<boolean>(false);

  // Each opening starts from what is saved.
  if (open !== openedFor) {
    setOpenedFor(open);
    if (open) {
      setSelected(saved.productIds);
      setDays(saved.validityDays ? String(saved.validityDays) : "");
      setSearch("");
      setDaysError(null);
      setFailure(null);
    }
  }

  const all = useMemo(() => products ?? [], [products]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? all.filter((p) => p.name.toLowerCase().includes(q)) : all;
  }, [all, search]);
  const full = selected.length >= GIFT_CARD_MAX_PRODUCTS;

  function toggle(id: string, on: boolean) {
    setSelected((prev) => (on ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    const validityDays = parseDays(days);
    if (validityDays === undefined) {
      setDaysError(t.validityError);
      document.getElementById(daysId)?.focus();
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      // Ids a complete list no longer has (a deleted product) are dropped, or the API refuses the whole set.
      const known = products && productsComplete ? selected.filter((id) => products.some((p) => p.id === id)) : selected;
      await onSave({ productIds: known, validityDays });
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.pickerTitle}
      description={t.settingsHint}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" disabled={saving} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.settingsSaving : t.settingsSave}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink">{t.chooseProducts}</legend>
          {productsLoading ? (
            <div role="status" className="flex min-h-11 items-center gap-2 text-sm text-ink-soft">
              <ZLoader size="sm" aria-hidden />
            </div>
          ) : productsError ? (
            <p className="text-sm text-danger">{errorMessage(productsError)}</p>
          ) : all.length === 0 ? (
            <p className="text-sm text-ink-soft">{t.noCatalog}</p>
          ) : (
            <>
              <div className="relative">
                <IconSearch aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-ink-soft" />
                <Input
                  type="search"
                  aria-label={t.filterProducts}
                  placeholder={t.filterProducts}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-11 ps-9"
                />
              </div>
              <p className="text-xs text-ink-soft">
                {selected.length === 0 ? t.noProductsSelected : pluralOf(t, "products", selected.length)} ·{" "}
                {fmt(t.maxProducts, { max: GIFT_CARD_MAX_PRODUCTS })}
              </p>
              {shown.length === 0 ? (
                <p className="text-sm text-ink-soft">{t.noMatchProducts}</p>
              ) : (
                <ul className="max-h-64 divide-y divide-line overflow-y-auto rounded-[var(--radius)] ring-1 ring-line">
                  {shown.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <li key={p.id}>
                        <label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-ink hover:bg-paper-sunken has-[:disabled]:cursor-default has-[:disabled]:opacity-60">
                          <input
                            type="checkbox"
                            className="size-5 shrink-0 cursor-pointer accent-primary"
                            checked={on}
                            disabled={!on && full}
                            onChange={(e) => toggle(p.id, e.target.checked)}
                          />
                          <span className="min-w-0 flex-1 truncate">
                            <bdi>{p.name}</bdi>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </fieldset>

        <div className="space-y-1.5">
          <label htmlFor={daysId} className="block text-sm font-medium text-ink">
            {t.validity}
          </label>
          <Input
            id={daysId}
            type="text"
            inputMode="numeric"
            dir="ltr"
            autoComplete="off"
            maxLength={4}
            value={days}
            aria-invalid={daysError ? true : undefined}
            aria-describedby={daysHint}
            onChange={(e) => {
              setDaysError(null);
              setDays(e.target.value);
            }}
            className="h-11 w-28 text-center tabular-nums"
          />
          <p id={daysHint} className={daysError ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
            {daysError ?? t.validityHint}
          </p>
        </div>

        <p className="text-xs text-ink-soft">{t.settingsTip}</p>
        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
