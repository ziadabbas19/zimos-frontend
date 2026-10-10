import { useState, type FormEvent } from "react";
import { Alert, Button } from "@store-builder/ui";
import { isApiErrorCode, type CreateWebsitePagePayload, type WebsitePage } from "@store-builder/api-client";
import { Modal } from "@/components/Modal";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    title: "New page",
    description: "Adds a page to this site with a few example blocks — a title, some text, a picture and a button — for you to edit or remove.",
    cancel: "Cancel",
    create: "Create page",
    creating: "Creating…",
    pageTitle: "Title",
    pageTitleHint: "Shown in the editor's page list.",
    path: "Address",
    pathHint: "Where the page lives on your store, e.g. /about. English letters, numbers and dashes.",
    pathInvalid: "Use an address like /about — English letters, numbers and dashes.",
    pageType: "Page type",
    typeCustom: "Custom",
    typeStatic: "Static (About, Contact…)",
    typeProduct: "Product",
    typeCollection: "Collection",
    typeBlogPost: "Blog post",
    typeCart: "Cart",
    typeHome: "Home",
  },
  ar: {
    title: "صفحة جديدة",
    description: "سنضيف إلى الموقع صفحة فيها بعض العناصر كمثال — عنوان ونص وصورة وزر — تعدّلها أو تحذفها كما تريد.",
    cancel: "إلغاء",
    create: "إنشاء الصفحة",
    creating: "جارٍ الإنشاء…",
    pageTitle: "اسم الصفحة",
    pageTitleHint: "يظهر في قائمة الصفحات داخل المحرر.",
    path: "عنوان الصفحة",
    pathHint: "مكان الصفحة في متجرك، مثل /about. حروف إنجليزية وأرقام وشرطة.",
    pathInvalid: "اكتب عنوانًا مثل /about — حروف إنجليزية وأرقام وشرطة.",
    pageType: "نوع الصفحة",
    typeCustom: "صفحة حرة",
    typeStatic: "ثابتة (من نحن، اتصل بنا…)",
    typeProduct: "منتج",
    typeCollection: "مجموعة",
    typeBlogPost: "مقال",
    typeCart: "السلة",
    typeHome: "الرئيسية",
  },
} satisfies Messages;

type PageTypeLabel = "typeCustom" | "typeStatic" | "typeProduct" | "typeCollection" | "typeBlogPost" | "typeCart" | "typeHome";

/** The backend's pageType enum, minus nothing — all seven are selectable. */
const PAGE_TYPES: { value: WebsitePage["pageType"]; label: PageTypeLabel }[] = [
  { value: "custom", label: "typeCustom" },
  { value: "static", label: "typeStatic" },
  { value: "product", label: "typeProduct" },
  { value: "collection", label: "typeCollection" },
  { value: "blog_post", label: "typeBlogPost" },
  { value: "cart", label: "typeCart" },
  { value: "home", label: "typeHome" },
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
  const t = useT(STRINGS);
  const [title, setTitle] = useState("");
  const [path, setPath] = useState("");
  // Once the merchant edits the path themselves, stop overwriting it from the title.
  const [pathTouched, setPathTouched] = useState(false);
  const [pageType, setPageType] = useState<WebsitePage["pageType"]>("custom");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const errorMessage = useErrorMessage();

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

  // An Arabic title gives no address by itself (addresses are English letters): the merchant types one.
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
      // A reserved path (/cart, /checkout…) belongs under the path field, in
      // our own words rather than the server's.
      if (isApiErrorCode(err, "PAGE_PATH_RESERVED") || isApiErrorCode(err, "PAGE_PATH_IN_TRASH")) {
        setFieldErrors({ path: errorMessage(err) });
        return;
      }
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
      title={t.title}
      description={t.description}
      footer={
        <>
          <Button variant="outline" onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          <Button onClick={(e) => void submit(e)} disabled={!canSubmit}>
            {busy ? t.creating : t.create}
          </Button>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        {error && <Alert variant="danger">{error}</Alert>}

        <TextField
          label={t.pageTitle}
          required
          autoFocus
          dir="auto"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          hint={t.pageTitleHint}
        />

        <TextField
          label={t.path}
          required
          dir="ltr"
          value={effectivePath}
          onChange={(e) => {
            setPathTouched(true);
            setPath(e.target.value);
          }}
          error={fieldErrors.path ?? (effectivePath && !pathValid ? t.pathInvalid : undefined)}
          hint={t.pathHint}
        />

        <Field label={t.pageType} error={fieldErrors.pageType}>
          {({ id, ...aria }) => (
            <Select
              id={id}
              {...aria}
              value={pageType}
              onChange={(e) => setPageType(e.target.value as WebsitePage["pageType"])}
            >
              {PAGE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {t[type.label]}
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
