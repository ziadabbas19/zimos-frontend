import { useState, type FormEvent } from "react";
import { Alert, Button, cn } from "@store-builder/ui";
import { isApiErrorCode, type CreateWebsitePagePayload } from "@store-builder/api-client";
import { TextField } from "@/components/Field";
import { IconInfo, IconLaunch, IconMessage, IconPage, IconProducts, IconSearch, type IconComponent } from "@/components/icons";
import { Modal } from "@/components/Modal";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import type { EditorLocale } from "./editorLocale";
import { SwitchRow } from "./inspector/controls";
import { addressProblem, pathOfSlug, slugFromName, type AddressProblem } from "./pageAddress";
import { PAGE_STARTERS, starterPageType, starterSections, type PageStarter } from "./pageStarters";

const STRINGS = {
  en: {
    title: "Add a page",
    description: "Choose how the page starts. You can change everything later.",
    startFrom: "Start from",
    blank: "Blank page",
    blankNote: "An empty page to fill yourself.",
    products: "Products page",
    productsNote: "All your products, ready to browse.",
    about: "About",
    aboutNote: "Your story and what makes you different.",
    contact: "Contact",
    contactNote: "A message form, your address and a map.",
    faq: "Questions",
    faqNote: "Common questions and their answers.",
    landing: "Landing page",
    landingNote: "A full page for one offer or product.",
    name: "Page name",
    nameHint: "Shoppers see this name in your menu.",
    address: "Page address",
    addressHint: "Your page opens at {path}",
    showHeader: "Show in the header menu",
    showFooter: "Show in the footer",
    productsTitle: "Your products page is ready",
    productsBody: "Your store already has a products page at /products, with filters, search and sorting. Add it to your menu in one click.",
    inMenu: "It's already in your menu.",
    menuFull: "Your menu is full. Remove a link from the header first.",
    addToMenu: "Add to menu",
    cancel: "Cancel",
    create: "Add page",
    creating: "Adding…",
    empty: "Write an address for this page.",
    format: "Use small English letters, numbers and dashes only.",
    reserved: "Your store uses this address for one of its own pages. Choose another one.",
    taken: "Another page already uses this address.",
  },
  ar: {
    title: "إضافة صفحة",
    description: "اختر طريقة بداية الصفحة. يمكنك تغيير كل شيء لاحقا.",
    startFrom: "ابدأ من",
    blank: "صفحة فارغة",
    blankNote: "صفحة خالية تملؤها بنفسك.",
    products: "صفحة المنتجات",
    productsNote: "كل منتجاتك جاهزة للتصفح.",
    about: "من نحن",
    aboutNote: "قصتك وما يميزك عن غيرك.",
    contact: "تواصل معنا",
    contactNote: "نموذج رسالة وعنوانك وخريطة.",
    faq: "الأسئلة الشائعة",
    faqNote: "الأسئلة المتكررة وإجاباتها.",
    landing: "صفحة هبوط",
    landingNote: "صفحة كاملة لعرض أو منتج واحد.",
    name: "اسم الصفحة",
    nameHint: "يظهر هذا الاسم للعملاء في القائمة.",
    address: "عنوان الصفحة",
    addressHint: "ستفتح صفحتك على {path}",
    showHeader: "إظهارها في القائمة العلوية",
    showFooter: "إظهارها في أسفل المتجر",
    productsTitle: "صفحة المنتجات جاهزة",
    productsBody: "متجرك فيه بالفعل صفحة منتجات على /products بها فلاتر وبحث وترتيب. أضفها إلى قائمتك بضغطة واحدة.",
    inMenu: "الصفحة موجودة في قائمتك بالفعل.",
    menuFull: "قائمتك ممتلئة. احذف رابطا من القائمة العلوية أولا.",
    addToMenu: "إضافة إلى القائمة",
    cancel: "إلغاء",
    create: "إضافة الصفحة",
    creating: "جار الإضافة…",
    empty: "اكتب عنوانا لهذه الصفحة.",
    format: "استخدم حروفا إنجليزية صغيرة وأرقاما وشرطات فقط.",
    reserved: "متجرك يستخدم هذا العنوان لإحدى صفحاته الأساسية. اختر عنوانا آخر.",
    taken: "هناك صفحة أخرى تستخدم هذا العنوان.",
  },
} satisfies Messages;

const GLYPH: Record<PageStarter, IconComponent> = {
  blank: IconPage,
  products: IconProducts,
  about: IconInfo,
  contact: IconMessage,
  faq: IconSearch,
  landing: IconLaunch,
};

/**
 * «إضافة صفحة»: how the page starts, its name and its address. The address is
 * written from the name until the merchant edits it, and what the store can't
 * use is said under the field before anything is sent.
 *
 * The products page is the store's own, so that choice makes no new page: it
 * puts the page in the menu.
 */
