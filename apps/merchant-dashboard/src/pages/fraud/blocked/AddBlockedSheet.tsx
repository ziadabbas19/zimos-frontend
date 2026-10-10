import { useEffect, useId, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  BLOCKED_ENTRY_SCOPES,
  BLOCKED_ENTRY_TYPES,
  apiFieldProblems,
  protectionAddBlocked,
  type BlockedEntryScope,
  type BlockedEntryType,
} from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { useToast } from "@/components/Toast";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { BLOCKED_STRINGS, isolate } from "./blockedText";

/**
 * «ضيف»: block a phone, an IP, an email, a device or a name and address, from
 * one or more things. The form opens in a sheet over the list (a bottom sheet
 * on the phone) with its two buttons pinned under it. The sheet is a `Modal`:
 * the same pane, and it asks before a half-typed entry is thrown away by a
 * stray tap outside.
 */
export function AddBlockedSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  const t = useT(BLOCKED_STRINGS);
  const workspaceId = useWorkspaceId();
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const [type, setType] = useState<BlockedEntryType>("phone");
  const [value, setValue] = useState("");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [scopes, setScopes] = useState<BlockedEntryScope[]>(["orders"]);
  const [reason, setReason] = useState("");
  const [problems, setProblems] = useState<{ value?: string; name?: string; address?: string; scopes?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType("phone");
    setValue("");
    setName("");
    setAddress("");
    setScopes(["orders"]);
    setReason("");
    setProblems({});
    setError(null);
  }, [open]);

  function toggleScope(key: BlockedEntryScope) {
    setScopes((prev) => (prev.includes(key) ? prev.filter((s) => s !== key) : [...prev, key]));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    const next: typeof problems = {};
    if (type === "name_address") {
      if (!name.trim()) next.name = t.valueRequired;
      if (!address.trim()) next.address = t.valueRequired;
    } else if (!value.trim()) next.value = t.valueRequired;
    if (scopes.length === 0) next.scopes = t.scopeRequired;
    setProblems(next);
    setError(null);
    if (Object.keys(next).length > 0) return;

    setBusy(true);
    try {
      const [entry] = await protectionAddBlocked(apiClient, workspaceId, {
        type,
        ...(type === "name_address" ? { name: name.trim(), address: address.trim() } : { value: value.trim() }),
        scopes,
        ...(reason.trim().length >= 2 ? { reason: reason.trim() } : {}),
      });
      toast.success(fmt(t.added, { value: isolate(entry.label) }));
      onAdded();
    } catch (err) {
      const field = apiFieldProblems(err)[0]?.field;
      if (field === "value") setProblems({ value: t[`valueInvalid_${type}`] });
      else if (field === "name") setProblems({ name: t.valueInvalid_name_address });
      else setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.addTitle}
      description={t.addDescription}
      footer={
        <>
          <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} noValidate className="space-y-4">
        <Field label={t.what}>
          {(props) => (
            <Select
              {...props}
              className="h-11"
              value={type}
              onChange={(e) => {
                setType(e.target.value as BlockedEntryType);
                setProblems({});
              }}
            >
              {BLOCKED_ENTRY_TYPES.map((key) => (
                <option key={key} value={key}>
                  {t[`type_${key}`]}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {type === "name_address" ? (
          <>
            <TextField
              label={t.name}
              required
              dir="auto"
              maxLength={200}
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={problems.name}
            />
            <TextField
              label={t.address}
              required
              dir="auto"
              maxLength={500}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              error={problems.address}
              hint={t.nameAddressHint}
            />
          </>
        ) : (
          <TextField
            label={t[`value_${type}`]}
            required
            dir="ltr"
            autoComplete="off"
            inputMode={type === "phone" ? "tel" : type === "email" ? "email" : "text"}
            maxLength={255}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            error={problems.value}
          />
        )}

        <fieldset className="space-y-1">
          <legend className="text-sm font-medium text-ink">{t.blockFrom}</legend>
          <div className="flex flex-wrap gap-x-5">
            {BLOCKED_ENTRY_SCOPES.map((key) => (
              <label key={key} className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink">
                <input
                  type="checkbox"
                  className="size-5 shrink-0 cursor-pointer accent-[var(--color-primary)]"
                  checked={scopes.includes(key)}
                  onChange={() => toggleScope(key)}
                />
                {t[`scope_${key}`]}
              </label>
            ))}
          </div>
          {problems.scopes && <p className="text-xs font-medium text-danger">{problems.scopes}</p>}
        </fieldset>

        <TextField
          label={t.reason}
          dir="auto"
          maxLength={300}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t.reasonPlaceholder}
        />

        {error && <Alert variant="danger">{error}</Alert>}
      </form>
    </Modal>
  );
}
