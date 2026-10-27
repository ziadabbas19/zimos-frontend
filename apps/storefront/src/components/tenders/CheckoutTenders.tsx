"use client";

import { useEffect, useState } from "react";
import {
  loyaltyRefusalOf,
  parseMoney,
  shopperLoyalty,
  shopperStoreCredit,
  storeCreditRefusalOf,
  type LoyaltyCheckoutFields,
  type ShopperLoyalty,
  type ShopperStoreCredit,
  type StoreCreditCheckoutFields,
  type StorefrontPaymentMethod,
} from "@store-builder/api-client";
import { StoreLink } from "@/components/StoreRoute";
import { focusRing, input } from "@/components/ui";
import { LOYALTY_ENABLED, STORE_CREDIT_ENABLED } from "@/lib/features";
import { useLoyaltyProgram } from "@/lib/loyaltyProgram";
import { useShopperApi, useShopperConfig } from "@/lib/shopperSession";
import { useStore } from "@/lib/StoreContext";
import type { GiftCardState } from "@/components/giftCards/GiftCardField";
import { useTenderCopy } from "./tenderCopy";

const POINTS_INPUT_ID = "checkout-loyalty-points";
const POINTS_ERROR_ID = `${POINTS_INPUT_ID}-error`;

/** Whatever digits were typed (an Arabic keyboard types ٠–٩), as a whole number; null when it is not one. */
function parsePoints(raw: string): number | null {
  const ascii = raw
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .trim();
  if (!/^\d{1,9}$/.test(ascii)) return null;
  return Number(ascii);
}

/** Points and store credit pay part of a cash-on-delivery order; they do not go with an online payment or a bank transfer. */
export function takesTenders(method: StorefrontPaymentMethod | undefined): boolean {
  return method?.method === "cod";
}

/**
 * The checkout's loyalty points and store credit, beside the gift card: a
 * signed-in shopper's balances, what they chose to use, the `loyaltyPoints` /
 * `useStoreCredit` the order carries with their token, and what the three
 * leave for the courier to collect. Cash on delivery only. Each of the two is
 * there only while its feature is switched on (lib/features).
 *
 * The amounts shown before the order is placed are estimates on the page's
 * estimated total, taken in the order the API takes them (card, credit,
 * points); the order's own answer says what each really paid.
 */
