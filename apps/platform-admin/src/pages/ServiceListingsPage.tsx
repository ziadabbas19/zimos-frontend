import { useState, type FormEvent } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button } from "@store-builder/ui";
import {
  SERVICE_CATEGORIES,
  adminServiceListingsCreate,
  adminServiceListingsDelete,
  adminServiceListingsList,
  adminServiceListingsUpdate,
  type ServiceCategory,
  type ServiceListing,
  type ServiceListingPayload,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SelectField, TextAreaField, TextField } from "@/components/forms";
import { StatusBadge } from "@/components/StatusBadge";
import { Toggle } from "@/components/Toggle";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { P } from "@/lib/permissions";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import { apiClient } from "@/lib/apiClient";
import { formatMinorMoney, toMajorAmount, toMinorAmount } from "@/lib/format";

const CATEGORY_LABEL: Record<ServiceCategory, string> = {
  page_management: "Page management",
  landing_pages: "Landing pages",
  ugc: "UGC content",
  video: "Video",
  marketing: "Marketing",
  programming: "Programming",
  consulting: "Consulting",
  store_setup: "Store setup",
  design: "Design",
  accounting: "Accounting",
};

interface ListingForm {
  id?: string;
  category: ServiceCategory;
  title: string;
  titleAr: string;
  description: string;
  descriptionAr: string;
  providerName: string;
  providerLogoUrl: string;
  price: string;
  priceCurrency: string;
  priceUnit: string;
  contactWhatsapp: string;
  contactUrl: string;
  contactEmail: string;
  isActive: boolean;
  position: string;
}

function toForm(l?: ServiceListing): ListingForm {
  return {
    id: l?.id,
    category: l?.category ?? "marketing",
    title: l?.title ?? "",
    titleAr: l?.titleAr ?? "",
    description: l?.description ?? "",
    descriptionAr: l?.descriptionAr ?? "",
    providerName: l?.providerName ?? "",
    providerLogoUrl: l?.providerLogoUrl ?? "",
    price: l && l.priceAmount !== null ? String(toMajorAmount(Number(l.priceAmount), l.priceCurrency ?? "EGP")) : "",
    priceCurrency: l?.priceCurrency ?? "EGP",
    priceUnit: l?.priceUnit ?? "",
    contactWhatsapp: l?.contactWhatsapp ? `+${l.contactWhatsapp}` : "",
    contactUrl: l?.contactUrl ?? "",
    contactEmail: l?.contactEmail ?? "",
    isActive: l?.isActive ?? true,
    position: String(l?.position ?? 0),
  };
}

/** Services marketplace (SPEC §20.5): the providers directory merchants see under "Services". */
export function ServiceListingsPage() {
  const toast = useToast();
  const { can } = useAuth();
  const canManage = can(P.SERVICE_LISTINGS_MANAGE);
  const { data, loading, error, refresh, setData } = useAsync(() => adminServiceListingsList(apiClient), []);
  const [filter, setFilter] = useState<"all" | ServiceCategory>("all");
  const [editing, setEditing] = useState<ListingForm | null>(null);
  const [deleting, setDeleting] = useState<ServiceListing | null>(null);

  const listings = data ?? [];
  const shown = filter === "all" ? listings : listings.filter((l) => l.category === filter);
  const options = [
    { value: "all" as const, label: "All", count: listings.length },
    ...SERVICE_CATEGORIES.filter((key) => listings.some((l) => l.category === key)).map((key) => ({
      value: key,
      label: CATEGORY_LABEL[key],
      count: listings.filter((l) => l.category === key).length,
    })),
  ];

  return (
    <div>
      <PageHeader
        title="Service listings"
        description="The providers directory merchants see under Services. Payment between a merchant and a provider happens outside Zimos."
        actions={
          canManage && (
            <Button onClick={() => setEditing(toForm())} disabled={!data}>
              <Plus /> New listing
            </Button>
          )
        }
      />
      <DataState loading={loading} error={error} onRetry={() => void refresh()}>
        <FilterChips options={options} value={filter} onChange={setFilter} className="mb-4" />
        {shown.length === 0 ? (
          <EmptyBlock message={listings.length === 0 ? "No service listings yet." : "No listings in this category."} />
        ) : (
          <ul className="space-y-3">
            {shown.map((l) => (
              <li key={l.id} className="rounded-[var(--radius-card)] bg-paper-raised shadow-[var(--shadow-card)] ring-1 ring-line p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge tone={l.isActive ? "success" : "neutral"}>{l.isActive ? "Shown" : "Hidden"}</StatusBadge>
                  <StatusBadge tone="info">{CATEGORY_LABEL[l.category]}</StatusBadge>
                  <span className="text-xs text-ink-soft">Position {l.position}</span>
                  {canManage && (
                    <div className="ms-auto flex gap-1">
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${l.title}`} onClick={() => setEditing(toForm(l))}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Delete ${l.title}`} onClick={() => setDeleting(l)}>
                        <Trash2 className="text-danger" />
                      </Button>
                    </div>
                  )}
                </div>
                <p className="mt-2 font-semibold text-ink">{l.title}</p>
                <p className="text-sm text-ink-soft">
                  {l.providerName} ·{" "}
                  {l.priceAmount !== null && l.priceCurrency
                    ? `${formatMinorMoney(Number(l.priceAmount), l.priceCurrency)}${l.priceUnit ? ` · ${l.priceUnit}` : ""}`
                    : "Price on request"}
                </p>
                <p className="mt-1 line-clamp-2 text-sm text-ink-soft">{l.description}</p>
                <p className="mt-1 text-xs text-ink-soft">
                  {[l.contactWhatsapp && `WhatsApp +${l.contactWhatsapp}`, l.contactUrl, l.contactEmail].filter(Boolean).join(" · ")}
                </p>
              </li>
            ))}
          </ul>
        )}
      </DataState>

      {editing && (
        <ListingEditor
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setData((prev) => {
              const list = prev ?? [];
              return list.some((x) => x.id === saved.id) ? list.map((x) => (x.id === saved.id ? saved : x)) : [saved, ...list];
            });
            toast.success("Listing saved.");
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={!!deleting}
        title={`Delete “${deleting?.title ?? ""}”?`}
        description="Merchants stop seeing it immediately."
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminServiceListingsDelete(apiClient, deleting.id);
          setData((prev) => (prev ?? []).filter((x) => x.id !== deleting.id));
          toast.success("Listing deleted.");
          setDeleting(null);
        }}
      />
    </div>
  );
}

