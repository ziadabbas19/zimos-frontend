import type { Locale } from "@/lib/i18n";
import { useStore } from "@/lib/StoreContext";

/**
 * The shopper's words for what pays an order beside its payment method:
 * loyalty points and store credit, each with cash on delivery only. The gift
 * card's own lines stay in the dictionary (`t.giftCards`); these are kept
 * beside the components that say them. Arabic is Egyptian, as the rest of the
 * store.
 */

const AR_DIGITS = new Intl.NumberFormat("ar-EG");
const EN_DIGITS = new Intl.NumberFormat("en-US");
const FR_DIGITS = new Intl.NumberFormat("fr-FR");

/** «نقطة واحدة / نقطتين / ٥ نقط / ١١ نقطة». */
function pointsAr(n: number): string {
  if (n === 1) return "نقطة واحدة";
  if (n === 2) return "نقطتين";
  const mod = n % 100;
  return `${AR_DIGITS.format(n)} ${mod >= 3 && mod <= 10 ? "نقط" : "نقطة"}`;
}
const pointsEn = (n: number) => (n === 1 ? "1 point" : `${EN_DIGITS.format(n)} points`);
const pointsFr = (n: number) => (n === 1 || n === 0 ? `${n} point` : `${FR_DIGITS.format(n)} points`);

const en = {
  points: pointsEn,
  // product page
  earn: (n: number) => `Earn ${pointsEn(n)}`,
  earnHint: "with this product, once your order is delivered",
  // checkout
  usePoints: (n: number, worth: string) => `Use your points (${EN_DIGITS.format(n)} = ${worth})`,
  pointsField: "Points to use",
  pointsWorth: (n: number, worth: string) => `${pointsEn(n)} = ${worth}`,
  pointsMin: (n: number) => `Use at least ${pointsEn(n)}.`,
  pointsMax: (n: number) => `You have ${pointsEn(n)}.`,
  pointsInvalid: "Enter a whole number of points.",
  pointsShare: (percent: number) => `Points can pay up to ${percent}% of an order.`,
  pointsCap: (n: number) => `One order takes up to ${pointsEn(n)}.`,
  pointsTaken: "The order takes only the points it can; the rest stay in your balance.",
  pointsTooFew: (have: number, need: number) => `You have ${pointsEn(have)}. You can use them once you reach ${pointsEn(need)}.`,
  signInForPoints: "Sign in to use your points",
  useCredit: (amount: string) => `Use your store credit (${amount})`,
  creditLine: "Store credit",
  pointsLine: "Points",
  codOnly: "Points and store credit work with cash on delivery only. Choose cash on delivery to use them.",
  payOnDelivery: "Pay on delivery",
  nothingLeft: "Nothing left to pay: this covers your whole order.",
  // checkout refusals
  refusedSignedOut: "You were signed out. Sign in again to use your points or store credit.",
  refusedLoyaltyOff: "This store no longer takes points.",
  refusedTooFew: (n: number) => `You need at least ${pointsEn(n)} to use them.`,
  refusedNotEnough: "You have fewer points than that. We updated your balance.",
  refusedUnavailable: "Points can't be used on this order.",
  refusedDeviceLimit: "Another account's points were used on this device today. Try again tomorrow.",
  refusedCreditEmpty: "You have no store credit left.",
  refusedCreditOff: "This store isn't taking store credit right now.",
  pointsRemoved: "We took your points off this order: check the total and place it again.",
  creditRemoved: "We took your store credit off this order: check the total and place it again.",
  // account
  myPoints: "My points",
  myCredit: "My credit",
  worth: (amount: string) => `Worth ${amount}`,
  expiresOn: (date: string) => `Expires on ${date} if you don't earn or use points before then`,
  programLine: (unit: string, n: number) => `You earn ${pointsEn(n)} for every ${unit} you pay for products.`,
  redeemLine: (n: number, worth: string) => `${pointsEn(n)} take ${worth} off an order at checkout.`,
  programOff: "This store isn't giving points right now. The points you have stay in your account.",
  pointsFrozen: "Your points are paused for now: they stay in your account, and you can use them once the store takes points again.",
  history: "History",
  pointsEmpty: "No points yet",
  pointsEmptyHint: "You earn points on every order once it is delivered.",
  creditEmpty: "No store credit yet",
  creditEmptyHint: "When the store gives you credit, or refunds an order as credit, it shows up here.",
  creditUse: "Tick “Use your store credit” at checkout to pay with it.",
  creditOff: "The store isn't taking store credit at checkout right now. Your balance stays as it is.",
  shop: "Start shopping",
  order: "Order",
  after: (text: string) => `Balance: ${text}`,
  kindEarn: "Earned on an order",
  kindRedeem: "Used on an order",
  kindHold: "Held for an order awaiting payment",
  kindRelease: "Given back",
  kindRefund: "Back from a refund",
  kindReverse: "Taken back (order returned or cancelled)",
  kindExpire: "Expired",
  kindAdjustUp: "Added by the store",
  kindAdjustDown: "Taken off by the store",
  kindGrant: "Added by the store",
  kindRefundCredit: "Order refunded as store credit",
  kindReferral: "Reward for inviting a friend",
};

