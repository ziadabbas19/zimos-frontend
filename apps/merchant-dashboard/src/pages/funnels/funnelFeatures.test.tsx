import { useState } from "react";
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { UiEdge, UiFunnel, UiStep, UiStepType } from "./funnelAdapter";
import { duplicateStep } from "./funnelFlow";
import { stepPageTree } from "./funnelPages";
import { isGenericStep } from "./genericPageRules";
import {
  CONTROL_KEY,
  MAX_VERSIONS,
  VersionSharesEditor,
  evenShares,
  rebalanceShares,
  sharesTotal,
  toPayload,
  type VersionDraft,
} from "./SplitTestVersions";

/**
 * Two things a funnel editor does more than once a day: copying a step, and
 * splitting a page's visitors between versions. The backend takes two to five
 * versions whose shares add up to exactly 100 (modules/funnels/splitTests.js).
 */

function step(key: string, type: UiStepType, i: number, over: Partial<UiStep> = {}): UiStep {
  return {
    id: `step_${key}`,
    key,
    name: key,
    type,
    offerId: null,
    bumpOfferId: null,
    experimentId: null,
    seo: {},
    tree: stepPageTree(type, "en"),
    x: 40 + i * 340,
    y: 64,
    ...over,
  };
}

function edge(id: string, from: string, to: string, condition: UiEdge["condition"], priority = 0): UiEdge {
  return { id, serverId: id, fromStepKey: from, toStepKey: to, condition, priority };
}

function funnel(steps: UiStep[], edges: UiEdge[]): UiFunnel {
  return { id: "f1", name: "Funnel", subdomain: null, status: "draft", steps, edges } as unknown as UiFunnel;
}

const idsOf = (s: UiStep) => {
  const ids: string[] = [];
  for (const section of s.tree.sections) {
    ids.push(section.id);
    for (const row of section.rows ?? []) {
      ids.push(row.id);
      for (const column of row.columns ?? []) {
        ids.push(column.id);
        for (const element of column.elements ?? []) ids.push(element.id);
      }
    }
  }
  return ids;
};

describe("a copy of a step", () => {
  const upsell = step("upsell", "upsell", 2, {
    name: "Extra offer",
    offerId: "offer_7",
    experimentId: "exp_1",
    seo: { title: "One more thing", nested: { a: 1 } },
  });
  const base = funnel(
    [step("landing", "landing", 0), step("checkout", "checkout", 1, { bumpOfferId: "bump_3" }), upsell, step("thank-you", "thank_you", 3)],
    [
      edge("e1", "landing", "checkout", "always"),
      edge("e2", "checkout", "upsell", "completed_checkout"),
      edge("e3", "upsell", "thank-you", "accepted_offer", 1),
      edge("e4", "upsell", "thank-you", "declined_offer"),
    ]
  );
  const taken = base.steps.map((s) => s.key);

  it("sits right after the original, unsaved, with a key of its own", () => {
    const result = duplicateStep(base, "checkout", "checkout (copy)", taken)!;
    expect(result.funnel.steps.map((s) => s.key)).toEqual(["landing", "checkout", "checkout-2", "upsell", "thank-you"]);
    const copy = result.funnel.steps[2];
    expect(result.key).toBe("checkout-2");
    expect(copy).toMatchObject({ id: null, name: "checkout (copy)", type: "checkout", bumpOfferId: "bump_3" });
    // Somewhere free on the map, never on top of another card.
    expect(result.funnel.steps.filter((s) => s.x === copy.x && s.y === copy.y)).toHaveLength(1);
  });

  it("carries the offer and the search settings, but not the running test", () => {
    const { funnel: next, key } = duplicateStep(base, "upsell", "Extra offer (copy)", taken)!;
    const copy = next.steps.find((s) => s.key === key)!;
    expect(copy.offerId).toBe("offer_7");
    expect(copy.experimentId).toBeNull();
    expect(copy.seo).toEqual(upsell.seo);
    expect(copy.seo).not.toBe(upsell.seo);
    // The original is untouched.
    expect(next.steps.find((s) => s.key === "upsell")).toBe(upsell);
  });

  it("copies the page with a new id on every section and element", () => {
    const { funnel: next, key } = duplicateStep(base, "landing", "landing (copy)", taken)!;
    const original = idsOf(base.steps[0]);
    const copied = idsOf(next.steps.find((s) => s.key === key)!);
    expect(copied).toHaveLength(original.length);
    expect(original.length).toBeGreaterThan(2);
    expect(new Set([...original, ...copied]).size).toBe(original.length * 2);
  });

  it("arrives connected from the original, the way a new step after it would", () => {
    const { funnel: next, key } = duplicateStep(base, "landing", "landing (copy)", taken)!;
    const added = next.edges.filter((e) => !base.edges.includes(e));
    expect(added).toHaveLength(1);
    expect(added[0]).toMatchObject({ fromStepKey: "landing", toStepKey: key, condition: "always" });
    // Every path that was there is still there.
    expect(next.edges.slice(0, base.edges.length)).toEqual(base.edges);
    const fromCheckout = duplicateStep(base, "checkout", "c", taken)!;
    expect(fromCheckout.funnel.edges.at(-1)).toMatchObject({ fromStepKey: "checkout", condition: "completed_checkout" });
  });

  it("keeps a page that is off the path off the path, at an address of its own", () => {
    const withPage = funnel([...base.steps, step("contact", "custom", 0, { name: "Contact us" })], base.edges);
    const { funnel: next, key } = duplicateStep(withPage, "contact", "Contact us (copy)", withPage.steps.map((s) => s.key))!;
    expect(key).toBe("contact-2");
    expect(next.edges).toEqual(base.edges);
    expect(isGenericStep(next.steps.find((s) => s.key === key)!, next.edges)).toBe(true);
  });

  it("does nothing for a step that is not there", () => {
    expect(duplicateStep(base, "nope", "x", taken)).toBeNull();
  });

  it("gives two copies of one step different ids too", () => {
    const first = duplicateStep(base, "landing", "c", taken)!;
    const second = duplicateStep(first.funnel, "landing", "c", first.funnel.steps.map((s) => s.key))!;
    const a = idsOf(first.funnel.steps.find((s) => s.key === first.key)!);
    const b = idsOf(second.funnel.steps.find((s) => s.key === second.key)!);
    expect(second.key).not.toBe(first.key);
    expect(new Set([...a, ...b]).size).toBe(a.length + b.length);
  });
});

