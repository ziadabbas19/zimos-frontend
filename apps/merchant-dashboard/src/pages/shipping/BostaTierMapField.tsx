import { useId } from "react";
import { Label } from "@store-builder/ui";
import {
  BOSTA_PACKAGE_TYPES,
  BOSTA_PARCEL_SIZES,
  type BostaPackageType,
  type BostaParcelSize,
  type BostaTierPackage,
  type WeightTier,
} from "@store-builder/api-client";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Select } from "@/components/Select";
import { useTierLabel } from "./weightTiers";

const STRINGS = {
  en: {
    heading: "Package per weight tier",
    hint: "Tell Bosta which package each tier ships as. Once any tier is mapped, every tier you book must be mapped. Orders from before you had tiers use the package type above.",
    noTiers: "Add weight tiers below to choose a package per tier. Until then every booking uses the package type above.",
    loading: "Loading tiers…",
    notMapped: "Not mapped",
    size: "Size",
    parcel: "Parcel",
    document: "Document",
    lightBulky: "Light bulky",
    heavyBulky: "Heavy bulky",
    SMALL: "Small",
    MEDIUM: "Medium",
    LARGE: "Large",
  },
  ar: {
    heading: "نوع الطرد لكل شريحة وزن",
    hint: "حدد لبوسطة نوع الطرد لكل شريحة. بمجرد ربط أي شريحة، لازم كل شريحة تحجز بيها تكون مربوطة. الأوردرات القديمة قبل الشرائح بتستخدم نوع الطرد اللي فوق.",
    noTiers: "أضف شرائح وزن بالأسفل لاختيار نوع طرد لكل شريحة. لحد ما تضيفها، كل الحجوزات بتستخدم نوع الطرد اللي فوق.",
    loading: "جارٍ تحميل الشرائح…",
    notMapped: "غير مربوطة",
    size: "المقاس",
    parcel: "طرد",
    document: "مستند",
    lightBulky: "حجم كبير خفيف",
    heavyBulky: "حجم كبير ثقيل",
    SMALL: "صغير",
    MEDIUM: "متوسط",
    LARGE: "كبير",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

const PACKAGE_LABEL: Record<BostaPackageType, keyof Strings> = {
  Parcel: "parcel",
  Document: "document",
  "Light Bulky": "lightBulky",
  "Heavy Bulky": "heavyBulky",
};

export function BostaTierMapField({
  tiers,
  loading,
  value,
  onChange,
  disabled,
}: {
  tiers: WeightTier[] | null;
  loading: boolean;
  value: Record<string, BostaTierPackage> | undefined;
  onChange: (next: Record<string, BostaTierPackage>) => void;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const tierLabel = useTierLabel();
  const map = value ?? {};

  function setTier(tierId: string, pkg: BostaTierPackage | null) {
    const next = { ...map };
    if (pkg) next[tierId] = pkg;
    else delete next[tierId];
    onChange(next);
  }

  return (
    <fieldset className="space-y-2">
      <legend className="text-sm font-medium text-ink">{t.heading}</legend>
      {loading ? (
        <p className="text-sm text-ink-soft">{t.loading}</p>
      ) : !tiers || tiers.length === 0 ? (
        <p className="text-sm text-ink-soft">{t.noTiers}</p>
      ) : (
        <>
          <p className="text-xs text-ink-soft">{t.hint}</p>
          <ul className="space-y-2">
            {tiers.map((tier) => (
              <TierRow
                key={tier.id}
                label={tierLabel(tier)}
                value={map[tier.id]}
                onChange={(pkg) => setTier(tier.id, pkg)}
                disabled={disabled}
                t={t}
              />
            ))}
          </ul>
        </>
      )}
    </fieldset>
  );
}

function TierRow({
  label,
  value,
  onChange,
  disabled,
  t,
}: {
  label: string;
  value: BostaTierPackage | undefined;
  onChange: (pkg: BostaTierPackage | null) => void;
  disabled: boolean;
  t: Strings;
}) {
  const typeId = useId();
  const sizeId = useId();
  return (
    <li className="grid items-end gap-2 sm:grid-cols-[10rem_1fr_1fr]">
      <span className="pb-3 text-sm text-ink">{label}</span>
      <div className="space-y-1">
        <Label htmlFor={typeId} className="sr-only">
          {label}
        </Label>
        <Select
          id={typeId}
          className="h-11"
          disabled={disabled}
          value={value?.packageType ?? ""}
          onChange={(e) => {
            const type = e.target.value as BostaPackageType | "";
            if (!type) onChange(null);
            else onChange(type === "Parcel" ? { packageType: type, size: value?.size ?? "SMALL" } : { packageType: type });
          }}
        >
          <option value="">{t.notMapped}</option>
          {BOSTA_PACKAGE_TYPES.map((p) => (
            <option key={p} value={p}>
              {t[PACKAGE_LABEL[p]]}
            </option>
          ))}
        </Select>
      </div>
      {value?.packageType === "Parcel" ? (
        <div className="space-y-1">
          <Label htmlFor={sizeId} className="sr-only">
            {t.size}
          </Label>
          <Select
            id={sizeId}
            className="h-11"
            disabled={disabled}
            value={value.size ?? "SMALL"}
            onChange={(e) => onChange({ packageType: "Parcel", size: e.target.value as BostaParcelSize })}
          >
            {BOSTA_PARCEL_SIZES.map((s) => (
              <option key={s} value={s}>
                {t.size}: {t[s]}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <span />
      )}
    </li>
  );
}
