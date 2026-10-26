import { useEffect, useState, type FormEvent } from "react";
import { Ban, Pencil, Plus, Trash2 } from "lucide-react";
import { Alert, Button, Table, TableBody, TableHeader, TableRow } from "@store-builder/ui";
import type {
  AdminBlocklistEntry as Entry,
  AdminBlockPayload,
  AdminBlockResult,
  AdminRiskIdentifierType as IdentifierType,
} from "@store-builder/api-client";
import { PageHeader } from "@/components/PageHeader";
import { DataState, EmptyBlock, ListSkeleton } from "@/components/DataState";
import { Modal } from "@/components/Modal";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { FilterChips, SearchInput, SelectField, TextAreaField, TextField } from "@/components/forms";
import { Mono, Panel, Td, Th } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { useToast } from "@/components/Toast";
import { useAsync } from "@/lib/useAsync";
import { getErrorMessage } from "@/lib/errors";
import * as adminApi from "@/lib/adminApi";
import { formatDateTime, formatRelative, toDateTimeInput } from "@/lib/format";

type TypeFilter = "all" | IdentifierType;
type StatusFilter = "all" | "active" | "expired";

const TYPE_LABEL: Record<IdentifierType, string> = { phone: "Phone", email: "Email", address: "Address" };

const TYPE_OPTIONS: Array<{ value: TypeFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "phone", label: "Phones" },
  { value: "email", label: "Emails" },
  { value: "address", label: "Addresses" },
];

const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "Any status" },
  { value: "active", label: "Active" },
  { value: "expired", label: "Expired" },
];

/** Waits for typing to pause before the search hits the server. */
function useDebounced<T>(value: T, ms = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

/** datetime-local (local time) -> ISO, or null for "never". */
function fromDateTimeInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null;
}

export function BlocklistPage() {
  const toast = useToast();
  const [type, setType] = useState<TypeFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const q = useDebounced(query.trim());
  // The page belongs to the filters it was chosen under: any filter change
  // starts again from the first page.
  const filterKey = [type, status, q].join("|");
  const [page, setPage] = useState({ key: filterKey, offset: 0 });
  const offset = page.key === filterKey ? page.offset : 0;
  const setOffset = (next: number) => setPage({ key: filterKey, offset: next });

  const { data, loading, error, refresh } = useAsync(
    () =>
      adminApi.listBlocklist({
        type: type === "all" ? undefined : type,
        status,
        q: q || undefined,
        offset,
      }),
    [type, status, q, offset]
  );

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Entry | null>(null);
  const [deleting, setDeleting] = useState<Entry | null>(null);

  const entries = data?.entries ?? [];
  const total = data?.total ?? 0;
  const limit = data?.limit ?? adminApi.RISK_PAGE_SIZE;
  const filtered = type !== "all" || status !== "all" || q !== "";

  return (
    <div>
      <PageHeader
        title="Blocklist"
        description="Phones, emails and addresses blocked from ordering in every workspace."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus /> Block identifier
          </Button>
        }
      />

      <Alert className="mb-4">
        A match works exactly like a store's own blocklist: the order is flagged as a blocked customer, and stores
        whose fraud rules refuse blocked customers refuse it. Nothing is changed in the store's own customer list.
      </Alert>

      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <FilterChips options={TYPE_OPTIONS} value={type} onChange={setType} />
          <FilterChips options={STATUS_OPTIONS} value={status} onChange={setStatus} />
        </div>
        <SearchInput value={query} onChange={setQuery} placeholder="Search phone, email, address or reason" />
      </div>

      <DataState skeleton={<ListSkeleton variant="table" />} loading={loading && !data} error={error} onRetry={() => void refresh()}>
        {entries.length === 0 ? (
          <EmptyBlock message={filtered ? "No entries match these filters." : "Nothing is blocked platform-wide."} />
        ) : (
          <Panel flush>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <Th>Identifier</Th>
                  <Th>Reason</Th>
                  <Th>Expires</Th>
                  <Th>Added</Th>
                  <Th>Status</Th>
                  <Th className="text-end">
                    <span className="sr-only">Actions</span>
                  </Th>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id}>
                    <Td className="max-w-80">
                      <div className="flex items-center gap-2">
                        <StatusBadge tone="neutral">{TYPE_LABEL[entry.type]}</StatusBadge>
                        <span className="truncate font-medium" title={entry.label}>
                          {entry.label}
                        </span>
                      </div>
                      {entry.type === "phone" && entry.value !== entry.label && (
                        <Mono className="mt-1 inline-block">{entry.value}</Mono>
                      )}
                    </Td>
                    <Td className="max-w-72">
                      <span className="line-clamp-2 text-sm">{entry.reason}</span>
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      {entry.expiresAt ? formatDateTime(entry.expiresAt) : <span className="text-ink-soft">Never</span>}
                    </Td>
                    <Td className="whitespace-nowrap text-sm">
                      <span title={formatDateTime(entry.createdAt)}>{formatRelative(entry.createdAt)}</span>
                      <span className="block text-xs text-ink-soft">{entry.createdBy ?? "Deleted user"}</span>
                    </Td>
                    <Td>
                      <StatusBadge tone={entry.status === "active" ? "danger" : "neutral"} dot>
                        {entry.status === "active" ? "Blocking" : "Expired"}
                      </StatusBadge>
                    </Td>
                    <Td className="text-end whitespace-nowrap">
                      <Button size="icon-sm" variant="ghost" aria-label={`Edit ${entry.label}`} onClick={() => setEditing(entry)}>
                        <Pencil />
                      </Button>
                      <Button size="icon-sm" variant="ghost" aria-label={`Unblock ${entry.label}`} onClick={() => setDeleting(entry)}>
                        <Trash2 className="text-danger" />
                      </Button>
                    </Td>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Panel>
        )}
        <Pager total={total} limit={limit} offset={offset} onOffset={setOffset} />
      </DataState>

      {creating && (
        <BlockModal
          onClose={() => setCreating(false)}
          onSaved={(result) => {
            toast.success(result.created ? "Identifier blocked." : "Already blocked — reason and expiry updated.");
            setCreating(false);
            void refresh({ silent: true });
          }}
        />
      )}
      {editing && (
        <EditModal
          entry={editing}
          onClose={() => setEditing(null)}
          onSaved={() => {
            toast.success("Blocklist entry updated.");
            setEditing(null);
            void refresh({ silent: true });
          }}
        />
      )}
      <ConfirmDialog
        open={!!deleting}
        title={`Unblock ${deleting?.label ?? ""}?`}
        description="New orders with this identifier will no longer be flagged or refused. Orders already flagged keep their flag."
        confirmLabel="Unblock"
        destructive
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (!deleting) return;
          await adminApi.deleteBlocklistEntry(deleting.id);
          toast.success("Identifier unblocked.");
          setDeleting(null);
          void refresh({ silent: true });
        }}
      />
    </div>
  );
}

