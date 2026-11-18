import { Button } from "@store-builder/ui";
import { useWorkspace } from "@/context/WorkspaceContext";
import { useEditorLocale } from "./editorLocale";
import { LookBlock } from "./theme/parts";

/**
 * One "Template look" for a store that wears an imported template: the
 * heading face, the text face (each a Latin face with its Arabic partner),
 * the buttons' corners, the size of the words and the space between
 * sections — every band, the header and the footer at once, live in the
 * preview (storefront lib/xsTokens.ts, the same keys and ranges). Saved as
 * `themeSettings.xsTokens`; only what the merchant changes is kept, and a
 * band's own look still wins. The colour is the store's brand colour above.
 */

/** The storefront's FACES, by key: the label shown here. */
export const TEMPLATE_FACES: ReadonlyArray<{ key: string; label: string }> = [
  { key: "poppins", label: "Poppins · تجول" },
  { key: "playfair", label: "Playfair Display · المسيري" },
  { key: "inter", label: "Inter · IBM Plex Arabic" },
  { key: "jost", label: "Jost · تجول" },
  { key: "marcellus", label: "Marcellus · أميري" },
  { key: "montserrat", label: "Montserrat · القاهرة" },
  { key: "nunito", label: "Nunito Sans · المراعي" },
  { key: "opensans", label: "Open Sans · القاهرة" },
  { key: "raleway", label: "Raleway · ريدكس" },
  { key: "roboto", label: "Roboto · IBM Plex Arabic" },
  { key: "rubik", label: "Rubik · ريدكس" },
  { key: "lato", label: "Lato · المراعي" },
  { key: "syne", label: "Syne · ريم كوفي" },
  { key: "cookie", label: "Cookie · رقعة" },
  { key: "lalezar", label: "Nunito Sans · لاله‌زار" },
];

/** How many of each template's text colours are under 4.5:1 on their own ground (storefront lib/xsReadable.ts). */
export const TOO_LIGHT: Record<string, number> = {"01":1,"10":1,"13":3,"14":1,"15":1,"18":1,"21":1,"03":3,"05":1,"07":2,"08":3};

export interface TemplateTokens {
  readable?: boolean;
  display?: string;
  sans?: string;
  radius?: number;
  scale?: number;
  space?: number;
}

type Blob = Record<string, unknown>;

/** The saved tokens as the panel edits them. */
export function readTemplateTokens(saved: unknown): TemplateTokens {
  const o = saved && typeof saved === "object" && !Array.isArray(saved) ? (saved as Blob) : {};
  const face = (v: unknown) => (typeof v === "string" && TEMPLATE_FACES.some((f) => f.key === v) ? v : undefined);
  const num = (v: unknown, least: number, most: number) => (typeof v === "number" && v >= least && v <= most ? v : undefined);
  const out: TemplateTokens = {};
  if (face(o.display)) out.display = o.display as string;
  if (face(o.sans)) out.sans = o.sans as string;
  if (num(o.radius, 0, 40) !== undefined) out.radius = o.radius as number;
  if (num(o.scale, 85, 125) !== undefined && o.scale !== 100) out.scale = o.scale as number;
  if (num(o.space, 50, 150) !== undefined && o.space !== 100) out.space = o.space as number;
  if (o.readable === true) out.readable = true;
  return out;
}

/** The blob to save: undefined once everything is the template's again. */
export function writeTemplateTokens(tokens: TemplateTokens): Blob | undefined {
  const out = readTemplateTokens(tokens);
  return Object.keys(out).length > 0 ? (out as Blob) : undefined;
}

