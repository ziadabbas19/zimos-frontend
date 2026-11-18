import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "@/i18n/LocaleContext";
import { usePublishFlow } from "./usePublishFlow";
import type { EditorDocument } from "./useEditorDocument";

vi.mock("@/components/Toast", () => ({ useToast: () => ({ notify: vi.fn(), error: vi.fn(), success: vi.fn() }) }));

function setup(over: Partial<EditorDocument>) {
  const calls: string[] = [];
  const doc = {
    lookDirty: true,
    flush: vi.fn().mockResolvedValue(true),
    saveLook: vi.fn(async () => {
      calls.push("look");
      return true;
    }),
    publish: vi.fn(async () => {
      calls.push("publish");
      return { ok: true, revision: { revisionNumber: 3 } };
    }),
    ...over,
  } as unknown as EditorDocument;
  const { result } = renderHook(() => usePublishFlow(doc, "shop"), { wrapper: LocaleProvider });
  return { doc, calls, result };
}

describe("publishing from the editor", () => {
  it("saves the look first, so the store matches the preview", async () => {
    const { calls, result } = setup({});
    await act(() => result.current.publishNow());
    expect(calls).toEqual(["look", "publish"]);
  });

  it("publishes nothing when the look can't be saved, and says so", async () => {
    const { doc, result } = setup({ saveLook: vi.fn().mockResolvedValue(false) });
    await act(() => result.current.publishNow());
    expect(doc.publish).not.toHaveBeenCalled();
    expect(result.current.error).toMatch(/couldn't save your look/);
  });

  it("does not touch a look that has not changed", async () => {
    const { doc, result } = setup({ lookDirty: false });
    await act(() => result.current.publishNow());
    expect(doc.saveLook).not.toHaveBeenCalled();
    expect(doc.publish).toHaveBeenCalledTimes(1);
  });
});
