import { useId } from "react";
import { Baby, Dumbbell, Ellipsis, Gem, Handshake, Shirt, Smartphone, Sofa, Sparkles, UtensilsCrossed, type LucideIcon } from "lucide-react";
import { Input, Label, cn } from "@store-builder/ui";
import { BUSINESS_TYPES, type BusinessType } from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    legend: "What does your store sell?",
    optional: "Optional. One tap is enough.",
    fashion: "Fashion & clothing",
    electronics: "Electronics & mobiles",
    beauty: "Beauty & care",
    food: "Food & drinks",
    home: "Home & furniture",
    accessories: "Accessories & jewelry",
    kids: "Kids & toys",
    sports: "Sports & fitness",
    services: "Services",
    other: "Other",
    otherLabel: "What do you sell?",
    otherPlaceholder: "e.g. handmade candles",
  },
  ar: {
    legend: "ماذا يبيع متجرك؟",
    optional: "اختياري. ضغطة واحدة تكفي.",
    fashion: "أزياء وملابس",
    electronics: "إلكترونيات وموبايلات",
    beauty: "تجميل وعناية",
    food: "أطعمة ومشروبات",
    home: "منزل وأثاث",
    accessories: "إكسسوارات ومجوهرات",
    kids: "أطفال وألعاب",
    sports: "رياضة ولياقة",
    services: "خدمات",
    other: "أخرى",
    otherLabel: "ماذا تبيع؟",
    otherPlaceholder: "مثال: شموع يدوية",
  },
} satisfies Messages;

const ICONS: Record<BusinessType, LucideIcon> = {
  fashion: Shirt,
  electronics: Smartphone,
  beauty: Sparkles,
  food: UtensilsCrossed,
  home: Sofa,
  accessories: Gem,
  kids: Baby,
  sports: Dumbbell,
  services: Handshake,
  other: Ellipsis,
};

/**
 * "What does your store sell?" on the store setup: one tap on a tile (a
 * radio group, so the arrow keys move between them), optional. "Other"
 * opens a short text field.
 */
export function BusinessTypeField({
  value,
  other,
  onChange,
  onOtherChange,
  disabled,
}: {
  value: BusinessType | null;
  other: string;
  onChange: (next: BusinessType) => void;
  onOtherChange: (next: string) => void;
  disabled?: boolean;
}) {
  const t = useT(STRINGS);
  const name = useId();
  const hintId = useId();
  const otherId = useId();
  return (
    <fieldset className="space-y-2" aria-describedby={hintId} disabled={disabled}>
      <legend className="text-sm font-medium text-ink">{t.legend}</legend>
      <p id={hintId} className="text-xs text-ink-soft">
        {t.optional}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {BUSINESS_TYPES.map((type) => {
          const Icon = ICONS[type];
          const selected = value === type;
          return (
            <label
              key={type}
              className={cn(
                "flex min-h-11 cursor-pointer items-center gap-2 rounded-[0.875rem] border px-3 py-2 text-sm transition-colors has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                selected ? "border-primary bg-primary-soft font-medium text-ink" : "border-line bg-paper-raised text-ink hover:border-primary/60",
                disabled && "cursor-not-allowed opacity-60"
              )}
            >
              <input type="radio" name={name} value={type} checked={selected} onChange={() => onChange(type)} className="sr-only" />
              <Icon className={cn("size-4 shrink-0", selected ? "text-primary" : "text-ink-soft")} aria-hidden />
              <span className="min-w-0">{t[type]}</span>
            </label>
          );
        })}
      </div>
      {value === "other" && (
        <div className="space-y-1.5 pt-1">
          <Label htmlFor={otherId}>{t.otherLabel}</Label>
          <Input
            id={otherId}
            value={other}
            onChange={(e) => onOtherChange(e.target.value)}
            placeholder={t.otherPlaceholder}
            maxLength={80}
            className="min-h-11"
          />
        </div>
      )}
    </fieldset>
  );
}
