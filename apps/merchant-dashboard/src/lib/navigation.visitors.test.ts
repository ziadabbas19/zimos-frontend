import { afterEach, describe, expect, it, vi } from "vitest";

type Navigation = typeof import("./navigation");

/** The navigation is built once from the switches, so each case loads it afresh. */
async function navWith(on: Record<string, boolean>): Promise<Navigation> {
  vi.resetModules();
  vi.doMock("@/lib/features", async (original) => ({ ...(await original<typeof import("@/lib/features")>()), ...on }));
  return import("./navigation");
}

afterEach(() => {
  vi.doUnmock("@/lib/features");
});

describe("the Visitors menu entry", () => {
  it("is not there while VISITORS_ENABLED is off", async () => {
    const nav = await navWith({});
    expect(nav.NAV_ITEMS.map((item) => item.key)).not.toContain("visitors");
  });

  it("sits under Analytics with the switch on, for the roles that read analytics", async () => {
    const nav = await navWith({ VISITORS_ENABLED: true });
    const item = nav.NAV_ITEMS.find((i) => i.key === "visitors");
    expect(item?.to).toBe("/analytics/visitors");
    expect(item?.requires).toEqual(["analytics.view"]);
    expect(nav.NAV_GROUPS.find((g) => g.items.some((i) => i.key === "visitors"))?.id).toBe("analytics");
    expect(nav.NAV_LABELS.en.visitors).toBe("Visitors");
    expect(nav.NAV_LABELS.ar.visitors).toBe("الزوار");
  });
});
