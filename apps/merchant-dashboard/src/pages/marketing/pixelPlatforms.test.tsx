import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import * as simpleIcons from "simple-icons";
import { PLATFORM_ICONS, PLATFORM_META, platformMark, platformName } from "./pixelPlatforms";
import { PlatformIcon } from "./PlatformIcon";

const platforms = Object.keys(PLATFORM_META);
const iconPaths = new Set(Object.values(simpleIcons as Record<string, { path?: unknown }>).map((icon) => icon?.path));

describe("pixelPlatforms", () => {
  it("has an icon for every platform of the list, and none for a platform that is not in it", () => {
    // A platform added to PLATFORM_META (or to the api-client's AD_PLATFORM_PIXEL_IDS) needs its line in PLATFORM_ICONS.
    const missing = platforms.filter((platform) => !Object.hasOwn(PLATFORM_ICONS, platform));
    expect(missing, `platforms without an icon in PLATFORM_ICONS: ${missing.join(", ")}`).toEqual([]);
    expect(Object.keys(PLATFORM_ICONS).sort()).toEqual([...platforms].sort());
  });

  it("draws a logo straight from simple-icons, else one capital letter that no other platform uses", () => {
    const letters: string[] = [];
    for (const platform of platforms) {
      const mark = platformMark(platform);
      if (mark.kind === "brand") {
        expect(iconPaths.has(mark.path), `${platform}: not a simple-icons path`).toBe(true);
      } else {
        expect(mark.letter, platform).toMatch(/^[A-Z]$/);
        letters.push(mark.letter);
      }
    }
    expect(new Set(letters).size, `two platforms share a letter: ${letters.join(" ")}`).toBe(letters.length);
  });

  it("gives a platform the dashboard does not know yet its id as the name and the id's first letter", () => {
    expect(platformName("linkedin")).toBe("linkedin");
    expect(platformMark("linkedin")).toEqual({ kind: "letter", letter: "L" });
  });

  it("renders every platform's icon hidden from screen readers, a logo or a letter in a circle", () => {
    for (const platform of platforms) {
      const { container, unmount } = render(<PlatformIcon platform={platform} />);
      const icon = container.querySelector(`[data-platform-icon="${platform}"]`);
      expect(icon, platform).not.toBeNull();
      expect(icon).toHaveAttribute("aria-hidden", "true");
      if (PLATFORM_ICONS[platform as keyof typeof PLATFORM_ICONS].kind === "brand") {
        expect(icon?.tagName.toLowerCase()).toBe("svg");
        expect(icon?.querySelector("path")?.getAttribute("d")).toBeTruthy();
      } else {
        expect(icon).toHaveAttribute("data-mark", "letter");
        expect(icon?.textContent).toMatch(/^[A-Z]$/);
      }
      unmount();
    }
  });
});
