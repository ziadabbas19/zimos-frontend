import type { Dictionary } from "../dictionary";

export const en: Dictionary = {
  meta: {
    title: "Zimos — a real store for cash-on-delivery selling",
    description:
      "Zimos turns DM order-taking into a proper online store for Egyptian and MENA merchants: every cash-on-delivery order confirmed by phone and tracked to the doorstep.",
  },

  nav: {
    brand: "Zimos",
    features: "Features",
    pricing: "Pricing",
    switchLanguage: "العربية",
    switchLanguageAria: "Switch language to Arabic",
    switchToDark: "Switch to dark theme",
    switchToLight: "Switch to light theme",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    login: "Log in",
    startStore: "Start your store",
  },

  hero: {
    kicker: "Built for cash-on-delivery selling",
    headline: "Your orders shouldn't live in your DMs",
    subheadline:
      "Zimos gives sellers in Egypt and across MENA a real online store — every cash-on-delivery order confirmed by a real phone call, given a tracking code, and followed all the way to the customer's door. No more scrolling chats to find who ordered what.",
    startStore: "Start your store",
    seeHow: "See how it works",
    flowCaption: "How an order moves through Zimos",
    flowAria: "Animated walkthrough of an order: placed, confirmed by call, tracking code issued, delivered.",
    trackingLabel: "Tracking code",
    steps: [
      {
        id: "placed",
        title: "Order comes in",
        detail: "A customer checks out from a WhatsApp or Instagram message — name, address, and items in one place.",
      },
      {
        id: "confirmed",
        title: "Confirmed by call",
        detail: "Your team rings the customer to confirm the order and the delivery address before anything ships.",
      },
      {
        id: "tracked",
        title: "Tracking code issued",
        detail: "Zimos generates a tracking code the moment the order is confirmed.",
      },
      {
        id: "delivered",
        title: "Out for delivery",
        detail: "The courier delivers and collects the cash. The order closes itself — no manual follow-up.",
      },
    ],
  },

  features: {
    kicker: "One flow, start to finish",
    heading: "From storefront to doorstep, and back again",
    intro:
      "One order record carries the sale from your storefront to the customer's door — and keeps working after the package arrives. Here's what it handles at each point.",
    stages: [
      {
        id: "setup",
        title: "Set up your store",
        summary: "Before the first order, you get a storefront that's genuinely online.",
        points: [
          "Start from a ready-made storefront design — a few to choose from.",
          "Add your logo, tagline, and brand color. No designer, no developer.",
          "Go live on your own subdomain, ready to take orders.",
        ],
      },
      {
        id: "order",
        title: "Take the order and confirm it",
        summary:
          "A checkout order turns into a confirmed shipment the customer can follow.",
        points: [
          "Offer add-ons and deals at checkout, so an order can grow before it's placed.",
          "Every cash-on-delivery order is confirmed by phone before anything ships.",
          "The customer gets SMS updates as the order moves.",
          "A shipping label and waybill are ready for the courier.",
          "A tracking code lets the customer check where the delivery is.",
        ],
      },
      {
        id: "aftercare",
        title: "After it's delivered",
        summary: "The order record stays useful once the package has arrived.",
        points: [
          "Handle a return straight from the original order — nothing to re-enter.",
          "Repeat customers are recognized the next time they order.",
        ],
      },
    ],
  },

  pricing: {
    badge: "Early access",
    heading: "Pricing isn't public yet",
    body:
      "Zimos is in early access. You can open your store and start taking real orders now — at no cost while we're in this phase — and we'll tell you well before any pricing takes effect.",
    ctaNote: "No card, no commitment.",
  },

  footer: {
    tagline: "A real online store for cash-on-delivery selling.",
    navLabel: "Footer",
    rights: "All rights reserved.",
  },
};
