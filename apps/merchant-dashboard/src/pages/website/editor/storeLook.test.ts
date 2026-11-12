import { describe, expect, it } from "vitest";
import {
  TEMPLATE_COLOR_SOURCE,
  accentOf,
  lookToPreview,
  lookToShellPreview,
  lookToWorkspacePatch,
  readStoreLook,
  sameLook,
  type StoreLook,
} from "./storeLook";
import { DEFAULT_FOOTER_LOOK, DEFAULT_HEADER_LOOK, newLink } from "./storeShell";

/** A look with every field set, so a test only has to override what it cares about. */
function baseLook(overrides: Partial<StoreLook> = {}): StoreLook {
  return {
    storeTheme: "original",
    primaryColor: "#1E40AF",
    primaryColorFromTemplate: false,
    primaryColorDark: null,
    secondaryColor: null,
    fontFamily: "modern",
    cornerRadius: "round",
    logoUrl: null,
    announcement: { enabled: false, messages: [], href: null, background: null, color: null },
    header: DEFAULT_HEADER_LOOK,
    footer: DEFAULT_FOOTER_LOOK,
    ...overrides,
  };
}

describe("store look", () => {
  it("reads defaults from a workspace that has saved nothing", () => {
    expect(readStoreLook({ themeSettings: {}, logoUrl: null })).toEqual({
      storeTheme: "original",
      primaryColor: null,
      primaryColorFromTemplate: false,
      primaryColorDark: null,
      secondaryColor: null,
      fontFamily: "classic",
      cornerRadius: "soft",
      logoUrl: null,
      announcement: { enabled: false, messages: [], href: null, background: null, color: null },
      header: DEFAULT_HEADER_LOOK,
      footer: DEFAULT_FOOTER_LOOK,
    });
  });

  it("ignores values the storefront would not accept", () => {
    const look = readStoreLook({
      themeSettings: { primaryColor: "teal", fontFamily: "comic-sans", cornerRadius: 12 },
      logoUrl: "https://cdn.example/logo.png",
    });
    expect(look.primaryColor).toBeNull();
    expect(look.fontFamily).toBe("classic");
    expect(look.cornerRadius).toBe("soft");
    expect(look.logoUrl).toBe("https://cdn.example/logo.png");
  });

  it("merges into themeSettings without dropping keys it doesn't own", () => {
    const patch = lookToWorkspacePatch(
      { productCountdownHours: 6, primaryColor: "#111111" },
      baseLook({ secondaryColor: null, fontFamily: "modern", cornerRadius: "round", logoUrl: null })
    );
    expect(patch).toEqual({
      logoUrl: null,
      themeSettings: {
        productCountdownHours: 6,
        primaryColor: "#1E40AF",
        fontFamily: "modern",
        cornerRadius: "round",
        header: { announcement: { enabled: false } },
      },
    });
  });

  it("leaves an unset colour out of the preview, so the store default still applies", () => {
    const preview = lookToPreview(readStoreLook({ themeSettings: {}, logoUrl: null }));
    expect(preview).not.toHaveProperty("primaryColor");
    expect(preview.logoUrl).toBeNull();
  });

  describe("theme and the accent per mode", () => {
    it("keeps a store that saved one colour on that colour in both modes", () => {
      // Saved before the modes could differ: no dark-mode key at all.
      const look = readStoreLook({ themeSettings: { primaryColor: "#1e40af" }, logoUrl: null });
      expect(look.primaryColor).toBe("#1E40AF");
      expect(look.primaryColorDark).toBeNull();
      expect(look.storeTheme).toBe("original");
      // Saving it again writes no dark-mode key, so the storefront keeps using
      // the one colour for dark mode too.
      const saved = lookToWorkspacePatch({ primaryColor: "#1e40af" }, look).themeSettings;
      expect(saved).not.toHaveProperty("primaryColorDark");
      expect(saved).not.toHaveProperty("storeTheme");
      expect(lookToPreview(look)).not.toHaveProperty("primaryColorDark");
    });

    it("reads and saves a theme and a separate dark-mode accent", () => {
      const look = readStoreLook({
        themeSettings: { storeTheme: "glass", primaryColor: "#6242F5", primaryColorDark: "#a594ff" },
        logoUrl: null,
      });
      expect(look.storeTheme).toBe("glass");
      expect(look.primaryColorDark).toBe("#A594FF");
      const saved = lookToWorkspacePatch({ productCountdownHours: 6 }, look).themeSettings;
      expect(saved).toMatchObject({
        productCountdownHours: 6,
        storeTheme: "glass",
        primaryColor: "#6242F5",
        primaryColorDark: "#A594FF",
      });
      expect(lookToPreview(look)).toMatchObject({ storeTheme: "glass", primaryColor: "#6242F5", primaryColorDark: "#A594FF" });
    });

    it("drops the theme and the dark accent when the merchant goes back to the defaults", () => {
      const saved = lookToWorkspacePatch(
        { storeTheme: "bold", primaryColorDark: "#FF5A4E", primaryColor: "#D7261E" },
        baseLook({ storeTheme: "original", primaryColor: "#D7261E", primaryColorDark: null })
      ).themeSettings;
      expect(saved).not.toHaveProperty("storeTheme");
      expect(saved).not.toHaveProperty("primaryColorDark");
      expect(saved.primaryColor).toBe("#D7261E");
    });

    it("reads an unknown theme as the original look", () => {
      expect(readStoreLook({ themeSettings: { storeTheme: "perfume" }, logoUrl: null }).storeTheme).toBe("original");
    });

    it("always tells the preview which theme to show, so going back to the original beats a saved theme", () => {
      expect(lookToPreview(baseLook({ storeTheme: "original" })).storeTheme).toBe("original");
    });

    it("counts a theme or a dark accent change as a change to the look", () => {
      expect(sameLook(baseLook(), baseLook({ storeTheme: "warm" }))).toBe(false);
      expect(sameLook(baseLook(), baseLook({ primaryColorDark: "#FFFFFF" }))).toBe(false);
      expect(sameLook(baseLook(), baseLook())).toBe(true);
    });
  });

  describe("a colour carried over from a website template", () => {
    const saved = { storeTheme: "warm", primaryColor: "#2563eb", primaryColorSource: TEMPLATE_COLOR_SOURCE };

    it("never paints over a theme's own accent, in the panel or the preview", () => {
      const look = readStoreLook({ themeSettings: saved, logoUrl: null });
      expect(look.primaryColorFromTemplate).toBe(true);
      expect(accentOf(look)).toBeNull();
      expect(lookToPreview(look)).not.toHaveProperty("primaryColor");
    });

    it("still counts on the original look", () => {
      const look = readStoreLook({ themeSettings: { ...saved, storeTheme: undefined }, logoUrl: null });
      expect(accentOf(look)).toBe("#2563EB");
      expect(accentOf(look, "elegant")).toBeNull();
      expect(lookToPreview(look).primaryColor).toBe("#2563EB");
    });

    it("keeps its marker through an unrelated save, and drops it once the merchant picks a colour", () => {
      const look = readStoreLook({ themeSettings: saved, logoUrl: null });
      expect(lookToWorkspacePatch(saved, { ...look, fontFamily: "system" }).themeSettings.primaryColorSource).toBe(
        TEMPLATE_COLOR_SOURCE
      );
      const picked = { ...look, primaryColor: "#B45309", primaryColorFromTemplate: false };
      const patch = lookToWorkspacePatch(saved, picked).themeSettings;
      expect(patch).not.toHaveProperty("primaryColorSource");
      expect(patch.primaryColor).toBe("#B45309");
      expect(sameLook(look, picked)).toBe(false);
    });
  });

  it("never puts the announcement bar in the preview payload — the preview bridge doesn't know the field", () => {
    const look = baseLook({ announcement: { enabled: true, messages: ["Sale!"], href: null, background: null, color: null } });
    const preview = lookToPreview(look);
    expect(preview).not.toHaveProperty("announcement");
  });

  describe("announcement bar", () => {
    it("turning it on with every message blank saves as turned off, not refused", () => {
      const look = baseLook({
        announcement: { enabled: true, messages: ["", "  "], href: null, background: null, color: null },
      });
      const patch = lookToWorkspacePatch({}, look);
      expect(patch.themeSettings.header).toEqual({ announcement: { enabled: false } });
    });

    it("a single message round-trips through the exact shape announcementOf reads: text set, no messages array", () => {
      const look = baseLook({
        announcement: {
          enabled: true,
          messages: ["Free shipping over 500 EGP"],
          href: "/sale",
          background: "#1F5D5B",
          color: "#FFFFFF",
        },
      });
      const patch = lookToWorkspacePatch({}, look);
      const saved = patch.themeSettings.header as { announcement: Record<string, unknown> };
      expect(saved.announcement).toEqual({
        enabled: true,
        text: "Free shipping over 500 EGP",
        href: "/sale",
        background: "#1F5D5B",
        color: "#FFFFFF",
      });
      expect(saved.announcement).not.toHaveProperty("messages");

      // readStoreLook opens the same value back up, unchanged.
      const reopened = readStoreLook({ themeSettings: { header: saved }, logoUrl: null });
      expect(reopened.announcement).toEqual(look.announcement);
    });

    it("two or more messages are written as a `messages` array of the same length, `text` staying the first one", () => {
      const look = baseLook({
        announcement: {
          enabled: true,
          messages: ["Free shipping", "Eid sale", "New arrivals"],
          href: null,
          background: null,
          color: null,
        },
      });
      const patch = lookToWorkspacePatch({}, look);
      const saved = patch.themeSettings.header as { announcement: Record<string, unknown> };
      expect(saved.announcement.text).toBe("Free shipping");
      expect(saved.announcement.messages).toEqual(["Free shipping", "Eid sale", "New arrivals"]);
      expect((saved.announcement.messages as string[]).length).toBeGreaterThanOrEqual(2);

      const reopened = readStoreLook({ themeSettings: { header: saved }, logoUrl: null });
      expect(reopened.announcement.messages).toEqual(["Free shipping", "Eid sale", "New arrivals"]);
      expect(reopened.announcement.enabled).toBe(true);
    });

    it("blank lines mixed with real ones are dropped before saving", () => {
      const look = baseLook({
        announcement: { enabled: true, messages: ["  ", "Real message", ""], href: null, background: null, color: null },
      });
      const patch = lookToWorkspacePatch({}, look);
      const saved = patch.themeSettings.header as { announcement: Record<string, unknown> };
      expect(saved.announcement.text).toBe("Real message");
      expect(saved.announcement).not.toHaveProperty("messages");
    });

    it("keeps other header keys untouched when saving the announcement", () => {
      const look = baseLook({
        announcement: { enabled: false, messages: [], href: null, background: null, color: null },
      });
      const patch = lookToWorkspacePatch({ header: { somethingElse: 1 } }, look);
      expect(patch.themeSettings.header).toEqual({ somethingElse: 1, announcement: { enabled: false } });
    });

    it("a store that never saved one reads back as disabled with no messages", () => {
      const look = readStoreLook({ themeSettings: {}, logoUrl: null });
      expect(look.announcement).toEqual({ enabled: false, messages: [], href: null, background: null, color: null });
    });
  });

  describe("header and footer", () => {
    it("writes nothing for a header and footer left at their defaults", () => {
      const patch = lookToWorkspacePatch({ footer: undefined }, baseLook());
      expect(patch.themeSettings.header).toEqual({ announcement: { enabled: false } });
      expect(patch.themeSettings).not.toHaveProperty("footer");
    });

    it("writes only the header settings that differ from the default", () => {
      const patch = lookToWorkspacePatch(
        {},
        baseLook({ header: { ...DEFAULT_HEADER_LOOK, logoAlign: "center", showLanguage: false, sticky: false } })
      );
      expect(patch.themeSettings.header).toEqual({
        announcement: { enabled: false },
        logo: { align: "center" },
        show: { language: false },
        sticky: false,
      });
    });

    it("round-trips a custom menu, keeping built-in links unlabelled", () => {
      const menu = [newLink("home"), { ...newLink("url"), label: "Instagram", href: "https://instagram.com/x" }];
      const look = baseLook({ header: { ...DEFAULT_HEADER_LOOK, menu } });
      const saved = lookToWorkspacePatch({}, look).themeSettings;
      expect((saved.header as Record<string, unknown>).menu).toEqual([
        { label: "", href: "/", kind: "home" },
        { label: "Instagram", href: "https://instagram.com/x", kind: "url" },
      ]);
      const reopened = readStoreLook({ themeSettings: saved, logoUrl: null });
      expect(sameLook(reopened, look)).toBe(true);
    });

    it("drops the footer key again when it goes back to the defaults, keeping keys it doesn't own", () => {
      const patch = lookToWorkspacePatch({ footer: { groups: [], extra: 1 } }, baseLook());
      expect(patch.themeSettings.footer).toEqual({ extra: 1 });
      expect(lookToWorkspacePatch({ footer: { text: "x" } }, baseLook()).themeSettings).not.toHaveProperty("footer");
    });

    it("previews exactly what a save would write", () => {
      const look = baseLook({ footer: { ...DEFAULT_FOOTER_LOOK, text: "Cairo · since 2020", showHelp: false } });
      const preview = lookToShellPreview({ header: { keep: true } }, look);
      const saved = lookToWorkspacePatch({ header: { keep: true } }, look).themeSettings;
      expect(preview).toEqual({
        header: saved.header,
        footer: saved.footer,
        tokens: saved.xsTokens ?? null,
        storePages: saved.storePages ?? null,
        storeWords: saved.storeWords ?? null,
        fonts: saved.fonts ?? null,
      });
    });

    it("carries the store's fonts — the header's among them — to the preview and the save alike", () => {
      const fonts = { primaryAr: "cairo", header: { en: "lora" } };
      const look = { ...baseLook(), fonts };
      expect(lookToShellPreview({}, look).fonts).toEqual(fonts);
      expect(lookToWorkspacePatch({ fonts: { primaryAr: "amiri" } }, look).themeSettings.fonts).toEqual(fonts);
      // No fonts in the look: the key goes, as every other key this panel owns.
      expect(lookToWorkspacePatch({ fonts: { primaryAr: "amiri" } }, baseLook()).themeSettings).not.toHaveProperty("fonts");
      expect(sameLook(look, { ...look, fonts: { ...fonts, header: { en: "inter" } } })).toBe(false);
    });
  });
});