describe("the shares of a split test", () => {
  it("splits evenly and always adds up to 100", () => {
    expect(evenShares(2)).toEqual([50, 50]);
    expect(evenShares(3)).toEqual([34, 33, 33]);
    for (let n = 2; n <= MAX_VERSIONS; n += 1) expect(evenShares(n).reduce((a, b) => a + b, 0)).toBe(100);
  });

  it("hands the difference to the other versions when one share moves", () => {
    const three: VersionDraft[] = [
      { key: "A", name: "", weight: 34 },
      { key: "B", name: "", weight: 33 },
      { key: "C", name: "", weight: 33 },
    ];
    const moved = rebalanceShares(three, "A", 60);
    expect(moved.find((v) => v.key === "A")!.weight).toBe(60);
    expect(sharesTotal(moved)).toBe(100);
    expect(sharesTotal(rebalanceShares(three, "B", 0))).toBe(100);
    expect(sharesTotal(rebalanceShares(three, "C", 100))).toBe(100);
    // Out of range is brought back in.
    expect(rebalanceShares(three, "A", 140).find((v) => v.key === "A")!.weight).toBe(100);
  });

  it("sends a page for every version but the original", () => {
    const page = { version: 1, sections: [] };
    const payload = toPayload([
      { key: CONTROL_KEY, name: "", weight: 50, builderData: page },
      { key: "B", name: " Red button ", weight: 30, builderData: page },
      { key: "C", name: "", weight: 20, builderData: page },
    ]);
    expect(payload).toEqual([
      { key: "A", name: "A", weight: 50 },
      { key: "B", name: "Red button", weight: 30, builderData: page },
      { key: "C", name: "C", weight: 20, builderData: page },
    ]);
  });
});

describe("the versions editor", () => {
  function Editor() {
    const [versions, setVersions] = useState<VersionDraft[]>([
      { key: "A", name: "", weight: 50 },
      { key: "B", name: "", weight: 50 },
    ]);
    return (
      <>
        <output data-testid="state">{versions.map((v) => `${v.key}:${v.weight}`).join(" ")}</output>
        <VersionSharesEditor versions={versions} onChange={setVersions} newPage={{ version: 1, sections: [] }} idPrefix="t" />
      </>
    );
  }
  const state = () => screen.getByTestId("state").textContent;

  it("adds versions up to five, sharing the visitors evenly each time", async () => {
    const { user } = renderWithProviders(<Editor />);
    const add = screen.getByRole("button", { name: "Add a version" });
    await user.click(add);
    expect(state()).toBe("A:34 B:33 C:33");
    await user.click(add);
    await user.click(add);
    expect(state()).toBe("A:20 B:20 C:20 D:20 E:20");
    expect(add).toHaveProperty("disabled", true);
  });

  it("never lets the original go, nor the last version beside it", async () => {
    const { user } = renderWithProviders(<Editor />);
    // Two versions: nothing can be removed.
    expect(screen.queryByRole("button", { name: /Remove version/ })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Add a version" }));
    expect(screen.queryByRole("button", { name: "Remove version A" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Remove version B" }));
    expect(state()).toBe("A:50 C:50");
  });

  it("reads in the dashboard's own Arabic", () => {
    renderWithProviders(<Editor />, { locale: "ar" });
    expect(screen.getByRole("button", { name: "إضافة نسخة" })).toBeTruthy();
    expect(screen.getByText("الصفحة كما هي الآن")).toBeTruthy();
  });
});
