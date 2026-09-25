"use client";

import type { StorefrontPaymentMethod } from "@store-builder/api-client";
import { CardIcon, CashIcon, WalletIcon } from "@/components/Icons";
import { useStore } from "@/lib/StoreContext";

/**
 * The checkout's payment section. With cash on delivery as the only method
 * (every store until it connects a gateway) it is the same static block the
 * checkout always showed; with more, a radio list in the merchant's order.
 */
export function PaymentMethodPicker({
  methods,
  value,
  onChange,
  idPrefix,
}: {
  methods: StorefrontPaymentMethod[];
  value: string;
  onChange: (id: string) => void;
  idPrefix: string;
}) {
  const { t } = useStore();

  const copy = (m: StorefrontPaymentMethod) =>
    m.method === "card"
      ? { title: t.payment.card, hint: t.payment.cardHint, Icon: CardIcon }
      : m.method === "wallet"
        ? { title: t.payment.wallet, hint: t.payment.walletHint, Icon: WalletIcon }
        : { title: t.checkout.cod, hint: t.checkout.codHint, Icon: CashIcon };

  if (methods.length === 1 && methods[0].method === "cod") {
    const { title, hint, Icon } = copy(methods[0]);
    return (
      <div className="mt-4 flex min-h-14 items-center gap-3 rounded-xl border-2 border-primary bg-primary-soft px-4 py-3">
        <Icon className="shrink-0 text-primary" />
        <p>
          <span className="block text-sm font-semibold text-ink">{title}</span>
          <span className="block text-xs text-ink-soft">{hint}</span>
        </p>
      </div>
    );
  }

  return (
    <div role="radiogroup" aria-label={t.checkout.payment} className="mt-4 space-y-2">
      {methods.map((m) => {
        const { title, hint, Icon } = copy(m);
        const checked = value === m.id;
        return (
          <label
            key={m.id}
            htmlFor={`${idPrefix}-pay-${m.id}`}
            className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary ${
              checked ? "border-primary bg-primary-soft" : "border-line bg-paper-raised hover:border-primary/50"
            }`}
          >
            <input
              id={`${idPrefix}-pay-${m.id}`}
              type="radio"
              name={`${idPrefix}-payment`}
              value={m.id}
              checked={checked}
              onChange={() => onChange(m.id)}
              className="size-4 shrink-0 accent-primary"
            />
            <Icon className="shrink-0 text-primary" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-semibold text-ink">
                {title}
                {m.mode === "test" && (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-dark">
                    {t.payment.testTag}
                  </span>
                )}
              </span>
              <span className="block text-xs text-ink-soft">{hint}</span>
            </span>
          </label>
        );
      })}
    </div>
  );
}
