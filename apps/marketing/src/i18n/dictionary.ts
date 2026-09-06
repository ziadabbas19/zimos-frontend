/**
 * The shape every locale dictionary must satisfy.
 *
 * Both `dictionaries/ar.ts` and `dictionaries/en.ts` are typed as
 * `Dictionary`, so adding a key in one language forces a translation in the
 * other. Keep this limited to copy that is actually on screen — the homepage
 * ships the Nav, the Hero, the Features section, Pricing, and the Footer.
 */

export interface Dictionary {
  /** `dir` is informational for client code; the root layout sets it on <html>. */
  meta: {
    /** Document <title>. */
    title: string;
    /** Meta description. */
    description: string;
  };

  nav: {
    /** Wordmark text. */
    brand: string;
    /** In-page section links (targets may not exist yet). */
    features: string;
    pricing: string;
    /** Visible label of the language switcher — the name of the OTHER language. */
    switchLanguage: string;
    /** Accessible name for the language switcher control. */
    switchLanguageAria: string;
    /** Accessible name for the theme toggle, per current theme. */
    switchToDark: string;
    switchToLight: string;
    /** Mobile disclosure button. */
    openMenu: string;
    closeMenu: string;
    /** Auth actions — link out to app.zimos.co. */
    login: string;
    startStore: string;
  };

  hero: {
    /** Short framing line above the headline (sentence case, not an all-caps eyebrow). */
    kicker: string;
    headline: string;
    subheadline: string;
    /** Primary CTA — same target as the nav CTA. */
    startStore: string;
    /** Lower-emphasis CTA — in-page anchor. */
    seeHow: string;
    /** Caption for the order-lifecycle illustration. */
    flowCaption: string;
    /** Accessible name for the illustration as a whole. */
    flowAria: string;
    /** Label shown next to the generated tracking code. */
    trackingLabel: string;
    /** The four stages of the order lifecycle, in order. */
    steps: [FlowStep, FlowStep, FlowStep, FlowStep];
  };

  features: {
    /** Short framing line above the heading (sentence case, not an eyebrow). */
    kicker: string;
    heading: string;
    /** A sentence or two under the heading. */
    intro: string;
    /** The three moments a merchant lives through, in order. */
    stages: [FeatureStage, FeatureStage, FeatureStage];
  };

  pricing: {
    /** Small pill above the heading — states the real early-access status. */
    badge: string;
    heading: string;
    body: string;
    /** Microcopy under the CTA. The button label itself reuses `nav.startStore`. */
    ctaNote: string;
  };

  footer: {
    /** One line under the wordmark. */
    tagline: string;
    /** Accessible name for the footer link list. */
    navLabel: string;
    /** Follows the © year and wordmark. */
    rights: string;
  };
}

export interface FlowStep {
  /** Stable id, not shown. */
  id: "placed" | "confirmed" | "tracked" | "delivered";
  title: string;
  detail: string;
}

export interface FeatureStage {
  /** Stable id, not shown; also selects the stage icon. */
  id: "setup" | "order" | "aftercare";
  title: string;
  /** One line naming the moment. */
  summary: string;
  /** Concrete capabilities in this moment — 2 to 5 items. */
  points: string[];
}