export type TenderCopy = typeof en;

const ar: TenderCopy = {
  points: pointsAr,
  earn: (n) => `هتكسب ${pointsAr(n)}`,
  earnHint: "من المنتج ده، أول ما طلبك يتسلّم",
  usePoints: (n, worth) => `استخدم نقطك (عندك ${AR_DIGITS.format(n)} = ${worth})`,
  pointsField: "عدد النقط اللي هتستخدمها",
  pointsWorth: (n, worth) => `${pointsAr(n)} = ${worth}`,
  pointsMin: (n) => `أقل عدد تقدر تستخدمه ${pointsAr(n)}.`,
  pointsMax: (n) => `إنت معاك ${pointsAr(n)}.`,
  pointsInvalid: "اكتب عدد نقط صحيح.",
  pointsShare: (percent) => `النقط بتدفع لحد ${AR_DIGITS.format(percent)}٪ من الطلب.`,
  pointsCap: (n) => `الطلب الواحد بياخد لحد ${pointsAr(n)}.`,
  pointsTaken: "الطلب بياخد من نقطك على قد ما ينفع، والباقي يفضل في رصيدك.",
  pointsTooFew: (have, need) => `إنت معاك ${pointsAr(have)}. تقدر تستخدمها لما توصل ${pointsAr(need)}.`,
  signInForPoints: "سجّل دخول عشان تستخدم نقطك",
  useCredit: (amount) => `استخدم رصيدك (${amount})`,
  creditLine: "رصيد المتجر",
  pointsLine: "النقط",
  codOnly: "النقط ورصيد المتجر بيتستخدموا مع الدفع عند الاستلام بس. اختار الدفع عند الاستلام عشان تستخدمهم.",
  payOnDelivery: "تدفع عند الاستلام",
  nothingLeft: "مفيش حاجة هتدفعها: ده مغطي الطلب كله.",
  refusedSignedOut: "اتسجّل خروجك. سجّل دخول تاني عشان تستخدم نقطك أو رصيدك.",
  refusedLoyaltyOff: "المتجر ده مبقاش بيقبل النقط.",
  refusedTooFew: (n) => `محتاج ${pointsAr(n)} على الأقل عشان تستخدم نقطك.`,
  refusedNotEnough: "نقطك أقل من كده. حدّثنا رصيدك.",
  refusedUnavailable: "مش هينفع تستخدم نقطك في الطلب ده.",
  refusedDeviceLimit: "اتستخدمت نقط حساب تاني من الجهاز ده النهارده. جرّب تاني بكرة.",
  refusedCreditEmpty: "مفيش رصيد فاضل عندك.",
  refusedCreditOff: "المتجر مش بيقبل رصيد المتجر دلوقتي.",
  pointsRemoved: "شيلنا النقط من الطلب ده: راجع الإجمالي وأكّد الطلب تاني.",
  creditRemoved: "شيلنا الرصيد من الطلب ده: راجع الإجمالي وأكّد الطلب تاني.",
  myPoints: "نقطي",
  myCredit: "رصيدي",
  worth: (amount) => `قيمتها ${amount}`,
  expiresOn: (date) => `بتنتهي يوم ${date} لو مكسبتش أو استخدمتش نقط قبلها`,
  programLine: (unit, n) => `بتكسب ${pointsAr(n)} على كل ${unit} بتدفعه في المنتجات.`,
  redeemLine: (n, worth) => `${pointsAr(n)} بتخصم ${worth} من طلبك في صفحة الدفع.`,
  programOff: "المتجر مش بيدّي نقط دلوقتي. النقط اللي معاك فاضلة في حسابك.",
  pointsFrozen: "نقطك متوقفة مؤقتًا: فاضلة في حسابك، وتقدر تستخدمها أول ما المتجر يرجع يقبل النقط.",
  history: "الحركة",
  pointsEmpty: "لسه مفيش نقط",
  pointsEmptyHint: "بتكسب نقط على كل طلب أول ما يتسلّم.",
  creditEmpty: "لسه مفيش رصيد",
  creditEmptyHint: "لما المتجر يضيف لك رصيد، أو يرجّع لك طلب كرصيد، هيظهر هنا.",
  creditUse: "علّم على «استخدم رصيدك» في صفحة الدفع عشان تدفع بيه.",
  creditOff: "المتجر مش بيقبل الرصيد في الدفع دلوقتي. رصيدك فاضل زي ما هو.",
  shop: "ابدأ التسوق",
  order: "الطلب",
  after: (text) => `الرصيد: ${text}`,
  kindEarn: "كسبتها من طلب",
  kindRedeem: "استخدمتها في طلب",
  kindHold: "محجوزة لطلب مستني الدفع",
  kindRelease: "رجعت لك",
  kindRefund: "رجعت من استرداد",
  kindReverse: "اتسحبت (الطلب اترجّع أو اتلغى)",
  kindExpire: "انتهت",
  kindAdjustUp: "إضافة من المتجر",
  kindAdjustDown: "خصم من المتجر",
  kindGrant: "إضافة من المتجر",
  kindRefundCredit: "طلب اترجّع كرصيد",
  kindReferral: "مكافأة دعوة صاحبك",
};

