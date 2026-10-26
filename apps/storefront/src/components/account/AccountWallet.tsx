"use client";

import type { ReactNode } from "react";
import {
  parseMoney,
  shopperLoyalty,
  shopperStoreCredit,
  type LoyaltyTransaction,
  type ShopperLoyalty,
  type ShopperStoreCredit,
  type StoreCreditTransaction,
} from "@store-builder/api-client";
import { WalletIcon } from "@/components/Icons";
import { StoreLink } from "@/components/StoreRoute";
import { btnPrimary, card, skeleton } from "@/components/ui";
import { useTenderCopy, type TenderCopy } from "@/components/tenders/tenderCopy";
import { useStore } from "@/lib/StoreContext";
import { Notice, useAccount } from "./AccountShell";
import { useShopperRead } from "./AccountWalletTabs";

/**
 * The account's «نقطي» and «رصيدي» pages: the signed-in
 * shopper's loyalty points and store credit, each with its balance and every
 * change of it. The tabs that lead here are in AccountWalletTabs.tsx.
 */

// ---------------------------------------------------------------- shared --

function WalletSkeleton() {
  return (
    <div className="space-y-3" aria-hidden>
      <div className={`${skeleton} h-32 w-full`} />
      <div className={`${skeleton} h-16 w-full`} />
      <div className={`${skeleton} h-16 w-full`} />
    </div>
  );
}

function LoadFailed({ onRetry }: { onRetry: () => void }) {
  const { t } = useStore();
  return (
    <Notice
      tone="danger"
      title={t.account.loadFailed}
      action={
        <button type="button" onClick={onRetry} className={btnPrimary}>
          {t.account.retry}
        </button>
      }
    />
  );
}

/** One change of a balance: what happened and when, the change, and the balance after it. */
function HistoryRow({
  what,
  orderId,
  createdAt,
  change,
  changeText,
  afterText,
}: {
  what: string;
  orderId: string | null;
  createdAt: string;
  change: number;
  changeText: string;
  afterText: string;
}) {
  const { intlLocale } = useStore();
  const copy = useTenderCopy();
  const date = new Intl.DateTimeFormat(intlLocale, { dateStyle: "medium" }).format(new Date(createdAt));
  return (
    <li className="flex items-start justify-between gap-3 px-4 py-3 text-sm sm:px-5">
      <div className="min-w-0">
        <p className="font-medium text-ink">{what}</p>
        <p className="mt-0.5 text-xs text-ink-soft">
          {date}
          {orderId && (
            <>
              {" · "}
              <StoreLink href={`/account/orders/${orderId}`} className="font-medium text-primary underline-offset-4 hover:underline">
                {copy.order}
              </StoreLink>
            </>
          )}
        </p>
      </div>
      <div className="shrink-0 text-end">
        <p className={`font-semibold tabular-nums ${change > 0 ? "text-success" : "text-ink"}`}>
          <bdi>
            {change > 0 ? "+" : change < 0 ? "−" : ""}
            {changeText}
          </bdi>
        </p>
        <p className="mt-0.5 text-xs text-ink-soft tabular-nums">{copy.after(afterText)}</p>
      </div>
    </li>
  );
}

function History({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6" aria-labelledby="account-wallet-history">
      <h2 id="account-wallet-history" className="text-base font-semibold text-ink">
        {title}
      </h2>
      <ul className={`${card} mt-3 divide-y divide-line`}>{children}</ul>
    </section>
  );
}

function Empty({ title, hint, shop }: { title: string; hint: string; shop: string }) {
  return (
    <div className={`${card} mt-6 flex flex-col items-center px-5 py-10 text-center`}>
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary-soft text-primary">
        <WalletIcon size={24} />
      </span>
      <p className="mt-4 text-base font-semibold text-ink">{title}</p>
      <p className="mt-1 max-w-sm text-sm text-ink-soft">{hint}</p>
      <StoreLink href="/products" className={`${btnPrimary} mt-5`}>
        {shop}
      </StoreLink>
    </div>
  );
}

// ---------------------------------------------------------------- points --

function pointsKind(row: LoyaltyTransaction, copy: TenderCopy): string {
  switch (row.kind) {
    case "earn":
      return copy.kindEarn;
    case "redeem":
      return copy.kindRedeem;
    case "hold":
      return copy.kindHold;
    case "release":
      return copy.kindRelease;
    case "refund":
      return copy.kindRefund;
    case "reverse":
      return copy.kindReverse;
    case "expire":
      return copy.kindExpire;
    // Points for an invited friend's delivered order.
    case "referral":
      return copy.kindReferral;
    default:
      return row.points < 0 ? copy.kindAdjustDown : copy.kindAdjustUp;
  }
}

