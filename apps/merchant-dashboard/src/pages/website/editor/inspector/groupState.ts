/** Which foldable inspector groups were left open, for as long as the editor stays open (controls.tsx Group). */
export const openGroups = new Map<string, boolean>();

export const OPEN_GROUP_EVENT = "zimos:inspector-open-group";

/**
 * Opens the foldable group `id` — the one showing now, and every one that
 * mounts with that id from here on (the canvas's "Aa" opens the Font group).
 */
export function openGroup(id: string): void {
  openGroups.set(id, true);
  window.dispatchEvent(new CustomEvent(OPEN_GROUP_EVENT, { detail: id }));
}
