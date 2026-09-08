"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { formatMoney, type CartLine } from "@store-builder/api-client";
import { useCart } from "@/lib/CartProvider";

function lineTitle(line: CartLine): string {
  if (line.variant) {
    return Object.values(line.variant.optionValues).join(" / ") || line.variant.sku || "منتج";
  }
  return "منتج";
}

export default function CartPage() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const { cart, isLoading, updateItem, removeItem } = useCart();

  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currency = cart?.currency ?? "EGP";
  const isEmpty = !cart || cart.items.length === 0;

  async function run(lineId: string, action: () => Promise<void>, fallback: string) {
    if (pendingId) return;
    setPendingId(lineId);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof Error ? err.message : fallback);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <main dir="rtl" className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
      <h1 className="font-display text-2xl font-medium text-ink">سلة التسوق</h1>

      {isLoading && !cart ? (
        <p className="mt-10 text-sm text-ink-soft">جارٍ تحميل السلة…</p>
      ) : isEmpty ? (
        <div className="mt-10 rounded-[var(--radius-card)] border border-line bg-paper-raised px-6 py-12 text-center">
          <p className="text-sm text-ink-soft">سلة التسوق فاضية.</p>
          <Link
            href={`/store/${workspaceId}`}
            className="mt-4 inline-block text-sm text-primary hover:underline"
          >
            → ارجع للتسوق
          </Link>
        </div>
      ) : (
        <>
          {error && (
            <p className="mt-4 rounded-[0.5rem] bg-danger-soft px-4 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <ul className="mt-6 border-t border-line">
            {cart.items.map((line) => {
              const rowBusy = pendingId === line.id;
              return (
                <li key={line.id} className="flex gap-4 border-b border-line py-4">
                  <div className="h-16 w-16 shrink-0 rounded-[0.5rem] bg-primary-soft" />

                  <div className="flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <span className="text-sm font-medium text-ink">{lineTitle(line)}</span>
                      <button
                        type="button"
                        onClick={() =>
                          run(line.id, () => removeItem(line.id), "تعذّر حذف الصنف")
                        }
                        disabled={rowBusy}
                        className="shrink-0 text-xs text-danger hover:underline disabled:opacity-50"
                      >
                        حذف
                      </button>
                    </div>

                    <span className="mt-1 text-xs text-ink-soft">
                      {formatMoney(line.currentUnitPrice, currency)} للوحدة
                    </span>
                    {line.priceChanged && (
                      <span className="mt-1 text-xs text-accent-dark">
                        السعر اتغيّر منذ إضافته للسلة
                      </span>
                    )}

                    <div className="mt-2 flex items-center justify-between">
                      <div className="inline-flex items-center rounded-[0.5rem] border border-line">
                        <button
                          type="button"
                          aria-label="إنقاص الكمية"
                          onClick={() =>
                            run(
                              line.id,
                              () => updateItem(line.id, line.quantity - 1),
                              "تعذّر تحديث الكمية"
                            )
                          }
                          disabled={rowBusy || line.quantity <= 1}
                          className="px-3 py-1 text-sm text-ink-soft disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="min-w-8 text-center text-sm text-ink">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="زيادة الكمية"
                          onClick={() =>
                            run(
                              line.id,
                              () => updateItem(line.id, line.quantity + 1),
                              "تعذّر تحديث الكمية"
                            )
                          }
                          disabled={rowBusy}
                          className="px-3 py-1 text-sm text-ink-soft disabled:opacity-40"
                        >
                          +
                        </button>
                      </div>
                      <span className="text-sm font-medium text-ink">
                        {formatMoney(line.lineTotal, currency)}
                      </span>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-ink-soft">الإجمالي المبدئي</span>
            <span className="font-display text-lg font-medium text-ink">
              {formatMoney(cart.subtotal, currency)}
            </span>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row-reverse sm:items-center sm:justify-between">
            <Link
              href={`/store/${workspaceId}/checkout`}
              className="rounded-[0.5rem] bg-primary px-6 py-3 text-center text-sm font-medium text-paper-raised transition-colors hover:bg-primary-dark"
            >
              إتمام الطلب
            </Link>
            <Link
              href={`/store/${workspaceId}`}
              className="text-center text-sm text-primary hover:underline"
            >
              متابعة التسوق
            </Link>
          </div>
        </>
      )}
    </main>
  );
}
