import {
  IconBellRinging,
  IconCourier,
  IconDoor,
  IconEmail,
  IconLayers,
  IconLink,
  IconProductAdd,
  IconRss,
  IconShuffle,
  IconSparkle,
  IconTicket,
} from "@/components/icons";
import { offersSummaryGet } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useCachedAsync } from "@/lib/useCachedAsync";
import { formatMoney } from "@/lib/format";
import { pluralOf } from "@/lib/plural";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { OffersHub } from "./hub/OffersHub";
import { OfferTools, type OfferToolGroup } from "./hub/OfferTools";

// Other screens keep importing the card from here.
export { OfferToolCard, type OfferTool } from "./hub/OfferToolCard";

/**
 * The offers tab of «العروض والخصومات»: every tool that raises
 * the value of an order or brings a customer, grouped by what it is for. Each
 * card opens the tool's own screen; its numbers for the last 30 days and how
 * many of its rules are running come from one summary call, and the cards work
 * without them while it loads or if it fails.
 */

const STRINGS = {
  en: {
    groupValue: "Raise the order's value",
    groupUrgency: "Give a reason to buy now",
    groupRules: "Rules and prices",
    groupReach: "Bring customers",
    bundles: "Bundles",
    bundlesHint: "Buy more, pay less per piece — one bundle for many products.",
    bumps: "Order bumps",
    bumpsHint: "A tick box on the order form: add this to your order.",
    crossSell: "Cross-sell",
    crossSellHint: "Suggest products that go with what is in the cart.",
    upsells: "Post-purchase upsell",
    upsellsHint: "One more offer on the thank-you page, added with one tap.",
    exit: "Exit popup",
    exitHint: "A last offer with a coupon for a visitor who is leaving.",
    rules: "Minimum order and free shipping",
    rulesHint: "A floor under small orders, and a bar that shows what is left for free shipping.",
    social: "Sales notifications",
    socialHint: "“Ahmed from Mansoura bought this” — from real orders only.",
    newsletter: "Newsletter sign-up",
    newsletterHint: "Collect mobile numbers from visitors who want to hear from you.",
    referrals: "Referral links",
    referralsHint: "A link per marketer, and the orders each one brought.",
    feed: "Product feed",
    feedHint: "A catalog link for Meta, Google, TikTok and Snapchat, and the Google Merchant checklist.",
    discounts: "Discount codes",
    discountsHint: "Coupons and automatic discounts.",
    period: "Numbers are for the last {days} days.",
    statBundles: "{orders} orders · customers saved {amount}",
    statBumps: "{count} sold · {amount}",
    statUpsells: "{count} accepted · {amount}",
    statDiscounts: "{count} uses · {amount} off",
    statSubscribers: "{count} new subscribers",
    running_one: "1 running",
    running_other: "{n} running",
  },
  ar: {
    groupValue: "زيادة قيمة الطلب",
    groupUrgency: "تحفيز الشراء",
    groupRules: "قواعد وأسعار",
    groupReach: "جذب العملاء",
    bundles: "الباقات",
    bundlesHint: "اشترِ أكثر وادفع أقل للقطعة — باقة واحدة لمنتجات كثيرة.",
    bumps: "إضافات الطلب",
    bumpsHint: "مربع اختيار في نموذج الطلب: أضف هذا إلى طلبك.",
    crossSell: "منتجات مقترحة",
    crossSellHint: "اقترح منتجات تناسب ما في السلة.",
    upsells: "عرض بعد الشراء",
    upsellsHint: "عرض إضافي في صفحة الشكر، يُضاف بضغطة واحدة.",
    exit: "نافذة الخروج",
    exitHint: "عرض أخير بكوبون لزائر يغادر.",
    rules: "الحد الأدنى للطلب والشحن المجاني",
    rulesHint: "حد أدنى للطلبات الصغيرة، وشريط يوضح المتبقي للشحن المجاني.",
    social: "إشعارات المبيعات",
    socialHint: "«أحمد من المنصورة اشترى هذا» — من طلبات حقيقية فقط.",
    newsletter: "الاشتراك في النشرة",
    newsletterHint: "اجمع أرقام الزوار الذين يريدون متابعتك.",
    referrals: "روابط الإحالة",
    referralsHint: "رابط لكل مسوّق، والطلبات التي جاءت منه.",
    feed: "ملف المنتجات",
    feedHint: "رابط كتالوج لـ Meta وGoogle وTikTok وSnapchat، وقائمة فحص Google Merchant.",
    discounts: "أكواد الخصم",
    discountsHint: "الكوبونات والخصومات التلقائية.",
    period: "الأرقام لآخر {days} يوم.",
    statBundles: "{orders} طلب · وفّر العملاء {amount}",
    statBumps: "{count} مباعة · {amount}",
    statUpsells: "{count} مقبولة · {amount}",
    statDiscounts: "{count} استخدام · خصم {amount}",
    statSubscribers: "{count} مشترك جديد",
    running_one: "واحد مفعّل",
    running_two: "اثنان مفعّلان",
    running_few: "{n} مفعّلة",
    running_other: "{n} مفعّلًا",
  },
} satisfies Messages;

