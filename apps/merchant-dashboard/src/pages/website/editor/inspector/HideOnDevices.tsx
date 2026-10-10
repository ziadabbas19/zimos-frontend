import { cn } from "@store-builder/ui";
import type { PageElement } from "@store-builder/api-client";
import { IconDesktop, IconPhoneDevice, IconTablet, type IconComponent } from "@/components/icons";
import { useEditorLocale } from "../editorLocale";
import { elementStyles, patchElementStyles, styleRefOf, type NamedStyle, type StyleDevice } from "../ElementStylePanel";
import { SwitchRow } from "./controls";
import { inspectorUi, type InspectorUi } from "./strings";

/**
 * "Hide on a device", on the Visibility page. It is the same stored value the
 * Style tab's per-device checkbox always wrote — `settings.style.<device>.hidden`
 * — shown as three screens that are each on or off.
 *
 * The storefront lays the three styles over each other (base, then tablet
 * under 1024px, then phone under 640px), so a screen with no value of its own
 * follows the wider one. Turning one screen off or on therefore writes
 * whatever the other two need to stay as they were, and nothing more.
 */

const SCREENS: ReadonlyArray<{ id: StyleDevice; icon: IconComponent; name: keyof InspectorUi & `screen${string}` }> = [
  { id: "base", icon: IconDesktop, name: "screenDesktop" },
  { id: "tablet", icon: IconTablet, name: "screenTablet" },
  { id: "mobile", icon: IconPhoneDevice, name: "screenMobile" },
];

type Hidden = Record<StyleDevice, boolean>;

const flag = (value: unknown): boolean | undefined => (typeof value === "boolean" ? value : undefined);

/** What each screen does today, the named style included. */
export function hiddenScreens(element: PageElement, named: NamedStyle[]): Hidden {
  const own = elementStyles(element);
  const ref = named.find((n) => n.id === styleRefOf(element))?.style ?? {};
  const at = (device: StyleDevice) => flag(own[device]?.hidden) ?? flag(ref[device]?.hidden);
  const base = at("base") === true;
  const tablet = at("tablet") ?? base;
  const mobile = at("mobile") ?? tablet;
  return { base, tablet, mobile };
}

/** The names of the screens an element is hidden on, widest first. */
export function hiddenScreenNames(element: PageElement, named: NamedStyle[], t: InspectorUi): string[] {
  const hidden = hiddenScreens(element, named);
  return SCREENS.filter((s) => hidden[s.id]).map((s) => t[s.name]);
}

export function HideOnDevices({
  element,
  named,
  onSettingsChange,
}: {
  element: PageElement;
  named: NamedStyle[];
  onSettingsChange: (settings: Record<string, unknown> | undefined) => void;
}) {
  const t = inspectorUi(useEditorLocale());
  const hidden = hiddenScreens(element, named);
  const own = elementStyles(element);
  const ref = named.find((n) => n.id === styleRefOf(element))?.style ?? {};

  function toggle(device: StyleDevice) {
    const want: Hidden = { ...hidden, [device]: !hidden[device] };
    // What each screen would do with no value of its own, given the one above it.
    const baseAlone = flag(ref.base?.hidden) === true;
    const tabletAlone = flag(ref.tablet?.hidden) ?? want.base;
    const mobileAlone = flag(ref.mobile?.hidden) ?? want.tablet;
    onSettingsChange(
      patchElementStyles(element, {
        base: { hidden: want.base === baseAlone ? undefined : want.base },
        tablet: { hidden: want.tablet === tabletAlone ? undefined : want.tablet },
        mobile: { hidden: want.mobile === mobileAlone ? undefined : want.mobile },
      })
    );
  }

  const everywhere = hidden.base && hidden.tablet && hidden.mobile;
  const phone = own.mobile ?? {};

  return (
    <div className="space-y-2">
      <div role="group" aria-label={t.showOnLabel} className="flex flex-wrap gap-2">
        {SCREENS.map(({ id, icon: Glyph, name }) => {
          const on = !hidden[id];
          return (
            <button
              key={id}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(id)}
              className={cn(
                "inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full px-3 text-sm font-medium ring-1 transition-colors duration-[var(--dur-fade)] ease-[var(--ease-out)] ring-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary motion-reduce:transition-none pointer-coarse:min-h-11",
                on ? "bg-primary-soft text-primary-dark ring-primary/40 dark:text-primary" : "text-ink-soft line-through ring-line-strong hover:text-ink"
              )}
            >
              <Glyph className="size-4" aria-hidden />
              {t[name]}
            </button>
          );
        })}
      </div>
      {everywhere && (
        <p role="status" className="text-xs leading-5 font-medium text-accent-dark">
          {t.hiddenEverywhere}
        </p>
      )}
      {!hidden.mobile && (
        <div>
          <SwitchRow
            label={t.whenUpright}
            checked={phone.hiddenPortrait === true}
            onChange={(checked) => onSettingsChange(patchElementStyles(element, { mobile: { hiddenPortrait: checked ? true : undefined } }))}
          />
          <SwitchRow
            label={t.whenSideways}
            checked={phone.hiddenLandscape === true}
            onChange={(checked) => onSettingsChange(patchElementStyles(element, { mobile: { hiddenLandscape: checked ? true : undefined } }))}
          />
        </div>
      )}
    </div>
  );
}
