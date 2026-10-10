import { useLocale, useT, type Messages } from "@/i18n/LocaleContext";
import { IconContrast, IconMoon, IconSun } from "@/components/icons";
import { Segmented } from "@/components/Segmented";
import { SettingsGroup, SettingsRow, SettingsSwitch } from "@/components/settings";
import { setGlass, setLook, setTone, useAppearance } from "@/lib/appearance";
import { useAppearanceSaved } from "@/lib/appearanceSync";
import { GlowColours } from "./GlowColours";
import { ToneSlider } from "./ToneSlider";

const STRINGS = {
  en: {
    language: "Language",
    languageHint: "The whole dashboard switches at once.",
    arabic: "عربي",
    english: "English",
    look: "Look",
    lookHint: "Light, pure black for OLED screens, or dark with a tone you choose.",
    light: "Light",
    black: "Black",
    dark: "Dark",
    tone: "Tone",
    toneHint: "From midnight blue to slate. The middle is the dark look as it always was.",
    glass: "Glass surfaces",
    glassHint: "Tables and cards let the background show through. Turn it off for plain solid surfaces.",
    glassSystem: "Your device asks for solid surfaces, so glass stays off here.",
    glassBlack: "The Black look is plain: no glass and no glows. Choose Light or Dark to turn glass on.",
    glow: "Glow colours",
    glowHint: "The coloured light behind the glass, on each side of the screen.",
    deviceNote: "These choices are kept on this device.",
    savedToAccount: "Saved to your account",
  },
  ar: {
    language: "اللغة",
    languageHint: "تتحوّل لوحة التحكم كلها مرة واحدة.",
    arabic: "عربي",
    english: "English",
    look: "المظهر",
    lookHint: "فاتح، أو أسود خالص لشاشات OLED، أو داكن بدرجة تختارها.",
    light: "فاتح",
    black: "أسود",
    dark: "داكن",
    tone: "درجة اللون",
    toneHint: "من الأزرق الليلي إلى الرمادي الأردوازي. المنتصف هو المظهر الداكن كما كان دائمًا.",
    glass: "الأسطح الزجاجية",
    glassHint: "تُظهر الجداول والبطاقات الخلفية من ورائها. أوقفها إذا أردت أسطحًا مصمتة.",
    glassSystem: "جهازك يطلب أسطحًا مصمتة، لذلك يبقى الزجاج متوقفًا هنا.",
    glassBlack: "المظهر الأسود بلا زجاج ولا توهّج. اختر الفاتح أو الداكن لتشغيل الزجاج.",
    glow: "ألوان التوهّج",
    glowHint: "الضوء الملوّن خلف الزجاج، على كل جانب من الشاشة.",
    deviceNote: "هذه الخيارات محفوظة على هذا الجهاز.",
    savedToAccount: "محفوظ على حسابك",
  },
} satisfies Messages;

/**
 * Settings → "Language and look": the language, one of three looks (Light,
 * Black, Dark), the tone of the dark one, the glass switch and the colours
 * the glass glows in. All of it is kept on this device and changes at once —
 * nothing to save. The look itself is lib/appearance.ts, the same store the
 * toolbar's sun / moon switch uses. The look (not the language) is also kept
 * on the account (lib/appearanceSync): one more line under the card says so
 * once it is there, and nothing is shown when it could not be saved.
 */
export function AppearanceSection() {
  const t = useT(STRINGS);
  const { locale, setLocale } = useLocale();
  const { look, tone, glass } = useAppearance();
  const saved = useAppearanceSaved();

  return (
    <SettingsGroup
      footer={
        saved ? (
          <>
            {t.deviceNote}
            <span className="block">{t.savedToAccount}</span>
          </>
        ) : (
          t.deviceNote
        )
      }
    >
      <SettingsRow
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
      <SettingsRow
        label={t.look}
        hint={t.lookHint}
        stacked
        control={
          <Segmented
            label={t.look}
            value={look}
            onChange={setLook}
            className="sm:self-start"
            options={[
              { value: "light", label: t.light, icon: IconSun },
              { value: "black", label: t.black, icon: IconContrast },
              { value: "dark", label: t.dark, icon: IconMoon },
            ]}
          />
        }
      />
      {/* The tone belongs to Dark alone: Light and Black have one ground each. */}
      {look === "dark" && (
        <SettingsRow label={t.tone} hint={t.toneHint} stacked control={<ToneSlider value={tone} onChange={setTone} />} />
      )}
      {/* A switch that is held off says why, in words, not only by looking dimmed. */}
      <SettingsSwitch
        label={t.glass}
        hint={glass === "system" ? t.glassSystem : glass === "black" ? t.glassBlack : t.glassHint}
        checked={glass === "on"}
        disabled={glass === "system" || glass === "black"}
        onChange={setGlass}
      />
      {/* The glows are part of the glass backdrop: without glass there is nothing to colour. */}
      {glass === "on" && <SettingsRow label={t.glow} hint={t.glowHint} stacked control={<GlowColours />} />}
    </SettingsGroup>
  );
}
