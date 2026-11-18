import { useEffect, useMemo, useState } from "react";
import type { PageSection } from "@store-builder/api-client";
import { Button } from "@store-builder/ui";
import { useT } from "@/i18n/LocaleContext";
import { demoWordCount, demoWordsTo, inArabic, loadDemoWords, type DemoLanguage } from "../../templates/xs/demoWords";
import type { StoreLook } from "../storeLook";
import { SHELL_STRINGS } from "./shellStrings";

/** A word or two can be a brand name; from this many on, the page really is in the other language. */
const MIN_WORDS = 3;

/**
 * A template's sample words are written in one language. On a store in the
 * other one the page mixes the two, so the editor says so and offers to switch
 * them with one press. What the merchant wrote is never touched (demoWords.ts).
 */
export function DemoLanguageBar({
  xsLook,
  language,
  sections,
  look,
  onApply,
}: {
  xsLook: string | null;
  language: DemoLanguage;
  sections: PageSection[];
  look: StoreLook;
  onApply: (sections: PageSection[], look: StoreLook) => void;
}) {
  const t = useT(SHELL_STRINGS);
  const [loaded, setLoaded] = useState<{ look: string; words: Record<string, string> } | null>(null);

  useEffect(() => {
    if (!xsLook) return;
    let live = true;
    void loadDemoWords(xsLook).then((words) => {
      if (live && words) setLoaded({ look: xsLook, words });
    });
    return () => {
      live = false;
    };
  }, [xsLook]);

  const words = useMemo(() => (loaded && loaded.look === xsLook ? demoWordsTo(loaded.words, language) : null), [loaded, xsLook, language]);
  const shell = { header: look.header, footer: look.footer, announcement: look.announcement };
  const count = words ? demoWordCount(sections, words) + demoWordCount(shell, words) : 0;
  if (!words || count < MIN_WORDS) return null;

  return (
    <div
      role="status"
      data-slot="editor-demo-language"
      className="flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-paper-raised px-3 py-2"
    >
      <p className="min-w-0 flex-1 basis-56 text-sm leading-6 text-ink">{language === "ar" ? t.demoNoticeAr : t.demoNoticeEn}</p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 rounded-full px-4 whitespace-normal"
        onClick={() => onApply(inArabic(sections, words), { ...look, ...inArabic(shell, words) })}
      >
        {language === "ar" ? t.demoUseAr : t.demoUseEn}
      </Button>
    </div>
  );
}
