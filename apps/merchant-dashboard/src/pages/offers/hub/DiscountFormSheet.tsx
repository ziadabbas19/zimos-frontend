import { useId, useMemo, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { Alert, Button, Input, Label, Spinner } from "@store-builder/ui";
import type { CreateDiscountPayload, Discount, DiscountType, Product, UpdateDiscountPayload } from "@store-builder/api-client";
import { IconArchive, IconLink, IconMagic, IconPause, IconPlay } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { basisPointsToPercentInput, majorToMinor, minorToMajorInput, percentToBasisPoints } from "@/lib/format";
import { fmt, useT } from "@/i18n/LocaleContext";
import { useWorkspace } from "@/context/WorkspaceContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { CopyButton } from "@/components/CopyButton";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { CouponLinkDialog } from "@/pages/discounts/CouponLinkDialog";
import { DiscountResultsPanel, type DiscountResults } from "@/pages/discounts/DiscountResults";
import { DiscountPreview } from "./DiscountPreview";
import { DISCOUNT_STRINGS, DISCOUNT_TYPES, STATUS_LABEL, TYPE_LABEL, displayStatus, generateCode } from "./discountModel";
import { matchesFolded } from "./foldText";
// Buy X get Y: units to buy, units given, the discount on them.
import { BuyXGetYFields, useBuyXGetY } from "./BuyXGetYFields";

export type DiscountFormTarget = Discount | "new" | null;

/** A choice made in a sheet opened from this one is not an edit of this form. */
const notAnEdit = (event: SyntheticEvent) => event.stopPropagation();

const ACTION =
  "zimos-offer-action inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-paper-raised px-3.5 text-[13px] font-medium text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

/**
 * Creating or editing a discount, in a sheet over the list: the form on one
 * side and, on the other, the discount as the shopper will meet it (a mock of
 * the cart summary, redrawn as the form changes). On a phone the preview comes
 * first, as a slim strip that stays in view.
 *
 * The same fields, the same checks and the same two calls as before
 * (`createDiscount`, `updateDiscount`). For a discount that exists, the sheet
 * also carries its results for the list's window and its own actions — copy
 * the code, the share link, turn it off / on, archive — so everything a row
 * can do is reachable without a long press.
 *
 * It is the shared `Modal` (the same pane as `Sheet`), so a dismissal after
 * something was typed first asks «تسيب التعديلات؟».
 */
export function DiscountFormSheet({
  target,
  results,
  onClose,
  onSaved,
  onToggle,
  onArchive,
}: {
  target: DiscountFormTarget;
  results: DiscountResults;
  onClose: () => void;
  onSaved: () => void;
  /** Turns the discount off or on (the page's own handler: same call, same toast). */
  onToggle: (discount: Discount) => void;
  /** Archives it; resolves once done. The page closes the sheet. */
  onArchive: (discount: Discount) => Promise<void>;
}) {
  const t = useT(DISCOUNT_STRINGS);
  const formId = useId();
  const [saving, setSaving] = useState(false);
  // While the sheet leaves, it keeps showing what it was opened for.
  const last = useRef<Exclude<DiscountFormTarget, null>>("new");
  if (target !== null) last.current = target;
  const shown = target ?? last.current;
  const editing = shown === "new" ? undefined : shown;

  return (
    <Modal
      open={target !== null}
      onClose={onClose}
      title={editing ? t.editTitle : t.newTitle}
      className="sm:max-w-[46rem] md:max-w-[52rem]"
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={saving}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={saving}>
            {saving ? t.saving : editing ? t.save : t.createSubmit}
          </Button>
        </>
      }
    >
      <DiscountFormBody
        key={editing ? editing.id : "new"}
        formId={formId}
        discount={editing}
        results={results}
        onSavingChange={setSaving}
        onDone={onSaved}
        onToggle={onToggle}
        onArchive={onArchive}
      />
    </Modal>
  );
}

