import type { ConfirmationAssignee, ConfirmationQueueSort } from "@store-builder/api-client";
import { IconClose } from "@/components/icons";
import { FilterChoice, FilterGroup, FilterSheet } from "@/components/list";
import { fmt } from "@/i18n/LocaleContext";
import { QUEUE_SORTS, type AssignmentFilter } from "./queueModel";
import { useQueueStrings } from "./queueStrings";

type BaseAssignment = "all" | "me" | "unassigned";

function baseOf(assignment: AssignmentFilter): BaseAssignment | null {
  return assignment === "all" ? "all" : assignment === "me" ? "me" : assignment === "unassigned" ? "unassigned" : null;
}

/** The name on a chip for the assignment in effect. */
export function useAssignmentLabel(team: ConfirmationAssignee[]): (assignment: AssignmentFilter) => string {
  const t = useQueueStrings();
  return (assignment) => {
    const base = baseOf(assignment);
    if (base === "all") return t.filterAll;
    if (base === "me") return t.filterMine;
    if (base === "unassigned") return t.filterUnassigned;
    const agent = team.find((member) => member.id === assignment);
    return fmt(t.assignedTo, { name: agent?.fullName ?? t.someone });
  };
}

/**
 * The one place the queue is sorted and filtered: the order of the calls, and
 * whose calls are shown. Both take effect as they change; the sort stays in
 * the address (?sort=) and in this browser, as it always has.
 */
export function QueueFilterSheet({
  open,
  onOpenChange,
  sort,
  onSortChange,
  assignment,
  onAssignmentChange,
  showAssignment,
  team,
  activeCount,
  onReset,
  applyLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sort: ConfirmationQueueSort;
  onSortChange: (sort: ConfirmationQueueSort) => void;
  assignment: AssignmentFilter;
  onAssignmentChange: (assignment: AssignmentFilter) => void;
  /** A solo store has nobody to hand a call to, so it gets no assignment filter at all. */
  showAssignment: boolean;
  /** The agents a manager may filter by; empty for an agent, who only filters by mine / nobody's. */
  team: ConfirmationAssignee[];
  activeCount: number;
  onReset: () => void;
  applyLabel: string;
}) {
  const t = useQueueStrings();
  const base = baseOf(assignment);

  return (
    <FilterSheet
      open={open}
      onOpenChange={onOpenChange}
      title={t.filtersTitle}
      activeCount={activeCount}
      onReset={onReset}
      applyLabel={applyLabel}
    >
      <FilterGroup label={t.sortLabel}>
        <FilterChoice<ConfirmationQueueSort>
          label={t.sortLabel}
          value={sort}
          onChange={(next) => {
            if (next) onSortChange(next);
          }}
          options={QUEUE_SORTS.map((key) => ({ value: key, label: t[`sort_${key}`] }))}
        />
      </FilterGroup>

      {showAssignment && (
        <FilterGroup label={t.assignmentFilter}>
          <FilterChoice<BaseAssignment>
            label={t.assignmentFilter}
            value={base}
            onChange={(next) => {
              if (next) onAssignmentChange(next);
            }}
            options={[
              { value: "all", label: t.filterAll },
              { value: "me", label: t.filterMine },
              { value: "unassigned", label: t.filterUnassigned },
            ]}
          />
        </FilterGroup>
      )}

      {showAssignment && team.length > 0 && (
        <FilterGroup label={t.filterAgents}>
          <FilterChoice<string>
            label={t.filterAgents}
            value={base === null ? assignment : null}
            allowClear
            // Pressing the chosen agent again lets go of them: back to every task.
            onChange={(next) => onAssignmentChange(next ?? "all")}
            options={team.map((agent) => ({ value: agent.id, label: agent.fullName }))}
          />
        </FilterGroup>
      )}
    </FilterSheet>
  );
}

export interface ActiveFilterChip {
  id: string;
  label: string;
  onRemove: () => void;
}

/**
 * The filters in effect, as a row of chips that each take themselves off —
 * drawn only while there is one, so the list starts right under the tabs
 * the rest of the time.
 */
export function ActiveFilterChips({ chips, onClear }: { chips: ActiveFilterChip[]; onClear: () => void }) {
  const t = useQueueStrings();
  if (chips.length === 0) return null;
  return (
    <div role="group" aria-label={t.activeFilters} className="mt-2 flex flex-wrap items-center gap-2">
      {chips.map((chip) => (
        <button
          key={chip.id}
          type="button"
          onClick={chip.onRemove}
          aria-label={fmt(t.removeFilter, { label: chip.label })}
          className="zimos-chip inline-flex h-10 max-w-full cursor-pointer items-center gap-1.5 rounded-full bg-paper-raised ps-3.5 pe-2.5 text-sm font-medium text-ink ring-1 ring-line transition-[scale,background-color] duration-[var(--dur-fade)] ease-[var(--ease-out)] select-none hover:bg-paper-sunken focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] pointer-coarse:h-11 motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <span className="min-w-0 truncate">{chip.label}</span>
          <IconClose className="size-3.5 shrink-0 text-ink-soft" aria-hidden />
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="inline-flex h-10 cursor-pointer items-center rounded-full px-3 text-sm font-medium text-ink-soft transition-colors duration-[var(--dur-fade)] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary pointer-coarse:h-11 motion-reduce:transition-none"
      >
        {t.clearAll}
      </button>
    </div>
  );
}