/** «نقطي»: the balance, what it is worth, when it expires, how points are earned and spent here, and the history. */
export function AccountPoints() {
  const { money, intlLocale } = useStore();
  const copy = useTenderCopy();
  const { api } = useAccount();
  const [state, reload] = useShopperRead<ShopperLoyalty>(api, shopperLoyalty);

  if (state.status === "error") return <LoadFailed onRetry={reload} />;
  if (state.status === "loading") return <WalletSkeleton />;

  const { data } = state;
  const { program } = data;
  const amount = (n: number | string) => money(n, data.currency);
  const expires = data.expiresAt ? new Intl.DateTimeFormat(intlLocale, { dateStyle: "long" }).format(new Date(data.expiresAt)) : null;
  // "100 points for every EGP 100": whole numbers whatever the store's rate (it goes down to 0.01 a unit).
  const per100 = program ? Math.floor(100 * program.earnPointsPerUnit) : 0;

  return (
    <div>
      <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-points-title">
        <h2 id="account-points-title" className="text-sm font-medium text-ink-soft">
          {copy.myPoints}
        </h2>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="font-display text-3xl font-bold text-ink tabular-nums">{copy.points(data.balance)}</span>
          {data.worth !== null && data.balance > 0 && <span className="text-sm font-medium text-success">{copy.worth(amount(data.worth))}</span>}
        </p>
        {expires && <p className="mt-2 text-xs text-ink-soft">{copy.expiresOn(expires)}</p>}
        {program ? (
          <ul className="mt-4 space-y-1 border-t border-line pt-4 text-sm text-ink-soft">
            {per100 > 0 && <li>{copy.programLine(amount(10000), per100)}</li>}
            <li>{copy.redeemLine(100, amount(100 * program.pointValue))}</li>
            {program.minRedeemPoints > 1 && <li>{copy.pointsMin(program.minRedeemPoints)}</li>}
            {program.maxRedeemPercent < 100 && <li>{copy.pointsShare(program.maxRedeemPercent)}</li>}
            {program.maxRedeemPointsPerOrder ? <li>{copy.pointsCap(program.maxRedeemPointsPerOrder)}</li> : null}
          </ul>
        ) : (
          // Frozen (the store's plan or subscription): the balance waits, nothing is lost.
          <p className="mt-4 border-t border-line pt-4 text-sm text-ink-soft">{data.frozen ? copy.pointsFrozen : copy.programOff}</p>
        )}
      </section>

      {data.history.length === 0 ? (
        <Empty title={copy.pointsEmpty} hint={copy.pointsEmptyHint} shop={copy.shop} />
      ) : (
        <History title={copy.history}>
          {data.history.map((row) => (
            <HistoryRow
              key={row.id}
              what={pointsKind(row, copy)}
              orderId={row.orderId}
              createdAt={row.createdAt}
              change={row.points}
              changeText={copy.points(Math.abs(row.points))}
              afterText={copy.points(row.balanceAfter)}
            />
          ))}
        </History>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- credit --

function creditKind(row: StoreCreditTransaction, copy: TenderCopy): string {
  switch (row.kind) {
    case "grant":
      return copy.kindGrant;
    case "adjust":
      return copy.kindAdjustDown;
    case "refund_credit":
      return copy.kindRefundCredit;
    case "redeem":
      return copy.kindRedeem;
    case "hold":
      return copy.kindHold;
    case "release":
      return copy.kindRelease;
    case "refund":
      return copy.kindRefund;
    // Credit for an invited friend's delivered order.
    case "referral":
      return copy.kindReferral;
    default:
      return parseMoney(row.amount) < 0 ? copy.kindAdjustDown : copy.kindGrant;
  }
}

/** «رصيدي»: the money the shopper holds at the store, how to spend it, and the history. */
export function AccountCredit() {
  const { money } = useStore();
  const copy = useTenderCopy();
  const { api } = useAccount();
  const [state, reload] = useShopperRead<ShopperStoreCredit>(api, shopperStoreCredit);

  if (state.status === "error") return <LoadFailed onRetry={reload} />;
  if (state.status === "loading") return <WalletSkeleton />;

  const { data } = state;
  const balance = parseMoney(data.balance);
  const amount = (n: number | string, currency = data.currency) => money(n, currency);

  return (
    <div>
      <section className={`${card} p-5 sm:p-6`} aria-labelledby="account-credit-title">
        <h2 id="account-credit-title" className="text-sm font-medium text-ink-soft">
          {copy.myCredit}
        </h2>
        <p className="mt-1 font-display text-3xl font-bold text-ink tabular-nums">{amount(balance)}</p>
        {balance > 0 && <p className="mt-3 border-t border-line pt-3 text-sm text-ink-soft">{data.spendingEnabled ? copy.creditUse : copy.creditOff}</p>}
      </section>

      {data.history.length === 0 ? (
        <Empty title={copy.creditEmpty} hint={copy.creditEmptyHint} shop={copy.shop} />
      ) : (
        <History title={copy.history}>
          {data.history.map((row) => {
            const change = parseMoney(row.amount);
            return (
              <HistoryRow
                key={row.id}
                what={creditKind(row, copy)}
                orderId={row.orderId}
                createdAt={row.createdAt}
                change={change}
                changeText={amount(Math.abs(change), row.currency || data.currency)}
                afterText={amount(row.balanceAfter, row.currency || data.currency)}
              />
            );
          })}
        </History>
      )}
    </div>
  );
}
