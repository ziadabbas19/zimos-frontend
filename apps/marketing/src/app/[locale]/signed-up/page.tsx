import type { Metadata } from "next";
import { Suspense } from "react";
import { SignedUp } from "@/components/signed-up";

/**
 * Not a page anyone reads: the dashboard opens it in a hidden frame once an
 * account is made (its lib/signupConversion.ts), and components/signed-up.tsx
 * reports the sign-up to this site's tag manager. Kept out of search engines
 * and of the sitemap.
 */
export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function SignedUpPage() {
  return (
    <Suspense>
      <SignedUp />
    </Suspense>
  );
}
