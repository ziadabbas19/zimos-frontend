import { useCallback, useId, useMemo, useRef, useState } from "react";
import { Button, cn } from "@store-builder/ui";
import { IconSliders } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { SheetFrame, SheetHeader } from "@/components/Sheet";
import { PHONE_QUERY, useMediaQuery } from "@/components/report/useMediaQuery";
import { useT } from "@/i18n/LocaleContext";
import type { UiStep } from "./funnelAdapter";
import { GeoPart } from "./sheet/GeoPart";
import { SettingsPart } from "./sheet/SettingsPart";
import { TestsPart } from "./sheet/TestsPart";
import { SheetGuardContext, type SheetGuard } from "./sheet/sheetKit";
import { SHEET_STRINGS } from "./sheet/sheetStrings";

/**
 * A funnel's own settings, order emails, split tests and country redirects
 * (SPEC §9.6, §9.7) — out of the canvas's way, in one side sheet: a panel on
 * the end edge on a desktop, a full-height bottom sheet on a phone.
 *
 * Four parts behind one segmented control: «الإعدادات», «الإيميلات»,
 * «اختبارات A/B», «الدول». Each part saves on its own, outside the funnel's
 * Save (the sheet says so), keeps its own unsaved state and pins its own save
 * bar under the scrolling body. Closing the sheet or changing part over
 * something unsaved asks first.
 *
 * `FunnelGrowthButton` is the trigger with the sheet; `FunnelSettingsSheet`
 * is the sheet alone, for a caller that opens it from somewhere else (a step
 * card's test badge, the inspector).
 */

export type FunnelSheetTab = "settings" | "tests" | "geo";

/*
 * The pane: about 480px on the end edge from 640px, 92% of the screen's height
 * on a phone. Fields inside are 16px on a phone so iOS does not zoom into them,
 * and 44px tall.
 */
const PANE =
  "zimos-funnel-sheet max-sm:h-[92dvh] sm:w-[min(30rem,calc(100vw_-_1.5rem))] " +
  "max-sm:[&_input:not([type=checkbox],[type=radio],[type=range])]:min-h-11 max-sm:[&_input]:text-base max-sm:[&_select]:min-h-11 max-sm:[&_select]:text-base max-sm:[&_textarea]:text-base";
/** While a version's page is being edited the page editor gets the width of the window. */
const PANE_WIDE = "sm:w-[min(84rem,calc(100vw_-_1.5rem))]";
/** Four segments in a phone's width: tighter padding, a step smaller. */
const SEGMENTS = "w-full max-sm:[&_[role=radio]]:px-1.5 max-sm:[&_[role=radio]]:text-[13px]";

