import { Input, cn } from "@store-builder/ui";
import { toLatinDigits } from "./costsModel";

/** Brings a field into view and puts the cursor in it: the first one a save could not accept. */
export function focusField(id: string) {
  const field = document.getElementById(id);
  if (!field) return;
  field.scrollIntoView({ block: "center" });
  field.focus({ preventScroll: true });
}

/**
 * An amount or a rate as it is typed: a decimal keypad on a phone, 44px tall
 * and 16px text there (so the page does not zoom), the currency code or the
 * percent sign at the start. Arabic digits are turned to the digits the
 * number is saved in as they are typed.
 */
export function AmountInput({
  id,
  value,
  onChange,
  adornment,
  invalid = false,
  describedBy,
  placeholder = "0",
  className,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  /** "EGP", "%". */
  adornment: string;
  invalid?: boolean;
  describedBy?: string;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <span aria-hidden className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-sm text-ink-soft">
        {adornment}
      </span>
      <Input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(event) => onChange(toLatinDigits(event.target.value))}
        className={cn("h-11 ps-12 tabular-nums md:h-10", invalid && "border-danger focus-visible:ring-danger/30")}
      />
    </div>
  );
}
