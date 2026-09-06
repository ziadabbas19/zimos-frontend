"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/i18n/provider";
import type { FlowStep } from "@/i18n/dictionary";
import { BarcodeIcon, ChatIcon, PackageCheckIcon, PhoneIcon } from "./icons";

/** Real Zimos tracking-code format: `zg` + 9 digits. */
const EXAMPLE_TRACKING_CODE = "zg482910573";

const STEP_ICON: Record<FlowStep["id"], typeof ChatIcon> = {
  placed: ChatIcon,
  confirmed: PhoneIcon,
  tracked: BarcodeIcon,
  delivered: PackageCheckIcon,
};

// How long each stage holds before the playhead advances (ms).
const HOLD = [1500, 1600, 2000, 2600];

export function OrderLifecycle() {
  const { dict } = useI18n();
  const { steps, flowCaption, flowAria, trackingLabel } = dict.hero;
  const last = steps.length - 1;

  // Server render and first client render both start at 0 — no mismatch.
  const [step, setStep] = useState(0);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    let timer: number | undefined;

    const run = () => {
      window.clearTimeout(timer);
      if (reduce.matches) {
        // Freeze on the completed flow — the whole story in one static frame.
        setStep(last);
        return;
      }
      let i = 0;
      setStep(0);
      const tick = () => {
        i = (i + 1) % steps.length;
        setStep(i);
        timer = window.setTimeout(tick, HOLD[i]);
      };
      timer = window.setTimeout(tick, HOLD[0]);
    };

    run();
    reduce.addEventListener("change", run);
    return () => {
      window.clearTimeout(timer);
      reduce.removeEventListener("change", run);
    };
  }, [steps.length, last]);

  return (
    <figure className="rounded-[var(--radius-card)] border border-line bg-paper-raised p-5 shadow-sm sm:p-6">
      <figcaption className="mb-5 text-sm text-ink-soft">{flowCaption}</figcaption>

      <div className="relative" role="img" aria-label={flowAria}>
        {/* Rail: a single track with one playhead that sweeps the stages.
            Block axis (top/bottom) is not mirrored by `dir`; the inline
            offset uses the logical `start-*` utility. */}
        <span
          aria-hidden
          className="absolute top-4 bottom-4 start-[1.125rem] w-px bg-line"
        />
        <span
          aria-hidden
          className="flow-playhead absolute top-4 start-[1.125rem] w-px bg-primary"
          style={{ blockSize: `calc((100% - 2rem) * ${step / last})` }}
        />

        <ol className="relative space-y-6">
          {steps.map((flowStep, i) => {
            const Icon = STEP_ICON[flowStep.id];
            const reached = i <= step;
            return (
              <li
                key={flowStep.id}
                className="grid grid-cols-[2.25rem_1fr] items-start gap-4"
              >
                <span
                  className={`flow-step relative z-10 flex size-9 items-center justify-center rounded-full border ${
                    reached
                      ? "border-primary bg-primary text-white"
                      : "border-line bg-paper-raised text-ink-soft"
                  }`}
                >
                  <Icon width="1.15rem" height="1.15rem" />
                </span>

                <div className={`flow-step ${reached ? "opacity-100" : "opacity-55"}`}>
                  <p
                    className={`font-medium ${reached ? "text-ink" : "text-ink-soft"}`}
                  >
                    {flowStep.title}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                    {flowStep.detail}
                  </p>

                  {flowStep.id === "tracked" && (
                    <span
                      className={`flow-code mt-2 inline-flex items-center gap-2 rounded-lg border border-accent-dark/35 bg-accent-soft px-2.5 py-1 ${
                        step >= i ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      <span className="text-xs font-medium text-accent-dark">
                        {trackingLabel}
                      </span>
                      <span
                        dir="ltr"
                        className="font-mono text-sm font-semibold tracking-wide text-ink"
                      >
                        {EXAMPLE_TRACKING_CODE}
                      </span>
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </figure>
  );
}
