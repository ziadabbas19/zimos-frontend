import { useState, type FormEvent } from "react";
import { useParams } from "react-router-dom";
import { Alert, Button, Input } from "@store-builder/ui";
import type { Customer, CustomerAddress } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { PageHeader } from "@/components/PageHeader";
import { DataState } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { TextField, Field } from "@/components/Field";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

export function CustomerDetailPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const workspaceId = useWorkspaceId();
  const detail = useAsync(
    () => apiClient.getCustomer(workspaceId, customerId as string),
    [workspaceId, customerId]
  );
  const customer = detail.data;
  const reload = () => detail.refresh({ silent: true });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader
        title={
          customer
            ? customer.fullName || customer.phoneRaw || customer.phoneNormalized
            : "Customer"
        }
        back={{ to: "/customers", label: "Customers" }}
        description={
          customer
            ? `${customer.totalOrders} orders · reliability ${customer.reliabilityScore}`
            : undefined
        }
      />

      <DataState loading={detail.loading} error={detail.error} onRetry={() => detail.refresh()}>
        {customer && (
          <div className="space-y-6">
            <ContactForm customer={customer} onSaved={reload} />
            <BlacklistSection customer={customer} onChanged={reload} />
            <AddressesSection customer={customer} onChanged={reload} />
          </div>
        )}
      </DataState>
    </div>
  );
}

function ContactForm({ customer, onSaved }: { customer: Customer; onSaved: () => void }) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [fullName, setFullName] = useState(customer.fullName ?? "");
  const [email, setEmail] = useState(customer.email ?? "");
  const [alternatePhone, setAlternatePhone] = useState(customer.alternatePhone ?? "");
  const [marketingConsent, setMarketingConsent] = useState(customer.marketingConsent);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      await apiClient.updateCustomer(workspaceId, customer.id, {
        fullName: fullName.trim() || null,
        email: email.trim() || null,
        alternatePhone: alternatePhone.trim() || null,
        marketingConsent,
      });
      toast.success("Customer updated.");
      onSaved();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">Contact details</h2>
      <form onSubmit={submit} className="mt-4 space-y-4">
        {formError && <Alert variant="danger">{formError}</Alert>}
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Full name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            error={fieldErrors.fullName}
          />
          <TextField
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldErrors.email}
          />
          <Field label="Phone" hint="Set from the storefront / checkout — read-only here.">
            {({ id }) => (
              <Input id={id} value={customer.phoneRaw || customer.phoneNormalized} disabled />
            )}
          </Field>
          <TextField
            label="Alternate phone"
            value={alternatePhone}
            onChange={(e) => setAlternatePhone(e.target.value)}
            error={fieldErrors.alternatePhone}
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-ink">
          <input
            type="checkbox"
            checked={marketingConsent}
            onChange={(e) => setMarketingConsent(e.target.checked)}
          />
          Has consented to marketing
        </label>
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </form>
    </section>
  );
}

