import { useEffect, useId, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import type { CreateWebsitePayload, Website, WebsiteTemplateSummary } from "@store-builder/api-client";
import { Alert, Button, Spinner, cn } from "@store-builder/ui";
import { IconCheck, IconFileAdd, IconStyle, IconWarning, type IconComponent } from "@/components/icons";
import { TextField } from "@/components/Field";
import { Sheet } from "@/components/Sheet";
import { useToast } from "@/components/Toast";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { apiClient } from "@/lib/apiClient";
import { getErrorMessage, getFieldErrors } from "@/lib/errors";
import { pluralOf } from "@/lib/plural";
import { useSaveThemeSettings } from "@/lib/themeSettingsSave";
import { useAsync } from "@/lib/useAsync";
import { invalidateCached } from "@/lib/useCachedAsync";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { TEMPLATE_COLOR_SOURCE } from "../editor/storeLook";
import { useCodeLabel } from "./codes";
import { DevicePreview } from "./DevicePreview";
import { TemplatePlaceholder } from "./TemplatePlaceholder";
import { storeHasOwnLook, templateColour, useTemplatePreviewTheme } from "./templateLook";
import { useMountedOpen } from "./useMountedOpen";

const STRINGS = {
  en: {
    use: "Use this template",
    livePreview: "Live preview of {name}",
    noPreview: "No preview yet",
    catalogueNote:
      "This is your store in this template, with your own products. Product sections say “coming soon” until you add some.",
    inUseNote: "Your current site started from this template.",
    loadingDetails: "Loading the template's pages…",
    detailError: "We couldn't load this template's pages. You can still use it.",
    retry: "Try again",
    includes: "Comes with {pages}:",
    pagesNone: "This template has no pages yet.",
    pages_one: "1 page",
    pages_other: "{n} pages",
    confirmTitle: "Start with “{name}”?",
    happens: "What happens",
    makesFirst:
      "We make your store's site from this template, with its pages. It stays a draft — shoppers see nothing until you publish.",
    makesNew: "We make a new site from this template, with its pages, as a draft.",
    keepsSite: "Nothing is replaced: “{name}” and its pages stay exactly as they are.",
    keepsData: "Your products, orders and settings are not touched.",
    takesLook: "Your store takes this template's colours — you can change them in the editor.",
    takesLookLive:
      "Your store has no colours of its own yet, so it takes this template's right away — on the live store too. You can change them in the editor.",
    keepsLook: "Your store's colours and theme stay as they are.",
    siteName: "Site name",
    siteNameHint: "A temporary address is made from it. You can change it later.",
    siteNamePlaceholder: "My store",
    back: "Back",
    create: "Start with this template",
    creating: "Setting up your site…",
    created: "“{name}” is ready. Make it yours.",
  },
  ar: {
    use: "استخدام هذا القالب",
    livePreview: "معاينة حيّة لقالب {name}",
    noPreview: "لا توجد معاينة بعد",
    catalogueNote: "هذا متجرك بهذا القالب وبمنتجاتك أنت. أقسام المنتجات تقول «قريبًا» إلى أن تضيف منتجات.",
    inUseNote: "موقعك الحالي بدأ من هذا القالب.",
    loadingDetails: "جارٍ تحميل صفحات القالب…",
    detailError: "تعذّر تحميل صفحات القالب. يمكنك استخدامه على أي حال.",
    retry: "إعادة المحاولة",
    includes: "يحتوي على {pages}:",
    pagesNone: "هذا القالب لا يحتوي على صفحات بعد.",
    pages_one: "صفحة واحدة",
    pages_two: "صفحتان",
    pages_few: "{n} صفحات",
    pages_other: "{n} صفحة",
    confirmTitle: "البدء بقالب «{name}»؟",
    happens: "ما سيحدث",
    makesFirst: "سننشئ موقع متجرك من هذا القالب بصفحاته. سيبقى مسودة — لن يرى العملاء شيئًا حتى تنشر.",
    makesNew: "سننشئ موقعًا جديدًا من هذا القالب بصفحاته، كمسودة.",
    keepsSite: "لن يُستبدل شيء: «{name}» وصفحاته تبقى كما هي.",
    keepsData: "منتجاتك وطلباتك وإعداداتك تبقى كما هي.",
    takesLook: "سيأخذ متجرك ألوان القالب — ويمكنك تغييرها من المحرر.",
    takesLookLive:
      "ليس لمتجرك ألوان خاصة بعد، فسيأخذ ألوان القالب فورًا — ويظهر ذلك على المتجر المنشور أيضًا. يمكنك تغييرها من المحرر.",
    keepsLook: "ألوان متجرك ومظهره تبقى كما هي.",
    siteName: "اسم الموقع",
    siteNameHint: "ننشئ منه عنوانًا مؤقتًا، ويمكنك تغييره لاحقًا.",
    siteNamePlaceholder: "متجري",
    back: "رجوع",
    create: "البدء بهذا القالب",
    creating: "جارٍ تجهيز موقعك…",
    created: "موقع «{name}» جاهز. اجعله بهويتك.",
  },
} satisfies Messages;

type Tone = "brand" | "kept" | "heed";

const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-primary-soft text-primary",
  kept: "bg-success-soft text-success",
  heed: "bg-accent-soft text-accent-dark",
};

