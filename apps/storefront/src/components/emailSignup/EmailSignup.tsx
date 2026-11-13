"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { ApiError, storefrontEmailSignup, type StoreEmailSignup } from "@store-builder/api-client";
import { createStorefrontApiClient } from "@/lib/apiClient";
import { useStore } from "@/lib/StoreContext";
import { useDialog } from "@/lib/useDialog";
import { pickText, type Locale } from "@/lib/i18n";
import { looksLikeEmail, popupSeen, rememberPopup, signupCopy, signupPlaces, signupQuietPath } from "@/lib/emailSignup";
import { CheckIcon, CrossIcon } from "../Icons";
import { btnPrimary, card, container, input } from "../ui";

/*
 * The footer and popup signup for the store's marketing emails (Marketing →
 * Email campaigns → Signup placement): an email field and a button. A signup
 * sends nothing to the shopper; the server answers the same whether or not
 * it knew the address (backend emailCampaigns/signupService.js).
 */

const TEXT = {
  en: {
    heading: "Get our offers by email",
    privacy: "No spam. Unsubscribe from any email in one click.",
    email: "Email address",
    placeholder: "you@example.com",
    subscribe: "Subscribe",
    sending: "Subscribing…",
    thanks: "You're subscribed. Thank you!",
    invalid: "Enter a valid email address.",
    tooMany: "Too many tries. Please wait a minute and try again.",
    failed: "That didn't go through. Please try again.",
    close: "Close",
  },
  ar: {
    heading: "خليك أول من يعرف بعروضنا على الإيميل",
    privacy: "من غير رسائل مزعجة، وتقدر تلغي الاشتراك من أي رسالة بضغطة واحدة.",
    email: "البريد الإلكتروني",
    placeholder: "you@example.com",
    subscribe: "اشترك",
    sending: "جاري الاشتراك…",
    thanks: "تم الاشتراك. شكرًا ليك!",
    invalid: "اكتب بريد إلكتروني صحيح.",
    tooMany: "محاولات كتير. استنى دقيقة وجرّب تاني.",
    failed: "ما تمش الاشتراك. جرّب تاني.",
    close: "إغلاق",
  },
  fr: {
    heading: "Recevez nos offres par e-mail",
    privacy: "Pas de spam. Désabonnement en un clic depuis chaque e-mail.",
    email: "Adresse e-mail",
    placeholder: "vous@exemple.com",
    subscribe: "S'abonner",
    sending: "Inscription…",
    thanks: "C'est fait. Merci !",
    invalid: "Saisissez une adresse e-mail valide.",
    tooMany: "Trop d'essais. Patientez une minute.",
    failed: "Ça n'a pas marché. Réessayez.",
    close: "Fermer",
  },
};

type Words = (typeof TEXT)["en"];
export const signupWords = (locale: Locale): Words => pickText(TEXT, locale) as Words;

/** The email field, the button and what the server said. */
export function EmailSignupForm({
  workspaceId,
  source,
  locale,
  compact = false,
  autoFocus = false,
  onDone,
}: {
  workspaceId: string;
  source: "footer" | "popup";
  locale: Locale;
  compact?: boolean;
  autoFocus?: boolean;
  onDone?: () => void;
}) {
  const t = signupWords(locale);
  const id = useId();
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    if (!looksLikeEmail(email)) {
      setError(t.invalid);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await storefrontEmailSignup(createStorefrontApiClient(), workspaceId, { email: email.trim(), source, ...(website ? { website } : {}) });
      setDone(true);
      onDone?.();
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0;
      setError(status === 422 ? t.invalid : status === 429 ? t.tooMany : t.failed);
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <p role="status" className="flex min-h-11 items-center gap-2 text-sm font-semibold text-success">
        <CheckIcon size={18} />
        {t.thanks}
      </p>
    );
  }

  const errorId = `${id}-error`;
  return (
    <form onSubmit={submit} noValidate className={compact ? "w-full" : "w-full max-w-md"}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor={`${id}-email`} className="sr-only">
          {t.email}
        </label>
        <input
          id={`${id}-email`}
          type="email"
          inputMode="email"
          autoComplete="email"
          dir="ltr"
          required
          // A dialog takes focus to its first field (lib/useDialog); the footer never does.
          data-autofocus={autoFocus ? "" : undefined}
          placeholder={t.placeholder}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          className={`${input} min-h-11 flex-1`}
        />
        <button type="submit" disabled={busy} className={`${btnPrimary} shrink-0`}>
          {busy ? t.sending : t.subscribe}
        </button>
      </div>
      {/* Not for people: hidden from sight and from assistive tech; a bot that fills it is answered and ignored. */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        value={website}
        onChange={(e) => setWebsite(e.target.value)}
        className="absolute -start-[9999px] h-0 w-0 opacity-0"
      />
      <p id={errorId} role="alert" className="mt-2 text-sm font-medium text-danger empty:hidden">
        {error}
      </p>
    </form>
  );
}

