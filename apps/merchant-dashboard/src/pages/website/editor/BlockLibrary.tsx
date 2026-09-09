import { Plus } from "lucide-react";
import { BLOCK_GROUPS, BLOCK_PRESETS, type BlockPreset } from "./blocks";

/**
 * Left sidebar. Every entry maps onto element types the backend actually
 * allows (pageTree.ALLOWED_ELEMENT_TYPES) — adding one that isn't on that
 * allowlist would make the page unsaveable, so the list is derived from
 * BLOCK_PRESETS rather than hand-written here.
 */
export function BlockLibrary({ onAdd }: { onAdd: (preset: BlockPreset) => void }) {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-line px-4 py-3">
        <h2 className="font-display text-sm font-medium text-ink">Add a block</h2>
        <p className="text-xs text-ink-soft">Appended to the bottom of the page.</p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {BLOCK_GROUPS.map((group) => {
          const presets = BLOCK_PRESETS.filter((p) => p.group === group);
          if (presets.length === 0) return null;
          return (
            <div key={group} className="mb-4 last:mb-0">
              <p className="px-1 pb-1.5 text-xs font-medium uppercase tracking-wide text-ink-soft">
                {group}
              </p>
              <div className="space-y-0.5">
                {presets.map((preset) => {
                  const Icon = preset.icon;
                  return (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => onAdd(preset)}
                      title={preset.description}
                      className="group flex w-full items-center gap-2 rounded-[0.5rem] px-2 py-2 text-left text-sm text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      <Icon className="size-4 shrink-0 text-ink-soft group-hover:text-primary" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">{preset.label}</span>
                      <Plus
                        className="size-4 shrink-0 text-ink-soft opacity-0 transition-opacity group-hover:opacity-100"
                        aria-hidden
                      />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
