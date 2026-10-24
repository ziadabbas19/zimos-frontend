import type { PointerEvent, ReactNode } from "react";
import { Button, cn } from "@store-builder/ui";
import { IconCaretRight, IconCheck, IconClose, IconWarning } from "@/components/icons";
import { fmt, useT } from "@/i18n/LocaleContext";
import { SHELL_STRINGS } from "./shellStrings";
import type { EditorDevice } from "./useEditorLayout";

/**
 * The centre zone: a flat, quiet ground with the device frame on it. The
 * frame itself — the storefront in an iframe, its width per device and its
 * scaling — is StorefrontPreview's; this is only what it stands on, plus the
 * strips that can sit above it (`bar`).
 *
 * A press on the bare ground lets go of the selection. Presses inside the
 * storefront never get here: the frame is another document.
 */
export function EditorStage({
  device,
  onClear,
  bar,
  tips,
  children,
}: {
  /** The width the stage is showing, for the glass layer to key on. */
  device: EditorDevice;
  onClear: () => void;
  bar?: ReactNode;
  /** Floats over the bottom of the stage (CanvasTips). */
  tips?: ReactNode;
  children: ReactNode;
}) {
  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    const target = event.target;
    if (target instanceof Element && target.closest("button, a, input, select, textarea, [role='button']")) return;
    onClear();
  }
  return (
    <main data-slot="editor-stage" data-device={device} className="relative flex min-w-0 flex-1 flex-col bg-paper-sunken">
      {bar}
      <div className="relative min-h-0 flex-1" onPointerDown={onPointerDown}>
        {children}
        {tips && <div className="pointer-events-none absolute inset-x-0 bottom-3 z-[2] flex justify-center px-3">{tips}</div>}
      </div>
    </main>
  );
}

/**
 * «تغييرات الشكل بتتنشر على طول — احفظها؟» The look (theme, colours, logo,
 * header, footer, announcement bar) has no draft in the backend: saving it
 * puts it in front of shoppers. So it never saves by itself; while it has
 * changes this strip sits above the stage with the two ways out.
 */
export function LookBar({
  saving,
  error,
  onSave,
  onRevert,
}: {
  saving: boolean;
  /** Why the last save of the look failed, said instead of the question. */
  error: string | null;
  onSave: () => void;
  onRevert: () => void;
}) {
  const t = useT(SHELL_STRINGS);
  return (
    <div
      data-slot="editor-lookbar"
      role="region"
      aria-label={t.lookBar}
      className="relative z-[1] flex shrink-0 flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-line bg-accent-soft px-3 py-2"
    >
      <p role={error ? "alert" : undefined} className="flex min-w-0 flex-1 basis-48 items-start gap-2 text-sm font-medium text-ink">
        {error && <IconWarning className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden />}
        <span className="min-w-0">{error ?? t.lookBar}</span>
      </p>
      <div className="flex shrink-0 items-center gap-2">
        <Button type="button" variant="ghost" className="rounded-full px-4" disabled={saving} onClick={onRevert}>
          {t.lookRevert}
        </Button>
        <Button type="button" variant="secondary" className="rounded-full px-4" disabled={saving} onClick={onSave}>
          {saving ? t.lookSaving : t.lookSave}
        </Button>
      </div>
    </div>
  );
}

/**
 * What can be done on the page itself, said once something is selected: a double-click types in
 * place, a click on a picture of the selected section replaces it, the handles resize and move.
 * Every one of those works already; without this nothing but a tooltip says so. Hidden for good
 * with its X (the editor keeps the choice).
 */
export function CanvasTips({ onDismiss }: { onDismiss: () => void }) {
  const t = useT(SHELL_STRINGS);
  const dot = <span aria-hidden className="text-ink-soft">·</span>;
  return (
    <aside
      data-slot="editor-tips"
      aria-label={t.tips}
      className="pointer-events-auto flex max-w-full items-center gap-1 rounded-full bg-paper-raised py-1 ps-4 pe-1 text-xs text-ink shadow-[var(--shadow-raised)] ring-1 ring-line"
    >
      <p className="m-0 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 py-1">
        <span>{t.tipText}</span>
        {dot}
        <span>{t.tipPicture}</span>
        {dot}
        <span>{t.tipHandles}</span>
      </p>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t.tipsDismiss}
        title={t.tipsDismiss}
        className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:size-11"
      >
        <IconClose className="size-4" aria-hidden />
      </button>
    </aside>
  );
}

/**
 * The first-run steps, for a site that came straight from the template
 * gallery and has never been published: «اختار القالب ✓ → لوّنه بهويتك → انشر».
 * Step two opens the store look, step three the publish sheet. It goes away
 * when dismissed, and for good once the site is published.
 */
export function GuideStrip({
  brandDone,
  onBrand,
  onPublish,
  onDismiss,
}: {
  brandDone: boolean;
  onBrand: () => void;
  onPublish: () => void;
  onDismiss: () => void;
}) {
  const t = useT(SHELL_STRINGS);
  const step = "inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-medium whitespace-nowrap pointer-coarse:min-h-11";
  const action =
    "cursor-pointer bg-paper-raised text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] ring-inset hover:bg-paper focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none";
  const badge = "flex size-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold tabular-nums";
  const arrow = <IconCaretRight className="size-3.5 shrink-0 text-ink-soft rtl:-scale-x-100" aria-hidden />;
  const done = (
    <span className={cn(badge, "bg-success text-paper-raised")}>
      <IconCheck className="size-3" aria-hidden />
      <span className="sr-only">{t.guideDone}</span>
    </span>
  );
  return (
    <nav
      data-slot="editor-guide"
      aria-label={t.guide}
      className="relative z-[1] flex shrink-0 items-center gap-1 border-b border-line bg-primary-soft ps-3 pe-1"
    >
      <ol className="flex min-w-0 flex-1 items-center gap-1.5 overflow-x-auto py-1.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li className={cn(step, "text-ink-soft")}>
          {done}
          {t.guideTemplate}
        </li>
        <li aria-hidden className="flex shrink-0">
          {arrow}
        </li>
        <li className="flex shrink-0">
          <button type="button" onClick={onBrand} className={cn(step, action)}>
            {brandDone ? done : <span className={cn(badge, "bg-primary text-primary-foreground")}>{fmt("{n}", { n: 2 })}</span>}
            {t.guideBrand}
          </button>
        </li>
        <li aria-hidden className="flex shrink-0">
          {arrow}
        </li>
        <li className="flex shrink-0">
          <button type="button" onClick={onPublish} className={cn(step, action)}>
            <span className={cn(badge, "bg-primary text-primary-foreground")}>{fmt("{n}", { n: 3 })}</span>
            {t.guidePublish}
          </button>
        </li>
      </ol>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t.guideDismiss}
        title={t.guideDismiss}
        className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] hover:text-ink focus-visible:outline-2 focus-visible:outline-primary motion-reduce:transition-none"
      >
        <IconClose className="size-4" aria-hidden />
      </button>
    </nav>
  );
}
