import { useState } from "react";
import { Button, Input, Label } from "@store-builder/ui";
import { CopyButton } from "@/components/CopyButton";
import { StepTypeTile } from "./panes/StepTypePicker";
import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { useToast } from "@/components/Toast";
import { STEP_TYPE_LABELS } from "./FunnelEditorPage.strings";
import type { UiStepType } from "./funnelAdapter";

const STRINGS = {
  en: {
    title: "Page title",
    titleHint: "Your own name for the page. On a generic page it is also the link's text in the funnel's footer.",
    address: "Address",
    addressHint: "Lowercase letters, digits and hyphens.",
    lockedAddress: "This page keeps its address: a page on the funnel map, or one that is already saved, cannot change it. Links and visitors' sessions use it.",
    type: "Type",
    preview: "Opens at",
    invalid: "Use lowercase letters, digits and hyphens, starting and ending with a letter or digit.",
    taken: "Another page of this funnel already uses this address.",
    save: "Apply",
    titleEmpty: "Give the page a name.",
    copyAddress: "Copy the address",
    applied: "Applied to the funnel. Save the funnel to keep it; the new address goes live when you publish.",
  },
  ar: {
    title: "اسم الصفحة",
    titleHint: "الاسم الذي تراه أنت للصفحة. في الصفحات الأخرى يكون أيضًا نص الرابط في تذييل مسار البيع.",
    address: "العنوان",
    addressHint: "حروف إنجليزية صغيرة وأرقام وشرطة (-).",
    lockedAddress: "هذه الصفحة تحتفظ بعنوانها: الصفحة الموجودة على خريطة المسار، أو المحفوظة من قبل، لا يتغيّر عنوانها لأن الروابط وجلسات الزوار تعتمد عليه.",
    type: "النوع",
    preview: "تُفتح على",
    invalid: "اكتب حروفًا إنجليزية صغيرة وأرقامًا وشرطة فقط، وابدأ واختم بحرف أو رقم.",
    taken: "توجد صفحة أخرى في هذا المسار بالعنوان نفسه. اختر عنوانًا آخر.",
    save: "تطبيق",
    titleEmpty: "اكتب اسمًا للصفحة.",
    copyAddress: "نسخ العنوان",
    applied: "طُبّق على مسار البيع. احفظ المسار ليُسجَّل، ويعمل العنوان الجديد عند النشر.",
  },
} satisfies Messages;

const KEY_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/;

/** What a typed address becomes: lowercase, spaces and underscores to hyphens, nothing else. */
const tidy = (v: string) =>
  v
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-{2,}/g, "-");

/**
 * Page settings → Details for a funnel step (SPEC §9.3: "the link using
 * letters, digits and hyphens, internal title, type"). The title can always
 * change. The address (the step's key) only can on a generic page that has
 * not been saved yet (`generic`): the API takes a key when a step is created
 * and never afterwards. Changes go into the funnel draft like any other edit
 * and are saved with it.
 */
export function StepDetailsForm({
  name,
  stepKey,
  type,
  generic,
  taken,
  pathOf,
  onApply,
}: {
  name: string;
  stepKey: string;
  type: UiStepType;
  /** A generic page (no edge in or out) that is not saved yet: its address can still change. */
  generic: boolean;
  /** Addresses this page may not take: the funnel's other pages, saved or not. */
  taken: string[];
  /** A generic page's public address for a key. */
  pathOf: (key: string) => string;
  onApply: (changes: { name: string; key: string }) => void;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const toast = useToast();
  const [title, setTitle] = useState(name);
  const [key, setKey] = useState(stepKey);

  const cleanKey = key.replace(/^-+|-+$/g, "");
  const problem = !generic || cleanKey === stepKey ? null : !KEY_RE.test(cleanKey) ? t.invalid : taken.includes(cleanKey) ? t.taken : null;
  const changed = title.trim() !== name || (generic && cleanKey !== stepKey);

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="pd-title">{t.title}</Label>
        <Input
          id="pd-title"
          dir="auto"
          maxLength={200}
          value={title}
          aria-invalid={title.trim() === "" ? true : undefined}
          aria-describedby="pd-title-hint"
          className="h-11 text-base md:h-9 md:text-sm"
          onChange={(e) => setTitle(e.target.value)}
        />
        <p id="pd-title-hint" className="text-xs text-ink-soft">
          {t.titleHint}
        </p>
        {title.trim() === "" && <p className="text-xs text-danger">{t.titleEmpty}</p>}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pd-key">{t.address}</Label>
        <Input
          id="pd-key"
          dir="ltr"
          maxLength={100}
          value={key}
          readOnly={!generic}
          aria-invalid={problem ? true : undefined}
          aria-describedby="pd-key-hint"
          className="h-11 text-base md:h-9 md:text-sm"
          onChange={(e) => setKey(tidy(e.target.value))}
        />
        <p id="pd-key-hint" className="text-xs text-ink-soft">
          {generic ? t.addressHint : t.lockedAddress}{" "}
          {generic && cleanKey && (
            <>
              {t.preview} <bdi dir="ltr">{pathOf(cleanKey)}</bdi> <CopyButton value={pathOf(cleanKey)} label={t.copyAddress} iconOnly className="align-middle" />
            </>
          )}
        </p>
        {problem && <p className="text-xs text-danger">{problem}</p>}
      </div>
      <div className="space-y-1.5">
        <span className="text-sm font-medium text-ink">{t.type}</span>
        <p className="flex items-center gap-2 text-sm text-ink">
          <StepTypeTile type={type} size="sm" />
          {STEP_TYPE_LABELS[locale][type]}
        </p>
      </div>
      <div className="text-end">
        <Button
          type="button"
          className="min-h-11 md:min-h-9"
          disabled={!changed || Boolean(problem) || !title.trim() || !cleanKey}
          onClick={() => {
            onApply({ name: title.trim(), key: generic ? cleanKey : stepKey });
            toast.success(t.applied);
          }}
        >
          {t.save}
        </Button>
      </div>
    </div>
  );
}
