import { useId, useRef, useState, type FormEvent, type SyntheticEvent } from "react";
import { Alert, Button, Input, Label } from "@store-builder/ui";
import type { CreateDiscountPayload, Discount, DiscountType, UpdateDiscountPayload } from "@store-builder/api-client";
import { IconArchive, IconLink, IconMagic, IconPause, IconPlay, IconReports } from "@/components/icons";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
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
import { asciiDigits, joinStamp, parsePhones, readControls, scheduleOf, splitStamp } from "./couponControls";
import {
  AudienceFields,
  CONTROL_STRINGS,
  CollectionChecklist,
  CoverageSwitches,
  ExcludedProductsField,
  FormSection,
  MaxDiscountField,
  MinQuantityField,
  ProductChecklist,
  ScheduleFields,
  StrictLimitSwitch,
  SwitchRow,
  controlsMessages,
  useCouponControls,
} from "./CouponControlFields";
import { DiscountSentence, type SentenceInput } from "./DiscountSentence";
// Buy X get Y: units to buy, units given, the discount on them.
import { BuyXGetYFields, useBuyXGetY, useBuyXGetYWords } from "./BuyXGetYFields";

export type DiscountFormTarget = Discount | "new" | null;

/** A choice made in a sheet opened from this one is not an edit of this form. */
const notAnEdit = (event: SyntheticEvent) => event.stopPropagation();

const ACTION =
  "zimos-offer-action inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full bg-paper-raised px-3.5 text-[13px] font-medium text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100";

type ProductScope = "all" | "products" | "collections";

/** A whole number of 1 or more as typed; null for none, NaN for one that is not valid. */
function wholeNumber(text: string): number | null {
  if (text.trim() === "") return null;
  const n = Math.floor(Number(asciiDigits(text.trim())));
  return Number.isFinite(n) && n >= 1 ? n : Number.NaN;
}

/** A positive figure for the sentence, or null. */
const positive = (n: number | null) => (n !== null && Number.isFinite(n) && n > 0 ? n : null);

