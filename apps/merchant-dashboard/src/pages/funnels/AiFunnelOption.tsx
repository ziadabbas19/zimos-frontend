import { IconSparkle } from "@/components/icons";
import { aiApply, type AiDialect, type AiPageInput } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { runAiJob, useAiDialects } from "@/lib/aiRun";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { Field, TextField } from "@/components/Field";
import { Select } from "@/components/Select";
import { ChoiceCard } from "./wizard/ChoiceCard";

/**
 * The funnel wizard's "AI template" (SPEC §9.1: the first cards are Blank,
 * AI template, niche template; §19 "Funnel/landing with AI"): the AI writes
 * the sales page for the chosen product, and the funnel is created as
 * sales page → checkout → thank you, as a draft.
 */

const STRINGS = {
  en: {
    card: "AI template",
    cardHint: "The AI writes the sales page from your product, then adds the checkout and thank-you pages.",
    audience: "Who is it for?",
    audiencePlaceholder: "e.g. mothers of toddlers, young men who work out",
    style: "Page style",
    style_classic: "Classic: hero, features, guarantee, FAQs",
    style_problem_solution: "Problem → solution",
    style_short: "Short and direct",
    dialect: "Language",
    needsProduct: "Choose the product the AI should sell.",
  },
  ar: {
    card: "قالب بالذكاء الاصطناعي",
    cardHint: "الذكاء الاصطناعي يكتب صفحة البيع من بيانات منتجك، ثم يضيف صفحتي الدفع والشكر.",
    audience: "لمن المنتج؟",
    audiencePlaceholder: "مثلًا: أمهات الأطفال الصغار، شباب يمارسون الرياضة",
    style: "شكل الصفحة",
    style_classic: "كلاسيكي: مقدمة ومميزات وضمان وأسئلة",
    style_problem_solution: "المشكلة ← الحل",
    style_short: "قصيرة ومباشرة",
    dialect: "اللغة",
    needsProduct: "اختر المنتج الذي سيبيعه الذكاء الاصطناعي.",
  },
} satisfies Messages;

export type AiFunnelSettings = { audience: string; template: NonNullable<AiPageInput["template"]>; dialect: AiDialect };
export const AI_FUNNEL_DEFAULTS: AiFunnelSettings = { audience: "", template: "classic", dialect: "egyptian" };

export function useAiFunnelText() {
  return useT(STRINGS);
}

/** The fixed card at the start of the template grid: the AI writes the sales page. One of the gallery's radio choices. */
export function AiTemplateCard({ active, onSelect }: { active: boolean; onSelect: () => void }) {
  const t = useT(STRINGS);
  return (
    <ChoiceCard
      name="funnel-template"
      checked={active}
      onSelect={onSelect}
      leading={
        <span className="zimos-ai-glyph flex size-11 items-center justify-center rounded-[0.875rem] bg-primary-soft text-primary">
          <IconSparkle className="size-6" aria-hidden />
        </span>
      }
      title={t.card}
      hint={t.cardHint}
    />
  );
}

/** The extra questions when the AI writes the page: who it is for, the page's shape, the language. */
export function AiFunnelFields({ value, onChange }: { value: AiFunnelSettings; onChange: (next: AiFunnelSettings) => void }) {
  const t = useT(STRINGS);
  const dialects = useAiDialects();
  return (
    <div className="space-y-3">
      <TextField
        label={t.audience}
        placeholder={t.audiencePlaceholder}
        maxLength={200}
        value={value.audience}
        onChange={(e) => onChange({ ...value, audience: e.target.value })}
      />
      <Field label={t.style}>
        {(props) => (
          <Select {...props} value={value.template} onChange={(e) => onChange({ ...value, template: e.target.value as AiFunnelSettings["template"] })}>
            {(["classic", "problem_solution", "short"] as const).map((style) => (
              <option key={style} value={style}>
                {t[`style_${style}`]}
              </option>
            ))}
          </Select>
        )}
      </Field>
      <Field label={t.dialect}>
        {(props) => (
          <Select {...props} value={value.dialect} onChange={(e) => onChange({ ...value, dialect: e.target.value as AiDialect })}>
            {dialects.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        )}
      </Field>
    </div>
  );
}

/** Writes the page, then creates the draft funnel around it. Returns the funnel id. */
export async function createAiFunnel(
  workspaceId: string,
  { productId, name, subdomain, settings }: { productId: string; name: string; subdomain?: string; settings: AiFunnelSettings }
): Promise<string> {
  const job = await runAiJob(workspaceId, "page", {
    productId,
    audience: settings.audience.trim() || undefined,
    template: settings.template,
    dialect: settings.dialect,
  });
  const applied = await aiApply<"page">(apiClient, workspaceId, job.id, { target: "funnel", name, ...(subdomain ? { subdomain } : {}) });
  if (!applied.applied || applied.applied.type !== "funnel") throw new Error("The funnel was not created");
  return applied.applied.id;
}
