import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import type { CreateWebsitePagePayload, WebsitePage } from "@store-builder/api-client";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";

/** The backend's pageType enum, minus nothing — all seven are selectable. */
const PAGE_TYPES: { value: WebsitePage["pageType"]; label: string }[] = [
  { value: "custom", label: "Custom" },
  { value: "static", label: "Static (About, Contact…)" },
  { value: "product", label: "Product" },
  { value: "collection", label: "Collection" },
  { value: "blog_post", label: "Blog post" },
  { value: "cart", label: "Cart" },
  { value: "home", label: "Home" },
];

/** "Our Story" -> "/our-story". Leading slash, lowercase, no double dashes. */
function slugifyPath(title: string): string {
  const slug = title
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[\s-]+/g, "-")
    .replace(/^-|-$/g, "");
  return slug ? `/${slug}` : "";
}

export function NewPageDialog({
  open,
  onClose,
  onCreate,
}: {
  open: boolean;
  onClose: () => void;
  /** Throw to keep the dialog open with the error shown inline. */
  onCreate: (payload: CreateWebsitePagePayload) => Promise<void>;
}) {
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  // Once the merchant edits the path themselves, stop overwriting it from the title.
  const [pathTouched, setPathTouched] = useState(false);
  const [pageType, setPageType] = useState<WebsitePage["pageType"]>("custom");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function reset() {
    setTitle("");
    setPath("");
    setPathTouched(false);
    setPageType("custom");
    setError(null);
    setFieldErrors({});
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  const effectivePath = pathTouched ? path : slugifyPath(title);
  const pathValid = /^\/[a-z0-9\-/]*$/i.test(effectivePath);
  const canSubmit = title.trim().length > 0 && effectivePath.length > 0 && pathValid && !busy;

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setFieldErrors({});
    try {
      await onCreate({ title: title.trim(), path: effectivePath, pageType });
      reset();
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="New page"
      description="Adds an empty page to this site. You can add blocks to it right away."
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={(e) => void submit(e)} disabled={!canSubmit}>
            {busy ? "Creating…" : "Create page"}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <TextField
          label="Title"
          required
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          hint="Shown in the editor's page switcher."
        />

        <TextField
          label="Path"
          required
          value={effectivePath}
          onChange={(e) => {
            setPathTouched(true);
            setPath(e.target.value);
          }}
          error={
            fieldErrors.path ??
            (effectivePath && !pathValid ? "Use a path like /about — letters, numbers and dashes." : undefined)
          }
          hint="The URL this page lives at, e.g. /about."
        />

        <Field label="Page type" error={fieldErrors.pageType}>
          {({ id, ...aria }) => (
            <Select
              id={id}
              {...aria}
              value={pageType}
              onChange={(e) => setPageType(e.target.value as WebsitePage["pageType"])}
            >
              {PAGE_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          )}
        </Field>

        {/* Lets Enter submit the form without a visible duplicate button. */}
        <button type="submit" className="cursor-pointer hidden" tabIndex={-1} aria-hidden />
      </form>
    </Modal>
  );
}
