import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_HEADER, readHeaderShell } from "./storeShell.ts";

describe("the header's navigation layout", () => {
  it("is the top bar for a store that saved nothing", () => {
    assert.equal(DEFAULT_HEADER.layout, "top");
    assert.equal(readHeaderShell(undefined), DEFAULT_HEADER);
    assert.equal(readHeaderShell({}).layout, "top");
    assert.equal(readHeaderShell({ primaryColor: "#112233", header: { announcement: { enabled: false } } }).layout, "top");
  });

  it("is the side column only for the one saved value", () => {
    assert.equal(readHeaderShell({ header: { layout: "side" } }).layout, "side");
    for (const layout of ["top", "SIDE", "left", "", true, 1, null, { side: true }]) {
      assert.equal(readHeaderShell({ header: { layout } }).layout, "top");
    }
  });

  it("changes nothing else the header reads", () => {
    const saved = { menu: [{ label: "Shop", href: "/products" }], logo: { size: "lg", align: "center" }, show: { cart: false }, sticky: false };
    const { layout: top, ...before } = readHeaderShell({ header: saved });
    const { layout: side, ...after } = readHeaderShell({ header: { ...saved, layout: "side" } });
    assert.equal(top, "top");
    assert.equal(side, "side");
    assert.deepEqual(after, before);
  });
});