/** Previous / next over a server-paged list, with "1–50 of 120". */
export function Pager({
  total,
  limit,
  offset,
  onOffset,
}: {
  total: number;
  limit: number;
  offset: number;
  onOffset: (offset: number) => void;
}) {
  if (total <= limit && offset === 0) return null;
  const first = total === 0 ? 0 : offset + 1;
  const last = Math.min(offset + limit, total);
  return (
    <div className="mt-3 flex items-center justify-between gap-3 text-sm text-ink-soft">
      <span className="tabular">
        {first}–{last} of {total}
      </span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={offset === 0} onClick={() => onOffset(Math.max(0, offset - limit))}>
          Previous
        </Button>
        <Button size="sm" variant="outline" disabled={offset + limit >= total} onClick={() => onOffset(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}

function BlockModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (result: AdminBlockResult) => void;
}) {
  const [type, setType] = useState<IdentifierType>("phone");
  const [value, setValue] = useState("");
  const [address, setAddress] = useState({ country: "EG", province: "", city: "", addressLine: "" });
  const [reason, setReason] = useState("");
  const [expires, setExpires] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const payload: AdminBlockPayload = {
      type,
      reason: reason.trim(),
      expiresAt: fromDateTimeInput(expires),
      ...(type === "address" ? { address } : { value: value.trim() }),
    };
    try {
      onSaved(await adminApi.blockIdentifier(payload));
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Block an identifier"
      description="Applies to new orders in every workspace."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="block-form" disabled={busy}>
            <Ban /> {busy ? "Blocking…" : "Block"}
          </Button>
        </>
      }
    >
      <form id="block-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <SelectField label="Type" value={type} onChange={(e) => setType(e.target.value as IdentifierType)}>
          <option value="phone">Phone number</option>
          <option value="email">Email address</option>
          <option value="address">Shipping address</option>
        </SelectField>
        {type === "phone" && (
          <TextField
            label="Phone"
            required
            inputMode="tel"
            placeholder="01012345678"
            hint="Any format — it is matched on the normalized number, like the stores' own blocklists."
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        )}
        {type === "email" && (
          <TextField label="Email" required type="email" value={value} onChange={(e) => setValue(e.target.value)} />
        )}
        {type === "address" && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <TextField
                label="Country code"
                required
                maxLength={2}
                value={address.country}
                onChange={(e) => setAddress({ ...address, country: e.target.value.toUpperCase() })}
              />
              <TextField label="Province" value={address.province} onChange={(e) => setAddress({ ...address, province: e.target.value })} />
            </div>
            <TextField label="City" required value={address.city} onChange={(e) => setAddress({ ...address, city: e.target.value })} />
            <TextField
              label="Street address"
              required
              hint="Matched on country, city and street, ignoring spacing, punctuation and common Arabic spelling variants."
              value={address.addressLine}
              onChange={(e) => setAddress({ ...address, addressLine: e.target.value })}
            />
          </div>
        )}
        <TextAreaField
          label="Reason"
          required
          maxLength={300}
          rows={2}
          hint="Recorded in the audit log. Never shown to the buyer or the store."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <TextField
          label="Expires"
          type="datetime-local"
          hint="Leave empty to block until someone unblocks it."
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
        />
      </form>
    </Modal>
  );
}

function EditModal({ entry, onClose, onSaved }: { entry: Entry; onClose: () => void; onSaved: () => void }) {
  const [reason, setReason] = useState(entry.reason);
  const [expires, setExpires] = useState(toDateTimeInput(entry.expiresAt));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await adminApi.updateBlocklistEntry(entry.id, { reason: reason.trim(), expiresAt: fromDateTimeInput(expires) });
      onSaved();
    } catch (err) {
      setError(getErrorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title="Edit blocklist entry"
      description={`${TYPE_LABEL[entry.type]}: ${entry.label}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button type="submit" form="edit-block-form" disabled={busy}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </>
      }
    >
      <form id="edit-block-form" onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextAreaField label="Reason" required maxLength={300} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
        <TextField
          label="Expires"
          type="datetime-local"
          hint="Leave empty to block until someone unblocks it. An expired entry is reactivated by setting a future date."
          value={expires}
          onChange={(e) => setExpires(e.target.value)}
        />
      </form>
    </Modal>
  );
}