interface Outcome {
  id: string;
  icon: IconComponent;
  tone: Tone;
  text: string;
}

/** Both actions are pills; the footer of the sheet gives them their height (44px rows on the phone). */
const ACTION = "rounded-full px-5";

/**
 * A template, opened from the grid: the live store in a phone (with a switch
 * to a computer), what the template is good for, the pages it comes with, and
 * ONE button — «استخدم القالب ده».
 *
 * That button does not act yet: it turns the sheet over to the confirmation,
 * which says exactly what using a template does. It never replaces anything —
 * `createWebsite` makes a NEW site (a draft) with a copy of the template's
 * pages; a site the store already has, its pages, the products and the orders
 * stay as they are. The one thing that can change on the store itself is its
 * colours, and only when it has none of its own (see applyTemplateColour) —
 * the confirmation says that too, and that it shows on a live store at once.
 * The site's name is asked for there, as before.
 *
 * Then the merchant lands in the editor with `?start=1`, where the shell's
 * "brand it → publish" guide takes over.
 */
export function TemplateSheet({
  template,
  open,
  onOpenChange,
  currentSite,
  inUse = false,
}: {
  template: WebsiteTemplateSummary;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The site the store has now, when it has one: the confirmation says it stays. */
  currentSite: Website | null;
  /** The current site was made from this template. */
  inUse?: boolean;
}) {
  const t = useT(STRINGS);
  const codeLabel = useCodeLabel();
  const formId = useId();
  const workspaceId = useWorkspaceId();
  const { currentWorkspace } = useWorkspace();
  const saveThemeSettings = useSaveThemeSettings();
  const toast = useToast();
  const navigate = useNavigate();
  const theme = useTemplatePreviewTheme(template);
  // Mounted by the press that opens it: closed for one frame, so it rises like every other sheet.
  const shown = useMountedOpen(open);

  // Informational only: the summary already carries the `templateVersionId` the API needs,
  // so a failure here shows a note and never blocks creating the site.
  const detail = useAsync(() => apiClient.getWebsiteTemplate(template.id), [template.id]);

  const storeName = currentWorkspace?.name ?? "";
  const [step, setStep] = useState<"preview" | "confirm">("preview");
  const [name, setName] = useState(storeName);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Each opening starts on the preview, with a clean form.
  useEffect(() => {
    if (!open) return;
    setStep("preview");
    setName(storeName);
    setFormError(null);
    setFieldErrors({});
    // `storeName` is read as it is when the sheet opens; typing must not be undone by a later refresh of the store.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, template.id]);

  const styles = detail.data?.globalStyles;
  const colour = templateColour(styles?.primaryColor);
  const ownLook = storeHasOwnLook(currentWorkspace?.themeSettings);

  /**
   * A template's colour lives in its `globalStyles`, which createWebsite copies
   * onto the website row — but the storefront paints from the workspace's
   * `themeSettings`, so a "perfume" template would open in the platform blue.
   * Carry the colour across here, only when the store has chosen neither a
   * theme nor an accent of its own, so a merchant's look is never overwritten
   * by picking a template. It is marked as the template's
   * (`primaryColorSource`), so a theme picked later still shows its own accent.
   * Best effort: the site exists either way, so a failure here is not surfaced.
   */
  async function applyTemplateColour() {
    if (!colour || ownLook) return;
    try {
      // Asked again of the server's copy: another tab may have picked a look since.
      await saveThemeSettings((current) =>
        storeHasOwnLook(current)
          ? null
          : {
              themeSettings: {
                ...current,
                // A template may bring its whole look — theme, header, footer (globalStyles.themeSettings).
                ...(styles?.themeSettings && typeof styles.themeSettings === "object"
                  ? (styles.themeSettings as Record<string, unknown>)
                  : {}),
                primaryColor: colour,
                primaryColorSource: TEMPLATE_COLOR_SOURCE,
              },
            }
      );
    } catch {
      /* the site was created; the merchant can still pick a colour in the editor */
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    const payload: CreateWebsitePayload = {
      name: name.trim(),
      templateVersionId: template.templateVersionId,
    };
    try {
      const result = await apiClient.createWebsite(workspaceId, payload);
      await applyTemplateColour();
      // The website page's remembered list no longer holds every site.
      invalidateCached(`website:sites:${workspaceId}`);
      toast.success(fmt(t.created, { name: result.website.name }));
      navigate(`/website/${result.website.id}/edit?start=1`);
    } catch (err) {
      const fields = getFieldErrors(err);
      setFieldErrors(fields);
      if (Object.keys(fields).length === 0) setFormError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  const pages = detail.data?.pages ?? [];
  const kind = template.category ? codeLabel("category", template.category) : "";
  const goodFor = codeLabel("goodFor", template.category);

  const outcomes: Outcome[] = [
    { id: "makes", icon: IconFileAdd, tone: "brand", text: currentSite ? t.makesNew : t.makesFirst },
    ...(currentSite
      ? [{ id: "site", icon: IconCheck, tone: "kept" as const, text: fmt(t.keepsSite, { name: currentSite.name }) }]
      : []),
    { id: "data", icon: IconCheck, tone: "kept", text: t.keepsData },
    ...(colour && !ownLook
      ? currentSite?.status === "published"
        ? [{ id: "look", icon: IconWarning, tone: "heed" as const, text: t.takesLookLive }]
        : [{ id: "look", icon: IconStyle, tone: "brand" as const, text: t.takesLook }]
      : ownLook
        ? [{ id: "look", icon: IconCheck, tone: "kept" as const, text: t.keepsLook }]
        : []),
  ];

  return (
    <Sheet
      open={shown}
      onOpenChange={(next) => {
        // A site being made is not walked away from.
        if (!next && saving) return;
        onOpenChange(next);
      }}
      title={step === "preview" ? template.name : fmt(t.confirmTitle, { name: template.name })}
      description={step === "preview" ? (kind ? `${kind} · ${goodFor}` : goodFor) : undefined}
      size="lg"
      // The whole height on a phone; a tall dialog from 640px, so the store has room.
      className="max-sm:h-[92dvh] sm:h-[min(85dvh,46rem)]"
      footer={
        step === "preview" ? (
          <Button type="button" className={ACTION} onClick={() => setStep("confirm")}>
            {t.use}
          </Button>
        ) : (
          <>
            <Button type="button" variant="outline" className={ACTION} disabled={saving} onClick={() => setStep("preview")}>
              {t.back}
            </Button>
            <Button type="submit" form={formId} className={ACTION} disabled={saving || name.trim().length === 0}>
              {saving ? t.creating : t.create}
            </Button>
          </>
        )
      }
    >
      {step === "preview" ? (
        <div data-slot="template-sheet" className="flex flex-col gap-3">
          {inUse && (
            <p className="flex items-center gap-2 rounded-2xl bg-primary-soft px-3 py-2 text-sm font-medium text-primary-dark dark:text-primary">
              <IconCheck className="size-4 shrink-0" aria-hidden />
              {t.inUseNote}
            </p>
          )}
          <DevicePreview
            workspaceId={workspaceId}
            templateId={template.id}
            theme={theme}
            title={fmt(t.livePreview, { name: template.name })}
            fallback={<TemplatePlaceholder color={template.primaryColor} title={template.name} label={t.noPreview} />}
            // What is left of the sheet once its header, the device switch and its footer are counted.
            stageClassName="h-[calc(92dvh_-_17.5rem)] min-h-[20rem] sm:h-[calc(min(85dvh,46rem)_-_15.5rem)]"
          />
          <p className="text-xs leading-5 text-ink-soft">{t.catalogueNote}</p>
          <div className="text-sm">
            {detail.loading ? (
              <span className="flex items-center gap-2 text-ink-soft">
                <Spinner className="size-4" /> {t.loadingDetails}
              </span>
            ) : detail.error ? (
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-ink-soft">
                {t.detailError}
                <button
                  type="button"
                  onClick={() => void detail.refresh()}
                  className="inline-flex min-h-11 cursor-pointer items-center rounded-full px-2 font-medium text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary pointer-fine:min-h-8"
                >
                  {t.retry}
                </button>
              </span>
            ) : pages.length === 0 ? (
              <p className="text-ink-soft">{t.pagesNone}</p>
            ) : (
              <>
                <p className="text-ink-soft">{fmt(t.includes, { pages: pluralOf(t, "pages", pages.length) })}</p>
                <ul className="mt-2 flex flex-wrap gap-1.5">
                  {pages.map((p) => (
                    <li
                      key={p.path}
                      className="rounded-full bg-paper-sunken px-2.5 py-1 text-xs font-medium text-ink-soft ring-1 ring-line"
                    >
                      {p.title || p.path}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </div>
      ) : (
        <form id={formId} onSubmit={submit} data-slot="template-confirm" className="space-y-5">
          {formError && <Alert variant="danger">{formError}</Alert>}
          <div>
            <h3 className="text-[13px] leading-5 font-semibold text-ink-soft">{t.happens}</h3>
            <ul className="mt-2.5 space-y-3">
              {outcomes.map((outcome) => {
                const OutcomeIcon = outcome.icon;
                return (
                  <li key={outcome.id} className="flex items-start gap-3 text-sm leading-6 text-ink">
                    <span
                      aria-hidden
                      className={cn("flex size-6 shrink-0 items-center justify-center rounded-full", TONE_CLASS[outcome.tone])}
                    >
                      <OutcomeIcon className="size-3.5" />
                    </span>
                    <span className="min-w-0">{outcome.text}</span>
                  </li>
                );
              })}
            </ul>
          </div>
          <TextField
            label={t.siteName}
            required
            value={name}
            disabled={saving}
            onChange={(e) => setName(e.target.value)}
            error={fieldErrors.name}
            hint={t.siteNameHint}
            placeholder={t.siteNamePlaceholder}
          />
        </form>
      )}
    </Sheet>
  );
}