const fr: TenderCopy = {
  points: pointsFr,
  earn: (n) => `Gagnez ${pointsFr(n)}`,
  earnHint: "avec ce produit, une fois votre commande livrée",
  usePoints: (n, worth) => `Utiliser vos points (${FR_DIGITS.format(n)} = ${worth})`,
  pointsField: "Points à utiliser",
  pointsWorth: (n, worth) => `${pointsFr(n)} = ${worth}`,
  pointsMin: (n) => `Utilisez au moins ${pointsFr(n)}.`,
  pointsMax: (n) => `Vous avez ${pointsFr(n)}.`,
  pointsInvalid: "Saisissez un nombre entier de points.",
  pointsShare: (percent) => `Les points peuvent payer jusqu'à ${percent} % d'une commande.`,
  pointsCap: (n) => `Une commande prend jusqu'à ${pointsFr(n)}.`,
  pointsTaken: "La commande ne prend que les points possibles ; le reste demeure sur votre solde.",
  pointsTooFew: (have, need) => `Vous avez ${pointsFr(have)}. Vous pourrez les utiliser à partir de ${pointsFr(need)}.`,
  signInForPoints: "Connectez-vous pour utiliser vos points",
  useCredit: (amount) => `Utiliser votre avoir (${amount})`,
  creditLine: "Avoir",
  pointsLine: "Points",
  codOnly: "Les points et l'avoir s'utilisent uniquement avec le paiement à la livraison. Choisissez le paiement à la livraison pour les utiliser.",
  payOnDelivery: "À payer à la livraison",
  nothingLeft: "Rien à payer : votre commande est entièrement couverte.",
  refusedSignedOut: "Vous avez été déconnecté. Reconnectez-vous pour utiliser vos points ou votre avoir.",
  refusedLoyaltyOff: "Cette boutique n'accepte plus les points.",
  refusedTooFew: (n) => `Il faut au moins ${pointsFr(n)} pour les utiliser.`,
  refusedNotEnough: "Vous avez moins de points que cela. Nous avons mis votre solde à jour.",
  refusedUnavailable: "Les points ne peuvent pas être utilisés sur cette commande.",
  refusedDeviceLimit: "Les points d'un autre compte ont été utilisés sur cet appareil aujourd'hui. Réessayez demain.",
  refusedCreditEmpty: "Il ne vous reste plus d'avoir.",
  refusedCreditOff: "Cette boutique n'accepte pas l'avoir pour le moment.",
  pointsRemoved: "Nous avons retiré vos points de cette commande : vérifiez le total et validez à nouveau.",
  creditRemoved: "Nous avons retiré votre avoir de cette commande : vérifiez le total et validez à nouveau.",
  myPoints: "Mes points",
  myCredit: "Mon avoir",
  worth: (amount) => `Valeur : ${amount}`,
  expiresOn: (date) => `Expire le ${date} si vous ne gagnez ni n'utilisez de points d'ici là`,
  programLine: (unit, n) => `Vous gagnez ${pointsFr(n)} pour chaque ${unit} dépensé en produits.`,
  redeemLine: (n, worth) => `${pointsFr(n)} retirent ${worth} d'une commande au paiement.`,
  programOff: "Cette boutique ne donne pas de points pour le moment. Vos points restent sur votre compte.",
  pointsFrozen: "Vos points sont en pause : ils restent sur votre compte et vous pourrez les utiliser dès que la boutique acceptera de nouveau les points.",
  history: "Historique",
  pointsEmpty: "Pas encore de points",
  pointsEmptyHint: "Vous gagnez des points sur chaque commande une fois livrée.",
  creditEmpty: "Pas encore d'avoir",
  creditEmptyHint: "Quand la boutique vous accorde un avoir, ou rembourse une commande en avoir, il apparaît ici.",
  creditUse: "Cochez « Utiliser votre avoir » au paiement pour régler avec.",
  creditOff: "La boutique n'accepte pas l'avoir au paiement pour le moment. Votre solde reste inchangé.",
  shop: "Commencer mes achats",
  order: "Commande",
  after: (text) => `Solde : ${text}`,
  kindEarn: "Gagnés sur une commande",
  kindRedeem: "Utilisés sur une commande",
  kindHold: "Réservés pour une commande en attente de paiement",
  kindRelease: "Rendus",
  kindRefund: "Rendus après un remboursement",
  kindReverse: "Repris (commande retournée ou annulée)",
  kindExpire: "Expirés",
  kindAdjustUp: "Ajoutés par la boutique",
  kindAdjustDown: "Retirés par la boutique",
  kindGrant: "Ajouté par la boutique",
  kindRefundCredit: "Commande remboursée en avoir",
  kindReferral: "Récompense pour l'invitation d'un ami",
};

const COPY: Record<Locale, TenderCopy> = { en, ar, fr };

export function tenderCopy(locale: Locale): TenderCopy {
  return COPY[locale] ?? en;
}

/** The copy in the page's language. */
export function useTenderCopy(): TenderCopy {
  return tenderCopy(useStore().locale);
}
