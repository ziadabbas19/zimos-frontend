import { IconPushLeft, IconPushRight } from "@/components/icons";
import { Button, cn } from "@store-builder/ui";

/**
 * A desktop side pane — block library, layer list, inspector, step list —
 * that collapses to a slim icon rail instead of disappearing, so its width
 * goes back to the canvas without losing the "there's a panel here" cue. Used
 * by the website and funnel editors, which otherwise spend two fixed-width
 * panes (`w-72`/`w-80` each) on chrome around the one thing a merchant is
 * actually looking at: the live preview.
 *
 * `side` is which edge it sits against — logical, not physical, so it mirrors
 * correctly in RTL the same way the callers' own `border-e`/`border-s` do.
 *
 * This composite covers editors whose pane is hidden entirely below its
 * breakpoint (the website editor: a drawer takes over on small screens). For
 * an editor whose pane instead stacks full-width on small screens (the funnel
 * flow view), compose `PaneRail` and `PaneCollapseToggle` directly against the
 * existing responsive classes — see FunnelEditorPage.
 */
export function CollapsiblePane({
  side,
  collapsed,
  onCollapsedChange,
  visibleClassName,
  railClassName,
  collapseLabel,
  expandLabel,
  children,
}: {
  side: "start" | "end";
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
  /** e.g. "lg:flex lg:w-72" — shown expanded, from that breakpoint up. */
  visibleClassName: string;
  /** e.g. "lg:flex" — the same breakpoint, for the collapsed 48px rail. */
  railClassName: string;
  collapseLabel: string;
  expandLabel: string;
  children: React.ReactNode;
}) {
  if (collapsed) {
    return <PaneRail side={side} expandLabel={expandLabel} onExpand={() => onCollapsedChange(false)} className={cn("hidden", railClassName)} />;
  }

  return (
    <div className={cn("hidden shrink-0 flex-col border-line bg-paper-raised", side === "start" ? "border-e" : "border-s", visibleClassName)}>
      <PaneCollapseToggle side={side} collapseLabel={collapseLabel} onCollapse={() => onCollapsedChange(true)} />
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
    </div>
  );
}

/** The slim 48px icon rail a collapsed pane becomes. */
export function PaneRail({
  side,
  expandLabel,
  onExpand,
  className,
}: {
  side: "start" | "end";
  expandLabel: string;
  onExpand: () => void;
  className?: string;
}) {
  const OpenIcon = side === "start" ? IconPushRight : IconPushLeft;
  return (
    <div className={cn("w-12 shrink-0 flex-col items-center border-line bg-paper-raised py-2", side === "start" ? "border-e" : "border-s", className)}>
      <Button type="button" size="icon" variant="ghost" aria-label={expandLabel} title={expandLabel} onClick={onExpand}>
        <OpenIcon className="size-4 rtl:-scale-x-100" aria-hidden />
      </Button>
    </div>
  );
}

/** The small header strip an expanded pane carries, to collapse it back down. */
export function PaneCollapseToggle({
  side,
  collapseLabel,
  onCollapse,
}: {
  side: "start" | "end";
  collapseLabel: string;
  onCollapse: () => void;
}) {
  const CloseIcon = side === "start" ? IconPushLeft : IconPushRight;
  return (
    <div className="flex items-center justify-end border-b border-line px-1.5 py-1">
      <Button type="button" size="icon" variant="ghost" aria-label={collapseLabel} title={collapseLabel} onClick={onCollapse}>
        <CloseIcon className="size-4 rtl:-scale-x-100" aria-hidden />
      </Button>
    </div>
  );
}