export interface FunnelSettingsSheetProps {
  funnelId: string;
  /** The funnel's steps as they are being edited: what a split test can run on. */
  steps: UiStep[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The part shown each time the sheet opens. Left out: the part it was left on (settings the first time). */
  initialTab?: FunnelSheetTab;
  /** With the tests part: open that step's test, or a new test on it when it has none. */
  testStepKey?: string | null;
  /** Told the funnel's new link once it is changed here (the open editor does not re-read it by itself). */
  onLinkChange?: (subdomain: string) => void;
}

export function FunnelSettingsSheet({ funnelId, steps, open, onOpenChange, initialTab, testStepKey, onLinkChange }: FunnelSettingsSheetProps) {
  const t = useT(SHEET_STRINGS);
  const phone = useMediaQuery(PHONE_QUERY);
  const noticeId = useId();
  const [tab, setTab] = useState<FunnelSheetTab>(initialTab ?? "settings");
  const [wide, setWide] = useState(false);
  // Who holds something unsaved, by reporter. The sheet only needs to know whether anyone does.
  const [dirtyBy, setDirtyBy] = useState<Record<string, boolean>>({});
  // What the merchant was about to do when the unsaved question came up.
  const [pending, setPending] = useState<(() => void) | null>(null);

  // On each opening: the asked-for part, and nothing left over from last time.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      if (initialTab) setTab(initialTab);
      setPending(null);
      setDirtyBy({});
      setWide(false);
    }
  }

  const anyDirty = Object.values(dirtyBy).some(Boolean);
  const dirtyRef = useRef(anyDirty);
  dirtyRef.current = anyDirty;

  const setDirty = useCallback((id: string, dirty: boolean) => {
    setDirtyBy((prev) => ((prev[id] ?? false) === dirty ? prev : { ...prev, [id]: dirty }));
  }, []);
  const guard = useCallback((action: () => void) => {
    if (dirtyRef.current) setPending(() => action);
    else action();
  }, []);
  const guardValue = useMemo<SheetGuard>(() => ({ setDirty, guard, setWide }), [setDirty, guard]);

  const nav = (
    <div data-funnel-sheet-nav="" className="shrink-0 px-5 pb-3">
      <Segmented<FunnelSheetTab>
        label={t.parts}
        value={tab}
        onChange={(next) => guard(() => setTab(next))}
        className={SEGMENTS}
        options={[
          { value: "settings", label: t.tabSettings },
          { value: "tests", label: phone ? t.tabTestsShort : t.tabTests },
          { value: "geo", label: t.tabGeo },
        ]}
      />
      <p className="mt-2 text-xs leading-5 text-ink-soft">{t.savesAlone}</p>
    </div>
  );

  return (
    <SheetFrame
      open={open}
      onOpenChange={(next) => {
        if (!next) guard(() => onOpenChange(false));
      }}
      side="auto-end"
      className={cn(PANE, wide && PANE_WIDE)}
    >
      <SheetGuardContext.Provider value={guardValue}>
        <SheetHeader title={t.title} />
        {pending && (
          <div
            role="alertdialog"
            aria-labelledby={noticeId}
            data-slot="sheet-notice"
            className="mx-4 mb-3 shrink-0 rounded-[1.25rem] bg-accent-soft px-4 py-3"
          >
            <p id={noticeId} className="text-sm font-semibold text-accent-dark">
              {t.unsavedTitle}
            </p>
            <p className="mt-0.5 text-sm text-ink-soft">{t.unsavedBody}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                autoFocus
                onClick={() => setPending(null)}
                className="min-h-11 cursor-pointer rounded-full bg-paper-raised px-4 text-sm font-semibold text-ink ring-1 ring-line-strong transition-[scale,background-color] duration-[var(--dur-fade)] hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
              >
                {t.unsavedStay}
              </button>
              <button
                type="button"
                onClick={() => {
                  const action = pending;
                  setPending(null);
                  // What was unsaved is given up: nothing guards the action now.
                  setDirtyBy({});
                  dirtyRef.current = false;
                  action();
                }}
                className="min-h-11 cursor-pointer rounded-full px-4 text-sm font-semibold text-danger transition-[scale,background-color] duration-[var(--dur-fade)] hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none"
              >
                {t.unsavedLeave}
              </button>
            </div>
          </div>
        )}
        {tab === "settings" && <SettingsPart funnelId={funnelId} nav={nav} onLinkSaved={onLinkChange} />}
        {tab === "tests" && <TestsPart funnelId={funnelId} steps={steps} nav={nav} focusStepKey={testStepKey} />}
        {tab === "geo" && <GeoPart funnelId={funnelId} nav={nav} />}
      </SheetGuardContext.Provider>
    </SheetFrame>
  );
}

export interface FunnelGrowthButtonProps {
  funnelId: string;
  steps: UiStep[];
  /** Optional: the part the sheet opens on. Default: where it was left (settings the first time). */
  initialTab?: FunnelSheetTab;
  /** Optional controlled pair: lets the canvas or the inspector open the same sheet. Left out, the button keeps the state. */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** Optional, with the tests part: open that step's test, or a new test on it. */
  testStepKey?: string | null;
  /** Optional: told the funnel's new link when it is changed in the sheet. */
  onLinkChange?: (subdomain: string) => void;
  /** Optional: classes for the trigger button (the header decides where it sits). */
  className?: string;
}

/** The editor's «إعدادات الفانل» button, with the sheet it opens. */
export function FunnelGrowthButton({ funnelId, steps, initialTab, open, onOpenChange, testStepKey, onLinkChange, className }: FunnelGrowthButtonProps) {
  const t = useT(SHEET_STRINGS);
  const [inner, setInner] = useState(false);
  const isOpen = open ?? inner;
  const setOpen = (next: boolean) => {
    if (open === undefined) setInner(next);
    onOpenChange?.(next);
  };

  return (
    <>
      <Button type="button" size="sm" variant="outline" className={cn("pointer-coarse:min-h-11", className)} onClick={() => setOpen(true)}>
        <IconSliders className="size-4" aria-hidden />
        {t.open}
      </Button>
      <FunnelSettingsSheet
        funnelId={funnelId}
        steps={steps}
        open={isOpen}
        onOpenChange={setOpen}
        initialTab={initialTab}
        testStepKey={testStepKey}
        onLinkChange={onLinkChange}
      />
    </>
  );
}
