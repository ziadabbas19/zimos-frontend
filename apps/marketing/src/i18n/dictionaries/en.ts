import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  meta: {
    title: "ZIMOS — Build. Sell. Grow.",
    description:
      "ZIMOS is the platform to build a complete online store in 5 minutes: ready-made store templates, every payment method, order confirmation before shipping, shipping with every company, and the real profit of each delivered order — on one screen.",
  },

  brand: {
    name: "ZIMOS",
    limits: "Commerce Without Limits",
    limitsLatin: null,
    loop: "Build. Sell. Grow.",
    loopLatin: null,
    tomorrow: "Commerce for a brighter tomorrow.",
  },

  nav: {
    skipToContent: "Skip to content",
    homeAria: "ZIMOS home",
    primaryLabel: "Main",
    templates: "Templates",
    benefits: "Benefits",
    howItWorks: "How it works",
    features: "Features",
    pricing: "Pricing",
    faq: "FAQ",
    switchLanguage: "العربية",
    switchLanguageAria: "Switch language to Arabic",
    languageLabel: "Language",
    themeLabel: "Theme",
    switchToDark: "Switch to dark theme",
    switchToLight: "Switch to light theme",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    signIn: "Sign in",
    startFree: "Start free",
  },

  hero: {
    lines: ["Build.", "Sell."],
    accent: "Grow.",
    body: "Start from a ready store template, put in your products and your brand, and publish in Arabic or English. Checkout, order confirmation, shipping and profit reports come built in.",
    primaryCta: "Start free",
    secondaryCta: "See the templates",
    ticks: ["Ready store templates", "Change every word and picture", "No card to start"],
    frameLabel: "yourstore.zimos.co",
    imageAlt: "A store built on ZIMOS from one of its templates, on a computer and on a phone",
    chips: {
      template: { title: "Template applied", detail: "Every word editable" },
      published: { title: "Store published", detail: "yourstore.zimos.co" },
      order: { title: "Order confirmed", detail: "Ready to ship" },
    },
  },

  integrations: {
    label: "Connects with",
    note: "Trademarks and logos belong to their owners.",
    manualTransfer: "Manual transfer",
    shippingCompanies: "Every shipping company",
    paymentGateways: "Payment gateways",
  },

  templates: {
    kicker: "Store templates",
    heading: "Ready store designs. Pick one and make it yours.",
    intro: "Stores built on ZIMOS from its template library — each with its own phone layout, and every section, word, colour and picture yours to change.",
    templateLabel: "Template {n}",
    categories: {
      "13": "Smart watches",
      "08": "Shoes and sportswear",
      "04": "Fashion and beauty",
      "10": "Winter wear",
    },
    hoverHint: "Point at a store to see its whole home page",
    swipeHint: "Swipe to see more stores",
    cta: "Pick your template",
    caption: "Real screenshots of the ZIMOS storefront — demo products and pictures.",
    creditsLead: "The store designs on this page are adapted from free templates:",
  },

  benefits: {
    kicker: "What you gain",
    heading: "Build the store. Everything after it comes with it.",
    intro:
      "Templates, an editor where everything is yours to change and a checkout that takes every payment method — plus order confirmation, shipping and real profit, connected in one platform.",
    hero: {
      title: "Your store, your way",
      body: "Start from a template and change any section, word, colour or picture in the editor — drag, drop, copy and paste. No designer, no code.",
      chips: ["Templates", "Editor", "Phone layout", "Arabic & English", "Your domain"],
    },
    items: [
      {
        id: "mobile",
        title: "Right on every phone",
        body: "Every template comes with its own phone layout, so the store your customer opens from an ad is fast and clean.",
      },
      {
        id: "domain",
        title: "On your own domain",
        body: "Start on a ZIMOS address and go live right away, then connect a domain you own whenever you're ready.",
      },
      {
        id: "funnels",
        title: "Funnels that raise the order",
        body: "Landing pages, order bumps at checkout and one-click upsells after purchase.",
      },
      {
        id: "confirmation",
        title: "Confirmed before it ships",
        body: "Your team confirms orders from one queue before they ship — by call, and by WhatsApp message on the plans that include it — so you stop paying to ship orders nobody wants.",
      },
      {
        id: "shipping",
        title: "Delivered by your courier",
        body: "Confirmed orders go to the shipping company you choose with a tracking code, connected directly or by hand, and the cash the courier collects is reconciled.",
      },
      {
        id: "analytics",
        title: "Your real profit, not a guess",
        body: "Cost per delivered order, real ROAS and break-even — counted on what was delivered, not on what was ordered.",
      },
    ],
    wide: {
      title: "It runs on its own",
      body: "Fake orders flagged, messages sent, statuses changed and work assigned as the order moves — no chasing, no copying.",
      feed: [
        { title: "New order", detail: "Checked for repeat and fake numbers" },
        { title: "Order confirmed", detail: "Tracking code issued" },
        { title: "Delivered", detail: "Status updated by the courier" },
      ],
    },
  },

  journey: {
    kicker: "How it works",
    heading: "From template to first order in five steps",
    intro: "Three steps to build your store, then two for every order: confirm it, then ship it and see what it earned.",
    by: { you: "On you", auto: "Automatic", zimos: "On ZIMOS" },
    steps: [
      {
        id: "template",
        by: "you",
        title: "Pick a template",
        body: "Choose the design that fits your brand from the template library.",
      },
      {
        id: "customize",
        by: "you",
        title: "Make it yours",
        body: "Add your products, logo and colours, and change any word or picture.",
      },
      {
        id: "publish",
        by: "you",
        title: "Publish",
        body: "Your store goes live on a ZIMOS address or on your own domain.",
      },
      {
        id: "confirm",
        by: "you",
        title: "Confirm orders",
        body: "Your team confirms orders before they ship: by call, and by WhatsApp message on the plans that include it.",
      },
      {
        id: "ship",
        by: "zimos",
        title: "Shipped and counted",
        body: "Booked with your courier — by you, or automatically once it's confirmed — with a tracking code, and counted in your real profit.",
      },
    ],
  },

  dashboard: {
    kicker: "Your dashboard",
    heading: "One screen for the whole store",
    intro: "Real screens of the dashboard you will run your store from every day: orders, confirmation, shipping and profit in one place.",
    tabs: [
      { id: "home", label: "Home", alt: "The ZIMOS dashboard home: sales, orders, net profit, confirmation and delivery rates, and store visits" },
      { id: "orders", label: "Orders", alt: "ZIMOS orders: every order with its stage, customer, place and products, with search and filters" },
      { id: "profit", label: "Real profit", alt: "ZIMOS real profit: delivered revenue less the goods, both shipping legs, fees and ad spend, day by day" },
    ],
    caption: "Real screens of the ZIMOS dashboard — numbers from a demo store.",
  },

  trust: {
    kicker: "What should reassure you",
    heading: "Your store and your data are yours, and the price is clear up front",
    intro:
      "ZIMOS is a platform you subscribe to, monthly or yearly. We don't sell products or take part in your sales — you sell to your customers, and we give you the tools.",
    points: [
      {
        title: "A clear subscription",
        body: "One monthly or yearly price for the platform, and everything your plan includes is written under it before you pay.",
      },
      {
        title: "Start free, no card",
        body: "Create your account, pick a template and add your products before you pay anything.",
      },
      {
        title: "Your data stays yours",
        body: "Export your orders, customers and products from the dashboard at any time.",
      },
      {
        title: "Payment you can check",
        body: "Currently by manual transfer; your subscription starts once it is confirmed, and refunds follow our",
      },
    ],
    refundLink: "refund policy",
  },

  pricing: {
    kicker: "Pricing",
    heading: "Simple plans for your store",
    intro: "A monthly or yearly subscription to the ZIMOS platform. Every price includes everything listed under the plan.",
    pageTitle: "Pricing — ZIMOS",
    pageDescription:
      "ZIMOS plans and prices: a monthly or yearly subscription to the platform for building and running your online store, with the free trial, limits and features of each plan.",
    pageHeading: "Plans and prices",
    pageIntro:
      "ZIMOS is a SaaS platform for building online stores. You subscribe to the platform monthly or yearly, on the plan that fits your store.",
    billingCycle: "Billing cycle",
    monthly: "Monthly",
    yearly: "Yearly",
    yearlyNote: "2 months free",
    perMonth: "/ month",
    perYear: "/ year",
    yearlyEquivalent: "or {price} / year",
    free: "Free",
    trial: "{days}-day free trial",
    noTrial: "No free trial",
    stores: "Stores",
    funnels: "Funnels a month",
    orders: "Orders a month",
    unlimited: "Unlimited",
    cta: "Subscribe",
    ctaYearly: "Subscribe yearly",
    seeAll: "See all plans and prices",
    comingSoon: "Prices will be available soon.",
    comingSoonBody: "Our plans are being finalised. Create your account now and we'll show you the plans as soon as they're published.",
    comingSoonCta: "Create your account",
    paymentNote: "Payment is currently by manual transfer, and refunds follow our",
    refundLink: "refund policy",
    features: {
      custom_domain: "Custom domain",
      funnels: "Sales funnels",
      whatsapp_confirmation: "WhatsApp order confirmation",
      abandoned_cart: "Abandoned cart recovery",
      multi_warehouse: "Multiple warehouses",
      api_access: "API access",
      staff_accounts: "Staff accounts",
      advanced_analytics: "Advanced analytics",
      visitor_insights: "Visitor insights",
      remove_branding: "Remove platform branding",
      priority_support: "Priority support",
      loyalty: "Loyalty points",
    },
    payPerOrder: {
      badge: "No subscription",
      tagline: "Pay only for each order, with no monthly or yearly subscription.",
      perOrder: "/ order",
      freeOrders: "Your first {orders} free",
      feeAtConfirmation: "Each order's fee is taken from your prepaid balance when the order is confirmed",
      feeAtPlacement: "Each order's fee is taken from your prepaid balance when the order comes in, and given back if it's cancelled before shipping",
      noExpiry: "Your balance never expires",
      topUp: "Top up your balance from your dashboard at any time",
      cta: "Get started",
      howToChoose: "After you sign up, choose pay per order in My Plan in your dashboard.",
      pageIntro:
        "ZIMOS is a SaaS platform for building online stores. You subscribe to the platform monthly or yearly, on the plan that fits your store, or pay only for each order, with no subscription.",
      faq: {
        kicker: "Pay per order",
        heading: "Questions about pay per order",
        afterFreeQuestion: "What happens after the free orders?",
        afterFreeAnswer: "After your first {orders}, {fee} is taken from your prepaid balance for each order. Top up your balance from your dashboard at any time.",
        whenQuestion: "When is an order's fee taken?",
        whenAtConfirmation:
          "When the order is confirmed, or when its payment arrives if the customer paid online — not when it comes in. An order cancelled before it's confirmed costs nothing; once it's confirmed, the fee isn't given back if the order is cancelled or returned.",
        whenAtPlacement: "When the order comes in. If it's cancelled or rejected before it ships, the fee goes back to your balance.",
        expiryQuestion: "Does my balance expire?",
        expiryAnswer: "No. Your balance never expires and doesn't shrink over time.",
        chooseQuestion: "How do I choose pay per order?",
        chooseAnswer: "Create your account, then choose pay per order in My Plan in your dashboard.",
      },
    },
  },

  service: {
    kicker: "What ZIMOS is",
    heading: "One platform to build your store and run it from the first order",
    body:
      "ZIMOS is software you use online: you build and run your store on it, and pay a monthly or yearly subscription for the platform. We don't sell products or take part in your sales — you sell to your customers, and ZIMOS gives you the store, the funnels, order confirmation, shipping and reports to do it.",
    bodyWithPayPerOrder:
      "ZIMOS is software you use online: you build and run your store on it, and pay for the platform with a monthly or yearly subscription, or a fee for each order from a prepaid balance. We don't sell products or take part in your sales — you sell to your customers, and ZIMOS gives you the store, the funnels, order confirmation, shipping and reports to do it.",
    points: [
      {
        title: "What you buy",
        body: "A subscription to the ZIMOS platform, monthly or yearly.",
        withPayPerOrder: "A subscription to the ZIMOS platform, monthly or yearly, or paying for each order from a prepaid balance.",
      },
      { title: "What it includes", body: "Your store and website, funnels, order management and the features of your plan." },
      {
        title: "How you pay",
        body: "Currently by manual transfer, activated once the payment is confirmed.",
        withPayPerOrder: "Currently by manual transfer: the subscription is activated, or the balance added, once the payment is confirmed.",
      },
      { title: "Your data stays yours", body: "Export your orders, customers and products from the dashboard at any time." },
    ],
  },

  legal: {
    lastUpdated: "Last updated: {date}",
    contactHeading: "Contact details",
    email: "Email",
    phone: "Phone",
    address: "Address",
    hours: "Working hours",
    entityHeading: "Legal entity",
    legalName: "Name",
    registration: "Commercial registration",
    taxRegistration: "Tax registration no.",
    relatedHeading: "Related pages",
    socialHeading: "Follow us and get in touch",
  },

  faq: {
    kicker: "Questions",
    heading: "Before you start: straight answers",
    contactLink: "Still unsure? Talk to us",
    items: [
      {
        question: "Can I change the template's design?",
        answer:
          "Yes. Every section, word, colour and picture is editable in the editor, each template has its own phone layout, and you can start from another template whenever you like.",
      },
      {
        question: "What exactly am I paying for?",
        answer:
          "A monthly or yearly subscription to the platform, on the plan you choose. Each plan's price and what it includes are on the pricing page. Payment is currently by manual transfer, and your subscription starts once it is confirmed.",
      },
      {
        question: "How does order confirmation work?",
        answer:
          "New cash-on-delivery orders wait in a confirmation queue, and your team confirms them before shipping: by call, and by WhatsApp message on the plans that include it. A cash-on-delivery order can't be booked with a courier until it's confirmed, and an order paid in advance ships once its payment is in.",
      },
      {
        question: "Can I ship with the courier I already use?",
        answer:
          "Yes. ZIMOS works with every shipping company: some are connected directly, so you connect your own account from the dashboard and book shipments with a tracking code, and with any other company you add the shipment to the order by hand with its waybill number.",
      },
      {
        question: "Which payment methods can I accept?",
        answer:
          "All of them: cash on delivery; card and wallet payments online through a payment gateway, once you connect your own account with it under Payments in the dashboard; and InstaPay as a manual transfer: the customer sends proof of the transfer and your team approves it.",
      },
      {
        question: "Can I use my own domain?",
        answer:
          "Your store starts on a ZIMOS subdomain so it can go live right away. When you're ready, connect a domain you own from your store settings.",
      },
      {
        question: "Is my data mine?",
        answer:
          "Yes. Your orders, customers and products belong to you, and you can export them from the dashboard at any time.",
      },
      {
        question: "Can my team work in the same account?",
        answer:
          "Yes. Invite teammates and give each one a role — a confirmation agent, for example, sees orders and customers and confirms orders, without your settings, products or finances.",
      },
    ],
  },

  finalCta: {
    heading: "Ready? Pick your store's look today.",
    body: "Start free, with no card. Choose a template, add your first product and publish — then take your first order and judge it all for yourself.",
    primaryCta: "Start free",
    secondaryCta: "I have an account — sign in",
  },

  footer: {
    navLabel: "Footer",
    links: [
      { label: "Features", href: "/features" },
      { label: "Pricing", href: "/pricing" },
      { label: "FAQ", href: "#faq" },
      { label: "Contact us", href: "/contact" },
      { label: "Refund policy", href: "/refund-policy" },
      { label: "Terms of service", href: "/terms" },
      { label: "Privacy policy", href: "/privacy" },
    ],
    rights: "All rights reserved.",
    languageLabel: "Language",
    registration: "Commercial registration",
    taxRegistration: "Tax registration no.",
  },
};
