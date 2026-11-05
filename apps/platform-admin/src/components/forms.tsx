import { commonText } from "@/lib/commonStrings";
import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { Search, X } from "lucide-react";
import { Input, Label, Textarea, cn } from "@store-builder/ui";

/** Native select styled to match the shared <Input> — the merchant dashboard's own (its components/Select.tsx). */
export const NativeSelect = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <select
      ref={ref}
      className={cn(
        "flex h-10 w-full cursor-pointer rounded-[0.5rem] border border-line-strong bg-paper-raised px-3 py-2 text-sm text-ink",
        "transition-shadow focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:outline-none",
        "disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      {children}
    </select>
  )
);
NativeSelect.displayName = "NativeSelect";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: (props: { id: string; "aria-invalid"?: boolean }) => ReactNode;
}

export function Field({ label, error, hint, required, className, children }: FieldProps) {
  const id = useId();
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </Label>
      {children({ id, "aria-invalid": error ? true : undefined })}
      {error ? (
        <p className="text-xs font-medium text-danger">{error}</p>
      ) : hint ? (
        <p className="text-xs text-ink-soft">{hint}</p>
      ) : null}
    </div>
  );
}

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextField({ label, error, hint, required, className, ...inputProps }: TextFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => <Input id={id} required={required} {...aria} {...inputProps} />}
    </Field>
  );
}

interface TextAreaFieldProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function TextAreaField({ label, error, hint, required, className, ...props }: TextAreaFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => <Textarea id={id} required={required} {...aria} {...props} />}
    </Field>
  );
}

interface SelectFieldProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "id"> {
  label: string;
  error?: string;
  hint?: string;
}

export function SelectField({ label, error, hint, required, className, children, ...props }: SelectFieldProps) {
  return (
    <Field label={label} error={error} hint={hint} required={required} className={className}>
      {({ id, ...aria }) => (
        <NativeSelect id={id} required={required} {...aria} {...props}>
          {children}
        </NativeSelect>
      )}
    </Field>
  );
}

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange" | "value"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * The search over a list, as the merchant dashboard draws it (its
 * components/list/ListToolbar.tsx): a pill with the glyph at its start, and a
 * round button that clears it once something is typed (the browser's own
 * clear cross is hidden, so there is one way to clear, not two).
 */
export function SearchInput({ value, onChange, className, placeholder = "Search…", ...props }: SearchInputProps) {
  const hasText = value !== "";
  return (
    <label
      data-slot="list-search"
      className={cn(
        "zimos-list-search flex h-11 w-full cursor-text items-center rounded-full bg-paper-raised text-ink ring-1 ring-line sm:w-72",
        "transition-[background-color,box-shadow] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none",
        "has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-primary",
        className
      )}
    >
      <Search className="ms-4 size-4 shrink-0 text-ink-soft" aria-hidden />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          "h-full min-w-0 flex-1 appearance-none bg-transparent ps-2.5 text-sm text-ink outline-none placeholder:text-ink-soft pointer-coarse:text-base [&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          hasText ? "pe-1" : "pe-4"
        )}
        {...props}
      />
      {hasText && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label={commonText().clear}
          className="relative me-1 flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-soft transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] before:absolute before:-inset-1 hover:bg-ink/8 hover:text-ink focus-visible:outline-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </label>
  );
}

export interface ChipOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

/* One chip of the merchant dashboard's chip row (its components/list/ChipRow.tsx):
   a full pill, 40px tall with a mouse and 44px under a finger. The solid look is
   here; the theme gives the pane and the brand fill on these hooks. */
const CHIP =
  "zimos-chip inline-flex h-10 shrink-0 cursor-pointer items-center gap-2 rounded-full text-sm font-medium whitespace-nowrap select-none pointer-coarse:h-11 " +
  "transition-[scale,background-color,color] duration-[var(--dur-fade)] ease-[var(--ease-out)] motion-reduce:transition-none " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.97] motion-reduce:active:scale-100";
const CHIP_ON = "bg-primary text-primary-foreground forced-colors:bg-[color:Highlight] forced-colors:text-[color:HighlightText]";
const CHIP_OFF = "bg-paper-raised text-ink ring-1 ring-line hover:bg-paper-sunken";
const COUNT =
  "zimos-chip-count inline-flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 text-xs leading-none font-semibold tabular-nums";
// On the chosen chip the figure sits in a darker bead (a lighter one in the dark theme, where the fill is light).
const COUNT_ON = "bg-black/20 dark:bg-white/30";
const COUNT_OFF = "bg-paper-sunken text-ink-soft";

/** Filter chips over a table (status filters): one is chosen, the others are a press away. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: ChipOption<T>[];
  value: T;
  onChange: (value: NoInfer<T>) => void;
  className?: string;
}) {
  return (
    <div role="group" data-slot="chip-row" className={cn("flex flex-wrap gap-2", className)}>
      {options.map((o) => {
        const pressed = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={pressed}
            onClick={() => onChange(o.value)}
            className={cn(CHIP, o.count !== undefined ? "ps-3.5 pe-2" : "px-3.5", pressed ? CHIP_ON : CHIP_OFF)}
          >
            <span>{o.label}</span>
            {o.count !== undefined && <span className={cn(COUNT, pressed ? COUNT_ON : COUNT_OFF)}>{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
