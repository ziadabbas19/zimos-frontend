import type { PlanFeatureKey } from "@/lib/plans";
import type { StoreKind } from "@/lib/store-shots";

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
    /** The home page's sections, in the header's order. */
    templates: string;
    benefits: string;
    howItWorks: string;
    growth: string;
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
    /** The pill above the title. */
    badge: string;
    /** The title: these lines in white, then `accent` in the logo's light blue. */
    lines: string[];
    accent: string;
    body: string;
    primaryCta: string;
    secondaryCta: string;
    /** Under the buttons, each with a tick. */
    ticks: [string, string, string];
    imageAlt: string;
    /** The cards floating over the stores — illustration, generic labels. */
    chips: {
      order: Chip;
      confirmed: Chip;
      delivered: Chip;
    };
    caption: string;
    /** The objects around the hero (components/hero-scene.tsx): decoration, hidden from screen readers. */
    scene: HeroScene;
  };

  /** The stores: every template of the library as a whole store, to open and look through. */
  templates: {
    kicker: string;
    heading: string;
    intro: string;
    /** "Template {n}" beside an imported store's kind (and on the credits page). */
    templateLabel: string;
    /** The kinds the gallery filters by (lib/store-shots.ts STORE_KINDS), and "all". */
    kinds: Record<StoreKind | "all", string>;
    /** What each store sells, by look number ("01" …): its name on its card. */
    names: Record<string, string>;
    /** On a look ZIMOS designed itself (lib/store-shots.ts OWN_LOOKS). */
    ownBadge: string;
    /** Accessible name of the row of kinds. */
    pickLabel: string;
    /** On each card: opens the store large, to look through (the viewer). */
    view: string;
    /** "Show all {n} stores". */
    showAll: string;
    /** The viewer: its accessible name, its two devices, its arrows, its close button, the way in from it, and how to look through the page. */
    viewerLabel: string;
    onComputer: string;
    onPhone: string;
    previous: string;
    next: string;
    close: string;
    useTemplate: string;
    scrollHint: string;
    cta: string;
    caption: string;
  };

  /** The strip of platforms under the hero; their names are not translated. */
  integrations: {
    label: string;
    note: string;
    /** Beside InstaPay's mark: it is a manual transfer, not a connection. */
    manualTransfer: string;
    /** In place of the shipping companies' marks, which the site does not name. */
    shippingCompanies: string;
    /** In place of the payment gateways' marks, which the site does not name. */
    paymentGateways: string;
  };

  /** "From the ad to the profit": five steps, each with a drawing of its screen. */
  journey: {
    kicker: string;
    heading: string;
    intro: string;
    steps: [JourneyStep, JourneyStep, JourneyStep, JourneyStep, JourneyStep];
    /** The drawings' words: generic interface labels and an example's figures. */
    demo: {
      sponsored: string;
      storeName: string;
      adText: string;
      shopNow: string;
      product: string;
      price: string;
      fields: [string, string, string];
      bump: string;
      orderNow: string;
      queue: string;
      /** The queue's three counts: new, confirmed, later. */
      counts: [Amount, Amount, Amount];
      orderNumber: string;
      risk: string;
      confirmed: string;
      refused: string;
      later: string;
      /** The orders waiting under the one on the call. */
      nextOrders: [QueuedOrder, QueuedOrder, QueuedOrder];
      shipment: string;
      courier: Amount;
      collect: Amount;
      deliverTo: Amount;
      tracking: string;
      statuses: [string, string, string];
      /** When each status came, under it. */
      statusTimes: [string, string, string];
      expected: Amount;
      profitTitle: string;
      rows: [Amount, Amount, Amount, Amount];
      net: Amount;
      currency: string;
      /** Under the week's chart: how the week compares. */
      week: Amount;
    };
    /** Under the drawings: they are an illustration. */
    note: string;
  };

  /** Six tools that bring sales and bring customers back, each with a small drawing. */
  growth: {
    kicker: string;
    heading: string;
    intro: string;
    tools: [GrowthTool, GrowthTool, GrowthTool, GrowthTool, GrowthTool, GrowthTool];
    /** What a plan includes differs: the pricing page has it. */
    note: string;
    pricingLink: string;
  };

  /** Real screens of the dashboard, one at a time. */
  dashboard: {
    kicker: string;
    heading: string;
    intro: string;
    tabs: [ShotTab, ShotTab, ShotTab];
    previous: string;
    next: string;
    caption: string;
  };

  /** Three steps to a live store. */
  start: {
    kicker: string;
    heading: string;
    steps: [TrustPoint, TrustPoint, TrustPoint];
    cta: string;
  };

  /** Under the home page's plans: what is paid for, how, and whose data it is. */
  trust: {
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
    /**
     * After "Yearly" on the switch, only while yearly saves on some plan. No
     * number: what a plan saves is worked out from its prices
     * (@store-builder/ui/plan-pricing), under its yearly price.
     */
    yearlySave: string;
    perMonth: string;
    perYear: string;
    /** Under a monthly price, muted. */
    billedMonthly: string;
    /** Read before the struck-out twelve monthly payments under a yearly price (screen readers only). */
    fullYearLabel: string;
    /** "{price}": the yearly price over twelve months, under it. */
    perMonthEquivalent: string;
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
    /** The badge on the middle of three plans (the home page and the pricing page). */
    mostPopular: string;
    seeAll: string;
    comingSoon: string;
    comingSoonBody: string;
    comingSoonCta: string;
    /** Followed by the refund policy link. */
    paymentNote: string;
    refundLink: string;
    features: Record<PlanFeatureKey, string>;
    /** On a phone, under a plan's first six features: "{n}" more. */
    moreFeatures: string;
    /**
     * The pay-per-order card and its questions, shown only while the API
     * sends that plan (lib/plans `payPerOrder`). Every number in them — the
     * fee, the free orders — comes from the plan.
     */
    payPerOrder: {
      /** The pill above the plan's name. */
      badge: string;
      tagline: string;
      /** The home page's wide card: what the plan is, as its title (its name, from the API, is the pill above). */
      title: string;
      /** After the fee, like perMonth. */
      perOrder: string;
      /** "{orders}" (lib/format formatOrderCount). */
      freeOrders: string;
      /** One of the two, as the API says the fee is taken. */
      feeAtConfirmation: string;
      feeAtPlacement: string;
      noExpiry: string;
      topUp: string;
      cta: string;
      /** Under the button: where the plan is chosen after sign-up. */
      howToChoose: string;
      /** The page's intro while the card is shown, in place of pageIntro. */
      pageIntro: string;
      faq: {
        kicker: string;
        heading: string;
        afterFreeQuestion: string;
        /** "{orders}", "{fee}" */
        afterFreeAnswer: string;
        whenQuestion: string;
        whenAtConfirmation: string;
        whenAtPlacement: string;
        expiryQuestion: string;
        expiryAnswer: string;
        chooseQuestion: string;
        chooseAnswer: string;
      };
    };
  };

  /** What the service is and what is sold — said plainly on the pricing page. */
  service: {
    kicker: string;
    heading: string;
    body: string;
    /** `body` while the pricing page shows the pay-per-order plan. */
    bodyWithPayPerOrder: string;
    /** A point's `withPayPerOrder` replaces its body while that plan is shown. */
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

  /** The credits page (/credits), linked from the footer. */
  credits: {
    title: string;
    description: string;
    intro: string;
    templatesHeading: string;
    /** Before the list of the designs' credits (lib/store-shots.ts SHOT_CREDITS). */
    templatesLead: string;
    resourcesHeading: string;
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

/** A line of a sum: what it is, and its figure as written ("−310"). */
export interface Amount {
  label: string;
  value: string;
}

/** An order in the journey's confirmation queue: its number, its product and its total, as written. */
export interface QueuedOrder {
  number: string;
  item: string;
  total: string;
}

export interface JourneyStep {
  id: "ad" | "page" | "confirm" | "ship" | "profit";
  /** Short, on the step's button. */
  label: string;
  title: string;
  body: string;
}

export interface GrowthTool {
  id: "coupons" | "loyalty" | "cart" | "bundles" | "email" | "recovery";
  title: string;
  body: string;
  /** The words inside the tool's drawing. */
  tag: string;
}

export interface ShotTab {
  /** The capture in public/product: `{id}-{locale}.webp`. */
  id: "home" | "orders" | "profit";
  label: string;
  /** One line about the screen, beside its name. */
  blurb: string;
  alt: string;
}

export interface TrustPoint {
  title: string;
  body: string;
  /** The service section's body for this point while the pay-per-order plan is shown. */
  withPayPerOrder?: string;
}

export interface FaqItem {
  question: string;
  answer: string;
}

/**
 * What the hero's objects say (components/hero-scene.tsx): each object's
 * word when it is tapped (`pops`), its hint under the pointer (`tips`), the
 * words drawn on a few of them, and the small tally of what was tapped.
 * Amounts are illustration, written the way the rest of the page writes them.
 */
export interface HeroScene {
  /** Until the first tap. */
  hint: string;
  pops: Record<HeroScenePop, string>;
  tips: Record<HeroSceneTip, string>;
  /** On the coins. */
  coin: string;
  /** On the two price tags. */
  tags: [string, string];
  /** In the chat bubble. */
  chat: { title: string; detail: string };
  /** The tally: its heading, the words after its two counts, and the amount's currency before or after it. */
  stat: { today: string; orders: string; reviews: string; before: string; after: string };
}

export type HeroScenePop =
  | "order1"
  | "order2"
  | "order3"
  | "order4"
  | "profit1"
  | "profit2"
  | "profit3"
  | "tag1"
  | "tag2"
  | "bag"
  | "ok"
  | "rocket"
  | "bell"
  | "chat"
  | "review"
  | "truck";

export type HeroSceneTip = "box" | "profit" | "discount" | "price" | "cart" | "confirm" | "publish" | "notifications" | "message" | "reviews" | "ship";