function ListingEditor({ initial, onClose, onSaved }: { initial: ListingForm; onClose: () => void; onSaved: (listing: ServiceListing) => void }) {
  const [form, setForm] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof ListingForm>(k: K, v: ListingForm[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.contactWhatsapp.trim() && !form.contactUrl.trim() && !form.contactEmail.trim()) {
      setError("Add a WhatsApp number, a link or an email so merchants can reach the provider.");
      return;
    }
    const price = form.price.trim() === "" ? null : Number(form.price);
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      setError("The price is not a valid amount.");
      return;
    }
    setBusy(true);
    setError(null);
    const currency = form.priceCurrency.trim().toUpperCase() || "EGP";
    const payload: ServiceListingPayload = {
      category: form.category,
      title: form.title.trim(),
      titleAr: form.titleAr.trim() || null,
      description: form.description.trim(),
      descriptionAr: form.descriptionAr.trim() || null,
      providerName: form.providerName.trim(),
      providerLogoUrl: form.providerLogoUrl.trim() || null,
      priceAmount: price === null ? null : toMinorAmount(price, currency),
      priceCurrency: price === null ? null : currency,
      priceUnit: form.priceUnit.trim() || null,
      contactWhatsapp: form.contactWhatsapp.trim() || null,
      contactUrl: form.contactUrl.trim() || null,
      contactEmail: form.contactEmail.trim() || null,
      isActive: form.isActive,
      position: Math.max(0, Math.floor(Number(form.position)) || 0),
    };
    try {
      onSaved(form.id ? await adminServiceListingsUpdate(apiClient, form.id, payload) : await adminServiceListingsCreate(apiClient, payload));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={form.id ? "Edit listing" : "New listing"}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="service-listing-form" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="service-listing-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <SelectField label="Category" value={form.category} onChange={(e) => set("category", e.target.value as ServiceCategory)}>
            {SERVICE_CATEGORIES.map((key) => (
              <option key={key} value={key}>
                {CATEGORY_LABEL[key]}
              </option>
            ))}
          </SelectField>
          <TextField label="Provider" required maxLength={200} value={form.providerName} onChange={(e) => set("providerName", e.target.value)} />
          <TextField label="Title (English)" required maxLength={200} value={form.title} onChange={(e) => set("title", e.target.value)} />
          <TextField label="Title (Arabic)" dir="rtl" maxLength={200} value={form.titleAr} onChange={(e) => set("titleAr", e.target.value)} />
        </div>
        <TextAreaField label="Description (English)" required maxLength={2000} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        <TextAreaField label="Description (Arabic)" dir="rtl" maxLength={2000} rows={3} value={form.descriptionAr} onChange={(e) => set("descriptionAr", e.target.value)} />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="Price" hint="Empty = price on request" inputMode="decimal" value={form.price} onChange={(e) => set("price", e.target.value)} />
          <TextField label="Currency" maxLength={3} value={form.priceCurrency} onChange={(e) => set("priceCurrency", e.target.value)} />
          <TextField label="Unit" hint="e.g. per month" maxLength={60} value={form.priceUnit} onChange={(e) => set("priceUnit", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TextField label="WhatsApp" type="tel" maxLength={32} value={form.contactWhatsapp} onChange={(e) => set("contactWhatsapp", e.target.value)} />
          <TextField label="Link" type="url" maxLength={1000} value={form.contactUrl} onChange={(e) => set("contactUrl", e.target.value)} />
          <TextField label="Email" type="email" maxLength={255} value={form.contactEmail} onChange={(e) => set("contactEmail", e.target.value)} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField label="Logo URL" type="url" maxLength={1000} value={form.providerLogoUrl} onChange={(e) => set("providerLogoUrl", e.target.value)} />
          <TextField label="Position" hint="Lower shows first" type="number" min={0} value={form.position} onChange={(e) => set("position", e.target.value)} />
        </div>
        <Toggle checked={form.isActive} onChange={(next) => set("isActive", next)} label="Shown to merchants" />
      </form>
    </Modal>
  );
}
