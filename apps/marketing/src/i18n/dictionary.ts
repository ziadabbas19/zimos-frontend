import type { PlanFeatureKey } from "@/lib/plans";

/**
 * The shape every locale dictionary must satisfy.
 *
 * Both `dictionaries/ar.ts` and `dictionaries/en.ts` are typed as
 * `Dictionary`, so adding a key in one language forces a translation in the
 * other. Keep this limited to copy that is actually on screen.
 *
 * Copy rules (ZIMOS brand): no invented metrics, customer counts, ratings,
 * testimonials or prices. Illustrations use generic UI labels only.
 */

export interface Dictionary {
  meta: {
    /** Document <title>. */
    title: string;
    /** Meta description. */
    description: string;
  };

  /** Approved brand phrases, localized. `*Latin` is the English original, shown
   *  as a small secondary line in Arabic; `null` where the main line already is it. */
  brand: {
    name: string;
    limits: string;
    limitsLatin: string | null;
    loop: string;
    loopLatin: string | null;
    tomorrow: string;
  };

  nav: {
    /** Visually hidden skip link, first focusable element. */
    skipToContent: string;
    /** Accessible name of the logo link. */
    homeAria: string;
    /** Accessible name of the primary <nav>. */
    primaryLabel: string;
    benefits: string;
    templates: string;
    howItWorks: string;
    pricing: string;
    faq: string;
    /** Visible label of the footer's language switcher — the name of the OTHER language. */
    switchLanguage: string;
    switchLanguageAria: string;
    /** Accessible name of the AR | EN switch in the header. */
    languageLabel: string;
    /** Beside the theme switch in the phone menu. */
    themeLabel: string;
    switchToDark: string;
    switchToLight: string;
    openMenu: string;
    closeMenu: string;
    /** Auth actions — link out to the dashboard. */
    signIn: string;
    startFree: string;
  };

  hero: {
    /** The slogan: these lines, then `accent` in the brand blue. */
    lines: string[];
    accent: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    /** Under the buttons, each with a tick. */
    ticks: [string, string, string];
    /** In the address pill of the browser frame. */
    frameLabel: string;
    imageAlt: string;
    /** The cards floating over the screenshot — illustration, generic labels. */
    chips: {
      template: Chip;
      published: Chip;
      order: Chip;
    };
  };

  /** Real stores built on the template library, in a gallery. */
  templates: {
    kicker: string;
    heading: string;
    intro: string;
    /** "Template {n}" under each card. */
    templateLabel: string;
    /** Category of each look shown (lib/store-shots.ts), by look number ("01" …). */
    categories: Record<string, string>;
    /** On a computer: pointing at a card scrolls its picture. */
    hoverHint: string;
    /** On a phone: the cards are a row to swipe through. */
    swipeHint: string;
    cta: string;
    caption: string;
    /** Before the list of the designs' credits (lib/store-shots.ts SHOT_CREDITS). */
    creditsLead: string;
  };

  /** The strip of platforms under the hero; their names are not translated. */
  integrations: {
    label: string;
    note: string;
    /** Beside a platform not connected yet. */
    soon: string;
    /** Beside InstaPay's mark: it is a manual transfer, not a connection. */
    manualTransfer: string;
  };

  benefits: {
    kicker: string;
    heading: string;
    intro: string;
    /** The big card: the store, with the chain that follows it as chips. */
    hero: { title: string; body: string; chips: [string, string, string, string, string] };
    items: [Capability, Capability, Capability, Capability, Capability, Capability];
    /** The wide card: automations, with a feed of what happens on its own. */
    wide: { title: string; body: string; feed: [Chip, Chip, Chip] };
  };

  journey: {
    kicker: string;
    heading: string;
    intro: string;
    /** Who does a step. */
    by: Record<StepOwner, string>;
    steps: [JourneyStep, JourneyStep, JourneyStep, JourneyStep, JourneyStep];
  };

  /** Real screens of the dashboard behind tabs. */
  dashboard: {
    kicker: string;
    heading: string;
    intro: string;
    tabs: [ShotTab, ShotTab, ShotTab];
    caption: string;
  };

  /** "What should reassure you": what is paid for, how, and whose data it is. */
  trust: {
    kicker: string;
    heading: string;
    intro: string;
    points: [TrustPoint, TrustPoint, TrustPoint, TrustPoint];
    /** The link in the payment point. */
    refundLink: string;
  };

  /** Plans and prices come from the API (GET /plans/public); these are the words around them. */
  pricing: {
    kicker: string;
    heading: string;
    intro: string;
    pageTitle: string;
    pageDescription: string;
    pageHeading: string;
    pageIntro: string;
    billingCycle: string;
    monthly: string;
    yearly: string;
    yearlyNote: string;
    perMonth: string;
    perYear: string;
    /** "{price}" */
    yearlyEquivalent: string;
    free: string;
    /** "{days}" */
    trial: string;
    noTrial: string;
    stores: string;
    funnels: string;
    orders: string;
    unlimited: string;
    cta: string;
    ctaYearly: string;
    seeAll: string;
    comingSoon: string;
    comingSoonBody: string;
    comingSoonCta: string;
    /** Followed by the refund policy link. */
    paymentNote: string;
    refundLink: string;
    features: Record<PlanFeatureKey, string>;
  };

  /** What the service is and what is sold — said plainly on the pricing page. */
  service: {
    kicker: string;
    heading: string;
    body: string;
    points: [TrustPoint, TrustPoint, TrustPoint, TrustPoint];
  };

  /** Shared by the policy and contact pages. */
  legal: {
    /** "{date}" */
    lastUpdated: string;
    contactHeading: string;
    email: string;
    phone: string;
    address: string;
    hours: string;
    entityHeading: string;
    legalName: string;
    registration: string;
    taxRegistration: string;
    relatedHeading: string;
    /** Above the social accounts on the contact page. */
    socialHeading: string;
  };

  faq: {
    kicker: string;
    heading: string;
    /** Under the heading, linking to the contact page. */
    contactLink: string;
    items: FaqItem[];
  };

  /** The navy closing band. */
  finalCta: {
    heading: string;
    body: string;
    primaryCta: string;
    /** The sign-in link beside the button. */
    secondaryCta: string;
  };

  footer: {
    navLabel: string;
    /** `#anchor` for a home-page section, `/path` for a page (the locale is prefixed at render). */
    links: { label: string; href: string }[];
    rights: string;
    languageLabel: string;
    registration: string;
    taxRegistration: string;
  };
}

/** A two-line label: a bold title and a small line under it. */
export interface Chip {
  title: string;
  detail: string;
}

export interface Capability {
  id: "mobile" | "domain" | "funnels" | "confirmation" | "shipping" | "analytics";
  title: string;
  body: string;
}

export type StepOwner = "you" | "auto" | "zimos";

export interface JourneyStep {
  id: "template" | "customize" | "publish" | "confirm" | "ship";
  by: StepOwner;
  title: string;
  body: string;
}

export interface ShotTab {
  /** The capture in public/product: `{id}-{locale}.webp`. */
  id: "home" | "orders" | "profit";
  label: string;
  alt: string;
}

export interface TrustPoint {
  title: string;
  body: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}