const WORDS = {
  en: {
    title: "Template look",
    hint: "Changes every section, the header and the footer at once. Anything a section sets for itself still wins. The colour is the brand colour above.",
    heading: "Heading font",
    body: "Text font",
    template: "The template's own",
    corners: "Button corners",
    cornersHint: "0 is square; 20 or more is a pill.",
    words: "Size of the words",
    spacing: "Space between sections",
    reset: "Back to the template's look",
    readable: "Easier-to-read text",
    readableHint: (n: number) => `${n} of this template's text colours are lighter than the 4.5:1 contrast easy reading needs. This darkens them just enough, keeping their hue.`,
  },
  ar: {
    title: "شكل القالب",
    hint: "يغير كل الأقسام والهيدر والفوتر مرة واحدة. أي حاجة القسم مظبطها لنفسه بتفضل زي ما هي. اللون هو لون البراند اللي فوق.",
    heading: "خط العناوين",
    body: "خط الكلام",
    template: "خط القالب الأصلي",
    corners: "استدارة الأزرار",
    cornersHint: "٠ مربعة؛ ٢٠ أو أكتر كبسولة.",
    words: "حجم الكلام",
    spacing: "المسافة بين الأقسام",
    reset: "رجوع لشكل القالب",
    readable: "كلام أسهل في القراية",
    readableHint: (n: number) => `${n} من ألوان الكلام في القالب ده أفتح من نسبة التباين ٤٫٥:١ اللي القراية المريحة محتاجاها. ده بيغمقها على قد الحاجة ويحافظ على درجتها.`,
  },
};

const selectClass =
  "h-10 w-full rounded-[0.75rem] bg-paper-sunken px-2 text-sm ring-1 ring-line focus-visible:outline-2 focus-visible:outline-primary pointer-coarse:h-11";

export function TemplateLookBlock({ saved, onChange }: { saved: unknown; onChange: (next: Blob | undefined, historyKey?: string) => void }) {
  const w = WORDS[useEditorLocale() === "ar" ? "ar" : "en"];
  const { currentWorkspace } = useWorkspace();
  const look = currentWorkspace?.themeSettings?.xsLook;
  if (typeof look !== "string" || look === "") return null;
  const tokens = readTemplateTokens(saved);
  const set = (patch: Partial<TemplateTokens>, key?: string) => onChange(writeTemplateTokens({ ...tokens, ...patch }), key);

  const face = (name: "display" | "sans", label: string) => (
    <label className="block space-y-1">
      <span className="text-sm font-medium text-ink-soft">{label}</span>
      <select className={selectClass} value={tokens[name] ?? ""} onChange={(e) => set({ [name]: e.target.value || undefined })}>
        <option value="">{w.template}</option>
        {TEMPLATE_FACES.map((f) => (
          <option key={f.key} value={f.key}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );

  const slider = (name: "scale" | "space", label: string, least: number, most: number) => {
    const value = tokens[name] ?? 100;
    return (
      <label className="block space-y-1">
        <span className="flex items-center justify-between text-sm font-medium text-ink-soft">
          {label}
          <output className="tabular-nums text-ink">{value}%</output>
        </span>
        <input
          type="range"
          min={least}
          max={most}
          step={5}
          value={value}
          className="w-full accent-[var(--color-primary)]"
          onChange={(e) => set({ [name]: Number(e.target.value) }, `template-look:${name}`)}
        />
      </label>
    );
  };

  return (
    <LookBlock title={w.title} hint={w.hint}>
      {face("display", w.heading)}
      {face("sans", w.body)}
      <label className="block space-y-1">
        <span className="flex items-center justify-between text-sm font-medium text-ink-soft">
          {w.corners}
          <output className="tabular-nums text-ink">{tokens.radius === undefined ? "—" : `${tokens.radius}px`}</output>
        </span>
        <input
          type="range"
          min={0}
          max={40}
          step={1}
          value={tokens.radius ?? 0}
          aria-describedby="template-look-corners"
          className="w-full accent-[var(--color-primary)]"
          onChange={(e) => set({ radius: Number(e.target.value) }, "template-look:radius")}
        />
        <span id="template-look-corners" className="block text-sm text-ink-soft">
          {w.cornersHint}
        </span>
      </label>
      {(TOO_LIGHT[look] ?? 0) > 0 && (
        <label className="flex items-start gap-2 text-sm text-ink">
          <input
            type="checkbox"
            className="mt-0.5 size-4 accent-[var(--color-primary)]"
            checked={tokens.readable === true}
            onChange={(e) => set({ readable: e.target.checked || undefined })}
          />
          <span>
            <span className="block font-medium">{w.readable}</span>
            <span className="block text-sm text-ink-soft">{w.readableHint(TOO_LIGHT[look])}</span>
          </span>
        </label>
      )}
      {slider("scale", w.words, 85, 125)}
      {slider("space", w.spacing, 50, 150)}
      {saved !== undefined && saved !== null && (
        <Button type="button" size="sm" variant="outline" onClick={() => onChange(undefined)}>
          {w.reset}
        </Button>
      )}
    </LookBlock>
  );
}