/**
 * Creating or editing a discount, in a sheet over the list: the form on one
 * side and, on the other, the discount as the shopper will meet it (a mock of
 * the cart summary, redrawn as the form changes). On a phone the preview comes
 * first, as a slim strip that stays in view.
 *
 * The form is in headed groups — type and value, when, on what, for whom,
 * limits — and ends with the whole coupon in one plain sentence. The same two
 * calls as before (`createDiscount`, `updateDiscount`), now with the coupon's
 * controls. For a discount that exists, the sheet also carries its results
 * for the list's window and its own actions — copy the code, the share link,
 * its report, turn it off / on, archive — so everything a row can do is
 * reachable without a long press.
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
  onReport,
}: {
  target: DiscountFormTarget;
  results: DiscountResults;
  onClose: () => void;
  onSaved: () => void;
  /** Turns the discount off or on (the page's own handler: same call, same toast). */
  onToggle: (discount: Discount) => void;
  /** Archives it; resolves once done. The page closes the sheet. */
  onArchive: (discount: Discount) => Promise<void>;
  /** Opens the discount's report (its uses, as a table and a file). */
  onReport?: (discount: Discount) => void;
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
        onReport={onReport}
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
  onReport,
}: {
  formId: string;
  discount?: Discount;
  results: DiscountResults;
  onSavingChange: (saving: boolean) => void;
  onDone: () => void;
  onToggle: (discount: Discount) => void;
  onArchive: (discount: Discount) => Promise<void>;
  onReport?: (discount: Discount) => void;
}) {
  const t = useT(DISCOUNT_STRINGS);
  const tc = useT(CONTROL_STRINGS);
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
  // A date, and a time only when one was chosen: a coupon saved from a date alone opens as a date alone.
  const [start, setStart] = useState(() => splitStamp(discount?.startsAt));
  const [end, setEnd] = useState(() => splitStamp(discount?.endsAt));
  // A new coupon's switch; an existing one turns on and off with its own call (onToggle).
  const [active, setActive] = useState(true);
  const [usageLimit, setUsageLimit] = useState(discount?.usageLimit != null ? String(discount.usageLimit) : "");
  const [perCustomerLimit, setPerCustomerLimit] = useState(discount?.perCustomerLimit != null ? String(discount.perCustomerLimit) : "");
  const [productScope, setProductScope] = useState<ProductScope>(() => {
    if (discount && discount.productRestrictions.length > 0) return "products";
    if (discount && (discount.collectionRestrictions ?? []).length > 0) return "collections";
    return "all";
  });
  const [productIds, setProductIds] = useState<string[]>(discount?.productRestrictions ?? []);
  const [collectionIds, setCollectionIds] = useState<string[]>(discount?.collectionRestrictions ?? []);
  const controls = useCouponControls(discount);

  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [sharing, setSharing] = useState(false);
  const [archiving, setArchiving] = useState(false);

  const needsValue = type === "percentage" || type === "fixed";
  const buyXGetY = useBuyXGetY(discount);
  const buyXGetYWords = useBuyXGetYWords();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    const errors: Record<string, string> = {};

    let valueNum: number | null = null;
    if (needsValue) {
      valueNum = type === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
      if (!Number.isFinite(valueNum) || valueNum < 0) errors.value = type === "percentage" ? t.percentInvalid : t.amountInvalid;
      else if (type === "percentage" && valueNum > 10000) errors.value = t.percentTooHigh;
    }

    let minSubtotalNum: number | null = null;
    if (minimumSubtotal.trim() !== "") {
      minSubtotalNum = majorToMinor(minimumSubtotal);
      if (!Number.isFinite(minSubtotalNum) || minSubtotalNum < 0) errors.minimumSubtotal = t.amountInvalid;
    }

    const usageLimitNum = wholeNumber(usageLimit);
    if (Number.isNaN(usageLimitNum)) errors.usageLimit = t.limitInvalid;
    const perCustomerNum = wholeNumber(perCustomerLimit);
    if (Number.isNaN(perCustomerNum)) errors.perCustomerLimit = t.limitInvalid;

    const startsAt = joinStamp(start.date, start.time);
    const endsAt = joinStamp(end.date, end.time);
    if (start.time && !start.date) errors.startsAt = tc.timeNeedsDate;
    if (end.time && !end.date) errors.endsAt = tc.timeNeedsDate;
    if (startsAt && endsAt && new Date(endsAt).getTime() < new Date(startsAt).getTime()) errors.endsAt = tc.endBeforeStart;

    if (productScope === "products" && productIds.length === 0) errors.productRestrictions = t.productsRequired;
    if (productScope === "collections" && collectionIds.length === 0) errors.collectionRestrictions = tc.collectionsRequired;

    const read = readControls(controls.draft, type, productScope === "products");
    for (const [field, message] of Object.entries(controlsMessages(read.problems, tc))) errors[field] ??= message;

    // Required for the type; a field that is not valid is marked and nothing is sent.
    const buyXGetYConfig = type === "buy_x_get_y" ? buyXGetY.read() : null;
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      return;
    }
    if (type === "buy_x_get_y" && !buyXGetYConfig) return;

    const codeValue = code.trim().toUpperCase();
    const productRestrictions = productScope === "products" ? productIds : [];
    const collectionRestrictions = productScope === "collections" ? collectionIds : [];

    onSavingChange(true);
    try {
      if (isEdit && discount) {
        // Every key, cleared ones as null. `stackable` is not sent: the server keeps one coupon per order whatever it says.
        const payload: UpdateDiscountPayload = {
          type,
          code: codeValue || null,
          value: needsValue ? valueNum : null,
          minimumSubtotal: minSubtotalNum,
          productRestrictions,
          collectionRestrictions,
          startsAt: startsAt ?? null,
          endsAt: endsAt ?? null,
          usageLimit: usageLimitNum,
          perCustomerLimit: perCustomerNum,
          ...read.payload,
          ...(buyXGetYConfig ? { buyXGetYConfig: { ...buyXGetYConfig } } : {}),
        };
        await apiClient.updateDiscount(workspaceId, discount.id, payload);
        toast.success(t.savedToast);
      } else {
        const payload: CreateDiscountPayload = {
          type,
          status: active ? "active" : "disabled",
          productRestrictions,
          collectionRestrictions,
          ...read.payload,
        };
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
      // The server's own words name the field ("customerPhones.2 is not…"): say it in the dashboard's language.
      if (fields.customerPhones) fields.customerPhones = tc.phonesServer;
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      onSavingChange(false);
    }
  }

  const status = discount ? displayStatus(discount) : null;
  const check = "size-5 shrink-0 cursor-pointer accent-primary";
  const choice = "flex min-h-11 cursor-pointer items-center gap-3 text-sm text-ink";
  const { draft } = controls;

  // The coupon as the form stands, for the sentence at its foot.
  const typedValue = type === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
  const sentence: SentenceInput = {
    type,
    value: needsValue && Number.isFinite(typedValue) && typedValue >= 0 && (type !== "percentage" || typedValue <= 10000) ? typedValue : null,
    buyXGetY: type === "buy_x_get_y" ? buyXGetYWords(buyXGetY) : null,
    maxDiscount: positive(majorToMinor(asciiDigits(draft.maxDiscount))),
    scope: productScope,
    productCount: productIds.length,
    collectionCount: collectionIds.length,
    excludedCount: draft.excludeOn ? draft.excludedIds.length : 0,
    appliesToShipping: draft.appliesToShipping,
    appliesToDiscounted: draft.appliesToDiscounted,
    combinesWithOffers: draft.combinesWithOffers,
    audience: draft.audience,
    phoneCount: parsePhones(draft.phones).length,
    vipCount: draft.vipTierIds.length,
    schedule: scheduleOf(draft),
    startsAt: joinStamp(start.date, start.time) ?? null,
    endsAt: joinStamp(end.date, end.time) ?? null,
    minimumSubtotal: positive(majorToMinor(minimumSubtotal)),
    minQuantity: positive(wholeNumber(draft.minQuantity)),
    usageLimit: positive(wholeNumber(usageLimit)),
    perCustomerLimit: positive(wholeNumber(perCustomerLimit)),
    paused: discount ? discount.status === "disabled" : !active,
  };

  const stampFields = (which: "startsAt" | "endsAt") => {
    const stamp = which === "startsAt" ? start : end;
    const setStamp = which === "startsAt" ? setStart : setEnd;
    return (
      <div className="grid grid-cols-2 gap-3">
        <Field label={which === "startsAt" ? t.startsAt : t.endsAt} error={fieldErrors[which]}>
          {({ id, ...aria }) => (
            <Input id={id} {...aria} type="date" value={stamp.date} onChange={(e) => setStamp({ ...stamp, date: e.target.value })} className="h-11" />
          )}
        </Field>
        <Field label={which === "startsAt" ? tc.startTime : tc.endTime} hint={tc.timeHint}>
          {({ id }) => (
            <Input id={id} type="time" dir="ltr" value={stamp.time} onChange={(e) => setStamp({ ...stamp, time: e.target.value })} className="h-11" />
          )}
        </Field>
      </div>
    );
  };

  return (
    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_17.5rem] md:gap-6">
      {/* First in the page on a phone, at the end side from md up. */}
      <div className="sticky top-0 z-10 md:static md:z-auto md:order-2">
        <div className="md:sticky md:top-0">
          <DiscountPreview
            values={{ code, type, value, minimumSubtotal, specificProducts: productScope !== "all" }}
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
              {onReport && (
                <button type="button" className={ACTION} onClick={() => onReport(discount)}>
                  <IconReports className="size-4" aria-hidden />
                  {t.report}
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

          <FormSection title={tc.sectionTypeValue}>
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

              {type === "percentage" && <MaxDiscountField controls={controls} currency={currency} error={fieldErrors.maxDiscountAmount} />}

              {type === "buy_x_get_y" && <BuyXGetYFields state={buyXGetY} error={fieldErrors.buyXGetYConfig} />}
            </div>
          </FormSection>

          <FormSection title={tc.sectionWhen}>
            {discount ? (
              discount.status !== "archived" && (
                // Its own call at once, like the button above: not an edit of the form.
                <div onInput={notAnEdit} onChange={notAnEdit}>
                  <SwitchRow checked={discount.status === "active"} onChange={() => onToggle(discount)} label={tc.active} hint={tc.activeHintEdit} />
                </div>
              )
            ) : (
              <SwitchRow checked={active} onChange={setActive} label={tc.active} hint={tc.activeHintNew} />
            )}
            {stampFields("startsAt")}
            {stampFields("endsAt")}
            <ScheduleFields controls={controls} error={fieldErrors.schedule} />
          </FormSection>

          <FormSection title={tc.sectionOnWhat}>
            <div className="space-y-1">
              <Label>{t.appliesTo}</Label>
              <div role="radiogroup" aria-label={t.appliesTo}>
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
                {productScope === "products" && <ProductChecklist label={t.specificProducts} selected={productIds} onChange={setProductIds} />}
                <label className={choice}>
                  <input
                    type="radio"
                    name={`${formId}-scope`}
                    className={check}
                    checked={productScope === "collections"}
                    onChange={() => setProductScope("collections")}
                  />
                  {tc.specificCollections}
                </label>
                {productScope === "collections" && (
                  <CollectionChecklist label={tc.specificCollections} selected={collectionIds} onChange={setCollectionIds} />
                )}
              </div>
              {fieldErrors.productRestrictions && <p className="text-xs font-medium text-danger">{fieldErrors.productRestrictions}</p>}
              {fieldErrors.collectionRestrictions && <p className="text-xs font-medium text-danger">{fieldErrors.collectionRestrictions}</p>}
            </div>
            {/* Leaving products out of a list of chosen products means nothing: shown for all products and collections. */}
            {productScope !== "products" && <ExcludedProductsField controls={controls} error={fieldErrors.excludedProductIds} />}
            <CoverageSwitches controls={controls} type={type} />
          </FormSection>

          <FormSection title={tc.sectionWho}>
            <AudienceFields controls={controls} errors={fieldErrors} />
          </FormSection>

          <FormSection title={tc.sectionLimits}>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyInput
                label={t.minimumSubtotal}
                currency={currency}
                value={minimumSubtotal}
                onChange={setMinimumSubtotal}
                error={fieldErrors.minimumSubtotal}
                hint={t.minimumSubtotalHint}
              />
              <MinQuantityField controls={controls} error={fieldErrors.minQuantity} />
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
            <StrictLimitSwitch controls={controls} />
          </FormSection>

          <DiscountSentence input={sentence} currency={currency} />
        </form>
      </div>
    </div>
  );
}
