import type { ReactNode } from "react";
import type {
  CarrierAddressUnmatchedDetails,
  CarrierAreaUnmatchedDetails,
  CarrierInfo,
  CarrierPlaceRef,
} from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { fmt, useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { Field } from "@/components/Field";
import { Select } from "@/components/Select";
import { placeName } from "@/pages/shipping/carriers";

const STRINGS = {
  en: {
    unmatchedCity: "{carrier} doesn't have a city matching “{value}”. Choose the city, then the district.",
    unmatchedDistrict: "Matched {city}, but not the area “{value}”. Choose the district.",
    city: "City / governorate",
    district: "District / area",
    chooseCity: "Choose a city",
    chooseDistrict: "Choose a district",
    chooseCityFirst: "Choose a city first",
    loadingPlaces: "Loading…",
    suggested: "Best matches",
    allDistricts: "All districts",
    allCities: "All cities",
    placesFailed: "Couldn't load {carrier}'s list.",
    // any courier's levels
    unmatchedTop: "{carrier} doesn't have a {level} matching “{value}”. Choose it below.",
    unmatchedBelow: "Matched {matched}, but not the {level} “{value}”. Choose it below.",
    chooseLevel: "Choose a {level}",
    chooseLevelFirst: "Choose a {level} first",
    nothingBelow: "{carrier} lists no {level} here. Choose another {parent}.",
    allLevel: "All",
    level_city: "City",
    level_district: "District",
    level_governorate: "Governorate",
    level_province: "Province",
    level_region: "Region",
    level_zone: "Zone",
    level_area: "Area",
    level_neighborhood: "Neighborhood",
  },
  ar: {
    unmatchedCity: "لا توجد لدى {carrier} مدينة تطابق «{value}». اختر المدينة ثم المنطقة.",
    unmatchedDistrict: "تمت مطابقة {city}، لكن ليس المنطقة «{value}». اختر المنطقة.",
    city: "المدينة / المحافظة",
    district: "المنطقة / الحي",
    chooseCity: "اختر مدينة",
    chooseDistrict: "اختر منطقة",
    chooseCityFirst: "اختر مدينة أولًا",
    loadingPlaces: "جارٍ التحميل…",
    suggested: "الأقرب للعنوان",
    allDistricts: "كل المناطق",
    allCities: "كل المدن",
    placesFailed: "تعذّر تحميل قائمة {carrier}.",
    unmatchedTop: "لم نجد في قائمة {carrier} ما يطابق «{value}» في خانة {level}. اختر من القائمة بالأسفل.",
    unmatchedBelow: "تمت مطابقة {matched}، لكن لم نجد ما يطابق «{value}» في خانة {level}. اختر من القائمة بالأسفل.",
    chooseLevel: "اختر {level}",
    chooseLevelFirst: "اختر {level} أولًا",
    nothingBelow: "لا توجد في قائمة {carrier} خيارات لخانة {level} هنا. غيّر اختيار {parent}.",
    allLevel: "الكل",
    level_city: "المدينة",
    level_district: "المنطقة",
    level_governorate: "المحافظة",
    level_province: "المحافظة",
    level_region: "الإقليم",
    level_zone: "النطاق",
    level_area: "الحي",
    level_neighborhood: "الحي",
  },
} satisfies Messages;

type Strings = (typeof STRINGS)["en"];

export interface PlaceOption {
  id: string;
  name: string | null;
  nameAr: string | null;
  suggested?: boolean;
}

/** What a picker is working from: nothing (the merchant chose to pick), or a 422's candidates. */
export type PickerSource =
  | { kind: "free" }
  | { kind: "unmatched"; details: CarrierAddressUnmatchedDetails }
  | { kind: "unmatchedArea"; details: CarrierAreaUnmatchedDetails };

/** A level name from the courier ("governorate") in the active language; unknown ones as sent. */
function useLevelLabel() {
  const t = useT(STRINGS);
  return (level: string) => {
    const key = `level_${level.toLowerCase()}` as keyof Strings;
    if (key in t) return t[key];
    return level ? level.charAt(0).toUpperCase() + level.slice(1).replace(/_/g, " ") : level;
  };
}

/**
 * City → district picker over the courier's own list. From scratch it lists
 * every city; after a 422 CARRIER_ADDRESS_UNMATCHED it starts from the
 * server's candidates — cities at level "city", the matched city's districts
 * (best matches first) at level "district". Districts of a chosen city come
 * from GET .../cities?cityId=. Booked with `{ cityId, districtId }`.
 */
export function CityDistrictPicker({
  courier,
  source,
  cityId,
  districtId,
  onCityChange,
  onDistrictChange,
  cityError,
  districtError,
  disabled,
}: {
  courier: CarrierInfo;
  source: Extract<PickerSource, { kind: "free" | "unmatched" }>;
  cityId: string;
  districtId: string;
  onCityChange: (id: string) => void;
  onDistrictChange: (id: string) => void;
  cityError?: string;
  districtError?: string;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const workspaceId = useWorkspaceId();
  const details = source.kind === "unmatched" ? source.details : null;
  const districtLevel = details?.level === "district";

  // Cities: the candidates at city level, the whole list from scratch, and
  // at district level just the city that matched.
  const allCities = useAsync<PlaceOption[] | null>(
    () =>
      source.kind === "free"
        ? apiClient.listCarrierCities(workspaceId, courier.code).then((cities) => cities.filter((c) => c.dropOffAvailable !== false))
        : Promise.resolve(null),
    [workspaceId, courier.code, source.kind]
  );
  const cityOptions: PlaceOption[] = details
    ? districtLevel && details.matchedCity
      ? [details.matchedCity]
      : details.candidates.map((c) => ({ id: c.cityId, name: c.cityName, nameAr: c.cityNameAr, suggested: c.suggested }))
    : (allCities.data ?? []);

  // Districts: the server's candidates when it already narrowed them down,
  // otherwise the chosen city's list.
  const fetchDistricts = Boolean(cityId) && !districtLevel;
  const cityDistricts = useAsync<PlaceOption[] | null>(
    () =>
      fetchDistricts
        ? apiClient
            .listCarrierCities(workspaceId, courier.code, cityId)
            .then((cities) => (cities[0]?.districts ?? []).filter((d) => d.dropOffAvailable !== false))
        : Promise.resolve(null),
    [workspaceId, courier.code, cityId, fetchDistricts]
  );
  const districtOptions: PlaceOption[] = districtLevel
    ? details!.candidates
        .filter((c) => c.districtId)
        .map((c) => ({ id: c.districtId as string, name: c.districtName, nameAr: c.districtNameAr, suggested: c.suggested }))
    : (cityDistricts.data ?? []);

  const orderValue =
    (details?.level === "city" ? details.orderAddress.province || details.orderAddress.city : details?.orderAddress.city) ?? "—";

  return (
    <div className="space-y-3 rounded-[0.5rem] border border-line p-3">
      {details && (
        <p className="text-sm text-ink">
          {details.level === "city"
            ? fmt(t.unmatchedCity, { carrier: courier.name, value: orderValue })
            : fmt(t.unmatchedDistrict, { city: placeName(details.matchedCity, locale), value: orderValue })}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <PlaceSelect
          label={t.city}
          placeholder={allCities.loading ? t.loadingPlaces : t.chooseCity}
          options={cityOptions}
          value={cityId}
          onChange={onCityChange}
          disabled={disabled || districtLevel}
          error={cityError ?? (allCities.error ? fmt(t.placesFailed, { carrier: courier.name }) : undefined)}
          suggestedLabel={t.suggested}
          restLabel={t.allCities}
        />
        <PlaceSelect
          label={t.district}
          placeholder={!cityId ? t.chooseCityFirst : cityDistricts.loading ? t.loadingPlaces : t.chooseDistrict}
          options={cityId ? districtOptions : []}
          value={districtId}
          onChange={onDistrictChange}
          disabled={disabled || !cityId || cityDistricts.loading}
          error={districtError ?? (cityDistricts.error ? fmt(t.placesFailed, { carrier: courier.name }) : undefined)}
          suggestedLabel={t.suggested}
          restLabel={t.allDistricts}
        />
      </div>
    </div>
  );
}

/**
 * Level-by-level picker for a courier whose address levels are not
 * city/district (1–3 of them, top first). Each level lists the children of
 * the node chosen above it, loaded when that parent is chosen. After a 422
 * CARRIER_ADDRESS_UNMATCHED the levels that matched are fixed from
 * `matchedPath` and the unmatched level offers the server's candidates,
 * best matches first. Booked with `carrierAddress.path`, one id per level.
 */
export function LevelAddressPicker({
  courier,
  levels,
  source,
  path,
  onChange,
  errors,
  disabled,
}: {
  courier: CarrierInfo;
  levels: string[];
  source: Extract<PickerSource, { kind: "free" | "unmatchedArea" }>;
  path: string[];
  onChange: (path: string[]) => void;
  /** Field errors keyed "carrierAddress.path" / "carrierAddress.path.N". */
  errors: Record<string, string>;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const { locale } = useLocale();
  const levelLabel = useLevelLabel();
  const details = source.kind === "unmatchedArea" ? source.details : null;
  const fixedDepth = details ? Math.min(details.levelIndex, details.matchedPath.length) : 0;

  const orderValue = details
    ? ((details.levelIndex === 0 ? details.orderAddress.province || details.orderAddress.city : details.orderAddress.city) ??
      "—")
    : "—";
  const matchedNames = details?.matchedPath.map((node) => placeName(node, locale)).join(" › ") ?? "";

  return (
    <div className="space-y-3 rounded-[0.5rem] border border-line p-3">
      {details && (
        <p className="text-sm text-ink">
          {fixedDepth > 0
            ? fmt(t.unmatchedBelow, { matched: matchedNames, level: levelLabel(details.level).toLowerCase(), value: orderValue })
            : fmt(t.unmatchedTop, { carrier: courier.name, level: levelLabel(details.level).toLowerCase(), value: orderValue })}
        </p>
      )}
      <div className={levels.length >= 3 ? "grid gap-3 sm:grid-cols-3" : levels.length === 2 ? "grid gap-3 sm:grid-cols-2" : "grid gap-3"}>
        {levels.map((level, i) => {
          const fixed: CarrierPlaceRef | undefined = details && i < fixedDepth ? details.matchedPath[i] : undefined;
          const candidates =
            details && i === details.levelIndex
              ? details.candidates.map((c) => ({ id: c.id, name: c.name, nameAr: c.nameAr, suggested: c.suggested }))
              : undefined;
          return (
            <LevelSelect
              key={level + i}
              courier={courier}
              label={levelLabel(level)}
              parentLabel={i > 0 ? levelLabel(levels[i - 1]) : ""}
              level={i}
              parentId={i === 0 ? null : (path[i - 1] ?? "")}
              fixed={fixed}
              candidates={candidates}
              value={path[i] ?? ""}
              onChange={(id) => onChange([...path.slice(0, i), id])}
              error={errors[`carrierAddress.path.${i}`] ?? (i === levels.length - 1 ? errors["carrierAddress.path"] : undefined)}
              disabled={disabled}
            />
          );
        })}
      </div>
    </div>
  );
}

function LevelSelect({
  courier,
  label,
  parentLabel,
  level,
  parentId,
  fixed,
  candidates,
  value,
  onChange,
  error,
  disabled,
}: {
  courier: CarrierInfo;
  label: string;
  parentLabel: string;
  level: number;
  /** null on the top level; "" while the level above is still unchosen. */
  parentId: string | null;
  /** A level that already matched: shown, not changeable. */
  fixed?: CarrierPlaceRef;
  /** The server's candidates for this level (overrides the loaded list). */
  candidates?: PlaceOption[];
  value: string;
  onChange: (id: string) => void;
  error?: string;
  disabled: boolean;
}) {
  const t = useT(STRINGS);
  const workspaceId = useWorkspaceId();
  const waiting = parentId === "";
  const load = !fixed && !candidates && !waiting;
  const areas = useAsync<PlaceOption[] | null>(
    () =>
      load
        ? apiClient
            .listCarrierAreas(workspaceId, courier.code, parentId ?? undefined)
            .then((nodes) => nodes.filter((n) => n.dropOffAvailable !== false))
        : Promise.resolve(null),
    [workspaceId, courier.code, parentId, load]
  );
  const options: PlaceOption[] = fixed ? [fixed] : (candidates ?? areas.data ?? []);
  const empty = load && !areas.loading && !areas.error && areas.data !== null && options.length === 0;

  const placeholder = waiting
    ? fmt(t.chooseLevelFirst, { level: parentLabel.toLowerCase() })
    : areas.loading
      ? t.loadingPlaces
      : fmt(t.chooseLevel, { level: label.toLowerCase() });

  return (
    <PlaceSelect
      label={label}
      placeholder={placeholder}
      options={options}
      value={fixed ? fixed.id : value}
      onChange={onChange}
      disabled={disabled || Boolean(fixed) || waiting || areas.loading}
      error={
        error ??
        (areas.error
          ? fmt(t.placesFailed, { carrier: courier.name })
          : empty && level > 0
            ? fmt(t.nothingBelow, { carrier: courier.name, level: label.toLowerCase(), parent: parentLabel.toLowerCase() })
            : undefined)
      }
      suggestedLabel={t.suggested}
      restLabel={t.allLevel}
    />
  );
}

export function PlaceSelect({
  label,
  placeholder,
  options,
  value,
  onChange,
  disabled,
  error,
  suggestedLabel,
  restLabel,
}: {
  label: string;
  placeholder: string;
  options: PlaceOption[];
  value: string;
  onChange: (id: string) => void;
  disabled: boolean;
  error?: string;
  suggestedLabel: string;
  restLabel: string;
}) {
  const { locale } = useLocale();
  const suggested = options.filter((o) => o.suggested);
  const rest = options.filter((o) => !o.suggested);
  const render = (o: PlaceOption): ReactNode => (
    <option key={o.id} value={o.id}>
      {placeName(o, locale)}
    </option>
  );
  const byName = (a: PlaceOption, b: PlaceOption) =>
    placeName(a, locale).localeCompare(placeName(b, locale), locale === "ar" ? "ar" : "en");
  return (
    <Field label={label} error={error} required>
      {({ id, ...aria }) => (
        <Select id={id} {...aria} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className="h-11">
          <option value="">{placeholder}</option>
          {suggested.length > 0 ? (
            <>
              <optgroup label={suggestedLabel}>{suggested.map(render)}</optgroup>
              {rest.length > 0 && <optgroup label={restLabel}>{[...rest].sort(byName).map(render)}</optgroup>}
            </>
          ) : (
            [...rest].sort(byName).map(render)
          )}
        </Select>
      )}
    </Field>
  );
}