function DiscountFormBody({
  formId,
  discount,
  results,
  onSavingChange,
  onDone,
  onToggle,
  onArchive,
}: {
  formId: string;
  discount?: Discount;
  results: DiscountResults;
  onSavingChange: (saving: boolean) => void;
  onDone: () => void;
  onToggle: (discount: Discount) => void;
  onArchive: (discount: Discount) => Promise<void>;
}) {
  const t = useT(DISCOUNT_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const { currentWorkspace } = useWorkspace();
  const currency = currentWorkspace?.defaultCurrency ?? "EGP";
  const isEdit = Boolean(discount);

  const [code, setCode] = useState(discount?.code ?? "");
  const [type, setType] = useState<DiscountType>(discount?.type ?? "percentage");
  const [value, setValue] = useState(() => {
    if (!discount) return "";
    if (discount.type === "percentage") return basisPointsToPercentInput(discount.value);
    if (discount.type === "fixed") return minorToMajorInput(discount.value);
    return "";
  });
  const [minimumSubtotal, setMinimumSubtotal] = useState(minorToMajorInput(discount?.minimumSubtotal));
  const [startsAt, setStartsAt] = useState(discount?.startsAt ? discount.startsAt.slice(0, 10) : "");
  const [endsAt, setEndsAt] = useState(discount?.endsAt ? discount.endsAt.slice(0, 10) : "");
  const [usageLimit, setUsageLimit] = useState(discount?.usageLimit != null ? String(discount.usageLimit) : "");
  const [perCustomerLimit, setPerCustomerLimit] = useState(discount?.perCustomerLimit != null ? String(discount.perCustomerLimit) : "");
  const [stackable, setStackable] = useState(discount?.stackable ?? false);
  const [productScope, setProductScope] = useState<"all" | "products">(
    discount && discount.productRestrictions.length > 0 ? "products" : "all"
  );
  const [productIds, setProductIds] = useState<string[]>(discount?.productRestrictions ?? []);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const needsValue = type === "percentage" || type === "fixed";
  const buyXGetY = useBuyXGetY(discount);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    let valueNum: number | null = null;
    if (needsValue) {
      valueNum = type === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
      if (!Number.isFinite(valueNum) || valueNum < 0) {
        setFieldErrors({ value: type === "percentage" ? t.percentInvalid : t.amountInvalid });
        return;
      }
      if (type === "percentage" && valueNum > 10000) {
        setFieldErrors({ value: t.percentTooHigh });
        return;
      }
    }

    let minSubtotalNum: number | null = null;
    if (minimumSubtotal.trim() !== "") {
      minSubtotalNum = majorToMinor(minimumSubtotal);
      if (!Number.isFinite(minSubtotalNum) || minSubtotalNum < 0) {
        setFieldErrors({ minimumSubtotal: t.amountInvalid });
        return;
      }
    }

    let usageLimitNum: number | null = null;
    if (usageLimit.trim() !== "") {
      usageLimitNum = Math.floor(Number(usageLimit));
      if (!Number.isFinite(usageLimitNum) || usageLimitNum < 1) {
        setFieldErrors({ usageLimit: t.limitInvalid });
        return;
      }
    }

    let perCustomerNum: number | null = null;
    if (perCustomerLimit.trim() !== "") {
      perCustomerNum = Math.floor(Number(perCustomerLimit));
      if (!Number.isFinite(perCustomerNum) || perCustomerNum < 1) {
        setFieldErrors({ perCustomerLimit: t.limitInvalid });
        return;
      }
    }

    if (productScope === "products" && productIds.length === 0) {
      setFieldErrors({ productRestrictions: t.productsRequired });
      return;
    }

    // Required for the type; a field that is not valid is marked and nothing is sent.
    const buyXGetYConfig = type === "buy_x_get_y" ? buyXGetY.read() : null;
    if (type === "buy_x_get_y" && !buyXGetYConfig) return;

    const codeValue = code.trim().toUpperCase();
    const restrictions = productScope === "products" ? productIds : [];

    onSavingChange(true);
    try {
      if (isEdit && discount) {
        const payload: UpdateDiscountPayload = {
          type,
          code: codeValue || null,
          value: needsValue ? valueNum : null,
          minimumSubtotal: minSubtotalNum,
          productRestrictions: restrictions,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          usageLimit: usageLimitNum,
          perCustomerLimit: perCustomerNum,
          stackable,
          ...(buyXGetYConfig ? { buyXGetYConfig: { ...buyXGetYConfig } } : {}),
        };
        await apiClient.updateDiscount(workspaceId, discount.id, payload);
        toast.success(t.savedToast);
      } else {
        const payload: CreateDiscountPayload = { type, stackable, productRestrictions: restrictions };
        if (codeValue) payload.code = codeValue;
        if (buyXGetYConfig) payload.buyXGetYConfig = { ...buyXGetYConfig };
        if (needsValue && valueNum != null) payload.value = valueNum;
        if (minSubtotalNum != null) payload.minimumSubtotal = minSubtotalNum;
        if (startsAt) payload.startsAt = startsAt;
        if (endsAt) payload.endsAt = endsAt;
        if (usageLimitNum != null) payload.usageLimit = usageLimitNum;
        if (perCustomerNum != null) payload.perCustomerLimit = perCustomerNum;
        await apiClient.createDiscount(workspaceId, payload);
        toast.success(codeValue ? fmt(t.createdCodeToast, { code: codeValue }) : t.createdAutomaticToast);
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      onSavingChange(false);
    }
  }

  const status = discount ? displayStatus(discount) : null;
  const check = "size-5 shrink-0 cursor-pointer accent-primary";
  const choice = "flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink";

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17.5rem] md:gap-6">
      {/* First in the page on a phone, at the end side from md up. */}
      <div className="sticky top-0 z-10 md:static md:z-auto md:order-2">
        <div className="md:sticky md:top-0">
          <DiscountPreview
            values={{ code, type, value, minimumSubtotal, specificProducts: productScope === "products" }}
            currency={currency}
          />
        </div>
      </div>

      <div className="min-w-0 space-y-4 md:order-1">
        {discount && status && (
          // What this discount is doing, and everything a row can do — none of it an edit of the form.
          <div className="space-y-3" onInput={notAnEdit} onChange={notAnEdit}>
            <div role="group" aria-label={t.thisDiscount} className="flex flex-wrap items-center gap-2">
              <StatusBadge value={status} text={t[STATUS_LABEL[status]]} />
              {discount.code && <CopyButton value={discount.code} label={t.copyCode} className={ACTION} />}
              {discount.code && discount.status !== "archived" && (
                <button type="button" className={ACTION} onClick={() => setSharing(true)}>
                  <IconLink className="size-4" aria-hidden />
                  {t.shareLink}
                </button>
              )}
              {discount.status !== "archived" && (
                <button type="button" className={ACTION} onClick={() => onToggle(discount)}>
                  {discount.status === "active" ? <IconPause className="size-4" aria-hidden /> : <IconPlay className="size-4" aria-hidden />}
                  {discount.status === "active" ? t.disable : t.enable}
                </button>
              )}
              {discount.status !== "archived" && (
                <button type="button" className={`${ACTION} text-danger`} onClick={() => setArchiving(true)}>
                  <IconArchive className="size-4" aria-hidden />
                  {t.archive}
                </button>
              )}
            </div>
            <DiscountResultsPanel results={results} discount={discount} />
            {/* Opened from inside this sheet, so they stack on it and it stays as it is underneath. */}
            <CouponLinkDialog
              discount={sharing ? discount : null}
              statusText={status === "active" ? null : t[STATUS_LABEL[status]]}
              onClose={() => setSharing(false)}
            />
            <ConfirmDialog
              open={archiving}
              title={discount.code ? fmt(t.archiveTitleCode, { code: discount.code }) : t.archiveTitle}
              description={t.archiveDescription}
              confirmLabel={t.archiveConfirm}
              cancelLabel={t.cancel}
              busyLabel={t.working}
              destructive
              onCancel={() => setArchiving(false)}
              onConfirm={async () => {
                await onArchive(discount);
                setArchiving(false);
              }}
            />
          </div>
        )}

        <form id={formId} onSubmit={submit} className="space-y-4">
          {formError && <Alert variant="danger">{formError}</Alert>}

          <Field label={t.code} error={fieldErrors.code} hint={t.codeHint}>
            {({ id, ...aria }) => (
              <div className="flex gap-2">
                <Input
                  id={id}
                  {...aria}
                  dir="ltr"
                  autoComplete="off"
                  autoCapitalize="characters"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="SUMMER25"
                  className={`h-11 min-w-0 flex-1 uppercase placeholder:normal-case ${fieldErrors.code ? "border-danger focus-visible:ring-danger/30" : ""}`}
                />
                <Button type="button" variant="outline" className="min-h-11 shrink-0 rounded-full px-4" onClick={() => setCode(generateCode())}>
                  <IconMagic className="size-4" aria-hidden />
                  {t.generate}
                </Button>
              </div>
            )}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.type} error={fieldErrors.type}>
              {({ id }) => (
                <Select id={id} value={type} onChange={(e) => setType(e.target.value as DiscountType)} className="h-11">
                  {DISCOUNT_TYPES.map((opt) => (
                    <option key={opt} value={opt}>
                      {t[TYPE_LABEL[opt]]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>

            {type === "percentage" && (
              <Field label={t.percentage} required error={fieldErrors.value} hint={t.percentageHint}>
                {({ id, ...aria }) => (
                  <div className="relative">
                    <Input
                      id={id}
                      {...aria}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={100}
                      step="0.01"
                      value={value}
                      onChange={(e) => setValue(e.target.value)}
                      className="h-11 pe-8"
                    />
                    <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">%</span>
                  </div>
                )}
              </Field>
            )}

            {type === "fixed" && (
              <MoneyInput label={t.amountOff} required currency={currency} value={value} onChange={setValue} error={fieldErrors.value} />
            )}

            {type === "buy_x_get_y" && <BuyXGetYFields state={buyXGetY} error={fieldErrors.buyXGetYConfig} />}
          </div>

          <fieldset className="space-y-4 border-t border-line pt-4">
            <legend className="float-start mb-3 w-full text-[13px] leading-5 font-semibold text-ink">{t.sectionRules}</legend>
            <div className="clear-both space-y-4">
              <MoneyInput
                label={t.minimumSubtotal}
                currency={currency}
                value={minimumSubtotal}
                onChange={setMinimumSubtotal}
                error={fieldErrors.minimumSubtotal}
                hint={t.minimumSubtotalHint}
              />

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.startsAt} error={fieldErrors.startsAt}>
                  {({ id, ...aria }) => (
                    <Input id={id} {...aria} type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="h-11" />
                  )}
                </Field>
                <Field label={t.endsAt} error={fieldErrors.endsAt}>
                  {({ id, ...aria }) => (
                    <Input id={id} {...aria} type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="h-11" />
                  )}
                </Field>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.usageLimit} error={fieldErrors.usageLimit} hint={t.usageLimitHint}>
                  {({ id, ...aria }) => (
                    <Input
                      id={id}
                      {...aria}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={usageLimit}
                      onChange={(e) => setUsageLimit(e.target.value)}
                      className="h-11"
                    />
                  )}
                </Field>
                <Field label={t.perCustomerLimit} error={fieldErrors.perCustomerLimit} hint={t.perCustomerLimitHint}>
                  {({ id, ...aria }) => (
                    <Input
                      id={id}
                      {...aria}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={perCustomerLimit}
                      onChange={(e) => setPerCustomerLimit(e.target.value)}
                      className="h-11"
                    />
                  )}
                </Field>
              </div>
            </div>
          </fieldset>

          <div className="space-y-1 border-t border-line pt-4">
            <Label>{t.appliesTo}</Label>
            <div>
              <label className={choice}>
                <input type="radio" name={`${formId}-scope`} className={check} checked={productScope === "all"} onChange={() => setProductScope("all")} />
                {t.allProducts}
              </label>
              <label className={choice}>
                <input
                  type="radio"
                  name={`${formId}-scope`}
                  className={check}
                  checked={productScope === "products"}
                  onChange={() => setProductScope("products")}
                />
                {t.specificProducts}
              </label>
              {productScope === "products" && <ProductScopePicker selected={productIds} onChange={setProductIds} />}
            </div>
            {fieldErrors.productRestrictions && <p className="text-xs font-medium text-danger">{fieldErrors.productRestrictions}</p>}
          </div>

          <label className={choice}>
            <input type="checkbox" className={check} checked={stackable} onChange={(e) => setStackable(e.target.checked)} />
            {t.stackable}
          </label>
        </form>
      </div>
    </div>
  );
}

/** Checklist of products for the "specific products" discount scope. Fetches
 * one page (up to the backend's max) and filters client-side — matches the
 * catalog list's own local-filter pattern rather than adding pagination to a
 * picker. */
function ProductScopePicker({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) {
  const t = useT(DISCOUNT_STRINGS);
  const workspaceId = useWorkspaceId();
  const products = useAsync(() => apiClient.listProducts(workspaceId, { limit: 200 }).then((r) => r.products), [workspaceId]);
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const all = useMemo(() => products.data ?? [], [products.data]);
  const filtered = useMemo(() => (search.trim() ? all.filter((p) => matchesFolded(p.name, search)) : all), [all, search]);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (products.loading) return <Spinner className="size-4" aria-label={t.loading} />;
  if (products.error) return <p className="text-sm text-danger">{getErrorMessage(products.error)}</p>;

  return (
    <div className="mt-1 space-y-2 rounded-[1rem] p-3 ring-1 ring-line">
      <div className="flex items-center justify-between gap-2">
        {/* Searching the list is not an edit of the discount. */}
        <Input
          value={search}
          onChange={(e) => {
            e.stopPropagation();
            setSearch(e.target.value);
          }}
          onInput={notAnEdit}
          aria-label={t.filterProducts}
          placeholder={t.filterProducts}
          className="h-11 max-w-xs"
        />
        <span className="text-xs whitespace-nowrap text-ink-soft tabular-nums">{fmt(t.selectedCount, { count: selected.length })}</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">{all.length === 0 ? t.noProducts : t.noMatch}</p>
      ) : (
        <div className="max-h-52 overflow-y-auto">
          {filtered.map((p: Product) => (
            <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-[0.625rem] px-1.5 text-sm text-ink hover:bg-paper-sunken">
              <input type="checkbox" className="size-5 shrink-0 cursor-pointer accent-primary" checked={selectedSet.has(p.id)} onChange={() => toggle(p.id)} />
              <span className="min-w-0 truncate">
                <bdi>{p.name}</bdi>
              </span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
