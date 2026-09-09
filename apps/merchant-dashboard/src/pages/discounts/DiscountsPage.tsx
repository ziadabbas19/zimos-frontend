import { useMemo, useState, type FormEvent } from "react";
import { Alert, Button, Input, Label, Spinner } from "@store-builder/ui";
import type {
  CreateDiscountPayload,
  Discount,
  DiscountStatus,
  DiscountType,
  Product,
  UpdateDiscountPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import {
  basisPointsToPercentInput,
  formatDate,
  formatMoney,
  formatPercent,
  majorToMinor,
  minorToMajorInput,
  percentToBasisPoints,
} from "@/lib/format";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { StatusBadge } from "@/components/StatusBadge";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { Field } from "@/components/Field";
import { MoneyInput } from "@/components/MoneyInput";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";

const TYPE_LABEL: Record<DiscountType, string> = {
  percentage: "Percentage off",
  fixed: "Fixed amount off",
  free_shipping: "Free shipping",
  buy_x_get_y: "Buy X get Y",
};

/** Value column: percent for %, money for fixed, a plain caption otherwise. */
function discountValueLabel(d: Discount): string {
  switch (d.type) {
    case "percentage":
      return formatPercent(d.value);
    case "fixed":
      return formatMoney(d.value);
    default:
      return "—";
  }
}

type DisplayStatus = DiscountStatus | "scheduled" | "expired";

/**
 * `active` on the backend just means "not disabled/archived" — a discount
 * with a future start or a past end is still stored as `active`. Compute the
 * status a merchant actually cares about from the date range on top of it.
 */
function displayStatus(d: Discount): DisplayStatus {
  if (d.status !== "active") return d.status;
  const now = Date.now();
  if (d.startsAt && new Date(d.startsAt).getTime() > now) return "scheduled";
  if (d.endsAt && new Date(d.endsAt).getTime() < now) return "expired";
  return "active";
}

function dateRangeLabel(d: Discount): string {
  if (!d.startsAt && !d.endsAt) return "No date limit";
  if (d.startsAt && !d.endsAt) return `From ${formatDate(d.startsAt)}`;
  if (!d.startsAt && d.endsAt) return `Until ${formatDate(d.endsAt)}`;
  return `${formatDate(d.startsAt)} – ${formatDate(d.endsAt)}`;
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I — easy to read aloud

function generateCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) {
    out += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return out;
}

export function DiscountsPage() {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const list = useAsync(() => apiClient.listDiscounts(workspaceId), [workspaceId]);

  const [formTarget, setFormTarget] = useState<Discount | "new" | null>(null);
  const [deleting, setDeleting] = useState<Discount | null>(null);

  const reload = () => list.refresh({ silent: true });
  const discounts = list.data ?? [];
  const editing = formTarget === "new" ? undefined : formTarget ?? undefined;

  async function toggleStatus(d: Discount) {
    const next = d.status === "active" ? "disabled" : "active";
    try {
      await apiClient.setDiscountStatus(workspaceId, d.id, next);
      toast.success(next === "active" ? "Discount enabled." : "Discount disabled.");
      reload();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    await apiClient.deleteDiscount(workspaceId, deleting.id);
    toast.success(deleting.code ? `"${deleting.code}" archived.` : "Discount archived.");
    setDeleting(null);
    reload();
  }

  return (
    <div className="max-w-5xl">
      <PageHeader
        title="Discounts"
        description="Codes and automatic discounts applied at checkout."
        actions={<Button onClick={() => setFormTarget("new")}>Create discount</Button>}
      />

      <DataState
        loading={list.loading}
        error={list.error}
        empty={discounts.length === 0}
        emptyMessage="No discounts yet. Create your first one."
        onRetry={() => list.refresh()}
      >
        <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-line bg-paper-raised text-left text-xs uppercase tracking-wide text-ink-soft">
                <th className="px-4 py-3 font-medium">Code</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Value</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Usage</th>
                <th className="px-4 py-3 font-medium">Dates</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {discounts.map((d) => (
                <tr
                  key={d.id}
                  onClick={() => setFormTarget(d)}
                  className="cursor-pointer border-b border-line last:border-0 hover:bg-paper-raised"
                >
                  <td className="px-4 py-3">
                    {d.code ? (
                      <span className="font-medium text-ink">{d.code}</span>
                    ) : (
                      <span className="text-ink-soft">Automatic</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{TYPE_LABEL[d.type]}</td>
                  <td className="px-4 py-3 text-ink-soft">{discountValueLabel(d)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge value={displayStatus(d)} />
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {d.usageCount}
                    {d.usageLimit != null ? ` / ${d.usageLimit}` : ""}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{dateRangeLabel(d)}</td>
                  <td
                    className="whitespace-nowrap px-4 py-3 text-right"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {d.status !== "archived" && (
                      <Button size="sm" variant="ghost" onClick={() => toggleStatus(d)}>
                        {d.status === "active" ? "Disable" : "Enable"}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() => setDeleting(d)}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataState>

      <Modal
        open={formTarget !== null}
        onClose={() => setFormTarget(null)}
        title={formTarget === "new" ? "Create discount" : "Edit discount"}
      >
        {formTarget !== null && (
          <DiscountForm
            key={formTarget === "new" ? "new" : formTarget.id}
            discount={editing}
            onCancel={() => setFormTarget(null)}
            onDone={() => {
              setFormTarget(null);
              reload();
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={deleting?.code ? `Archive "${deleting.code}"?` : "Archive this discount?"}
        description="A discount that has been redeemed is financial history, so it's archived rather than deleted — it stops applying at checkout and drops off active reporting."
        confirmLabel="Archive discount"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function DiscountForm({
  discount,
  onDone,
  onCancel,
}: {
  discount?: Discount;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
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
  const [usageLimit, setUsageLimit] = useState(
    discount?.usageLimit != null ? String(discount.usageLimit) : ""
  );
  const [perCustomerLimit, setPerCustomerLimit] = useState(
    discount?.perCustomerLimit != null ? String(discount.perCustomerLimit) : ""
  );
  const [stackable, setStackable] = useState(discount?.stackable ?? false);
  const [productScope, setProductScope] = useState<"all" | "products">(
    discount && discount.productRestrictions.length > 0 ? "products" : "all"
  );
  const [productIds, setProductIds] = useState<string[]>(discount?.productRestrictions ?? []);

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const needsValue = type === "percentage" || type === "fixed";

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});

    let valueNum: number | null = null;
    if (needsValue) {
      valueNum = type === "percentage" ? percentToBasisPoints(value) : majorToMinor(value);
      if (!Number.isFinite(valueNum) || valueNum < 0) {
        setFieldErrors({
          value:
            type === "percentage" ? "Enter a percentage between 0 and 100." : "Enter a valid amount.",
        });
        return;
      }
      if (type === "percentage" && valueNum > 10000) {
        setFieldErrors({ value: "A percentage discount can't exceed 100%." });
        return;
      }
    }

    let minSubtotalNum: number | null = null;
    if (minimumSubtotal.trim() !== "") {
      minSubtotalNum = majorToMinor(minimumSubtotal);
      if (!Number.isFinite(minSubtotalNum) || minSubtotalNum < 0) {
        setFieldErrors({ minimumSubtotal: "Enter a valid amount." });
        return;
      }
    }

    let usageLimitNum: number | null = null;
    if (usageLimit.trim() !== "") {
      usageLimitNum = Math.floor(Number(usageLimit));
      if (!Number.isFinite(usageLimitNum) || usageLimitNum < 1) {
        setFieldErrors({ usageLimit: "Enter a whole number of 1 or more." });
        return;
      }
    }

    let perCustomerNum: number | null = null;
    if (perCustomerLimit.trim() !== "") {
      perCustomerNum = Math.floor(Number(perCustomerLimit));
      if (!Number.isFinite(perCustomerNum) || perCustomerNum < 1) {
        setFieldErrors({ perCustomerLimit: "Enter a whole number of 1 or more." });
        return;
      }
    }

    if (productScope === "products" && productIds.length === 0) {
      setFieldErrors({ productRestrictions: "Select at least one product, or switch to all products." });
      return;
    }

    const codeValue = code.trim().toUpperCase();
    const restrictions = productScope === "products" ? productIds : [];

    setSaving(true);
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
        };
        await apiClient.updateDiscount(workspaceId, discount.id, payload);
        toast.success("Discount saved.");
      } else {
        const payload: CreateDiscountPayload = { type, stackable, productRestrictions: restrictions };
        if (codeValue) payload.code = codeValue;
        if (needsValue && valueNum != null) payload.value = valueNum;
        if (minSubtotalNum != null) payload.minimumSubtotal = minSubtotalNum;
        if (startsAt) payload.startsAt = startsAt;
        if (endsAt) payload.endsAt = endsAt;
        if (usageLimitNum != null) payload.usageLimit = usageLimitNum;
        if (perCustomerNum != null) payload.perCustomerLimit = perCustomerNum;
        await apiClient.createDiscount(workspaceId, payload);
        toast.success(codeValue ? `"${codeValue}" created.` : "Automatic discount created.");
      }
      onDone();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      {formError && <Alert variant="danger">{formError}</Alert>}

      <Field
        label="Code"
        error={fieldErrors.code}
        hint="Leave blank for an automatic discount with no code."
      >
        {({ id, ...aria }) => (
          <div className="flex gap-2">
            <Input
              id={id}
              {...aria}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="SUMMER25"
              className={fieldErrors.code ? "border-danger focus-visible:ring-danger/30" : undefined}
            />
            <Button type="button" variant="outline" onClick={() => setCode(generateCode())}>
              Generate
            </Button>
          </div>
        )}
      </Field>

      <Field label="Type" error={fieldErrors.type}>
        {({ id }) => (
          <Select id={id} value={type} onChange={(e) => setType(e.target.value as DiscountType)}>
            {(Object.keys(TYPE_LABEL) as DiscountType[]).map((t) => (
              <option key={t} value={t}>
                {TYPE_LABEL[t]}
              </option>
            ))}
          </Select>
        )}
      </Field>

      {type === "percentage" && (
        <Field label="Percentage" required error={fieldErrors.value} hint="Between 0 and 100.">
          {({ id, ...aria }) => (
            <div className="relative">
              <Input
                id={id}
                {...aria}
                type="number"
                min={0}
                max={100}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="pr-8"
              />
              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-sm text-ink-soft">
                %
              </span>
            </div>
          )}
        </Field>
      )}

      {type === "fixed" && (
        <MoneyInput
          label="Amount off"
          required
          value={value}
          onChange={setValue}
          error={fieldErrors.value}
        />
      )}

      <MoneyInput
        label="Minimum subtotal"
        value={minimumSubtotal}
        onChange={setMinimumSubtotal}
        error={fieldErrors.minimumSubtotal}
        hint="Optional — the order subtotal must reach this before the discount applies."
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Starts at" error={fieldErrors.startsAt}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="date"
              value={startsAt}
              onChange={(e) => setStartsAt(e.target.value)}
            />
          )}
        </Field>
        <Field label="Ends at" error={fieldErrors.endsAt}>
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="date"
              value={endsAt}
              onChange={(e) => setEndsAt(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Usage limit" error={fieldErrors.usageLimit} hint="Total redemptions allowed.">
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={1}
              value={usageLimit}
              onChange={(e) => setUsageLimit(e.target.value)}
            />
          )}
        </Field>
        <Field
          label="Per-customer limit"
          error={fieldErrors.perCustomerLimit}
          hint="Redemptions allowed per customer."
        >
          {({ id, ...aria }) => (
            <Input
              id={id}
              {...aria}
              type="number"
              min={1}
              value={perCustomerLimit}
              onChange={(e) => setPerCustomerLimit(e.target.value)}
            />
          )}
        </Field>
      </div>

      <div className="space-y-2">
        <Label>Applies to</Label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="discount-scope"
              checked={productScope === "all"}
              onChange={() => setProductScope("all")}
            />
            All products
          </label>
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="radio"
              name="discount-scope"
              checked={productScope === "products"}
              onChange={() => setProductScope("products")}
            />
            Specific products
          </label>
          {productScope === "products" && (
            <ProductScopePicker selected={productIds} onChange={setProductIds} />
          )}
        </div>
        {fieldErrors.productRestrictions && (
          <p className="text-xs font-medium text-danger">{fieldErrors.productRestrictions}</p>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={stackable}
          onChange={(e) => setStackable(e.target.checked)}
        />
        Can be combined with other discounts
      </label>

      <div className="flex justify-end gap-3 pt-1">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? "Saving…" : isEdit ? "Save discount" : "Create discount"}
        </Button>
      </div>
    </form>
  );
}

/** Checklist of products for the "specific products" discount scope. Fetches
 * one page (up to the backend's max) and filters client-side — matches the
 * catalog list's own local-filter pattern rather than adding pagination to a
 * picker. */
function ProductScopePicker({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const workspaceId = useWorkspaceId();
  const products = useAsync(
    () => apiClient.listProducts(workspaceId, { limit: 200 }).then((r) => r.products),
    [workspaceId]
  );
  const [search, setSearch] = useState("");

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const all = products.data ?? [];
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return all;
    return all.filter((p) => p.name.toLowerCase().includes(q));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, search]);

  function toggle(id: string) {
    onChange(selectedSet.has(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  }

  if (products.loading) return <Spinner className="size-4" />;
  if (products.error) return <p className="text-sm text-danger">{getErrorMessage(products.error)}</p>;

  return (
    <div className="space-y-2 rounded-[var(--radius-card)] border border-line p-3">
      <div className="flex items-center justify-between gap-2">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter products…"
          className="max-w-xs"
        />
        <span className="whitespace-nowrap text-xs text-ink-soft">{selected.length} selected</span>
      </div>
      {filtered.length === 0 ? (
        <p className="text-sm text-ink-soft">
          {all.length === 0 ? "No products yet — add one in Catalog first." : "No products match."}
        </p>
      ) : (
        <div className="max-h-48 space-y-1 overflow-y-auto">
          {filtered.map((p: Product) => (
            <label
              key={p.id}
              className="flex items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper-raised"
            >
              <input type="checkbox" checked={selectedSet.has(p.id)} onChange={() => toggle(p.id)} />
              {p.name}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
