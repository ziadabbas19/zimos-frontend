import { useEffect, useState } from "react";

/**
 * `open`, but never true on the first render.
 *
 * A dialog that mounts already open appears without its entrance (Base UI
 * only plays the enter transition when `open` turns true on something that is
 * mounted). A sheet that is first mounted by the press that opens it — the
 * template sheet, a theme's preview — passes its `open` through here, so it
 * mounts closed and opens a frame later, and rises like every other sheet.
 */
export function useMountedOpen(open: boolean): boolean {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  return open && mounted;
}
