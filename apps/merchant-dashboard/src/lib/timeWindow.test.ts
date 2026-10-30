import { describe, expect, it } from "vitest";
import { rangeNow } from "./timeWindow";
import { rangeWindows } from "./analytics";
import { webRangeWindow } from "./webAnalytics";

const at = (iso: string) => new Date(iso).getTime();

describe("a date range's now", () => {
  it("is the start of the next minute, so nothing up to now is left out", () => {
    expect(new Date(rangeNow(at("2026-10-30T10:15:20.123Z"))).toISOString()).toBe("2026-10-30T10:16:00.000Z");
    expect(new Date(rangeNow(at("2026-10-30T10:15:00.000Z"))).toISOString()).toBe("2026-10-30T10:15:00.000Z");
  });

  it("gives the same windows for every read within a minute", () => {
    const first = rangeWindows("30d", at("2026-10-30T10:15:01.000Z"));
    const later = rangeWindows("30d", at("2026-10-30T10:15:59.999Z"));
    expect(later).toEqual(first);
    expect(first.current.to).toBe("2026-10-30T10:16:00.000Z");
    expect(first.current.from).toBe("2026-09-30T10:16:00.000Z");
    expect(first.previous.to).toBe(first.current.from);

    expect(webRangeWindow("7d", at("2026-10-30T10:15:01.000Z"))).toEqual(webRangeWindow("7d", at("2026-10-30T10:15:42.000Z")));
    expect(webRangeWindow("7d", at("2026-10-30T10:15:01.000Z")).to).toBe("2026-10-30T10:16:00.000Z");
  });

  it("still moves on with the next minute", () => {
    expect(rangeWindows("7d", at("2026-10-30T10:16:00.001Z")).current.to).toBe("2026-10-30T10:17:00.000Z");
  });
});
