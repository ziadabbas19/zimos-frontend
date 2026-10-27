import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Button, ZLoader, ZLoaderHold } from "@store-builder/ui";

afterEach(cleanup);

/** The seconds of a CSS time ("-1.600s"). */
const seconds = (el: Element) => parseFloat((el as SVGElement).style.animationDelay);

describe("ZLoader: the one loader", () => {
  it("is the mark's three strips outlined faintly, announced with its label", () => {
    const { container } = render(<ZLoader label="Loading the orders…" />);
    const svg = screen.getByRole("status", { name: "Loading the orders…" });
    expect(svg.getAttribute("data-slot")).toBe("z-loader");
    expect(svg.getAttribute("data-size")).toBe("md");
    expect(svg.getAttribute("width")).toBe("32");
    expect(svg.getAttribute("fill")).toBe("none");
    const strips = container.querySelectorAll(".zimos-zl-base");
    expect(strips).toHaveLength(3);
    expect(new Set(Array.from(strips, (p) => p.getAttribute("d"))).size).toBe(3);
  });

  it("runs a comet on each strip: a white-cyan glowing head, then a trail that thins and fades out", () => {
    const { container } = render(<ZLoader />);
    const heads = container.querySelectorAll(".zimos-zl-head");
    expect(heads).toHaveLength(3);
    const headGroup = heads[0].parentElement as Element;
    expect(headGroup.getAttribute("stroke")).toBe("#effdff");
    expect(headGroup.getAttribute("stroke-linecap")).toBe("round");
    const glow = headGroup.getAttribute("filter")?.match(/^url\(#(.+)\)$/)?.[1];
    expect(container.querySelector(`filter[id="${glow}"] feGaussianBlur`)).not.toBeNull();

    const strip = container.querySelector(".zimos-zl-base")?.parentElement as Element;
    const trail = Array.from(strip.querySelectorAll(".zimos-zl-run"));
    expect(trail).toHaveLength(7);
    const opacity = trail.map((p) => Number(p.getAttribute("stroke-opacity")));
    const width = trail.map((p) => Number(p.getAttribute("stroke-width")));
    expect(opacity[0]).toBe(1);
    expect(opacity[6]).toBeLessThan(0.1);
    expect(opacity).toEqual([...opacity].sort((a, b) => b - a));
    expect(width).toEqual([...width].sort((a, b) => b - a));
    expect(width[6]).toBeLessThan(width[0]);
    // Each dash a little further behind the head, so they run as one trail.
    const lag = trail.map(seconds);
    expect(lag).toEqual([...lag].sort((a, b) => a - b));
    expect(new Set(lag).size).toBe(7);
  });

  it("passes the head over the three strips in turn, in one cycle", () => {
    const { container } = render(<ZLoader />);
    const heads = Array.from(container.querySelectorAll(".zimos-zl-head"), seconds);
    expect(heads).toEqual([-2.4, -1.6, -0.8]);
  });

  it("draws a longer trail at lg than at sm", () => {
    const trailLength = (size: "sm" | "lg") => {
      const { container, unmount } = render(<ZLoader size={size} aria-hidden />);
      const strip = container.querySelector(".zimos-zl-base")?.parentElement as Element;
      const dashes = Array.from(strip.querySelectorAll(".zimos-zl-run"));
      const total = dashes.reduce((sum, p) => sum + Number(p.getAttribute("stroke-dasharray")?.split(" ")[0]), 0);
      unmount();
      return total;
    };
    expect(trailLength("lg")).toBeGreaterThan(trailLength("sm"));
  });

  it("takes the mark's own cyan-to-blue in a section and the text colour in a button, unless told", () => {
    const { container, rerender } = render(<ZLoader />);
    const svg = () => container.querySelector("svg") as SVGSVGElement;
    expect(svg().getAttribute("data-tone")).toBeNull();
    expect(svg().style.getPropertyValue("--zl-c")).toBe("");
    rerender(<ZLoader size="sm" />);
    expect(svg().getAttribute("data-tone")).toBe("own");
    expect(svg().style.getPropertyValue("--zl-c")).toBe("currentColor");
    expect(svg().getAttribute("width")).toBe("16");
    rerender(<ZLoader size="sm" color="#ff00aa" />);
    expect(svg().style.getPropertyValue("--zl-c")).toBe("#ff00aa");
  });

  it("gives every loader its own gradients, so two colours on one page do not mix", () => {
    const { container } = render(
      <>
        <ZLoader />
        <ZLoader color="#ff00aa" />
      </>
    );
    const [first, second] = Array.from(container.querySelectorAll("svg"));
    const refs = (svg: SVGSVGElement) =>
      Array.from(svg.querySelectorAll(".zimos-zl-base"), (p) => p.parentElement?.getAttribute("stroke")?.match(/^url\(#(.+)\)$/)?.[1]);
    for (const svg of [first, second]) {
      for (const id of refs(svg)) expect(svg.querySelector(`linearGradient[id="${id}"]`)).not.toBeNull();
    }
    expect(refs(first).some((id) => refs(second).includes(id))).toBe(false);
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

  it("brings its own CSS: the running comet, and a still glowing outline under reduced motion", () => {
    render(<ZLoader />);
    const css = Array.from(document.querySelectorAll("style"))
      .map((s) => s.textContent ?? "")
      .join("\n");
    expect(css).toContain("@keyframes zimos-zl-run{to{stroke-dashoffset:-300}}");
    expect(css).toContain(".zimos-zl-base{opacity:.25}");
    expect(css).toContain("drop-shadow");
    expect(css).toContain("@media (prefers-reduced-motion:reduce){.zimos-zl-run{display:none}.zimos-zl-base{opacity:1}}");
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
