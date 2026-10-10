import { useState, type ReactNode } from "react";
import { IconSliders } from "@/components/icons";
import { Button, Input, Label } from "@store-builder/ui";
import { useErrorMessage } from "@/lib/errorMessages";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { FilterTabs } from "@/components/FilterTabs";
import { Modal } from "@/components/Modal";
import { Textarea } from "@/components/Textarea";
import { useToast } from "@/components/Toast";

const STRINGS = {
  en: {
    title: "Page settings — {name}",
    tabs: "Page settings sections",
    details: "Details",
    seo: "SEO",
    seoTitle: "Title in search results",
    seoDescription: "Description",
    image: "Sharing image (link)",
    imageHint: "Shown when the link is shared. 1200×630 works best.",
    noindex: "Hide this page from search engines",
    count: "{n} / {max}",
    saveSeo: "Save SEO",
    seoSaved: "SEO saved.",
    close: "Close",
    open: "Page settings",
    hintPage: "Search engines see this once you publish the website.",
    hintStep: "Saved with the funnel (Save), and live once you publish it.",
  },
  ar: {
    title: "إعدادات الصفحة — {name}",
    tabs: "أقسام إعدادات الصفحة",
    details: "التفاصيل",
    seo: "SEO",
    seoTitle: "العنوان في نتائج البحث",
    seoDescription: "الوصف",
    image: "صورة المشاركة (رابط)",
    imageHint: "بتظهر لما اللينك يتشارك. الأفضل 1200×630.",
    noindex: "إخفاء الصفحة دي من محركات البحث",
    count: "{n} / {max}",
    saveSeo: "حفظ SEO",
    seoSaved: "تم حفظ SEO.",
    close: "إغلاق",
    open: "إعدادات الصفحة",
    hintPage: "محركات البحث هتشوف ده بعد ما تنشر الموقع.",
    hintStep: "بيتحفظ مع الفانل (حفظ)، ويبقى شغال بعد ما تنشره.",
  },
} satisfies Messages;

/** Whether the dialog is for a website page or a funnel step (its SEO hints differ). */
type PageScriptKind = "page" | "step";

export type PageSettingsTab = "details" | "seo";
type Tab = PageSettingsTab;

