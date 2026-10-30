import { pickText, type Locale } from "@/lib/i18n";

/**
 * The shopper's words for combos (products sold together at one price): the
 * product page's cards, the cart's combo lines and the thank-you page. Kept
 * beside the components instead of in lib/i18n.ts, which every lane edits.
 */
const TEXT = {
  en: {
    title: "Buy it as a combo",
    badge: "Combo",
    contents: "In this combo",
    choose: (names: string[]) => (names.length > 0 ? `Choose ${names.join(" and ")}` : "Choose an option"),
    chooseFor: (product: string) => `Option for ${product}`,
    missingProduct: "A product that's no longer available",
    soldOut: "Sold out",
    separately: "Bought separately:",
    save: (amount: string) => `You save ${amount}`,
    add: "Add the combo to cart",
    adding: "Adding…",
    added: "Added to cart",
    addFailed: "Couldn't add the combo to your cart. Please try again.",
    pickFirst: "Choose an option for each product first.",
    gone: "This combo is no longer available.",
    lineUnavailable: "This combo is no longer available. Remove it from your cart.",
    checkoutBlocked: "A combo in your cart is no longer available. Remove it to place your order.",
    partOf: (name: string) => `Part of the combo: ${name}`,
  },
  ar: {
    title: "اشتري الطقم ووفّر",
    badge: "طقم",
    contents: "اللي في الطقم",
    choose: (names: string[]) => (names.length > 0 ? `اختار ${names.join(" و")}` : "اختار"),
    chooseFor: (product: string) => `اختيارك من ${product}`,
    missingProduct: "منتج مبقاش متاح",
    soldOut: "خلصان",
    separately: "لو اشتريتهم لوحدهم:",
    save: (amount: string) => `هتوفّر ${amount}`,
    add: "ضيف الطقم للسلة",
    adding: "بنضيفه…",
    added: "اتضاف للسلة",
    addFailed: "معرفناش نضيف الطقم للسلة. جرّب تاني.",
    pickFirst: "اختار لكل منتج الأول.",
    gone: "الطقم ده مبقاش متاح.",
    lineUnavailable: "الطقم ده مبقاش متاح، شيله من السلة",
    checkoutBlocked: "فيه طقم في السلة مبقاش متاح. شيله عشان تكمّل الطلب.",
    partOf: (name: string) => `من طقم: ${name}`,
  },
  fr: {
    title: "Achetez-le en pack",
    badge: "Pack",
    contents: "Dans ce pack",
    choose: (names: string[]) => (names.length > 0 ? `Choisissez ${names.join(" et ")}` : "Choisissez une option"),
    chooseFor: (product: string) => `Option pour ${product}`,
    missingProduct: "Un produit qui n'est plus disponible",
    soldOut: "Épuisé",
    separately: "Achetés séparément :",
    save: (amount: string) => `Vous économisez ${amount}`,
    add: "Ajouter le pack au panier",
    adding: "Ajout…",
    added: "Ajouté au panier",
    addFailed: "Impossible d'ajouter le pack au panier. Veuillez réessayer.",
    pickFirst: "Choisissez d'abord une option pour chaque produit.",
    gone: "Ce pack n'est plus disponible.",
    lineUnavailable: "Ce pack n'est plus disponible. Retirez-le de votre panier.",
    checkoutBlocked: "Un pack de votre panier n'est plus disponible. Retirez-le pour passer la commande.",
    partOf: (name: string) => `Fait partie du pack : ${name}`,
  },
};

export type ComboText = (typeof TEXT)["en"];

export function comboText(locale: Locale): ComboText {
  return pickText(TEXT, locale);
}
