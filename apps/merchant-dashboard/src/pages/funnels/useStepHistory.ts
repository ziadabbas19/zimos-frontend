import { useCallback, useEffect, useRef, useState } from "react";
import type { PageTree } from "@store-builder/api-client";
import { commit, redo as redoHistory, undo as undoHistory, type History } from "../website/editor/editHistory";

/**
 * Undo / redo for a funnel step's page — the website
 * editor's history (website/editor/editHistory.ts: whole-tree snapshots, a
 * burst of typing in one section folded into one step, 100 steps), with the
 * one difference that the page itself is not kept here: the tree lives in the
 * funnel draft (`UiStep.tree`, saved by the funnel's own Save and its draft
 * autosave). This only remembers the steps back and forward, per step —
 * opening another step starts a fresh history.
 *
 * The keys (Ctrl/⌘+Z, Ctrl/⌘+Shift+Z, Ctrl/⌘+Y) are not listened for here any
 * more: FunnelStepPageEditor hands `undo` / `redo` to the website editor's own
 * `useEditorShortcuts`, so both editors answer the same keys the same way
 * (Arabic keyboard layouts included).
 *
 * `change` and `update` are stable and always act on the newest tree: an edit
 * that arrives late (the Undo of a toast, two edits in one tick) is applied to
 * the page as it is then, not as it was when the callback was made.
 */

interface Stacks {
  stepKey: string;
  past: PageTree[];
  future: PageTree[];
  /** The key and time of the last change, for folding a burst into one step. */
  lastKey: string | null;
  lastAt: number;
}

const fresh = (stepKey: string): Stacks => ({ stepKey, past: [], future: [], lastKey: null, lastAt: 0 });

export function useStepHistory(stepKey: string, tree: PageTree, onTreeChange: (tree: PageTree) => void) {
  const [stacks, setStacks] = useState<Stacks>(() => fresh(stepKey));
  // Another step is another page: its own history (adjusted during render, as React advises).
  if (stacks.stepKey !== stepKey) setStacks(fresh(stepKey));

  // What the stable callbacks below read. Brought up to date after every
  // render, and by each edit as it happens (so a second edit in the same tick
  // builds on the first).
  const live = useRef({ stacks, tree, onTreeChange });
  useEffect(() => {
    live.current = { stacks, tree, onTreeChange };
  });

  /** Moves to `next` (the outcome of a commit, an undo or a redo of the website editor's history). */
  const move = useCallback((from: History<PageTree>, to: History<PageTree>) => {
    if (to === from) return;
    const current = live.current;
    const stacksNow: Stacks = {
      stepKey: current.stacks.stepKey,
      past: to.past,
      future: to.future,
      lastKey: to.lastKey,
      lastAt: to.lastAt,
    };
    live.current = { ...current, stacks: stacksNow, tree: to.present };
    setStacks(stacksNow);
    current.onTreeChange(to.present);
  }, []);

  const historyNow = useCallback((): History<PageTree> => {
    const { stacks: s, tree: present } = live.current;
    return { past: s.past, present, future: s.future, lastKey: s.lastKey, lastAt: s.lastAt };
  }, []);

  /** Records an edit. Pass a `key` to fold a burst of similar edits into one undo step. */
  const change = useCallback(
    (next: PageTree, key?: string) => {
      const from = historyNow();
      move(from, commit(from, next, { key: key ?? null }));
    },
    [historyNow, move]
  );

  /** The same, from the page as it is now. Returning the same tree records nothing. */
  const update = useCallback(
    (edit: (current: PageTree) => PageTree, key?: string) => {
      const from = historyNow();
      move(from, commit(from, edit(from.present), { key: key ?? null }));
    },
    [historyNow, move]
  );

  const undo = useCallback(() => {
    const from = historyNow();
    move(from, undoHistory(from));
  }, [historyNow, move]);

  const redo = useCallback(() => {
    const from = historyNow();
    move(from, redoHistory(from));
  }, [historyNow, move]);

  return { change, update, undo, redo, canUndo: stacks.past.length > 0, canRedo: stacks.future.length > 0 };
}
