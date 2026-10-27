import { useId, useState, type ComponentProps, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Input, Label, cn, ZLoader } from "@store-builder/ui";
import { IconArrowLeft, IconEye, IconEyeOff } from "@/components/icons";
import { LanguageSwitch } from "@/components/LanguageSwitch";
import { ZimosLogo } from "@/components/ZimosLogo";
import { useT, type Messages } from "@/i18n/LocaleContext";

/**
 * The one composition of every screen outside the dashboard: sign in, sign up,
 * the password and email links, the username and plan steps, the Google
 * landing, the store picker.
 *
 * The wallpaper, the ZIMOS mark at the top, the language switch in the corner
 * and ONE card in the middle with what to do. The frame is `.auth-glass`
 * (theme/auth.css) — a solid white card on the page ground — and the glass layer
 * (theme/glass/sweep-account.css) turns the ground into the aurora and the card
 * into a pane. The pieces below are what goes in the card: a title that says what
 * to do, fields with the label above and the error under, links a thumb can
 * hit, a line that says something is on its way.
 *
 * Nothing here knows about accounts: the pages keep their own calls,
 * redirects and tokens.
 */

const STRINGS = {
  en: { show: "Show password", hide: "Hide password" },
  ar: { show: "إظهار كلمة المرور", hide: "إخفاء كلمة المرور" },
} satisfies Messages;

const WIDTH = {
  sm: "max-w-[26rem]",
  md: "max-w-xl",
  lg: "max-w-2xl",
} as const;

export function AuthShell({
  children,
  size = "sm",
  className,
}: {
  children: ReactNode;
  size?: keyof typeof WIDTH;
  /** A card wider than the three sizes (the sign-up form's two columns). */
  className?: string;
}) {
  return (
    <div className="auth-glass">
      <header className="absolute inset-x-0 top-0 z-10 flex h-16 items-center justify-center px-4">
        <ZimosLogo height={30} />
      </header>
      {/* The language can be chosen before signing in, not only in Settings. */}
      <div data-slot="auth-corner" className="absolute end-3 top-2.5 z-10">
        <LanguageSwitch className="h-11" />
      </div>
      <main className="auth-glass-stage">
        <div data-slot="auth-card" className={cn("w-full min-w-0", WIDTH[size], className)}>
          {children}
        </div>
      </main>
    </div>
  );
}

type Tone = "default" | "success" | "danger";
const TILE_TONE: Record<Tone, string> = {
  default: "bg-primary-soft text-primary",
  success: "bg-success-soft text-success",
  danger: "bg-danger-soft text-danger",
};

/**
 * The top of the card: an optional step line, an optional tile with an icon
 * (a result: sent, done, failed), the title — the page's h1 — and one sentence.
 */
export function AuthHeading({
  title,
  children,
  id,
  step,
  icon,
  tone = "default",
  center = false,
}: {
  title: string;
  /** One sentence under the title. */
  children?: ReactNode;
  id?: string;
  /** "Step 1 of 3". */
  step?: string;
  icon?: ReactNode;
  tone?: Tone;
  center?: boolean;
}) {
  return (
    <div className={cn(center && "flex flex-col items-center text-center")}>
      {step && <p className="mb-2 text-xs font-medium text-ink-soft tabular-nums">{step}</p>}
      {icon && (
        <div
          data-slot="auth-tile"
          className={cn("mb-4 flex size-14 shrink-0 items-center justify-center rounded-[1.25rem] [&_svg]:size-8", TILE_TONE[tone])}
        >
          {icon}
        </div>
      )}
      <h1 id={id} className="font-display text-2xl leading-8 font-semibold text-ink sm:text-[1.75rem] sm:leading-9">
        {title}
      </h1>
      {children && <p className="mt-2 text-sm leading-6 text-ink-soft">{children}</p>}
    </div>
  );
}

/** 16px at every width, so a phone never zooms into the field. The height comes from `.auth-glass` (46px). */
export const AUTH_INPUT = "text-base md:text-base";
/** The primary button of a card: full width, 48px under the thumb. */
export const AUTH_SUBMIT = "min-h-12 w-full text-base";

