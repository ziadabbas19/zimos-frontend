import type { FeaturesCopy } from "./types";

/** Translated from the Arabic list (ar.ts), item for item. */
export const en: FeaturesCopy = {
  meta: {
    title: "Features — ZIMOS",
    description:
      "Every ZIMOS feature for merchants: products, orders and confirmation, shipping with every company, every payment method, fraud protection, marketing, store design and reports. Try it free for 7 days.",
  },

  hero: {
    kicker: "Features",
    heading: "Everything your store needs, in one place",
    body: "From your first product to your last report. ZIMOS supports every payment method and works with every shipping company.",
    cta: "Start your 7-day free trial",
  },

  bar: {
    navLabel: "Feature sections",
    jumpLabel: "Jump to a section",
    searchLabel: "Search features",
    searchPlaceholder: "Search features",
    openSearch: "Search",
    empty: "No feature matches that word.",
    clearSearch: "Clear search",
  },

  sections: {
    products: {
      label: "Products",
      title: "Products and catalogue",
      intro: "Your whole catalogue — sizes, photos and offers — run from one place.",
      items: [
        { title: "Unlimited products", body: "No limit on the number of products." },
        {
          title: "Full variants",
          body: "Sizes and colours, each variant with its own price, cost, SKU, weight, image and stock.",
        },
        { title: "Product photos and video", body: "Drag to upload, reorder, and automatic resizing." },
        {
          title: "Category tree",
          body: "Drag to reorder, each category with its own image, description and SEO.",
        },
        {
          title: "Import and export",
          body: "Import from CSV or Excel, and export your catalogue.",
        },
        { title: "Bulk edit", body: "Change the price, status or shipping of many products at once." },
        {
          title: "Product offers",
          body: "Fixed-price bundles, quantity discounts and a countdown to the end of the offer.",
        },
        {
          title: "Paid custom fields",
          body: "Text or a photo from the customer, for gift notes or embroidery, for example.",
        },
        { title: "Restaurant menu options", body: "Sizes and add-ons with a minimum, a maximum and a price." },
        {
          title: "Digital products and courses",
          body: "Delivered automatically on payment, with chapters, lessons and a student portal.",
        },
        { title: "Product A/B tests", body: "Test the price or the photos; the winner is picked automatically." },
        { title: "Reviews", body: "Moderate and add reviews with photos, with a “Verified buyer” badge." },
        { title: "Interactive photos (Shop the look)", body: "Points on a photo linked to your products." },
        { title: "Customer questions", body: "Customers ask about a product, and you answer." },
        {
          title: "Back-in-stock alerts",
          body: "The customer gets an email or SMS when the product is back.",
        },
        {
          title: "Sizes, specs and comparison",
          body: "Size charts, specification tables and product comparison.",
        },
        { title: "Purchase limits and pre-orders", body: "Set purchase limits and take pre-orders." },
      ],
    },

    orders: {
      label: "Orders",
      title: "Orders and confirmation",
      intro: "From the moment an order arrives until it is delivered: confirm, edit, print and track.",
      items: [
        {
          title: "All your orders in one place",
          body: "Stages with counts, search by number, name or phone, and filters by governorate, payment method, source and discount code.",
        },
        { title: "Kanban board for orders", body: "Drag orders from one stage to the next." },
        {
          title: "Team confirmation queue",
          body: "An order locks to the agent calling, the outcome takes one tap (confirmed, rejected with a reason, unreachable, postponed), and calls are shared across the team.",
        },
        { title: "One-tap WhatsApp confirmation", body: "Right from the order page." },
        {
          title: "Lost orders",
          body: "See who left at checkout and why, then turn it into an order or send a recovery message.",
        },
        { title: "Bulk printing", body: "Waybills, invoices and the courier's handover sheet in one PDF." },
        { title: "Order export", body: "CSV or Excel, plus an export for your accountant." },
        {
          title: "Edit an order before shipping",
          body: "Address, products and quantities, with the total recalculated instantly.",
        },
        { title: "A timeline for every order", body: "Who did what, and when, in full." },
        {
          title: "Returns and exchanges",
          body: "Accept or reject a return and put it back in stock; customers can ask for an exchange.",
        },
        { title: "Manual orders", body: "For customers who order on WhatsApp or by phone." },
        {
          title: "Customer tracking page",
          body: "Customers follow their order with their mobile number and order number.",
        },
        { title: "PDF invoice", body: "For every order." },
        { title: "Live updates", body: "Orders update in front of you, no refresh needed." },
      ],
    },

    shipping: {
      label: "Shipping",
      title: "Shipping and tracking",
      intro: "Works with every shipping company, connected directly or manually, and with your own couriers too.",
      items: [
        {
          title: "Every shipping company",
          body: "Connected directly, or manually with a tracking number and link.",
        },
        {
          title: "Flexible shipping rates",
          body: "A price per governorate, free shipping over an amount, weight-based rates, shipping groups for heavy products, and options (standard, express, pickup).",
        },
        { title: "Local delivery zones", body: "Within the city, with fees and an estimated time." },
        { title: "Store pickup", body: "Customers can collect their order from you." },
        { title: "Your own couriers", body: "Register your couriers and settle their accounts." },
        { title: "Store opening hours", body: "And automatic closing outside them." },
        {
          title: "Automatic tracking",
          body: "Of each shipment's status, and cancel a shipment from the same page.",
        },
        { title: "Bulk shipment booking", body: "With missing details checked before sending." },
        {
          title: "Shipping collections",
          body: "See the money each shipping company holds for you and reconcile its statement (CSV).",
        },
      ],
    },

    payments: {
      label: "Payments",
      title: "Payments",
      intro: "ZIMOS supports every payment method, all in one store.",
      items: [
        {
          title: "Every payment method in one store",
          body: "Cash on delivery, InstaPay, mobile wallets, online payment gateways, gift cards, store credit and loyalty points.",
        },
        {
          title: "InstaPay and wallets",
          body: "The customer transfers and uploads the transfer number and a screenshot; you review and accept or reject before shipping.",
        },
        {
          title: "Full or partial refunds",
          body: "Through the gateway or manually with a credit note, or as store credit.",
        },
        { title: "Clear payment status", body: "On every order." },
        { title: "Invoices and tax", body: "PDF invoices, and tax at the rates you set." },
        {
          title: "Your plan, your way",
          body: "Pay ZIMOS per order from a prepaid balance, or with a monthly or yearly subscription you change yourself.",
        },
      ],
    },

    fraud: {
      label: "Fraud",
      title: "Fraud protection",
      intro: "Spot suspicious orders and stop them, without bothering your real customers.",
      items: [
        {
          title: "Automatic rules",
          body: "For repeated or rapid orders from the same number or IP, unusual quantities and customers who often refuse orders.",
        },
        { title: "A risk level for every order", body: "Low, medium or high, with the reasons." },
        { title: "Phone verification by code (OTP)", body: "By WhatsApp or SMS, before the order." },
        { title: "Bot protection", body: "Without bothering real customers." },
        {
          title: "Block list",
          body: "By phone number, IP, email or device, and import a ready-made list.",
        },
        { title: "Block and cancel in one tap", body: "From the suspicious order." },
        {
          title: "Protection stats",
          body: "How many orders were stopped, and how many pounds you saved (an estimate).",
        },
      ],
    },

    customers: {
      label: "Customers",
      title: "Customers and loyalty",
      intro: "Know your customers, and bring them back with points, credit and gifts.",
      items: [
        { title: "A full customer base", body: "Search, tags, order history and addresses." },
        { title: "Saved segments", body: "Save groups of customers for targeting." },
        {
          title: "Customer segmentation (RFM)",
          body: "Champions, customers at risk and lost customers.",
        },
        { title: "Customer accounts", body: "Passwordless sign-in with a code, and a wishlist." },
        {
          title: "Loyalty points and VIP tiers",
          body: "With discounts, free shipping and points multipliers.",
        },
        { title: "Store credit", body: "Customers spend it at checkout." },
        { title: "“Refer a friend”", body: "A reward for the customer and for their friend." },
        { title: "Gift cards", body: "Sold in your store and redeemed at checkout." },
      ],
    },

    marketing: {
      label: "Marketing",
      title: "Marketing and offers",
      intro: "Pixels and the source of every order, discounts and offers, and automations that run on their own.",
      items: [
        {
          title: "Ad pixels",
          body: "Meta, TikTok, Snapchat, Google, GTM and Clarity, per funnel or product.",
        },
        { title: "Server-side events (Conversions API)", body: "For Meta, TikTok, Snapchat and GA4." },
        { title: "The source of every order", body: "First and last touch, UTMs and ad click IDs." },
        {
          title: "Discount codes",
          body: "Percentage, amount, free shipping or “Buy X, get Y”, with usage limits and dates, a share link that applies the code by itself, and many codes generated at once.",
        },
        { title: "Automatic discounts", body: "A discount that applies without a code." },
        {
          title: "Bigger orders",
          body: "Bundles, order bumps, post-purchase upsells, suggested products and an exit pop-up.",
        },
        { title: "Social proof", body: "Notices of real sales." },
        {
          title: "Newsletter and referrals",
          body: "Newsletter sign-up with a coupon, and referral links for marketers.",
        },
        { title: "Product feed", body: "For Meta, Google, TikTok and Snapchat." },
        {
          title: "One-tap ready automations",
          body: "Order confirmation, shipped, courier on the way, delivered with a review request, cart recovery and digital product delivery.",
        },
        {
          title: "Custom automations",
          body: "With triggers, steps and conditions: WhatsApp, email, SMS, webhook, tag.",
        },
      ],
    },

    store: {
      label: "Store",
      title: "Store and design",
      intro: "Design your store yourself and see every change on the real store.",
      items: [
        {
          title: "Visual editor",
          body: "Edit the real store in front of you: one click to select, two to type.",
        },
        {
          title: "Sections, templates and themes",
          body: "A library of ready sections, and templates and themes previewed with your products.",
        },
        {
          title: "A layout per device",
          body: "Separate styling for phone, tablet and desktop, and sections hidden by device.",
        },
        { title: "Draft and publish", body: "And go back to any published version." },
        { title: "Your brand", body: "Colours, fonts and logo saved live, with light and dark modes." },
        {
          title: "Sales funnels",
          body: "Landing, checkout, upsell/downsell and thank-you pages, with ready templates and A/B testing.",
        },
        { title: "Blog and redirects", body: "A blog, and 301/302 redirects." },
        { title: "Full SEO", body: "And an automatic sitemap." },
        { title: "Your own domain", body: "With an SSL certificate." },
        { title: "Arabic and English", body: "And other content languages." },
        {
          title: "Store app and WhatsApp button",
          body: "An app for your store (PWA), and a floating WhatsApp button.",
        },
        { title: "Ready policies", body: "Returns, privacy and terms, from ready templates." },
        { title: "More than one store", body: "On one account." },
      ],
    },

    reports: {
      label: "Reports",
      title: "Reports and profit",
      intro: "Know your real profit and where your sales come from, in numbers.",
      items: [
        {
          title: "Sales dashboard",
          body: "Sales, orders, conversion and average order value, compared with the previous period.",
        },
        {
          title: "Real profit",
          body: "After product cost, shipping, returns, fees and ads, with the most you can spend on ads per order.",
        },
        {
          title: "Sales sources",
          body: "With the actual return on ad spend and the cost per delivered order.",
        },
        {
          title: "Detailed reports",
          body: "Products, delivery by governorate and shipping company, customers, slow-moving stock, return reasons and peak times.",
        },
        { title: "Site traffic", body: "Visits and visitors, and who is on now." },
        { title: "Email reports", body: "Daily and weekly." },
        { title: "Ad spend", body: "Entered by hand or from a CSV." },
        { title: "CSV export", body: "For most reports." },
      ],
    },

    notifications: {
      label: "Notifications",
      title: "Notifications and WhatsApp",
      intro: "Know what is happening as it happens, and talk to customers on WhatsApp from one place.",
      items: [
        {
          title: "Notification bell",
          body: "For new and suspicious orders and service alerts, with a sound for new orders.",
        },
        { title: "Per-member notifications", body: "Choose each team member's notifications separately." },
        {
          title: "Shared WhatsApp inbox for the team",
          body: "Conversations, assignment to a member, quick replies and templates.",
        },
        { title: "WhatsApp confirm buttons", body: "Customers confirm or cancel their order with a button." },
        {
          title: "Customer emails",
          body: "Received, shipped, cancelled, refunded and abandoned cart, from a template you edit.",
        },
      ],
    },

    team: {
      label: "Team",
      title: "Team and account",
      intro: "Work with your team, each person seeing what is theirs.",
      items: [
        {
          title: "Ready roles",
          body: "Owner, manager, editor, order operator, confirmation agent and accountant, each seeing what concerns them.",
        },
        { title: "Team invites", body: "And an activity log of every change." },
        { title: "Secure sign-in", body: "Sign in with Google, and two-step sign-in." },
        { title: "Quick search", body: "Across the dashboard." },
        { title: "Support and ideas", body: "Ticket support, and a page to suggest features." },
        { title: "Bilingual dashboard", body: "Arabic or English, in light or dark mode." },
      ],
    },

    developers: {
      label: "Developers",
      title: "For developers",
      intro: "Connect your store to your own systems.",
      items: [
        {
          title: "Public API",
          body: "Documented with Swagger, for orders, products, customers, discounts and inventory.",
        },
        { title: "Webhooks", body: "Signed, with automatic retries." },
        { title: "API keys", body: "With read or write permissions." },
      ],
    },
  },

  shots: {
    caption: "A real screen from the ZIMOS dashboard; the figures come from a demo store.",
    orders: "The orders page in the ZIMOS dashboard: each order with its status, customer, location and products, with search and filters",
    profit:
      "The real profit page in the ZIMOS dashboard: revenue after product cost, shipping, fees and ads, day by day",
  },

  cta: {
    heading: "Open your store in under 5 minutes",
    body: "Try ZIMOS free for 7 days, with every payment method and every shipping company.",
    primaryCta: "Start your 7-day free trial",
    secondaryCta: "I have an account — sign in",
  },

  home: {
    kicker: "Features",
    heading: "Everything you need to sell and grow",
    intro: "A glimpse of ZIMOS's main tools; every detail is on the features page.",
    cards: {
      orders: {
        title: "Orders & confirmation",
        body: "A team confirmation queue, lost orders and bulk waybill printing.",
      },
      shipping: {
        title: "Shipping",
        body: "Works with every shipping company, connected directly or manually.",
      },
      payments: { title: "Payments", body: "Every payment method in one store." },
      fraud: {
        title: "Fraud protection",
        body: "A risk level for every order, phone verification by code and a block list.",
      },
      marketing: { title: "Marketing", body: "Pixels, discount codes and one-tap automations." },
      store: { title: "Store", body: "A visual editor where you edit the real store in front of you." },
      reports: { title: "Reports", body: "Your real profit after product cost, shipping and ads." },
      loyalty: { title: "Loyalty", body: "Points and VIP tiers, store credit and gift cards." },
    },
    cta: "See all features",
  },
};