function Heading({ signup, locale, as: Tag = "p", id }: { signup: StoreEmailSignup; locale: Locale; as?: "p" | "h2"; id?: string }) {
  const t = signupWords(locale);
  const copy = signupCopy(signup, locale);
  return (
    <div className="min-w-0">
      <Tag id={id} className="text-base font-semibold text-ink">
        {copy.label || t.heading}
      </Tag>
      {copy.incentive && <p className="mt-1 text-sm font-semibold text-primary">{copy.incentive}</p>}
    </div>
  );
}

/**
 * A slim band right above the store's footer, on every page the footer is
 * drawn on (all three footer looks), when the merchant switched it on.
 */
export function FooterEmailSignup() {
  const { store, locale } = useStore();
  const signup = signupPlaces(store?.emailSignup);
  if (!store || !signup || !signup.footer) return null;
  const copy = signupCopy(signup, locale);
  const t = signupWords(locale);
  return (
    <section aria-label={copy.label || t.heading} data-email-signup="footer" className="border-t border-line bg-paper-raised">
      <div className={`${container} flex flex-col gap-3 py-6 md:flex-row md:items-center md:justify-between md:gap-8`}>
        <Heading signup={signup} locale={locale} />
        <div className="w-full md:max-w-md">
          <EmailSignupForm workspaceId={store.id} source="footer" locale={locale} compact />
          <p className="mt-2 text-xs text-ink-soft">{copy.privacy || t.privacy}</p>
        </div>
      </div>
    </section>
  );
}

/** Whether this device has a mouse to leave the page with (no exit intent on a phone). */
function finePointer(): boolean {
  try {
    return window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  } catch {
    return false;
  }
}

/**
 * The popup: after the merchant's seconds, or when the pointer leaves the
 * page towards the browser's bar (a computer only; a phone or tablet waits
 * the seconds instead). Once per visitor — remembered when it opens, in the
 * browser's storage, or for this page alone when storage is unavailable —
 * and never where the shopper is paying or reading an order.
 */
export function EmailSignupPopup() {
  const { store, locale } = useStore();
  const pathname = usePathname() ?? "";
  const signup = signupPlaces(store?.emailSignup);
  const popup = signup?.popup ?? null;
  const workspaceId = store?.id ?? "";
  const quiet = signupQuietPath(pathname);
  const [open, setOpen] = useState(false);
  const shown = useRef(false);

  useEffect(() => {
    if (!popup || !workspaceId || quiet || shown.current || popupSeen(workspaceId)) return;
    const show = () => {
      if (shown.current || popupSeen(workspaceId)) return;
      shown.current = true;
      rememberPopup(workspaceId);
      setOpen(true);
    };
    if (popup.trigger === "exit_intent" && finePointer()) {
      const onLeave = (e: MouseEvent) => {
        if (!e.relatedTarget && e.clientY <= 0) show();
      };
      document.addEventListener("mouseout", onLeave);
      return () => document.removeEventListener("mouseout", onLeave);
    }
    const timer = window.setTimeout(show, popup.delaySeconds * 1000);
    return () => window.clearTimeout(timer);
  }, [popup, workspaceId, quiet]);

  // Into the checkout while it is open: it steps aside.
  const visible = open && !quiet;
  const dialogRef = useDialog<HTMLDivElement>({ open: visible, onClose: () => setOpen(false) });

  if (!store || !signup || !popup || !visible) return null;
  const t = signupWords(locale);
  const copy = signupCopy(signup, locale);
  const titleId = `email-signup-popup-title-${store.id}`;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 sm:items-center" onMouseDown={() => setOpen(false)}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        data-email-signup="popup"
        className={`${card} relative w-full max-w-md p-6 pt-12 shadow-xl`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label={t.close}
          className="absolute end-2 top-2 inline-flex h-11 w-11 cursor-pointer items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-paper hover:text-ink focus-visible:outline-2 focus-visible:outline-primary"
        >
          <CrossIcon size={18} />
        </button>
        <Heading signup={signup} locale={locale} as="h2" id={titleId} />
        <div className="mt-4">
          <EmailSignupForm workspaceId={store.id} source="popup" locale={locale} compact autoFocus />
        </div>
        <p className="mt-3 text-xs text-ink-soft">{copy.privacy || t.privacy}</p>
      </div>
    </div>
  );
}
