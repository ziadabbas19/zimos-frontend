import { Check, CircleAlert } from "lucide-react";
import { Input, Label, cn, ZLoader } from "@store-builder/ui";
import { ROOT_DOMAIN, slugRejectionMessage } from "@/lib/storeAddress";
import type { SlugCheckState } from "@/lib/useSlugCheck";

/**
 * The store address input, with the live verdict underneath it.
 *
 * The domain is drawn as part of the control rather than left to a hint, so
 * what the merchant is choosing reads as the address it will become — they are
 * naming a link, not filling in a field called "slug".
 *
 * Typing is normalised on the way in (lowercased, spaces to hyphens). The
 * backend would do the same before storing, so letting a merchant type
 * "My Store" and then quietly checking something else would make the verdict
 * look like it belonged to different text.
 */
export function StoreAddressField({
  id,
  value,
  onChange,
  state,
  disabled,
}: {
  id: string;
  value: string;
  onChange: (slug: string) => void;
  state: SlugCheckState;
  disabled?: boolean;
}) {
  const invalid = state.status === "unavailable";

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Store address</Label>
      <div
        className={cn(
          "flex items-center rounded-[0.5rem] border border-line-strong bg-paper-raised pe-3 transition-colors focus-within:ring-2 focus-within:ring-primary/30",
          invalid && "border-danger focus-within:ring-danger/30",
          state.status === "available" && "border-success",
          disabled && "opacity-50"
        )}
      >
        <Input
          id={id}
          value={value}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={invalid || undefined}
          aria-describedby={`${id}-status`}
          onChange={(e) =>
            onChange(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, "-"))
          }
          placeholder="my-store"
          // The border and ring live on the wrapper so the suffix sits inside
          // them. Input styles its own focus and aria-invalid states, which
          // would draw a second box within this one — hence neutralising those
          // variants too, not just the resting border.
          className="h-9 border-0 bg-transparent shadow-none focus-visible:border-0 focus-visible:ring-0 aria-invalid:border-0 aria-invalid:ring-0 dark:bg-transparent"
        />
        <span className="shrink-0 select-none text-sm text-ink-soft">.{ROOT_DOMAIN}</span>
      </div>

      <p
        id={`${id}-status`}
        aria-live="polite"
        className={cn(
          "flex items-center gap-1.5 text-xs",
          state.status === "available" && "font-medium text-success",
          state.status === "unavailable" && "font-medium text-danger",
          (state.status === "checking" || state.status === "empty") && "text-ink-soft",
          state.status === "error" && "text-ink-soft"
        )}
      >
        {state.status === "checking" && (
          <>
            <ZLoader size="sm" className="size-3.5" aria-hidden />
            Checking availability…
          </>
        )}
        {state.status === "available" && (
          <>
            <Check className="size-3.5" aria-hidden />
            {value}.{ROOT_DOMAIN} is available
          </>
        )}
        {state.status === "unavailable" && (
          <>
            <CircleAlert className="size-3.5" aria-hidden />
            {slugRejectionMessage(state.result.reason)}
          </>
        )}
        {state.status === "error" && state.message}
        {state.status === "empty" && "This is the web address your customers will visit."}
      </p>
    </div>
  );
}
