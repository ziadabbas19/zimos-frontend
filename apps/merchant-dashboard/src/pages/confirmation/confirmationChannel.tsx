import { useId } from "react";
import { IconWhatsApp } from "@/components/icons";
import { cn } from "@store-builder/ui";
import type { ConfirmationChannel } from "@store-builder/api-client";
import { useWorkspace } from "@/context/WorkspaceContext";
import { fmt, useT, type Messages } from "@/i18n/LocaleContext";
import { whatsAppConfirmUrl, type WhatsAppOrder } from "@/lib/whatsapp";

/**
 * How an agent reached the customer on a confirmation attempt, shared by the
 * confirmation queue and the order page's Confirmation panel: the picker, the
 * WhatsApp button beside the phone number, and the label on each attempt.
 */

const STRINGS = {
  en: {
    channel: "How did you reach the customer?",
    call: "Call",
    whatsapp: "WhatsApp",
    other: "Other",
    openWhatsApp: "WhatsApp",
    openWhatsAppLabel: "Message {name} on WhatsApp (opens in a new tab)",
    customer: "the customer",
  },
  ar: {
    channel: "كيف تواصلت مع العميل؟",
    call: "اتصال",
    whatsapp: "واتساب",
    other: "أخرى",
    openWhatsApp: "واتساب",
    openWhatsAppLabel: "راسل {name} عبر واتساب (يفتح في علامة تبويب جديدة)",
    customer: "العميل",
  },
} satisfies Messages;

/** The channels an agent picks from. The API also accepts "other", which older clients may send. */
export const PICKABLE_CHANNELS: readonly ConfirmationChannel[] = ["call", "whatsapp"];

export function useChannelLabels(): Record<ConfirmationChannel, string> {
  const t = useT(STRINGS);
  return { call: t.call, whatsapp: t.whatsapp, other: t.other };
}

/** Call / WhatsApp as a row of radio pills, each a 44px target. */
export function ChannelPicker({
  value,
  onChange,
  disabled,
}: {
  value: ConfirmationChannel;
  onChange: (channel: ConfirmationChannel) => void;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const labels = useChannelLabels();
  const name = useId();
  const labelId = useId();
  return (
    <div className="space-y-1.5">
      <p id={labelId} className="text-sm font-medium text-ink">
        {t.channel}
      </p>
      <div role="radiogroup" aria-labelledby={labelId} className="flex flex-wrap gap-2">
        {PICKABLE_CHANNELS.map((channel) => {
          const checked = value === channel;
          return (
            <label
              key={channel}
              className={cn(
                "flex min-h-11 min-w-11 cursor-pointer items-center gap-2 rounded-full px-3.5 text-sm ring-1 transition-colors duration-[var(--dur-fade)] motion-reduce:transition-none",
                "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-primary",
                checked ? "bg-primary-soft font-medium text-ink ring-primary" : "text-ink-soft ring-line hover:ring-primary/50",
                "has-[:disabled]:cursor-default has-[:disabled]:opacity-80"
              )}
            >
              <input
                type="radio"
                name={name}
                value={channel}
                checked={checked}
                disabled={disabled}
                onChange={() => onChange(channel)}
                className="size-4 shrink-0 accent-primary"
              />
              {labels[channel]}
            </label>
          );
        })}
      </div>
    </div>
  );
}

/**
 * The click-to-chat link for confirming this order over WhatsApp, with the
 * store's own message (Settings) or the default one; null when the number
 * cannot be placed in a country. Nothing is sent by the platform.
 */
export function useWhatsAppConfirmUrl(order: WhatsAppOrder): string | null {
  const { currentWorkspace } = useWorkspace();
  return whatsAppConfirmUrl(
    order,
    currentWorkspace?.name ?? "",
    currentWorkspace?.settings?.confirmation_whatsapp_template ?? null
  );
}

/** The accessible name of a WhatsApp control for this order's customer. */
export function useWhatsAppLabel(order: WhatsAppOrder): string {
  const t = useT(STRINGS);
  return fmt(t.openWhatsAppLabel, { name: order.contactSnapshot.fullName?.trim() || t.customer });
}

/**
 * Opens WhatsApp with the customer's number and the store's confirmation
 * message ready to send. Renders nothing when the number can't be dialled.
 * `onOpen` lets the caller note that WhatsApp was used on this call.
 */
export function WhatsAppButton({
  order,
  onOpen,
  className,
}: {
  order: WhatsAppOrder;
  onOpen?: () => void;
  className?: string;
}) {
  const t = useT(STRINGS);
  const url = useWhatsAppConfirmUrl(order);
  const label = useWhatsAppLabel(order);
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={onOpen}
      aria-label={label}
      data-slot="contact-whatsapp"
      className={cn(
        "inline-flex min-h-11 items-center gap-2 rounded-full bg-success-soft px-4 text-sm font-semibold text-success transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] active:scale-[0.97] pointer-fine:min-h-9 motion-reduce:transition-none motion-reduce:active:scale-100",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
        className
      )}
    >
      <IconWhatsApp className="size-4 shrink-0" aria-hidden />
      {t.openWhatsApp}
    </a>
  );
}
