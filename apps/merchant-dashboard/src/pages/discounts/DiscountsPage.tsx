import { useState, type FormEvent } from "react";
import { Alert, Button, Input } from "@store-builder/ui";
import type {
  CreateDiscountPayload,
  Discount,
  DiscountType,
  UpdateDiscountPayload,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import {
  basisPointsToPercentInput,
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
import { TextField, Field } from "@/components/Field";
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
                    <StatusBadge value={d.status} />
                  </td>
                  <td className="px-4 py-3 text-ink-soft">
                    {d.usageCount}
                    {d.usageLimit != null ? ` / ${d.usageLimit}` : ""}
                  </td>
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

    const codeValue = code.trim().toUpperCase();

    setSaving(true);
    try {
      if (isEdit && discount) {
        const payload: UpdateDiscountPayload = {
          type,
          code: codeValue || null,
          value: needsValue ? valueNum : null,
          minimumSubtotal: minSubtotalNum,
          startsAt: startsAt || null,
          endsAt: endsAt || null,
          usageLimit: usageLimitNum,
          perCustomerLimit: perCustomerNum,
          stackable,
        };
        await apiClient.updateDiscount(workspaceId, discount.id, payload);
        toast.success("Discount saved.");
      } else {
        const payload: CreateDiscountPayload = { type, stackable };
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

      <TextField
        label="Code"
        value={code}
        onChange={(e) => setCode(e.target.value)}
        error={fieldErrors.code}
        hint="Leave blank for an automatic discount with no code."
        placeholder="SUMMER25"
      />

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