export function useCheckoutTenders({
  method,
  total,
  currency,
  giftCard,
}: {
  method: StorefrontPaymentMethod | undefined;
  /** The page's estimated total, minor units. */
  total: number;
  currency: string;
  giftCard: GiftCardState;
}) {
  const { money } = useStore();
  const copy = useTenderCopy();
  const config = useShopperConfig();
  const api = useShopperApi();
  const publicProgram = useLoyaltyProgram();
  const accounts = config.status === "ready" && config.config.enabled;
  const token = accounts ? api.token : null;

  // The signed-in shopper's points and credit, once per token (and again after a refused order).
  const [wallet, setWallet] = useState<{ token: string; loyalty: ShopperLoyalty | null; credit: ShopperStoreCredit | null } | null>(null);
  const [nonce, setNonce] = useState(0);
  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    // Either may fail on its own: the checkout goes on without it.
    void Promise.all([
      LOYALTY_ENABLED ? api.call((client, storeId, tk) => shopperLoyalty(client, storeId, tk)).catch(() => null) : null,
      STORE_CREDIT_ENABLED ? api.call((client, storeId, tk) => shopperStoreCredit(client, storeId, tk)).catch(() => null) : null,
    ]).then(([loyalty, credit]) => {
      if (!cancelled) setWallet({ token, loyalty, credit });
    });
    return () => {
      cancelled = true;
    };
  }, [token, api, nonce]);
  const current = wallet && token && wallet.token === token ? wallet : null;

  const [pointsOn, setPointsOn] = useState(false);
  const [pointsDraft, setPointsDraft] = useState("");
  const [pointsError, setPointsError] = useState<string | null>(null);
  const [creditOn, setCreditOn] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const usable = takesTenders(method);

  // Points: the programme the shopper's own answer carries (the public one while that loads), in the cart's currency.
  const program = current?.loyalty ? current.loyalty.program : (publicProgram ?? null);
  const programHere = program && program.currency.toUpperCase() === currency.toUpperCase() ? program : null;
  const pointsBalance = current?.loyalty?.balance ?? 0;
  const pointsWorth = programHere ? pointsBalance * programHere.pointValue : 0;
  const canUsePoints = Boolean(programHere) && pointsBalance > 0 && pointsBalance >= (programHere?.minRedeemPoints ?? 1);

  const credit = current?.credit ?? null;
  const creditBalance = credit ? parseMoney(credit.balance) : 0;
  const canUseCredit = Boolean(credit?.spendingEnabled) && creditBalance > 0 && credit?.currency.toUpperCase() === currency.toUpperCase();

  // What each would take off this order, in the API's order: gift card, store credit, points.
  const cardOff = giftCard.off;
  const creditOff = usable && creditOn && canUseCredit ? Math.min(creditBalance, Math.max(0, total - cardOff)) : 0;
  const asked = parsePoints(pointsDraft);
  const pointsProblem =
    !programHere || !pointsOn
      ? null
      : asked === null || asked < 1
        ? copy.pointsInvalid
        : asked < programHere.minRedeemPoints
          ? copy.pointsMin(programHere.minRedeemPoints)
          : asked > pointsBalance
            ? copy.pointsMax(pointsBalance)
            : null;
  const pointsReady = usable && pointsOn && canUsePoints && programHere !== null && asked !== null && pointsProblem === null;
  const pointsCap = programHere
    ? Math.min(Math.floor((total * programHere.maxRedeemPercent) / 100), Math.max(0, total - cardOff - creditOff))
    : 0;
  // The store's cap per order too (maxRedeemPointsPerOrder), as the API's own planFor takes it.
  const perOrder = programHere?.maxRedeemPointsPerOrder || Infinity;
  const pointsUsed = pointsReady && programHere && asked !== null ? Math.min(asked, Math.floor(pointsCap / programHere.pointValue), perOrder) : 0;
  const pointsOff = programHere ? pointsUsed * programHere.pointValue : 0;
  const anyOff = cardOff > 0 || creditOff > 0 || pointsOff > 0;
  const rest = Math.max(0, total - cardOff - creditOff - pointsOff);

  const payload: LoyaltyCheckoutFields & StoreCreditCheckoutFields = {
    ...(pointsReady && asked !== null ? { loyaltyPoints: asked } : {}),
    ...(usable && creditOn && canUseCredit ? { useStoreCredit: true } : {}),
  };

  function togglePoints(on: boolean) {
    setPointsOn(on);
    setPointsError(null);
    setNote(null);
    // Ticking it offers every point: the order takes only what it can.
    if (on && !pointsDraft.trim()) setPointsDraft(String(pointsBalance));
  }

  /** Before the order is sent: what is wrong with the points typed, said beside the field too. Null when nothing is. */
  function check(): string | null {
    if (!usable || !pointsOn || !canUsePoints) return null;
    setPointsError(pointsProblem);
    if (pointsProblem) document.getElementById(POINTS_INPUT_ID)?.focus();
    return pointsProblem;
  }

  /**
   * A refused order: when the points or the credit were the reason, that one
   * comes off the order with the reason beside it, the balances are read
   * again, and the same words are returned for the form's own error line.
   */
  function onError(err: unknown): string | null {
    const points = loyaltyRefusalOf(err);
    const store = storeCreditRefusalOf(err);
    if (!points && !store) return null;
    let text: string;
    if (points === "signed_out" || store === "signed_out") {
      // The token stopped working: forget it, and the sign-in line shows again.
      api.signOut();
      setPointsOn(false);
      setCreditOn(false);
      text = copy.refusedSignedOut;
    } else if (points === "cod_only" || store === "cod_only") {
      text = copy.codOnly;
    } else if (points) {
      setPointsOn(false);
      const why =
        points === "off"
          ? copy.refusedLoyaltyOff
          : points === "too_few"
            ? copy.refusedTooFew(programHere?.minRedeemPoints ?? 1)
            : points === "unavailable"
              ? copy.refusedUnavailable
              : points === "device_limit"
                ? copy.refusedDeviceLimit
                : copy.refusedNotEnough;
      text = `${why} ${copy.pointsRemoved}`;
    } else {
      setCreditOn(false);
      text = `${store === "off" ? copy.refusedCreditOff : copy.refusedCreditEmpty} ${copy.creditRemoved}`;
    }
    setNote(text);
    setNonce((n) => n + 1);
    return text;
  }

  // The phone bar (CheckoutStickyBar) says what is left to pay once something pays part.
  const stickyBar = anyOff ? { totalLabel: copy.payOnDelivery, total: money(rest, currency) } : {};

  return {
    /** The store offers accounts and the shopper is not signed in: points wait behind the sign-in. */
    signInOffered: accounts && !token && Boolean(publicProgram),
    signedIn: Boolean(token),
    /** The signed-in shopper's token, sent with the order (X-Shopper-Token). */
    shopperToken: token,
    usable,
    currency,
    total,
    program: programHere,
    pointsBalance,
    pointsWorth,
    canUsePoints,
    pointsOn,
    togglePoints,
    pointsDraft,
    setPointsDraft: (value: string) => {
      setPointsDraft(value);
      setPointsError(null);
    },
    pointsError,
    pointsTyped: asked,
    pointsUsed,
    pointsOff,
    creditBalance,
    canUseCredit,
    creditOn,
    toggleCredit: (on: boolean) => {
      setCreditOn(on);
      setNote(null);
    },
    creditOff,
    cardOff,
    anyOff,
    rest,
    note,
    payload,
    check,
    onError,
    stickyBar,
  };
}

export type CheckoutTendersState = ReturnType<typeof useCheckoutTenders>;

/**
 * Under the checkout's gift card: «استخدم رصيدك (150 ج.م)», «استخدم نقطك
 * (عندك 2000 = 200 ج.م)» with the number of points, and what is left to pay
 * once a card, credit or points take their part. Signed out on a store with
 * points: «سجّل دخول عشان تستخدم نقطك».
 */