export function OffersPage() {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  // Each tool's numbers; the cards work without them while they load or if they fail.
  // Kept for the session, so coming back to the hub shows them at once.
  const s = useCachedAsync(`offers-summary:${workspaceId}`, () => offersSummaryGet(apiClient, workspaceId, 30), [workspaceId]).data;

  // «٣ شغّالين»: only when the summary knows, and only above zero.
  const running = (count: number | undefined) => (count !== undefined && count > 0 ? pluralOf(t, "running", count) : undefined);

  const groups: OfferToolGroup[] = [
    {
      id: "value",
      title: t.groupValue,
      tools: [
        {
          to: "/offers/bundles",
          icon: <IconLayers />,
          title: t.bundles,
          hint: t.bundlesHint,
          state: running(s?.bundles.active),
          stat: s && s.bundles.orders > 0 ? fmt(t.statBundles, { orders: s.bundles.orders, amount: formatMoney(s.bundles.savedAmount) }) : undefined,
        },
        {
          to: "/offers/order-bumps",
          icon: <IconProductAdd />,
          title: t.bumps,
          hint: t.bumpsHint,
          state: running(s?.bumps.active),
          stat: s && s.bumps.sold > 0 ? fmt(t.statBumps, { count: s.bumps.sold, amount: formatMoney(s.bumps.revenue) }) : undefined,
        },
        {
          to: "/offers/upsells",
          icon: <IconSparkle />,
          title: t.upsells,
          hint: t.upsellsHint,
          state: running(s?.upsells.active),
          stat: s && s.upsells.accepted > 0 ? fmt(t.statUpsells, { count: s.upsells.accepted, amount: formatMoney(s.upsells.revenue) }) : undefined,
        },
        { to: "/offers/cross-sell", icon: <IconShuffle />, title: t.crossSell, hint: t.crossSellHint, state: running(s?.crossSell.active) },
      ],
    },
    {
      id: "urgency",
      title: t.groupUrgency,
      tools: [
        { to: "/offers/exit-popup", icon: <IconDoor />, title: t.exit, hint: t.exitHint },
        { to: "/offers/social-proof", icon: <IconBellRinging />, title: t.social, hint: t.socialHint },
      ],
    },
    {
      id: "rules",
      title: t.groupRules,
      tools: [
        { to: "/offers/order-rules", icon: <IconCourier />, title: t.rules, hint: t.rulesHint },
        {
          to: "/discounts",
          icon: <IconTicket />,
          title: t.discounts,
          hint: t.discountsHint,
          state: running(s?.discounts.active),
          stat:
            s && s.discounts.redemptions > 0
              ? fmt(t.statDiscounts, { count: s.discounts.redemptions, amount: formatMoney(s.discounts.amount) })
              : undefined,
        },
      ],
    },
    {
      id: "reach",
      title: t.groupReach,
      tools: [
        {
          to: "/offers/newsletter",
          icon: <IconEmail />,
          title: t.newsletter,
          hint: t.newsletterHint,
          stat: s && s.newsletter.subscribers > 0 ? fmt(t.statSubscribers, { count: s.newsletter.subscribers }) : undefined,
        },
        { to: "/offers/referrals", icon: <IconLink />, title: t.referrals, hint: t.referralsHint },
        { to: "/offers/feed", icon: <IconRss />, title: t.feed, hint: t.feedHint },
      ],
    },
  ];

  // The period is named only when a card shows a number it applies to.
  const hasStats = groups.some((group) => group.tools.some((tool) => tool.stat));

  return (
    <OffersHub tab="offers">
      <OfferTools groups={groups} note={s && hasStats ? fmt(t.period, { days: s.days }) : undefined} />
    </OffersHub>
  );
}
