import { cn } from "@store-builder/ui";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    label: "How your store gets started",
    stepOf: "Step {n} of {total}: {name}",
    number: "{n}",
    choose: "Choose a template",
    brand: "Make it yours",
    brandShort: "Brand it",
    publish: "Publish",
    sentence:
      "Pick a template you like. The editor opens next, where you put in your colour and logo, then publish. Everything can be changed later.",
  },
  ar: {
    label: "كيف يبدأ متجرك",
    stepOf: "الخطوة {n} من {total}: {name}",
    number: "{n}",
    choose: "اختر القالب",
    brand: "اجعله بهويتك",
    brandShort: "الهوية",
    publish: "انشر",
    sentence: "اختر قالبًا يعجبك، ثم يفتح المحرر لتضع لونك وشعار متجرك وتنشر. ويمكنك تغيير كل شيء لاحقًا.",
  },
} satisfies Messages;

const TOTAL = 3;

/**
 * First run, when the store has no site yet: the page IS these three steps.
 * «اختار القالب → لوّنه بهويتك → انشر» as a slim row of pills joined by a line
 * — the first one current, the other two still to come (they happen in the
 * editor, which opens with `?start=1` once a template is used) — and one
 * sentence of what happens. A picture of the way, not a control: nothing here
 * is pressed.
 *
 * Material (the pane, the brand fill of the current step, the beads) is in
 * glass/website.css; on its own it is a raised card with a solid brand pill.
 */
export function StartSteps({ className }: { className?: string }) {
  const t = useT(STRINGS);
  const steps = [
    { full: t.choose, short: t.choose },
    { full: t.brand, short: t.brandShort },
    { full: t.publish, short: t.publish },
  ];

  return (
    <div
      data-slot="start-steps"
      className={cn(
        "zimos-start-steps min-w-0 rounded-[var(--radius-card)] bg-paper-raised p-3 shadow-[var(--shadow-card)] ring-1 ring-line sm:p-4",
        className
      )}
    >
      <ol aria-label={t.label} className="flex items-center">
        {steps.map((step, index) => {
          const current = index === 0;
          return (
            <li
              key={step.full}
              aria-current={current ? "step" : undefined}
              className={cn("flex min-w-0 items-center", index > 0 && "flex-1")}
            >
              {index > 0 && (
                <span aria-hidden data-slot="start-step-line" className="mx-1 h-0.5 min-w-2 flex-1 rounded-full bg-line sm:mx-2" />
              )}
              {/* Read as one sentence; the pill itself is the picture of it. */}
              <span className="sr-only">{fmt(t.stepOf, { n: index + 1, total: TOTAL, name: step.full })}</span>
              <span
                data-slot="start-step"
                data-state={current ? "current" : "todo"}
                className={cn(
                  "inline-flex h-9 min-w-0 items-center gap-1.5 rounded-full ps-1.5 pe-3 text-[13px] leading-none font-semibold select-none",
                  current
                    ? "bg-primary text-primary-foreground forced-colors:bg-[Highlight] forced-colors:text-[HighlightText]"
                    : "text-ink-soft"
                )}
              >
                <span
                  aria-hidden
                  data-slot="start-step-bead"
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-xs leading-none font-semibold tabular-nums",
                    current ? "bg-primary-foreground text-primary" : "bg-paper-sunken text-ink-soft"
                  )}
                >
                  {fmt(t.number, { n: index + 1 })}
                </span>
                {step.short === step.full ? (
                  <span aria-hidden className="min-w-0 truncate">
                    {step.full}
                  </span>
                ) : (
                  <>
                    <span aria-hidden className="min-w-0 truncate sm:hidden">
                      {step.short}
                    </span>
                    <span aria-hidden className="hidden min-w-0 truncate sm:inline">
                      {step.full}
                    </span>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <p data-slot="start-steps-note" className="mt-3 px-1 text-sm leading-6 text-ink-soft">
        {t.sentence}
      </p>
    </div>
  );
}
