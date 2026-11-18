import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("../../../index.css", import.meta.url), "utf8");

describe("the editor and the keyboard", () => {
  it("draws a focus ring even on controls whose classes turn the outline off", () => {
    const rule = /\[data-slot="editor"\][^{]*:focus-visible\s*\{([^}]*)\}/.exec(css)?.[1] ?? "";
    expect(rule).toMatch(/outline-style:\s*solid/);
    expect(rule).toMatch(/outline-width:\s*2px/);
  });
});