export function NewPageDialog({
  open,
  onClose,
  onCreate,
  takenPaths,
  language,
  productsMenu,
  onAddProductsToMenu,
}: {
  open: boolean;
  onClose: () => void;
  /** Throw to keep the dialog open with the error shown inline. */
  onCreate: (payload: CreateWebsitePagePayload) => Promise<void>;
  /** The addresses this site's pages already have. */
  takenPaths: readonly string[];
  /** The store's language: the sample words of a new page are written in it. */
  language: EditorLocale;
  /** Whether the products page can still be added to the header menu. */
  productsMenu: "available" | "added" | "full";
  onAddProductsToMenu: () => void;
}) {
  const t = useT(STRINGS);
  const [starter, setStarter] = useState<PageStarter>("blank");
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  // Once the merchant edits the address, the name stops writing over it.
  const [slugTouched, setSlugTouched] = useState(false);
  const [showHeader, setShowHeader] = useState(true);
  const [showFooter, setShowFooter] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverProblem, setServerProblem] = useState<AddressProblem | null>(null);
  const [nameError, setNameError] = useState<string | undefined>(undefined);

  function reset() {
    setStarter("blank");
    setName("");
    setSlug("");
    setSlugTouched(false);
    setShowHeader(true);
    setShowFooter(false);
    setError(null);
    setServerProblem(null);
    setNameError(undefined);
  }

  function close() {
    if (busy) return;
    reset();
    onClose();
  }

  const shownSlug = slugTouched ? slug : slugFromName(name);
  const problem = addressProblem(shownSlug, takenPaths);
  // Nothing written yet is not a mistake to point at.
  const shownProblem = serverProblem ?? (problem === "empty" && !slugTouched ? null : problem);
  const isProducts = starter === "products";
  const canSubmit = !isProducts && name.trim().length > 0 && problem === null && !busy;

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError(null);
    setServerProblem(null);
    setNameError(undefined);
    try {
      await onCreate({
        title: name.trim(),
        path: pathOfSlug(shownSlug),
        pageType: starterPageType(starter),
        showInHeader: showHeader,
        showInFooter: showFooter,
        draftData: { version: 1, sections: starterSections(starter, name.trim(), language) },
      });
      reset();
    } catch (err) {
      if (isApiErrorCode(err, "PAGE_PATH_RESERVED")) setServerProblem("reserved");
      else if (isApiErrorCode(err, "PAGE_PATH_TAKEN") || isApiErrorCode(err, "PAGE_PATH_IN_TRASH")) setServerProblem("taken");
      else {
        const fields = getFieldErrors(err);
        setNameError(fields.title);
        if (!fields.title) setError(getErrorMessage(err));
      }
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
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" className="min-h-11" onClick={close} disabled={busy}>
            {t.cancel}
          </Button>
          {isProducts ? (
            <Button
              className="min-h-11"
              disabled={productsMenu !== "available"}
              onClick={() => {
                onAddProductsToMenu();
                close();
              }}
            >
              {t.addToMenu}
            </Button>
          ) : (
            <Button className="min-h-11" onClick={(event) => void submit(event)} disabled={!canSubmit}>
              {busy ? t.creating : t.create}
            </Button>
          )}
        </>
      }
    >
      <form data-editor-dialog data-slot="add-page" onSubmit={(event) => void submit(event)} className="space-y-5">
        {error && <Alert variant="danger">{error}</Alert>}

        <fieldset className="min-w-0 space-y-2">
          <legend className="mb-2 text-sm font-medium text-ink">{t.startFrom}</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {PAGE_STARTERS.map((value) => {
              const Glyph = GLYPH[value];
              return (
                <label
                  key={value}
                  data-slot="page-starter"
                  className={cn(
                    "flex min-h-24 cursor-pointer flex-col gap-1 rounded-[0.875rem] border border-line p-3 transition-colors motion-reduce:transition-none",
                    "hover:bg-paper-sunken has-[:checked]:border-primary has-[:checked]:bg-primary-soft",
                    "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary"
                  )}
                >
                  <input
                    type="radio"
                    name="page-starter"
                    value={value}
                    checked={starter === value}
                    onChange={() => setStarter(value)}
                    className="sr-only"
                  />
                  <Glyph className="size-5 text-primary-dark dark:text-primary" aria-hidden />
                  <span className="text-sm font-semibold text-ink">{t[value]}</span>
                  <span className="text-sm leading-5 text-ink-soft">{t[`${value}Note`]}</span>
                </label>
              );
            })}
          </div>
        </fieldset>

        {isProducts ? (
          <div data-slot="products-page-note" className="space-y-1 rounded-[0.875rem] bg-paper-sunken p-3">
            <p className="text-sm font-semibold text-ink">{t.productsTitle}</p>
            <p className="text-sm leading-6 text-ink-soft">{t.productsBody}</p>
            {productsMenu !== "available" && (
              <p role="status" className="text-sm font-medium text-ink">
                {productsMenu === "added" ? t.inMenu : t.menuFull}
              </p>
            )}
          </div>
        ) : (
          <>
            <TextField
              label={t.name}
              required
              autoFocus
              dir="auto"
              maxLength={200}
              value={name}
              onChange={(event) => setName(event.target.value)}
              error={nameError}
              hint={t.nameHint}
            />
            <TextField
              label={t.address}
              required
              dir="ltr"
              maxLength={120}
              value={shownSlug}
              onChange={(event) => {
                setSlugTouched(true);
                setServerProblem(null);
                setSlug(event.target.value);
              }}
              error={shownProblem ? t[shownProblem] : undefined}
              hint={shownSlug ? fmt(t.addressHint, { path: pathOfSlug(shownSlug) }) : undefined}
            />
            <div className="space-y-1">
              <SwitchRow label={t.showHeader} checked={showHeader} onChange={setShowHeader} />
              <SwitchRow label={t.showFooter} checked={showFooter} onChange={setShowFooter} />
            </div>
          </>
        )}

        {/* Lets Enter submit the form without a second visible button. */}
        <button type="submit" className="hidden" tabIndex={-1} aria-hidden />
      </form>
    </Modal>
  );
}