/** The builder toolbar's "Page settings" button and its dialog. */
export function PageSettingsButton({
  name,
  seo,
  onSaveSeo,
  scripts,
  compact = false,
  details,
}: {
  name: string;
  seo: Record<string, unknown>;
  onSaveSeo: (seo: Record<string, unknown>) => Promise<void> | void;
  scripts: { kind: PageScriptKind; id: string | null };
  /** Icon only (the website editor's toolbar). */
  compact?: boolean;
  /** The Details tab (the page's title and address), shown first when given. */
  details?: ReactNode;
}) {
  const t = useT(STRINGS);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={compact ? "icon-sm" : "default"}
        aria-label={t.open}
        title={t.open}
        onClick={() => setOpen(true)}
      >
        <IconSliders className="size-4" aria-hidden />
        {!compact && t.open}
      </Button>
      {open && (
        <PageSettingsDialog
          name={name}
          seo={seo}
          showNoindex={scripts.kind === "page"}
          seoHint={scripts.kind === "page" ? t.hintPage : t.hintStep}
          onSaveSeo={onSaveSeo}
          scripts={scripts}
          details={details}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
const str = (v: unknown) => (typeof v === "string" ? v : "");

/**
 * A page's settings in the builder: the Details tab when the
 * page passes one (a funnel step's title and address), the SEO tab (title,
 * description, sharing image, and for website pages "hide from search
 * engines") and the Scripts tab (code in <head> and before </body>, kept
 * outside the page tree under the store's custom-code rules).
 *
 * SEO is the page's own: `onSaveSeo` saves it the way that page saves —
 * a website page at once (live with the next Publish), a funnel step into the
 * funnel draft. Scripts save on their own, at once.
 */
export function PageSettingsDialog({
  name,
  seo,
  showNoindex,
  seoHint,
  onSaveSeo,
  scripts,
  details,
  initialTab,
  onClose,
}: {
  name: string;
  seo: Record<string, unknown>;
  details?: ReactNode;
  /** Left out: shown for a website page, not for a funnel step. */
  showNoindex?: boolean;
  /** Where the SEO goes: "live with your next Publish" / "saved with the funnel". Left out: the sentence for this kind of page. */
  seoHint?: string;
  onSaveSeo: (seo: Record<string, unknown>) => Promise<void> | void;
  scripts: { kind: PageScriptKind; id: string | null };
  /** The tab it opens on. Left out: Details when there is one, else SEO. */
  initialTab?: PageSettingsTab;
  onClose: () => void;
}) {
  const t = useT(STRINGS);
  const isPage = scripts.kind === "page";
  const [tab, setTab] = useState<Tab>(initialTab && (initialTab !== "details" || details) ? initialTab : details ? "details" : "seo");
  const tabs = [
    ...(details ? [{ value: "details" as const, label: t.details }] : []),
    { value: "seo" as const, label: t.seo },
  ];
  return (
    <Modal open onClose={onClose} title={fmt(t.title, { name })} footer={<Button variant="outline" onClick={onClose}>{t.close}</Button>}>
      <div className="space-y-4">
        {tabs.length > 1 && <FilterTabs label={t.tabs} value={tab} onChange={setTab} tabs={tabs} />}
        {tab === "details" ? (
          details
        ) : (
          <SeoForm seo={seo} showNoindex={showNoindex ?? isPage} hint={seoHint ?? (isPage ? t.hintPage : t.hintStep)} onSave={onSaveSeo} />
        )}
      </div>
    </Modal>
  );
}

function SeoForm({ seo, showNoindex, hint, onSave }: { seo: Record<string, unknown>; showNoindex: boolean; hint: string; onSave: (seo: Record<string, unknown>) => Promise<void> | void }) {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const [title, setTitle] = useState(str(seo.title));
  const [description, setDescription] = useState(str(seo.description));
  const [image, setImage] = useState(str(seo.ogImage));
  const [noindex, setNoindex] = useState(seo.noindex === true);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      // Keys this form doesn't edit (the canvas position of a funnel step…) stay.
      await onSave({ ...seo, title: title.trim(), description: description.trim(), ogImage: image.trim(), ...(showNoindex ? { noindex } : {}) });
      toast.success(t.seoSaved);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-soft">{hint}</p>
      <div className="space-y-1.5">
        <Label htmlFor="ps-title">{t.seoTitle}</Label>
        <Input id="ps-title" dir="auto" maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} />
        <p className="text-xs text-ink-soft">{fmt(t.count, { n: title.length, max: 70 })}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-description">{t.seoDescription}</Label>
        <Textarea id="ps-description" dir="auto" rows={3} maxLength={1000} value={description} onChange={(e) => setDescription(e.target.value)} />
        <p className="text-xs text-ink-soft">{fmt(t.count, { n: description.length, max: 160 })}</p>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ps-image">{t.image}</Label>
        <Input id="ps-image" type="url" dir="ltr" maxLength={1000} value={image} aria-describedby="ps-image-hint" onChange={(e) => setImage(e.target.value)} />
        <p id="ps-image-hint" className="text-xs text-ink-soft">
          {t.imageHint}
        </p>
      </div>
      {showNoindex && (
        <label className="flex min-h-11 items-center gap-2 text-sm text-ink">
          <input type="checkbox" className="size-4 accent-primary" checked={noindex} onChange={(e) => setNoindex(e.target.checked)} />
          {t.noindex}
        </label>
      )}
      <div className="text-end">
        <Button disabled={busy} onClick={() => void save()}>
          {t.saveSeo}
        </Button>
      </div>
    </div>
  );
}