interface AuthFieldProps extends Omit<ComponentProps<typeof Input>, "id"> {
  label: string;
  /** Under the field, in the danger colour: what is wrong and how to fix it. */
  error?: string | null;
  hint?: ReactNode;
  /** On the label's line, at its end (the "forgot password?" link). */
  labelEnd?: ReactNode;
  /** A fixed id, when something outside looks the field up. */
  fieldId?: string;
  /** Inside the field, at its end (the eye of a password). */
  trailing?: ReactNode;
  /** More lines under the field (the password rules still to meet). */
  children?: ReactNode;
}

/** A field of the card: the label above, the input, then the error — or the hint — under it. */
export function AuthField({ label, error, hint, labelEnd, fieldId, trailing, children, className, ...input }: AuthFieldProps) {
  const auto = useId();
  const id = fieldId ?? auto;
  const noteId = `${id}-note`;
  const describedBy = [input["aria-describedby"], error || hint ? noteId : undefined].filter(Boolean).join(" ") || undefined;
  return (
    <div className="space-y-1.5">
      <div className="flex min-h-6 items-center justify-between gap-3">
        <Label htmlFor={id}>{label}</Label>
        {labelEnd}
      </div>
      <div className="relative">
        <Input
          id={id}
          {...input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(AUTH_INPUT, trailing ? "pe-12" : undefined, error && "border-danger", className)}
        />
        {trailing}
      </div>
      {error ? (
        <p id={noteId} role="alert" className="text-[13px] leading-5 font-medium text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={noteId} className="text-xs leading-5 text-ink-soft">
          {hint}
        </p>
      ) : null}
      {children}
    </div>
  );
}

/** A password: the same field with an eye at its end that shows what was typed. The eye is 44px wide. */
export function AuthPasswordField(props: Omit<AuthFieldProps, "type" | "trailing">) {
  const t = useT(STRINGS);
  const [shown, setShown] = useState(false);
  return (
    <AuthField
      {...props}
      type={shown ? "text" : "password"}
      trailing={
        <button
          type="button"
          onClick={() => setShown((was) => !was)}
          aria-label={shown ? t.hide : t.show}
          aria-pressed={shown}
          className="absolute inset-y-0 end-0 flex w-12 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[color,scale] duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
        >
          {shown ? <IconEyeOff className="size-5" aria-hidden /> : <IconEye className="size-5" aria-hidden />}
        </button>
      }
    />
  );
}

/** The password rules still to meet, under the field while it is being typed. */
export function AuthRules({ id, rules }: { id: string; rules: readonly string[] }) {
  if (rules.length === 0) return null;
  return (
    <ul id={id} className="space-y-1 text-xs leading-5 text-ink-soft">
      {rules.map((rule) => (
        <li key={rule} className="flex items-start gap-1.5">
          <span aria-hidden>•</span>
          {rule}
        </li>
      ))}
    </ul>
  );
}

const LINK =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary";

/** A text link of the card, 44px tall. `back` puts the arrow of a way back before it. */
export function AuthLink({ to, children, back = false, className }: { to: string; children: ReactNode; back?: boolean; className?: string }) {
  return (
    <Link to={to} className={cn(LINK, className)}>
      {back && <IconArrowLeft className="size-4 shrink-0 rtl:rotate-180" aria-hidden />}
      {children}
    </Link>
  );
}

/** The same look for something that is not a page: sign out, resend. */
export function AuthLinkButton({ className, type = "button", ...props }: ComponentProps<"button">) {
  return <button type={type} className={cn(LINK, "disabled:cursor-default disabled:opacity-50", className)} {...props} />;
}

/** The last line of a card: a quiet question and the link that answers it. */
export function AuthFooter({ children }: { children: ReactNode }) {
  return <p className="mt-6 flex flex-wrap items-center justify-center gap-x-1.5 text-center text-sm text-ink-soft">{children}</p>;
}

/** "or" between the one-tap ways in and the form. */
export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="my-5 flex items-center gap-3 text-xs text-ink-soft">
      <span className="h-px flex-1 bg-line" />
      {children}
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

/** Something is on its way: the Z loader and what is happening, announced once. */
export function AuthBusy({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div role="status" aria-live="polite" className={cn("flex min-h-11 items-center justify-center gap-3 text-sm text-ink-soft", className)}>
      <ZLoader aria-hidden />
      <span>{children}</span>
    </div>
  );
}

/** Brand-coloured Google "G" — an inline SVG: the mark's own colours, not an icon of the set. */
export function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" width="18" height="18" className="shrink-0" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}
