import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  meta: {
    title: "Zimos — Online Store Builder for Cash on Delivery",
    description:
      "Zimos lets you build a complete online store in 5 minutes and sell with cash on delivery: orders confirmed before shipping, every shipping company, real profit per order.",
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
    benefits: "Features",
    howItWorks: "Order journey",
    growth: "Growth tools",
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
    startFree: "Get started",
  },

  hero: {
    badge: "One platform for selling with cash on delivery",
    lines: ["Your online store, live in minutes."],
    accent: "Your profit on every order, clear.",
    body: "Build your store from a ready template in minutes, confirm your orders before they ship, send them with any shipping company, and see your net profit once every cost is off.",
    primaryCta: "Create your store",
    secondaryCta: "See the stores",
    ticks: ["Subscribe when you publish", "Ready store templates", "Arabic and English"],
    imageAlt: "Stores built on ZIMOS from its templates, on a computer and on a phone",
    chips: {
      order: { title: "New order", detail: "In the confirmation queue" },
      confirmed: { title: "Order confirmed", detail: "Tracking code ready" },
      delivered: { title: "Delivered", detail: "Counted in your profit" },
    },
    caption: "Real screenshots of ZIMOS stores — demo products and pictures.",
  },

  integrations: {
    label: "Connects with",
    note: "Trademarks and logos belong to their owners.",
    manualTransfer: "Manual transfer",
    shippingCompanies: "Every shipping company",
    paymentGateways: "Payment gateways",
  },

  templates: {
    kicker: "Stores",
    heading: "See your store before you build it.",
    intro:
      "Whole stores built on ZIMOS from its template library. Open any store and look through its page on a computer and on a phone, then start from it and change every word, colour and picture.",
    templateLabel: "Template {n}",
    kinds: {
      all: "All stores",
      fashion: "Fashion and clothing",
      home: "Home and furniture",
      food: "Restaurants and food",
      electronics: "Electronics",
      kids: "Mother and baby",
      other: "Other",
    },
    names: {
      "23": "Clothing store",
      "24": "Mother and baby",
      "13": "Smart watches",
      "02": "Furniture and decor",
      "18": "Fast food",
      "05": "Men's fashion",
      "04": "Fashion and beauty",
      "15": "Electronics and computers",
      "09": "Pillows and bedding",
      "20": "Grill house",
      "01": "Women's fashion",
      "12": "Watches and smart devices",
      "17": "Fruit and juices",
      "10": "Winter wear",
      "03": "Modern fashion",
      "19": "Café and restaurant",
      "08": "Sports shoes",
      "14": "Youth clothing",
      "21": "Fine dining",
      "06": "Dresses and style",
      "16": "Clothing and accessories",
      "22": "Services and business",
    },
    ownBadge: "Designed by ZIMOS",
    pickLabel: "Pick a kind of store",
    view: "View the store",
    showAll: "Show all {n} stores",
    viewerLabel: "Store preview",
    onComputer: "Computer",
    onPhone: "Phone",
    previous: "Previous store",
    next: "Next store",
    close: "Close the preview",
    useTemplate: "Start with this template",
    scrollHint: "Scroll inside the screen to see the whole page",
    cta: "Create your store",
    caption: "Real screenshots of ZIMOS stores — demo products and pictures.",
  },

  journey: {
    kicker: "Order journey",
    heading: "From the ad to the profit, on one path.",
    intro: "From the moment your customer sees the ad until the order's profit is in your account: every step happens inside ZIMOS, with who is responsible and what comes next.",
    steps: [
      {
        id: "ad",
        label: "The ad",
        title: "Your customer sees the ad",
        body: "Connect your ad pixels to your store, and ZIMOS records where every order came from, so you know which ad brought it.",
      },
      {
        id: "page",
        label: "Sales page",
        title: "And orders from one page",
        body: "A landing page for your product with a short order form, and an order bump at checkout that raises the order's value.",
      },
      {
        id: "confirm",
        label: "Confirmation",
        title: "Your team confirms it before it ships",
        body: "The order joins the confirmation queue with its risk level, and your agent records the call's outcome with one click.",
      },
      {
        id: "ship",
        label: "Shipping",
        title: "Then it ships with your courier",
        body: "Book the confirmed order with the shipping company you choose, with a tracking code, and its status updates until delivery.",
      },
      {
        id: "profit",
        label: "Profit",
        title: "And you see its real profit",
        body: "Once delivered, the order is counted in your profit, after the product's cost, shipping and ads.",
      },
    ],
    demo: {
      sponsored: "Sponsored",
      storeName: "Your store",
      adText: "The watch everyone asks about. Order now and pay on delivery.",
      shopNow: "Shop now",
      product: "Smart watch",
      price: "EGP 1,250",
      fields: ["Name", "Phone number", "Address"],
      bump: "Add a spare strap at half price",
      orderNow: "Order now, pay on delivery",
      queue: "Confirmation queue",
      orderNumber: "Order 1042",
      risk: "Low risk",
      confirmed: "Confirmed",
      refused: "Refused",
      later: "Later",
      shipment: "Shipment",
      tracking: "Tracking code",
      statuses: ["Booked", "On its way", "Delivered"],
      profitTitle: "The order's profit",
      rows: [
        { label: "Sale price", value: "1,250" },
        { label: "Product cost", value: "−520" },
        { label: "Shipping", value: "−70" },
        { label: "Ads", value: "−180" },
      ],
      net: { label: "Net profit", value: "480" },
      currency: "EGP",
    },
    note: "An illustration with generic interface elements; the figures are an example.",
  },

  growth: {
    kicker: "Growth tools",
    heading: "Tools that raise your sales and bring customers back.",
    intro: "Discounts, offers and loyalty you run from the same dashboard, with no outside add-ons.",
    tools: [
      {
        id: "coupons",
        title: "Discount codes",
        body: "A percentage, an amount or free shipping, on terms you set: how long, which products, how many uses.",
        tag: "20% off",
      },
      {
        id: "loyalty",
        title: "Loyalty points",
        body: "Your customer earns points with every order and spends them on the next, with VIP levels that add more.",
        tag: "320 points",
      },
      {
        id: "cart",
        title: "Cart rewards",
        body: "A bar in the cart tells your customer how far they are from free shipping or the next discount.",
        tag: "EGP 150 to free shipping",
      },
      {
        id: "bundles",
        title: "Bundles and extra offers",
        body: "Product bundles at one price, an order bump at checkout, and an upsell after purchase.",
        tag: "Bundle of 3",
      },
      {
        id: "email",
        title: "Email campaigns",
        body: "Send your offers to your subscribed customers, all of them or a segment, with a ready editor and a preview before sending.",
        tag: "Weekend offer",
      },
      {
        id: "recovery",
        title: "Lost-order recovery",
        body: "See who left checkout before finishing their order, and turn them into an order or send a recovery message.",
        tag: "Finish your order",
      },
    ],
    note: "The tools you get depend on your plan; the details are on the",
    pricingLink: "pricing page",
  },

  dashboard: {
    kicker: "Your dashboard",
    heading: "Real screens, not marketing pictures.",
    intro: "This is the dashboard you will run your store from every day, exactly as you will see it.",
    tabs: [
      {
        id: "home",
        label: "Home",
        blurb: "Sales, orders and net profit, with confirmation and delivery rates.",
        alt: "The ZIMOS dashboard home: sales, orders, net profit, confirmation and delivery rates, and store visits",
      },
      {
        id: "orders",
        label: "Orders",
        blurb: "Every order with its stage, customer and products, with search and filters.",
        alt: "ZIMOS orders: every order with its stage, customer, place and products, with search and filters",
      },
      {
        id: "profit",
        label: "Real profit",
        blurb: "Delivered revenue less every cost, day by day.",
        alt: "ZIMOS real profit: delivered revenue less the goods, both shipping legs, fees and ad spend, day by day",
      },
    ],
    previous: "Previous screen",
    next: "Next screen",
    caption: "Real screens of the ZIMOS dashboard — numbers from a demo store.",
  },

  start: {
    kicker: "Getting started",
    heading: "Your store is live in three steps.",
    steps: [
      {
        title: "Create your account",
        body: "Sign up in minutes, then pick your plan and the template that fits your brand.",
      },
      {
        title: "Add your products and your brand",
        body: "Add your products one by one or import them from a file, then put in your logo and colours.",
      },
      {
        title: "Subscribe and publish",
        body: "Once your store is ready, subscribe and publish it on a ZIMOS address or on your own domain, and orders reach you in the dashboard.",
      },
    ],
    cta: "Create your store",
  },

  trust: {
    points: [
      {
        title: "A clear subscription",
        body: "One monthly or yearly price for the platform, and everything your plan includes is written under it before you pay.",
      },
      {
        title: "Build your store before you pay",
        body: "Create your account, pick a template and add your products. You subscribe when your store is ready to publish.",
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
    heading: "A clear price from the start.",
    intro: "Pick the plan that fits your store's size, or pay per order. Every price includes everything listed under the plan.",
    pageTitle: "Pricing and Plans — Zimos",
    pageDescription:
      "Zimos plans and prices: a monthly or yearly subscription to the platform for building and running your online store, with the limits and features of each plan.",
    pageHeading: "Plans and prices",
    pageIntro:
      "ZIMOS is a SaaS platform for building online stores. You subscribe to the platform monthly or yearly, on the plan that fits your store.",
    billingCycle: "Billing cycle",
    monthly: "Monthly",
    yearly: "Yearly",
    yearlySave: "Save",
    perMonth: "/ month",
    perYear: "/ year",
    yearlyEquivalent: "or {price} / year",
    fullYearLabel: "Instead of paying monthly for a year:",
    perMonthEquivalent: "= {price} / month",
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
      reviews: "Product and store reviews",
      about_gallery: "About page photo gallery",
      combos: "Product combos",
      cart_rewards: "Cart rewards",
      email_campaigns: "Email campaigns",
      advanced_coupons: "Advanced coupons",
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

  credits: {
    title: "Credits and licenses",
    description: "The free templates, icons and fonts the Zimos website uses, and their licenses.",
    intro: "The ZIMOS website uses free designs, icons and fonts. Our thanks to the people who made them — here they are with their licenses.",
    templatesHeading: "Store designs",
    templatesLead: "The store designs on this site are adapted from free templates:",
    resourcesHeading: "Icons, photographs and fonts",
  },

  faq: {
    kicker: "Questions",
    heading: "Questions we hear before the start",
    contactLink: "Still unsure? Talk to us",
    items: [
      {
        question: "Do I need technical skills to build my store?",
        answer:
          "No. You start from a ready template and edit your store in a visual editor that shows every change as you make it — no code, no designer.",
      },
      {
        question: "Does my store work in Arabic and English?",
        answer:
          "Yes. The store and the dashboard both work in Arabic and English, and your customer picks the language they browse in.",
      },
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
    heading: "Ready for your first order?",
    body: "Create your account, pick a template and add your first product. You subscribe when your store is ready to publish.",
    primaryCta: "Create your store",
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
      { label: "Credits", href: "/credits" },
    ],
    rights: "All rights reserved.",
    languageLabel: "Language",
    registration: "Commercial registration",
    taxRegistration: "Tax registration no.",
  },
};
