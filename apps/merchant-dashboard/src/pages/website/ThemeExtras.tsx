import { useState } from "react";
import { IconRotateBack } from "@/components/icons";
import { Button } from "@store-builder/ui";
import { themeResetCurrent } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useErrorMessage } from "@/lib/errorMessages";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { useToast } from "@/components/Toast";

/**
 * The theme gallery's "Reset" on the current theme and its tags (SPEC §8.1,
 * item 100; backend themes/themeReset.js, migration 429's tag vocabulary).
 */

const STRINGS = {
  en: {
    reset: "Reset",
    resetTitle: "Reset the theme to its own look?",
    resetDescription:
      "Your accent colours, second colour, font and corners go back to the theme's defaults. The theme, your logo and your header, footer and announcement bar stay. It changes your live store right away.",
    resetting: "Resetting…",
    resetDone: "The theme is back to its own look.",
    nothingToReset: "The theme already shows its own look.",
    style: "Style",
    anyStyle: "Any style",
    tag_customizable: "Customizable",
    tag_simple: "Simple",
    tag_serif: "Serif",
    tag_luxury: "Luxury",
    tag_spacious: "Spacious",
    tag_bold: "Bold",
    tag_colorful: "Colourful",
    tag_modern: "Modern",
    tag_minimal: "Minimal",
    tag_flat: "Flat",
    tag_trusted: "Trusted",
    tag_shadows: "Soft shadows",
    tag_rounded: "Rounded",
    tag_cozy: "Cozy",
    tag_soft: "Soft",
    tag_glass: "Glass",
    tag_playful: "Playful",
    tag_kids: "Kids",
  },
  ar: {
    reset: "إعادة ضبط",
    resetTitle: "ترجع الثيم لشكله الأصلي؟",
    resetDescription:
      "ألوانك الأساسية واللون التاني والخط والزوايا هيرجعوا لإعدادات الثيم. الثيم واللوجو والهيدر والفوتر وشريط الإعلان مش هيتغيروا. التغيير بيظهر على متجرك اللايف على طول.",
    resetting: "جارٍ إعادة الضبط…",
    resetDone: "الثيم رجع لشكله الأصلي.",
    nothingToReset: "الثيم أصلًا بشكله الأصلي.",
    style: "الطابع",
    anyStyle: "أي طابع",
    tag_customizable: "قابل للتخصيص",
    tag_simple: "بسيط",
    tag_serif: "خط كلاسيكي",
    tag_luxury: "فخم",
    tag_spacious: "مساحات واسعة",
    tag_bold: "جريء",
    tag_colorful: "ملوّن",
    tag_modern: "عصري",
    tag_minimal: "مينيمال",
    tag_flat: "مسطّح",
    tag_trusted: "موثوق",
    tag_shadows: "ظلال ناعمة",
    tag_rounded: "زوايا دائرية",
    tag_cozy: "دافئ",
    tag_soft: "ناعم",
    tag_glass: "زجاجي",
    tag_playful: "مرح",
    tag_kids: "أطفال",
  },
} satisfies Messages;

/** A tag in the merchant's language when it is one of the shared vocabulary, else as the console wrote it. */
export function useTagLabel() {
  const t = useT(STRINGS);
  return (tag: string) => (t as Record<string, string>)[`tag_${tag}`] ?? tag;
}

export function useStyleFilterText() {
  const t = useT(STRINGS);
  return { style: t.style, anyStyle: t.anyStyle };
}

export function ThemeTags({ tags }: { tags: string[] }) {
  const label = useTagLabel();
  if (tags.length === 0) return null;
  return (
    <ul className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <li key={tag} className="rounded-full bg-paper px-2 py-0.5 text-[0.7rem] text-ink-soft ring-1 ring-line">
          {label(tag)}
        </li>
      ))}
    </ul>
  );
}

/** "Reset" on the current theme's card. */
export function ThemeResetButton() {
  const t = useT(STRINGS);
  const toast = useToast();
  const errorMessage = useErrorMessage();
  const { currentWorkspace, applySavedWorkspace } = useWorkspace();
  const [open, setOpen] = useState(false);

  async function reset() {
    if (!currentWorkspace) return;
    try {
      const res = await themeResetCurrent(apiClient, currentWorkspace.id);
      applySavedWorkspace({ ...currentWorkspace, themeSettings: res.themeSettings });
      toast.success(res.cleared.length > 0 ? t.resetDone : t.nothingToReset);
      setOpen(false);
    } catch (err) {
      throw new Error(errorMessage(err));
    }
  }

  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="relative z-10 h-7 px-2 text-xs" onClick={() => setOpen(true)}>
        <IconRotateBack className="size-3.5" aria-hidden />
        {t.reset}
      </Button>
      <ConfirmDialog
        open={open}
        title={t.resetTitle}
        description={t.resetDescription}
        confirmLabel={t.reset}
        busyLabel={t.resetting}
        onCancel={() => setOpen(false)}
        onConfirm={reset}
      />
    </>
  );
}
