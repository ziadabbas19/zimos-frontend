import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { isApiErrorCode, type UpdateWebsitePagePayload, type WebsitePage } from "@store-builder/api-client";
import { Field, TextField } from "@/components/Field";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { getErrorMessage } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { SwitchRow } from "./inspector/controls";
import { addressProblem, pathOfSlug, slugOfPath, type AddressProblem } from "./pageAddress";

const STRINGS = {
  en: {
    title: "Page details",
    name: "Page name",
    address: "Page address",
    addressHint: "Your page opens at {path}",
    moved: "People who open the old address will be sent to the new one.",
    showHeader: "Show in the header menu",
    showFooter: "Show in the footer",
    search: "On Google",
    searchTitle: "Title on Google",
    searchDescription: "Description on Google",
    count: "{n} of {max} characters",
    cancel: "Cancel",
    save: "Save",
    saving: "Saving…",
    empty: "Write an address for this page.",
    format: "Use small English letters, numbers and dashes only.",
    reserved: "Your store uses this address for one of its own pages. Choose another one.",
    taken: "Another page already uses this address.",
  },
  ar: {
    title: "تفاصيل الصفحة",
    name: "اسم الصفحة",
    address: "عنوان الصفحة",
    addressHint: "ستفتح صفحتك على {path}",
    moved: "من يفتح العنوان القديم سينتقل تلقائيا إلى العنوان الجديد.",
    showHeader: "إظهارها في القائمة العلوية",
    showFooter: "إظهارها في أسفل المتجر",
    search: "على جوجل",
    searchTitle: "العنوان على جوجل",
    searchDescription: "الوصف على جوجل",
    count: "{n} من {max} حرف",
    cancel: "إلغاء",
    save: "حفظ",
    saving: "جار الحفظ…",
    empty: "اكتب عنوانا لهذه الصفحة.",
    format: "استخدم حروفا إنجليزية صغيرة وأرقاما وشرطات فقط.",
    reserved: "متجرك يستخدم هذا العنوان لإحدى صفحاته الأساسية. اختر عنوانا آخر.",
    taken: "هناك صفحة أخرى تستخدم هذا العنوان.",
  },
} satisfies Messages;

const text = (value: unknown) => (typeof value === "string" ? value : "");

/** A page's name, address, place in the menus and how it reads on Google, in one place. */
export function PageDetailsDialog({
  page,
  takenPaths,
  onSave,
  onClose,
}: {
  page: WebsitePage;
  /** The addresses of the site's other pages. */
  takenPaths: readonly string[];
  /** Throw to keep the dialog open with the error shown inline. */
  onSave: (patch: UpdateWebsitePagePayload) => Promise<void>;
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  const home = page.pageType === "home";
  const seo = (page.seo ?? {}) as Record<string, unknown>;
  const [name, setName] = useState(page.title);
  const [slug, setSlug] = useState(slugOfPath(page.path));
  const [showHeader, setShowHeader] = useState(page.showInHeader === true);
  const [showFooter, setShowFooter] = useState(page.showInFooter === true);
  const [searchTitle, setSearchTitle] = useState(text(seo.title));
  const [searchDescription, setSearchDescription] = useState(text(seo.description));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverProblem, setServerProblem] = useState<AddressProblem | null>(null);

  const problem = home ? null : (serverProblem ?? addressProblem(slug, takenPaths, page.path));
  const moved = !home && pathOfSlug(slug) !== page.path;
  const canSave = name.trim().length > 0 && problem === null && !busy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSave) return;
    const patch: UpdateWebsitePagePayload = {};
    if (name.trim() !== page.title) patch.title = name.trim();
    if (moved) patch.path = pathOfSlug(slug);
    if (!home && showHeader !== (page.showInHeader === true)) patch.showInHeader = showHeader;
    if (!home && showFooter !== (page.showInFooter === true)) patch.showInFooter = showFooter;
    if (searchTitle.trim() !== text(seo.title) || searchDescription.trim() !== text(seo.description)) {
      patch.seo = { ...seo, title: searchTitle.trim(), description: searchDescription.trim() };
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave(patch);
      onClose();
    } catch (err) {
      if (isApiErrorCode(err, "PAGE_PATH_RESERVED")) setServerProblem("reserved");
      else if (isApiErrorCode(err, "PAGE_PATH_TAKEN") || isApiErrorCode(err, "PAGE_PATH_IN_TRASH")) setServerProblem("taken");
      else setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!busy) onClose();
      }}
      title={t.title}
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={onClose} disabled={busy}>
            {t.cancel}
          </Button>
          <Button className="min-h-11" onClick={(event) => void submit(event)} disabled={!canSave}>
            {busy ? t.saving : t.save}
          </Button>
        </>
      }
    >
      <form data-editor-dialog data-slot="page-details" onSubmit={(event) => void submit(event)} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}
        <TextField label={t.name} required autoFocus dir="auto" maxLength={200} value={name} onChange={(event) => setName(event.target.value)} />
        {!home && (
          <>
            <TextField
              label={t.address}
              required
              dir="ltr"
              maxLength={120}
              value={slug}
              onChange={(event) => {
                setServerProblem(null);
                setSlug(event.target.value);
              }}
              error={problem ? t[problem] : undefined}
              hint={slug ? fmt(t.addressHint, { path: pathOfSlug(slug) }) : undefined}
            />
            {moved && page.isLive && problem === null && (
              <p role="status" data-slot="page-moved-note" className="text-sm leading-6 text-ink">
                {t.moved}
              </p>
            )}
            <div className="space-y-1">
              <SwitchRow label={t.showHeader} checked={showHeader} onChange={setShowHeader} />
              <SwitchRow label={t.showFooter} checked={showFooter} onChange={setShowFooter} />
            </div>
          </>
        )}
        <fieldset className="min-w-0 space-y-3 border-t border-line pt-4">
          <legend className="pe-2 text-sm font-semibold text-ink">{t.search}</legend>
          <TextField
            label={t.searchTitle}
            dir="auto"
            maxLength={300}
            value={searchTitle}
            onChange={(event) => setSearchTitle(event.target.value)}
            hint={fmt(t.count, { n: searchTitle.length, max: 70 })}
          />
          <Field label={t.searchDescription} hint={fmt(t.count, { n: searchDescription.length, max: 160 })}>
            {({ id }) => <Textarea id={id} dir="auto" rows={3} maxLength={1000} value={searchDescription} onChange={(event) => setSearchDescription(event.target.value)} />}
          </Field>
        </fieldset>
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
      </form>
    </Modal>
  );
}