function BlacklistSection({
  customer,
  onChanged,
}: {
  customer: Customer;
  onChanged: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [blacklisting, setBlacklisting] = useState(false);
  const [unblacklisting, setUnblacklisting] = useState(false);
  const [reason, setReason] = useState("");

  async function confirmBlacklist() {
    if (reason.trim() === "") throw new Error("Enter a reason for blacklisting this customer.");
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, {
      isBlacklisted: true,
      reason: reason.trim(),
    });
    toast.success("Customer blacklisted.");
    setBlacklisting(false);
    setReason("");
    onChanged();
  }

  async function confirmRemove() {
    await apiClient.setCustomerBlacklist(workspaceId, customer.id, { isBlacklisted: false });
    toast.success("Customer removed from the blacklist.");
    setUnblacklisting(false);
    onChanged();
  }

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <h2 className="font-display text-lg font-medium text-ink">Blacklist</h2>
      {customer.isBlacklisted ? (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">
            This customer is blacklisted
            {customer.blacklistReason ? ` — ${customer.blacklistReason}` : ""}.
          </p>
          <Button variant="outline" size="sm" onClick={() => setUnblacklisting(true)}>
            Remove from blacklist
          </Button>
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <p className="text-sm text-ink-soft">
            Blacklisting stops this customer from checking out.
          </p>
          <Button
            variant="danger"
            size="sm"
            onClick={() => {
              setReason("");
              setBlacklisting(true);
            }}
          >
            Blacklist customer
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={blacklisting}
        title="Blacklist this customer?"
        description="They won't be able to check out until you remove them from the blacklist."
        confirmLabel="Blacklist"
        destructive
        onCancel={() => setBlacklisting(false)}
        onConfirm={confirmBlacklist}
      >
        <Field label="Reason" required>
          {({ id }) => (
            <Textarea
              id={id}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Repeated failed deliveries"
            />
          )}
        </Field>
      </ConfirmDialog>

      <ConfirmDialog
        open={unblacklisting}
        title="Remove from blacklist?"
        description="The customer will be able to place orders again."
        confirmLabel="Remove"
        onCancel={() => setUnblacklisting(false)}
        onConfirm={confirmRemove}
      />
    </section>
  );
}

function AddressesSection({
  customer,
  onChanged,
}: {
  customer: Customer;
  onChanged: () => void;
}) {
  const [target, setTarget] = useState<CustomerAddress | "new" | null>(null);
  const addresses = customer.addresses ?? [];

  return (
    <section className="rounded-[var(--radius-card)] border border-line p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-display text-lg font-medium text-ink">Addresses</h2>
        <Button size="sm" onClick={() => setTarget("new")}>
          Add address
        </Button>
      </div>

      {addresses.length === 0 ? (
        <p className="mt-3 text-sm text-ink-soft">No addresses on file.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {addresses.map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-[0.5rem] border border-line p-3"
            >
              <div className="min-w-0 text-sm">
                <p className="text-ink">
                  {[a.addressLine, a.city, a.province, a.postalCode, a.country]
                    .filter(Boolean)
                    .join(", ")}
                </p>
                {a.notes && <p className="text-xs text-ink-soft">{a.notes}</p>}
                {a.isDefault && <p className="text-xs text-primary">Default</p>}
              </div>
              <Button size="sm" variant="ghost" onClick={() => setTarget(a)}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={target !== null}
        onClose={() => setTarget(null)}
        title={target === "new" ? "Add address" : "Edit address"}
      >
        {target !== null && (
          <AddressForm
            key={target === "new" ? "new" : target.id}
            customerId={customer.id}
            address={target === "new" ? undefined : target}
            onCancel={() => setTarget(null)}
            onDone={() => {
              setTarget(null);
              onChanged();
            }}
          />
        )}
      </Modal>
    </section>
  );
}

function AddressForm({
  customerId,
  address,
  onDone,
  onCancel,
}: {
  customerId: string;
  address?: CustomerAddress;
  onDone: () => void;
  onCancel: () => void;
}) {
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const [country, setCountry] = useState(address?.country ?? "EG");
  const [province, setProvince] = useState(address?.province ?? "");
  const [city, setCity] = useState(address?.city ?? "");
  const [addressLine, setAddressLine] = useState(address?.addressLine ?? "");
  const [postalCode, setPostalCode] = useState(address?.postalCode ?? "");
  const [notes, setNotes] = useState(address?.notes ?? "");
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function submit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFieldErrors({});
    setSaving(true);
    try {
      if (address) {
        await apiClient.updateCustomerAddress(workspaceId, customerId, address.id, {
          country: country.trim().toUpperCase(),
          province: province.trim() || null,
          city: city.trim(),
          addressLine: addressLine.trim(),
          postalCode: postalCode.trim() || null,
          notes: notes.trim() || null,
          isDefault,
        });
        toast.success("Address saved.");
      } else {
        await apiClient.addCustomerAddress(workspaceId, customerId, {
          country: country.trim().toUpperCase(),
          province: province.trim() || undefined,
          city: city.trim(),
          addressLine: addressLine.trim(),
          postalCode: postalCode.trim() || undefined,
          notes: notes.trim() || undefined,
          isDefault,
        });
        toast.success("Address added.");
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
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Country"
          required
          value={country}
          onChange={(e) => setCountry(e.target.value)}
          error={fieldErrors.country}
          hint="Two-letter code."
        />
        <TextField
          label="Province"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
          error={fieldErrors.province}
        />
        <TextField
          label="City"
          required
          value={city}
          onChange={(e) => setCity(e.target.value)}
          error={fieldErrors.city}
        />
        <TextField
          label="Postal code"
          value={postalCode}
          onChange={(e) => setPostalCode(e.target.value)}
          error={fieldErrors.postalCode}
        />
      </div>
      <TextField
        label="Address line"
        required
        value={addressLine}
        onChange={(e) => setAddressLine(e.target.value)}
        error={fieldErrors.addressLine}
      />
      <Field label="Notes" error={fieldErrors.notes}>
        {({ id }) => (
          <Textarea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} />
        )}
      </Field>
      <label className="flex items-center gap-2 text-sm text-ink">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(e) => setIsDefault(e.target.checked)}
        />
        Default address
      </label>
      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={saving || !country.trim() || !city.trim() || !addressLine.trim()}
        >
          {saving ? "Saving…" : address ? "Save address" : "Add address"}
        </Button>
      </div>
    </form>
  );
}
