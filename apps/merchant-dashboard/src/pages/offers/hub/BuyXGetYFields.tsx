import { useState } from "react";
import { Input } from "@store-builder/ui";
import type { Discount } from "@store-builder/api-client";
import { Field } from "@/components/Field";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { DISCOUNT_STRINGS, discountValueLabel } from "./discountModel";

/*
 * A buy-X-get-Y discount: «اشترِ 2 واحصل على 1 مجانًا».
 * The form's three fields for the type — units to buy, units given, and how
 * much comes off each given unit as a percentage (100% = free; sent as
 * `getDiscountBasisPoints` = percent × 100) — and the list's one-line
 * description of such a discount. The value field is not used for this type.
 */

const STRINGS = {
  en: {
    buy: "Units to buy",
    get: "Units given",
    off: "Discount on those units",
    offHint: "100% = Free",
    hint: "The cheapest units in the cart are the ones discounted",
    unitsInvalid: "Enter a whole number from 1 to 1000.",
    offInvalid: "Enter a percentage from 0.01 to 100.",
    free: "Buy {buy}, get {get} free",
    atOff: "Buy {buy}, get {get} at {percent}% off",
  },
  ar: {
    buy: "عدد القطع التي يشتريها",
    get: "عدد القطع التي يحصل عليها",
    off: "الخصم على هذه القطع",
    offHint: "100% = مجانًا",
    hint: "الخصم يقع على أرخص القطع في السلة",
    unitsInvalid: "أدخل رقمًا صحيحًا من 1 إلى 1000.",
    offInvalid: "أدخل نسبة من 0.01 إلى 100.",
    free: "اشترِ {buy} واحصل على {get} مجانًا",
    atOff: "اشترِ {buy} واحصل على {get} بخصم {percent}%",
  },
} satisfies Messages;

export interface BuyXGetYConfig {
  buyQuantity: number;
  getQuantity: number;
  /** 1–10000; 10000 = free. */
  getDiscountBasisPoints: number;
}

/** The saved config of a discount, when it holds a valid one. */
export function buyXGetYConfigOf(discount: Pick<Discount, "buyXGetYConfig"> | undefined | null): BuyXGetYConfig | null {
  const raw = discount?.buyXGetYConfig as Partial<BuyXGetYConfig> | null | undefined;
  if (!raw || typeof raw.buyQuantity !== "number" || typeof raw.getQuantity !== "number") return null;
  const points = typeof raw.getDiscountBasisPoints === "number" ? raw.getDiscountBasisPoints : 10000;
  return { buyQuantity: raw.buyQuantity, getQuantity: raw.getQuantity, getDiscountBasisPoints: points };
}

const ascii = (text: string) => text.trim().replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
const percentText = (points: number) => String(Math.round(points) / 100);

export interface BuyXGetYState {
  buy: string;
  get: string;
  percent: string;
  errors: { buy?: boolean; get?: boolean; percent?: boolean };
  set: (field: "buy" | "get" | "percent", value: string) => void;
  /** The config to send, or null when a field is not valid (it is then marked). */
  read: () => BuyXGetYConfig | null;
}

export function useBuyXGetY(discount: Discount | undefined): BuyXGetYState {
  const saved = buyXGetYConfigOf(discount);
  const [buy, setBuy] = useState(saved ? String(saved.buyQuantity) : "2");
  const [get, setGet] = useState(saved ? String(saved.getQuantity) : "1");
  const [percent, setPercent] = useState(saved ? percentText(saved.getDiscountBasisPoints) : "100");
  const [errors, setErrors] = useState<BuyXGetYState["errors"]>({});

  function set(field: "buy" | "get" | "percent", value: string) {
    (field === "buy" ? setBuy : field === "get" ? setGet : setPercent)(value);
    setErrors((prev) => (prev[field] ? { ...prev, [field]: false } : prev));
  }

  function read(): BuyXGetYConfig | null {
    const units = (text: string) => (/^\d{1,4}$/.test(ascii(text)) ? Number(ascii(text)) : Number.NaN);
    const buyQuantity = units(buy);
    const getQuantity = units(get);
    const points = /^\d{1,3}(\.\d{1,2})?$/.test(ascii(percent)) ? Math.round(Number(ascii(percent)) * 100) : Number.NaN;
    const bad = {
      buy: !(buyQuantity >= 1 && buyQuantity <= 1000),
      get: !(getQuantity >= 1 && getQuantity <= 1000),
      percent: !(points >= 1 && points <= 10000),
    };
    setErrors(bad);
    if (bad.buy || bad.get || bad.percent) return null;
    return { buyQuantity, getQuantity, getDiscountBasisPoints: points };
  }

  return { buy, get, percent, errors, set, read };
}

/** The three fields, with the server's own 422 on `buyXGetYConfig` said under them. */
export function BuyXGetYFields({ state, error, disabled }: { state: BuyXGetYState; error?: string; disabled?: boolean }) {
  const t = useT(STRINGS);
  return (
    <div className="space-y-3 sm:col-span-2">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={t.buy} required error={state.errors.buy ? t.unitsInvalid : undefined}>
          {({ id, ...aria }) => (
            <Input id={id} {...aria} type="text" inputMode="numeric" dir="ltr" maxLength={4} disabled={disabled} value={state.buy} onChange={(e) => state.set("buy", e.target.value)} className="h-11 tabular-nums" />
          )}
        </Field>
        <Field label={t.get} required error={state.errors.get ? t.unitsInvalid : undefined}>
          {({ id, ...aria }) => (
            <Input id={id} {...aria} type="text" inputMode="numeric" dir="ltr" maxLength={4} disabled={disabled} value={state.get} onChange={(e) => state.set("get", e.target.value)} className="h-11 tabular-nums" />
          )}
        </Field>
        <Field label={t.off} required error={state.errors.percent ? t.offInvalid : undefined} hint={t.offHint}>
          {({ id, ...aria }) => (
            <div className="relative">
              <Input id={id} {...aria} type="text" inputMode="decimal" dir="ltr" maxLength={6} disabled={disabled} value={state.percent} onChange={(e) => state.set("percent", e.target.value)} className="h-11 pe-8 tabular-nums" />
              <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">%</span>
            </div>
          )}
        </Field>
      </div>
      {error ? (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : (
        <p className="text-xs text-ink-soft">{t.hint}</p>
      )}
    </div>
  );
}

/** A discount's value for the list: «اشترِ 2 واحصل على 1 مجانًا» for a buy-X-get-Y one, the usual label for any other. */
export function DiscountValueLabel({ discount }: { discount: Discount }) {
  const t = useT(STRINGS);
  const base = useT(DISCOUNT_STRINGS);
  const config = discount.type === "buy_x_get_y" ? buyXGetYConfigOf(discount) : null;
  if (!config) return <>{discountValueLabel(discount, base)}</>;
  const values = { buy: config.buyQuantity, get: config.getQuantity, percent: percentText(config.getDiscountBasisPoints) };
  return <>{config.getDiscountBasisPoints >= 10000 ? fmt(t.free, values) : fmt(t.atOff, values)}</>;
}
