import { useState } from "react";
import { cn } from "@store-builder/ui";
import type { EmailSignupPlace, EmailSignupSettings } from "@store-builder/api-client";
import { FilterTabs } from "@/components/FilterTabs";
import { Segmented } from "@/components/Segmented";
import { IconCheck, IconClose } from "@/components/icons";
import { fmt, useLocale, useT } from "@/i18n/LocaleContext";
import { OfferPreview } from "../../offers/OfferKit";
import { SIGNUP_STRINGS, type SignupText } from "./signupStrings";

const PLACES: EmailSignupPlace[] = ["checkout", "quickOrder", "cart", "footer", "popup"];

/**
 * How each place looks to a shopper, live as the merchant edits: the box with
 * its words and starting tick, the footer band, the popup. In the language
 * picked here (the store's words for it, or the storefront's defaults), drawn
 * in that language's direction. Nothing in it is a real control.
 */
export function SignupPreview({ draft, storeName }: { draft: EmailSignupSettings; storeName: string }) {
  const t = useT(SIGNUP_STRINGS);
  const { locale } = useLocale();
  const [place, setPlace] = useState<EmailSignupPlace>(() => PLACES.find((p) => draft[p].enabled) ?? "checkout");
  const [lang, setLang] = useState<"ar" | "en">(locale === "ar" ? "ar" : "en");
  const words = SIGNUP_STRINGS[lang];
  const copy = draft.text[lang];
  const on = draft[place].enabled;

  return (
    <section aria-label={t.preview} className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{t.preview}</h3>
        <Segmented
          size="sm"
          label={t.previewLanguage}
          value={lang}
          onChange={setLang}
          options={[
            { value: "ar", label: t.arabic },
            { value: "en", label: t.english },
          ]}
        />
      </div>
      <FilterTabs
        label={t.previewPlace}
        value={place}
        onChange={setPlace}
        buttonClassName="min-h-11 sm:min-h-0 pointer-coarse:min-h-11"
        tabs={PLACES.map((value) => ({ value, label: t[`place_${value}` as keyof SignupText] }))}
      />
      <OfferPreview>
        <div dir={lang === "ar" ? "rtl" : "ltr"} lang={lang} data-preview-place={place} className={cn("space-y-3", !on && "opacity-50")}>
          {place === "footer" || place === "popup" ? (
            <FormPreview popup={place === "popup"} words={words} heading={copy.label} incentive={copy.incentive} privacy={copy.privacy} />
          ) : (
            <BoxPreview
              words={words}
              storeName={storeName}
              ticked={draft[place].preTicked}
              label={copy.label}
              incentive={copy.incentive}
              privacy={copy.privacy}
              withOrderButton={place !== "cart"}
            />
          )}
        </div>
        {!on && <p className="text-xs font-medium text-ink-soft">{t.previewOff}</p>}
      </OfferPreview>
    </section>
  );
}

function BoxPreview({
  words,
  storeName,
  ticked,
  label,
  incentive,
  privacy,
  withOrderButton,
}: {
  words: SignupText;
  storeName: string;
  ticked: boolean;
  label: string | null;
  incentive: string | null;
  privacy: string | null;
  withOrderButton: boolean;
}) {
  return (
    <div className="space-y-2 rounded-lg bg-paper-raised p-3 ring-1 ring-line" aria-hidden>
      <div className="flex min-h-11 items-center gap-3 text-sm font-medium text-ink">
        <span
          data-preview-ticked={ticked ? "true" : "false"}
          className={cn("inline-flex size-5 shrink-0 items-center justify-center rounded border-2", ticked ? "border-primary bg-primary text-on-primary" : "border-line-strong bg-paper")}
        >
          {ticked && <IconCheck className="size-3.5" />}
        </span>
        <span className="min-w-0">
          {label?.trim() || fmt(words.sfBoxLabel, { store: storeName })}
          {incentive?.trim() && <span className="font-semibold text-primary"> {incentive.trim()}</span>}
        </span>
      </div>
      <p className="ps-8 text-xs text-ink-soft">{privacy?.trim() || words.sfBoxHint}</p>
      {withOrderButton && <div className="flex min-h-11 items-center justify-center rounded-lg bg-primary text-sm font-semibold text-on-primary">{words.sfOrder}</div>}
    </div>
  );
}

function FormPreview({
  popup,
  words,
  heading,
  incentive,
  privacy,
}: {
  popup: boolean;
  words: SignupText;
  heading: string | null;
  incentive: string | null;
  privacy: string | null;
}) {
  return (
    <div className={cn("relative space-y-3 rounded-lg bg-paper-raised p-4 ring-1 ring-line", popup && "mx-auto max-w-sm pt-10 shadow-lg")} aria-hidden>
      {popup && (
        <span className="absolute end-2 top-2 inline-flex size-9 items-center justify-center rounded-lg text-ink-soft" title={words.sfClose}>
          <IconClose className="size-4" />
        </span>
      )}
      <div>
        <p className="text-sm font-semibold text-ink">{heading?.trim() || words.sfHeading}</p>
        {incentive?.trim() && <p className="mt-0.5 text-sm font-semibold text-primary">{incentive.trim()}</p>}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <span dir="ltr" className="flex min-h-11 flex-1 items-center rounded-lg border border-line-strong bg-paper px-3 text-sm text-ink-soft">
          {words.sfEmail}
        </span>
        <span className="flex min-h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-on-primary">{words.sfSubscribe}</span>
      </div>
      <p className="text-xs text-ink-soft">{privacy?.trim() || words.sfPrivacy}</p>
    </div>
  );
}
