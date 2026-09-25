import { Input, cn } from "@store-builder/ui";
import { Field } from "./Field";

interface WeightInputProps {
  label: string;
  /** Kilograms as typed, e.g. "1.25". Parent converts with kgInputToGrams() at submit. */
  value: string;
  onChange: (value: string) => void;
  /** Unit adornment, already translated ("kg" / "كجم"). */
  unit: string;
  error?: string;
  hint?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

/** Text input for a weight in kilograms, with a unit adornment. */
export function WeightInput({ label, value, onChange, unit, error, hint, required, disabled, className }: WeightInputProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => (
        <div className="relative">
          <Input
            id={id}
            {...aria}
            inputMode="decimal"
            value={value}
            disabled={disabled}
            placeholder="0.5"
            onChange={(e) => onChange(e.target.value)}
            className={cn("pe-12", error && "border-danger focus-visible:ring-danger/30")}
          />
          <span className="pointer-events-none absolute inset-y-0 end-0 flex items-center pe-3 text-sm text-ink-soft">
            {unit}
          </span>
        </div>
      )}
    </Field>
  );
}
