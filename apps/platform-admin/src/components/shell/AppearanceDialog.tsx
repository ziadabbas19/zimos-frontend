import { Contrast, Moon, Sun } from "lucide-react";
import { Segmented } from "@store-builder/ui";
import { GlowColours, ToneSlider, setGlass, setLook, setTone, useAppearance } from "@store-builder/ui/appearance";
import { animateThemeChange } from "@store-builder/ui/theme-reveal";
import { Modal } from "@/components/Modal";
import { useLocale, useT } from "@/i18n/LocaleContext";
import { LOOK_STRINGS, SHELL_STRINGS } from "@/lib/shellStrings";
import { LookGroup, LookRow, LookSwitch } from "./lookRows";

/**
 * "Language and look", from the account menu: the language, one of three looks
 * (Light, Black, Dark), the tone of the dark one, the glass switch and the
 * colours the glass glows in. The merchant dashboard's Settings → Language and
 * look, with the same controls and the same store (packages/ui appearance):
 * everything is kept on this device and changes at once — nothing to save —
 * and the toolbar's sun / moon switch reads the same choice.
 *
 * A dialog, not a page: the console has no settings section to put it in.
 */
export function AppearanceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const shell = useT(SHELL_STRINGS);
  const t = useT(LOOK_STRINGS);
  const { locale, setLocale } = useLocale();
  const { look, tone, glass } = useAppearance();

  return (
    <Modal open={open} onClose={onClose} title={shell.languageAndLook} className="max-w-xl">
      <LookGroup footer={t.deviceNote}>
        <LookRow
          label={t.language}
          hint={t.languageHint}
          control={
            <Segmented
              label={t.language}
              value={locale}
              onChange={setLocale}
              options={[
                { value: "ar", label: t.arabic },
                { value: "en", label: t.english },
              ]}
            />
          }
        />
        {/* Three segments do not fit beside the label on a phone: the control takes its own line. */}
        <LookRow
          label={t.look}
          hint={t.lookHint}
          stacked
          control={
            <Segmented
              label={t.look}
              value={look}
              // The new look grows over the old one as a circle from the segment pressed, like the toolbar switch.
              onChange={(next, press) => animateThemeChange(press, () => setLook(next))}
              className="sm:self-start"
              options={[
                { value: "light", label: t.light, icon: Sun },
                { value: "black", label: t.black, icon: Contrast },
                { value: "dark", label: t.dark, icon: Moon },
              ]}
            />
          }
        />
        {/* The tone belongs to Dark alone: Light and Black have one ground each. */}
        {look === "dark" && <LookRow label={t.tone} hint={t.toneHint} stacked control={<ToneSlider locale={locale} value={tone} onChange={setTone} />} />}
        {/* A switch that is held off says why, in words, not only by looking dimmed. */}
        <LookSwitch
          label={t.glass}
          hint={glass === "system" ? t.glassSystem : glass === "black" ? t.glassBlack : t.glassHint}
          checked={glass === "on"}
          disabled={glass === "system" || glass === "black"}
          onChange={setGlass}
        />
        {/* The glows are part of the glass backdrop: without glass there is nothing to colour. */}
        {glass === "on" && <LookRow label={t.glow} hint={t.glowHint} stacked control={<GlowColours locale={locale} />} />}
      </LookGroup>
    </Modal>
  );
}
