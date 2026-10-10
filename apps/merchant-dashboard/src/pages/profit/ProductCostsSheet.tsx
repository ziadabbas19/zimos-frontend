import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { ProfitEconomics, ProfitEconomicsProduct } from "@store-builder/api-client";
import { Modal } from "@/components/Modal";
import { ViewLink } from "@/components/ViewLink";
import { fmt, useCommon, useT } from "@/i18n/LocaleContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { formatMoney } from "@/lib/format";
import { AmountInput, focusField } from "./CostFields";
import { COST_META, COSTS_STRINGS, readForm, toForm, type CostErrors, type CostForm } from "./costsModel";

/** "120 EGP", or "120 EGP – 180 EGP" when the variants differ. */
export function costRange(min: number | null, max: number | null, currency: string): string {
  if (min === null) return "—";
  return max === null || min === max ? formatMoney(min, currency) : `${formatMoney(min, currency)} – ${formatMoney(max, currency)}`;
}

/**
 * A product's own costs, in a sheet over the list: the six fields of the
 * store defaults, each empty until the product differs (the placeholder shows
 * the default it falls back to). Save sends what the old dialog sent; "Back to
 * the store's defaults" drops the product's values altogether.
 *
 * A `Modal`: the same pane as a sheet (a bottom sheet on the phone), which
 * also asks before a half-typed change is thrown away by a stray tap outside.
 */
export function ProductCostsSheet({
  product,
  open,
  currency,
  defaults,
  onClose,
  onSave,
  onReset,
}: {
  /** The product being edited. It stays here while the sheet closes, so the sheet does not empty on its way out. */
  product: ProfitEconomicsProduct | null;
  open: boolean;
  currency: string;
  /** The store defaults as the page shows them: what an empty field falls back to. */
  defaults: CostForm;
  onClose: () => void;
  /** Saves the product's costs. Resolve to close; throw to stay open with the reason. */
  onSave: (product: ProfitEconomicsProduct, payload: ProfitEconomics) => Promise<void>;
  /** Drops the product's own costs. Resolve to close; throw to stay open with the reason. */
  onReset: (product: ProfitEconomicsProduct) => Promise<void>;
}) {
  const t = useT(COSTS_STRINGS);
  const common = useCommon();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [form, setForm] = useState<CostForm>(() => toForm(null));
  const [errors, setErrors] = useState<CostErrors>({});
  const [busy, setBusy] = useState<"save" | "reset" | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const productId = product?.productId;
  // The sheet opens on what is saved: a change left behind by Cancel never comes back.
  useEffect(() => {
    if (!open || !product) return;
    setForm(toForm(product.overrides));
    setErrors({});
    setFailure(null);
    // The product object is new after every refresh of the list; its id says whether it is another product.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, productId]);

  if (!product) return null;
  const current = product;
  const idOf = (field: string) => `${formId}-${field}`;

  async function run(kind: "save" | "reset", action: () => Promise<void>) {
    setBusy(kind);
    setFailure(null);
    try {
      await action();
    } catch (err) {
      setFailure(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const { payload, errors: found } = readForm(form);
    setErrors(found);
    if (!payload) {
      const first = COST_META.find((meta) => found[meta.field]);
      if (first) focusField(idOf(first.field));
      return;
    }
    void run("save", () => onSave(current, payload));
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        if (!busy) onClose();
      }}
      title={fmt(t.editTitle, { name: current.name })}
      description={t.editDesc}
      className="max-w-2xl"
      footer={
        <>
          {current.overrides && (
            <Button
              type="button"
              variant="ghost"
              disabled={busy !== null}
              className="rounded-full px-4 text-ink-soft hover:text-ink sm:me-auto"
              onClick={() => void run("reset", () => onReset(current))}
            >
              {busy === "reset" ? t.working : t.reset}
            </Button>
          )}
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy !== null}>
            {common.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy !== null}>
            {busy === "save" ? common.saving : common.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-2xl bg-paper-sunken px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm leading-6 font-medium text-ink">
              {current.minCostAmount === null ? (
                t.missingCost
              ) : (
                <>
                  {t.colUnitCost}:{" "}
                  <bdi dir="ltr" className="tabular-nums">
                    {costRange(current.minCostAmount, current.maxCostAmount, currency)}
                  </bdi>
                </>
              )}
            </p>
            <p className="text-xs leading-5 text-ink-soft">{t.unitCostWhere}</p>
          </div>
          <ViewLink
            to={`/catalog/${current.productId}`}
            className="inline-flex min-h-11 shrink-0 items-center rounded-full px-3 text-sm font-semibold text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary"
          >
            {current.minCostAmount === null ? t.setUnitCost : t.openProduct}
          </ViewLink>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {COST_META.map((meta) => {
            const id = idOf(meta.field);
            const wrong = errors[meta.field];
            return (
              <div key={meta.field} className="space-y-1.5">
                <label htmlFor={id} className="block text-sm font-medium text-ink">
                  {t[meta.label]}
                </label>
                <AmountInput
                  id={id}
                  value={form[meta.field]}
                  onChange={(value) => {
                    setForm((prev) => ({ ...prev, [meta.field]: value }));
                    if (wrong) setErrors((prev) => ({ ...prev, [meta.field]: undefined }));
                  }}
                  adornment={meta.kind === "money" ? currency : "%"}
                  invalid={Boolean(wrong)}
                  describedBy={`${id}-hint`}
                  placeholder={defaults[meta.field] || "0"}
                />
                <p id={`${id}-hint`} role={wrong ? "alert" : undefined} className={wrong ? "text-xs font-medium text-danger" : "text-xs text-ink-soft"}>
                  {wrong ? (wrong === "money" ? t.invalidMoney : t.invalidPercent) : t[meta.hint]}
                </p>
              </div>
            );
          })}
        </div>

        {failure && <Alert variant="danger">{failure}</Alert>}
      </form>
    </Modal>
  );
}
