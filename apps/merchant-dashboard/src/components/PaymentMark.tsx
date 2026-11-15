import { cn } from "@store-builder/ui";
import { IconWallet } from "@/components/icons";
import { ProviderLogo } from "@/components/ProviderLogo";
import instapay from "@/assets/payments/instapay.png";
import orange from "@/assets/payments/orange.png";
import vodafone from "@/assets/payments/vodafone.png";
import we from "@/assets/payments/we.png";

/** The wallets a mobile-wallet transfer can be sent from, most used first. */
const WALLETS = [
  { src: vodafone, name: "Vodafone Cash" },
  { src: orange, name: "Orange Cash" },
  { src: we, name: "WE Pay" },
];

/**
 * A way of paying, recognised by its mark before its name is read: InstaPay's
 * logo; for a mobile wallet the marks of the wallets it can be sent from,
 * side by side; a payment gateway's own logo (ProviderLogo); anything else a
 * wallet glyph. Decorative: the method's name beside it is what is read
 * (sources in assets/payments/CREDITS.md).
 */
export function PaymentMark({ code, kind, className }: { code: string; kind?: "manual" | "gateway"; className?: string }) {
  const key = code.toLowerCase().replace(/[-_\s]/g, "");
  if (key.includes("instapay")) {
    return <img src={instapay} alt="" aria-hidden draggable={false} className={cn("h-9 w-auto shrink-0 object-contain", className)} />;
  }
  if (key.includes("wallet") || key.includes("cash")) {
    return (
      <span aria-hidden data-payment-mark="wallet" className={cn("flex shrink-0 items-center gap-1", className)}>
        {WALLETS.map((wallet) => (
          <img
            key={wallet.name}
            src={wallet.src}
            alt=""
            title={wallet.name}
            draggable={false}
            className="size-8 rounded-[9px] bg-white object-contain ring-1 ring-line"
          />
        ))}
      </span>
    );
  }
  if (kind === "gateway") return <ProviderLogo code={code} size="sm" className={className} />;
  return (
    <span aria-hidden className={cn("grid size-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary [&>svg]:size-5", className)}>
      <IconWallet />
    </span>
  );
}
