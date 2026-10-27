import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button, ZLoader, ZLoaderHold } from "@store-builder/ui";

afterEach(cleanup);

describe("ZLoader: the one loader", () => {
  it("is the Z outlined twice (the faint letter and the running light), announced with its label", () => {
    const { container } = render(<ZLoader label="Loading the orders…" />);
    const svg = screen.getByRole("status", { name: "Loading the orders…" });
    expect(svg.getAttribute("data-slot")).toBe("z-loader");
    expect(svg.getAttribute("data-size")).toBe("md");
    expect(svg.getAttribute("width")).toBe("32");
    const paths = container.querySelectorAll("path");
    expect(paths).toHaveLength(2);
    expect(paths[0].getAttribute("d")).toBe(paths[1].getAttribute("d"));
    expect(paths[1].getAttribute("class")).toBe("zimos-zl-trace");
    expect(paths[1].getAttribute("pathLength")).toBe("100");
    expect(svg.getAttribute("fill")).toBe("none");
  });

  it("takes the brand colour in a section and the text colour in a button, unless told", () => {
    const { container, rerender } = render(<ZLoader />);
    const svg = () => container.querySelector("svg") as SVGSVGElement;
    expect(svg().style.getPropertyValue("--zl-c")).toBe("var(--color-primary, #0080e0)");
    rerender(<ZLoader size="sm" />);
    expect(svg().style.getPropertyValue("--zl-c")).toBe("currentColor");
    expect(svg().getAttribute("width")).toBe("16");
    rerender(<ZLoader size="sm" color="#ff00aa" />);
    expect(svg().style.getPropertyValue("--zl-c")).toBe("#ff00aa");
  });

  it("says nothing when decorative, and keeps a caller's size class", () => {
    const { container } = render(<ZLoader size="sm" className="size-3.5" aria-hidden />);
    expect(screen.queryByRole("status")).toBeNull();
    const svg = container.querySelector("svg") as SVGSVGElement;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.getAttribute("class")).toBe("zimos-zl size-3.5");
  });

  it("covers the page at lg, the veil announced and the letter silent", () => {
    const { container } = render(<ZLoader size="lg" label="Loading…" />);
    const page = screen.getByRole("status", { name: "Loading…" });
    expect(page.getAttribute("data-slot")).toBe("z-loader-page");
    expect(page.className).toBe("zimos-zl-page");
    expect(container.querySelector("svg")?.getAttribute("aria-hidden")).toBe("true");
  });

  it("holds a button's words in place, hidden, with the Z on them", () => {
    render(
      <Button>
        <ZLoaderHold label="Deleting…">Delete the product</ZLoaderHold>
      </Button>
    );
    const button = screen.getByRole("button");
    expect(button.querySelector(".zimos-zl-hold-words")?.textContent).toBe("Delete the product");
    expect(button.querySelector(".zimos-zl-hold-words")?.getAttribute("aria-hidden")).toBe("true");
    expect(screen.getByRole("status", { name: "Deleting…" }).getAttribute("data-size")).toBe("sm");
  });

  it("brings its own CSS: the running light, and a still glow under reduced motion", () => {
    render(<ZLoader />);
    const css = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    expect(css).toContain("@keyframes zimos-zl-trace");
    expect(css).toContain("stroke-dashoffset");
    expect(css).toContain("drop-shadow");
    expect(css).toMatch(/@media \(prefers-reduced-motion:reduce\)\{\.zimos-zl-trace\{animation:none;stroke-dasharray:none\}\}/);
  });
});

/** Every app's source, and the shared packages: no other loader may come back. */
// Vitest runs from apps/merchant-dashboard (its root); the repo is two levels up.
const ROOT = resolve(process.cwd(), "../..") + "/";
const SCANNED = ["apps/merchant-dashboard/src", "apps/platform-admin/src", "apps/storefront/src", "apps/marketing/src", "packages/ui/src"];
const FORBIDDEN: Array<[string, RegExp]> = [
  ["animate-spin", /animate-spin/],
  ["a lucide loader icon", /import\s*\{[^}]*\bLoader(2|Circle|Pinwheel)?(Icon)?\b[^}]*\}\s*from\s*"lucide-react"/],
  ["a Spinner component", /<Spinner\b|\bIconSpinner\b/],
  ["a border spinner", /border-t-transparent/],
  ["a spin keyframe", /@keyframes\s+spin\b/],
];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "node_modules" ? [] : sourceFiles(path);
    return /\.(tsx?|css|mjs)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
  });
}

describe("no loader but the Z", () => {
  it("finds no spinning icon, Spinner or spin keyframe in any app or in packages/ui", () => {
    const found: string[] = [];
    for (const dir of SCANNED) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const text = readFileSync(file, "utf8");
        for (const [what, pattern] of FORBIDDEN) {
          if (pattern.test(text)) found.push(`${file.slice(ROOT.length)}: ${what}`);
        }
      }
    }
    expect(found).toEqual([]);
  });
});