export function CheckoutTenders({ state }: { state: CheckoutTendersState }) {
  const { money } = useStore();
  const copy = useTenderCopy();
  const { program } = state;
  const amount = (n: number) => money(n, state.currency);

  const pointsLow = Boolean(program) && state.signedIn && state.pointsBalance > 0 && !state.canUsePoints;
  const offers = state.signInOffered || state.canUseCredit || state.canUsePoints || pointsLow;
  if (!offers && !state.anyOff && !state.note) return null;

  const tickClass = "h-5 w-5 shrink-0 cursor-pointer accent-[var(--color-primary)] disabled:cursor-not-allowed";
  const rowClass = "flex min-h-11 cursor-pointer items-center gap-3 text-sm font-medium text-ink has-[:disabled]:cursor-not-allowed has-[:disabled]:text-ink-soft";

  return (
    <div className="mt-3 space-y-2 border-t border-line pt-3">
      {state.signInOffered && (
        <StoreLink
          href="/account?next=/checkout"
          className={`inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline ${focusRing}`}
        >
          {copy.signInForPoints}
        </StoreLink>
      )}

      {state.canUseCredit && (
        <label className={rowClass}>
          <input
            type="checkbox"
            className={tickClass}
            checked={state.creditOn && state.usable}
            disabled={!state.usable}
            onChange={(e) => state.toggleCredit(e.target.checked)}
          />
          <span className="min-w-0">{copy.useCredit(amount(state.creditBalance))}</span>
        </label>
      )}

      {state.canUsePoints && program && (
        <div>
          <label className={rowClass}>
            <input
              type="checkbox"
              className={tickClass}
              checked={state.pointsOn && state.usable}
              disabled={!state.usable}
              onChange={(e) => state.togglePoints(e.target.checked)}
            />
            <span className="min-w-0">{copy.usePoints(state.pointsBalance, amount(state.pointsWorth))}</span>
          </label>
          {state.pointsOn && state.usable && (
            <div className="ms-8 mt-1">
              <label htmlFor={POINTS_INPUT_ID} className="mb-1.5 block text-xs font-medium text-ink-soft">
                {copy.pointsField}
              </label>
              <input
                id={POINTS_INPUT_ID}
                type="text"
                inputMode="numeric"
                autoComplete="off"
                dir="ltr"
                maxLength={9}
                value={state.pointsDraft}
                onChange={(e) => state.setPointsDraft(e.target.value)}
                onKeyDown={(e) => {
                  // Enter must not place the order from this field.
                  if (e.key === "Enter") e.preventDefault();
                }}
                aria-invalid={state.pointsError ? true : undefined}
                aria-describedby={state.pointsError ? POINTS_ERROR_ID : undefined}
                className={`${input} max-w-[10rem] text-center tabular-nums`}
              />
              {state.pointsError ? (
                <p id={POINTS_ERROR_ID} role="alert" className="mt-1 text-xs font-medium text-danger">
                  {state.pointsError}
                </p>
              ) : (
                <p className="mt-1 text-xs text-ink-soft">
                  {state.pointsTyped !== null && state.pointsTyped > 0 && state.pointsTyped <= state.pointsBalance
                    ? `${copy.pointsWorth(state.pointsTyped, amount(state.pointsTyped * program.pointValue))} · `
                    : ""}
                  {program.maxRedeemPercent < 100 ? `${copy.pointsShare(program.maxRedeemPercent)} ` : ""}
                  {program.maxRedeemPointsPerOrder ? `${copy.pointsCap(program.maxRedeemPointsPerOrder)} ` : ""}
                  {copy.pointsTaken}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {pointsLow && program && <p className="text-xs text-ink-soft">{copy.pointsTooFew(state.pointsBalance, program.minRedeemPoints)}</p>}

      {!state.usable && (state.canUseCredit || state.canUsePoints) && (
        <p className="rounded-xl bg-accent-soft px-3 py-2 text-xs font-medium text-accent-dark">{copy.codOnly}</p>
      )}

      <div aria-live="polite" className="empty:hidden">
        {state.note && <p className="rounded-xl bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{state.note}</p>}
      </div>

      {state.anyOff && (
        <dl className="space-y-1 border-t border-line pt-3 text-sm">
          {state.creditOff > 0 && (
            <div className="flex justify-between gap-3 text-success">
              <dt>{copy.creditLine}</dt>
              <dd>−{amount(state.creditOff)}</dd>
            </div>
          )}
          {state.pointsOff > 0 && (
            <div className="flex justify-between gap-3 text-success">
              <dt>
                {copy.pointsLine} ({copy.points(state.pointsUsed)})
              </dt>
              <dd>−{amount(state.pointsOff)}</dd>
            </div>
          )}
          {state.rest === 0 ? (
            <div className="font-bold text-ink">
              <dt className="sr-only">{copy.payOnDelivery}</dt>
              <dd>{copy.nothingLeft}</dd>
            </div>
          ) : (
            <div className="flex justify-between gap-3 font-bold text-ink">
              <dt>{copy.payOnDelivery}</dt>
              <dd>{amount(state.rest)}</dd>
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
