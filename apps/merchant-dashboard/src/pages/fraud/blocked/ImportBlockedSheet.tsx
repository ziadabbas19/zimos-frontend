import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import {
  BLOCKED_ENTRY_SCOPES,
  BLOCKED_ENTRY_TYPES,
  apiFieldProblems,
  protectionImportBlocked,
  type BlockedEntryImportResult,
  type BlockedEntryScope,
  type BlockedEntryType,
} from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Select } from "@/components/Select";
import { fmt, useT } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { useErrorMessage } from "@/lib/errorMessages";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { BLOCKED_STRINGS } from "./blockedText";

const MAX_IMPORT_BYTES = 1024 * 1024;

/**
 * «استورد»: a CSV of entries to block, with the type and the scope used for
 * the rows that name none. The same sheet then says what happened — how many
 * were added, were already there or were skipped, and why each skipped line was.
 */
export function ImportBlockedSheet({ open, onClose, onImported }: { open: boolean; onClose: () => void; onImported: () => void }) {
  const t = useT(BLOCKED_STRINGS);
  const workspaceId = useWorkspaceId();
  const errorMessage = useErrorMessage();
  const formId = useId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<BlockedEntryType>("phone");
  const [scope, setScope] = useState<BlockedEntryScope>("orders");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BlockedEntryImportResult | null>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setResult(null);
  }, [open]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    const file = fileRef.current?.files?.[0];
    setError(null);
    if (!file) return setError(t.chooseFile);
    if (file.size > MAX_IMPORT_BYTES) return setError(t.fileTooBig);
    setBusy(true);
    try {
      const csv = await file.text();
      const done = await protectionImportBlocked(apiClient, workspaceId, { csv, type, scope });
      setResult(done);
      onImported();
    } catch (err) {
      setError(apiFieldProblems(err)[0]?.message ?? errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t.importTitle}
      description={t.importDescription}
      footer={
        result ? (
          <Button type="button" className="rounded-full px-5" onClick={onClose}>
            {t.close}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" className="rounded-full px-5" onClick={onClose} disabled={busy}>
              {t.cancel}
            </Button>
            <Button type="submit" form={formId} className="rounded-full px-5" disabled={busy}>
              {busy ? t.importing : t.runImport}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <Alert variant="success">
            {fmt(t.importDone, { imported: result.imported, updated: result.updated, skipped: result.skipped })}
          </Alert>
          {result.errors.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-ink">{t.importErrors}</p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-ink-soft">
                {result.errors.map((problem) => (
                  <li key={problem.line}>{fmt(t.line, { n: problem.line, message: problem.message })}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <form id={formId} onSubmit={submit} noValidate className="space-y-4">
          <Field label={t.file} required>
            {(props) => (
              <input
                {...props}
                ref={fileRef}
                type="file"
                accept=".csv,text/csv,text/plain"
                className="block min-h-11 w-full text-sm text-ink file:me-3 file:min-h-11 file:cursor-pointer file:rounded-full file:border file:border-line file:bg-paper file:px-4 file:text-sm file:font-medium file:text-ink"
              />
            )}
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t.defaultType}>
              {(props) => (
                <Select {...props} className="h-11" value={type} onChange={(e) => setType(e.target.value as BlockedEntryType)}>
                  {BLOCKED_ENTRY_TYPES.filter((key) => key !== "name_address").map((key) => (
                    <option key={key} value={key}>
                      {t[`type_${key}`]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <Field label={t.defaultScope}>
              {(props) => (
                <Select {...props} className="h-11" value={scope} onChange={(e) => setScope(e.target.value as BlockedEntryScope)}>
                  {BLOCKED_ENTRY_SCOPES.map((key) => (
                    <option key={key} value={key}>
                      {t[`scope_${key}`]}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
        </form>
      )}
    </Modal>
  );
}
