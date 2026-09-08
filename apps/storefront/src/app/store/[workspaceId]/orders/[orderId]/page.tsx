"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";

function Confirmation() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const search = useSearchParams();
  const orderNumber = search.get("number");
  const phone = search.get("phone");

  return (
    <main
      dir="rtl"
      className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center px-6 py-16 text-center"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-soft">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-7 w-7 text-primary-dark"
          aria-hidden="true"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>

      <h1 className="mt-6 font-display text-2xl font-medium text-ink">تم استلام طلبك</h1>

      <p className="mt-3 text-sm leading-relaxed text-ink-soft">
        {orderNumber ? (
          <>
            تم استلام طلبك رقم{" "}
            <span className="font-medium text-ink">#{orderNumber}</span>.{" "}
          </>
        ) : (
          "تم استلام طلبك بنجاح. "
        )}
        هنتواصل معاك
        {phone ? (
          <>
            {" "}
            على الرقم{" "}
            <span dir="ltr" className="font-medium text-ink">
              {phone}
            </span>{" "}
          </>
        ) : (
          " "
        )}
        اللي كتبته لتأكيد الطلب.
      </p>

      <Link
        href={`/store/${workspaceId}`}
        className="mt-8 inline-block rounded-[0.5rem] border border-line px-5 py-2.5 text-sm text-ink transition-colors hover:border-primary hover:text-primary-dark"
      >
        العودة للمتجر
      </Link>
    </main>
  );
}

export default function OrderConfirmationPage() {
  return (
    <Suspense
      fallback={
        <main className="flex-1 px-6 py-16 text-center text-sm text-ink-soft">
          جارٍ التحميل…
        </main>
      }
    >
      <Confirmation />
    </Suspense>
  );
}
