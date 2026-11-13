import type {
  EmailCampaign,
  EmailCampaignAlign,
  EmailCampaignAudience,
  EmailCampaignBlock,
  EmailCampaignBlockType,
  EmailCampaignDraft,
  EmailCampaignLocale,
  EmailCampaignRfmLabel,
  EmailCampaignRules,
} from "@store-builder/api-client";
import { majorToMinor, minorToMajorInput } from "@/lib/format";

/**
 * The campaign editor's form: what the screens hold (strings as typed, a key
 * per block for React) and the payload the API takes. The checks mirror the
 * server's (emailCampaigns/campaignValidation.js), so a mistake is said
 * beside its field before anything is sent.
 */

export const MAX_BLOCKS = 40;
export const MAX_PRODUCTS = 6;

export interface BlockDraft {
  key: string;
  type: EmailCampaignBlockType;
  text: string;
  size: "lg" | "md";
  align: EmailCampaignAlign;
  url: string;
  alt: string;
  link: string;
  width: string;
  label: string;
  color: string;
  productIds: string[];
  showPrice: boolean;
}

export type AudienceKind = EmailCampaignAudience["type"];
export const RULE_KEYS = ["minOrders", "maxOrders", "minSpent", "maxSpent", "lastOrderWithinDays", "lastOrderOlderThanDays"] as const;
export type RuleKey = (typeof RULE_KEYS)[number];
const MONEY_RULES = new Set<RuleKey>(["minSpent", "maxSpent"]);

export interface CampaignDraftForm {
  name: string;
  subject: string;
  preheader: string;
  locale: EmailCampaignLocale;
  replyTo: string;
  audienceKind: AudienceKind;
  segmentId: string;
  rfmLabels: EmailCampaignRfmLabel[];
  rules: Record<RuleKey, string>;
  blocks: BlockDraft[];
}

let counter = 0;
export const newKey = () => `b${Date.now().toString(36)}${(counter += 1)}`;

export function emptyBlock(type: EmailCampaignBlockType): BlockDraft {
  return { key: newKey(), type, text: "", size: "lg", align: "start", url: "", alt: "", link: "", width: "", label: "", color: "", productIds: [], showPrice: true };
}

const emptyRules = (): Record<RuleKey, string> => Object.fromEntries(RULE_KEYS.map((k) => [k, ""])) as Record<RuleKey, string>;

export function blankForm(locale: EmailCampaignLocale, replyTo: string | null): CampaignDraftForm {
  return {
    name: "",
    subject: "",
    preheader: "",
    locale,
    replyTo: replyTo ?? "",
    audienceKind: "all",
    segmentId: "",
    rfmLabels: [],
    rules: emptyRules(),
    blocks: [{ ...emptyBlock("heading") }, { ...emptyBlock("text") }, { ...emptyBlock("button") }],
  };
}

function blockDraft(b: EmailCampaignBlock): BlockDraft {
  const d = emptyBlock(b.type);
  if (b.type === "heading") return { ...d, text: b.text, size: b.size ?? "lg", align: b.align ?? "start" };
  if (b.type === "text") return { ...d, text: b.text, align: b.align ?? "start" };
  if (b.type === "image") return { ...d, url: b.url, alt: b.alt ?? "", link: b.link ?? "", width: b.width ? String(b.width) : "", align: b.align ?? "start" };
  if (b.type === "button") return { ...d, label: b.label, url: b.url, color: b.color ?? "", align: b.align ?? "start" };
  if (b.type === "products") return { ...d, productIds: [...b.productIds], showPrice: b.showPrice !== false };
  return d;
}

/** A saved campaign as the form shows it. */
export function formOf(c: EmailCampaign): CampaignDraftForm {
  const rules = emptyRules();
  if (c.audience.type === "rules") {
    for (const key of RULE_KEYS) {
      const v = c.audience.rules[key];
      if (v !== undefined && v !== null) rules[key] = MONEY_RULES.has(key) ? minorToMajorInput(v) : String(v);
    }
  }
  return {
    name: c.name,
    subject: c.subject,
    preheader: c.preheader ?? "",
    locale: c.locale,
    replyTo: c.replyTo ?? "",
    audienceKind: c.audience.type,
    segmentId: c.audience.type === "segment" ? c.audience.segmentId : "",
    rfmLabels: c.audience.type === "rfm" ? [...c.audience.labels] : [],
    rules,
    blocks: c.blocks.map(blockDraft),
  };
}

/** One block as the API takes it: optional fields left out when empty. */
export function blockPayload(b: BlockDraft): EmailCampaignBlock {
  const align = b.align !== "start" ? { align: b.align } : {};
  switch (b.type) {
    case "heading":
      return { type: "heading", text: b.text.trim(), ...(b.size === "md" ? { size: "md" as const } : {}), ...align };
    case "text":
      return { type: "text", text: b.text.trim(), ...align };
    case "image":
      return {
        type: "image",
        url: b.url.trim(),
        ...(b.alt.trim() ? { alt: b.alt.trim() } : {}),
        ...(b.link.trim() ? { link: b.link.trim() } : {}),
        ...(b.width.trim() ? { width: Number(b.width) } : {}),
        ...align,
      };
    case "button":
      return { type: "button", label: b.label.trim(), url: b.url.trim(), ...(b.color.trim() ? { color: b.color.trim() } : {}), ...align };
    case "products":
      return { type: "products", productIds: b.productIds.slice(0, MAX_PRODUCTS), ...(b.showPrice ? {} : { showPrice: false }) };
    default:
      return { type: "divider" };
  }
}

export function audiencePayload(f: CampaignDraftForm): EmailCampaignAudience {
  if (f.audienceKind === "segment") return { type: "segment", segmentId: f.segmentId };
  if (f.audienceKind === "rfm") return { type: "rfm", labels: f.rfmLabels };
  if (f.audienceKind === "rules") {
    const rules: EmailCampaignRules = {};
    for (const key of RULE_KEYS) {
      const raw = f.rules[key].trim();
      if (!raw) continue;
      rules[key] = MONEY_RULES.has(key) ? majorToMinor(raw) : Number(raw);
    }
    return { type: "rules", rules };
  }
  return { type: "all" };
}

/** Is the audience complete enough to count (a segment picked, a group, a rule)? */
export function audienceReady(f: CampaignDraftForm): boolean {
  if (f.audienceKind === "segment") return Boolean(f.segmentId);
  if (f.audienceKind === "rfm") return f.rfmLabels.length > 0;
  if (f.audienceKind === "rules") return RULE_KEYS.some((k) => f.rules[k].trim() !== "") && !RULE_KEYS.some((k) => ruleError(k, f.rules[k]));
  return true;
}

export function payloadOf(f: CampaignDraftForm): EmailCampaignDraft & { name: string } {
  return {
    name: f.name.trim(),
    subject: f.subject.trim(),
    preheader: f.preheader.trim() || null,
    locale: f.locale,
    replyTo: f.replyTo.trim() || null,
    blocks: f.blocks.map(blockPayload),
    ...(audienceReady(f) ? { audience: audiencePayload(f) } : {}),
  };
}

export type ProblemKey = "required" | "urlInvalid" | "colorInvalid" | "rulesNeedOne" | "rfmNeedOne" | "incompleteSubject" | "incompleteBlocks";
/** "blocks.<key>.<field>" | "name" | "subject" | "replyTo" | "audience" | "rules.<key>" → what is wrong. */
export type Problems = Record<string, ProblemKey>;

const HTTP = /^https?:\/\/[^\s"'<>]+$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ruleError(key: RuleKey, raw: string): ProblemKey | null {
  const v = raw.trim();
  if (!v) return null;
  if (MONEY_RULES.has(key)) return Number.isFinite(majorToMinor(v)) && majorToMinor(v) >= 0 ? null : "required";
  return /^\d+$/.test(v) && Number(v) <= 100000 ? null : "required";
}

export function blockProblems(b: BlockDraft): Partial<Record<string, ProblemKey>> {
  const out: Partial<Record<string, ProblemKey>> = {};
  if (b.type === "heading" || b.type === "text") {
    if (!b.text.trim()) out.text = "required";
  }
  if (b.type === "image" || b.type === "button") {
    if (!b.url.trim()) out.url = "required";
    else if (!HTTP.test(b.url.trim())) out.url = "urlInvalid";
  }
  if (b.type === "image" && b.link.trim() && !HTTP.test(b.link.trim())) out.link = "urlInvalid";
  if (b.type === "button") {
    if (!b.label.trim()) out.label = "required";
    if (b.color.trim() && !/^#[0-9a-fA-F]{6}$/.test(b.color.trim())) out.color = "colorInvalid";
  }
  if (b.type === "products" && b.productIds.length === 0) out.productIds = "required";
  return out;
}

/** Every problem of the form; `forSending` also wants a subject and a block. */
export function validate(f: CampaignDraftForm, { forSending = false } = {}): Problems {
  const out: Problems = {};
  if (!f.name.trim()) out.name = "required";
  if (f.replyTo.trim() && !EMAIL.test(f.replyTo.trim())) out.replyTo = "required";
  if (f.audienceKind === "segment" && !f.segmentId) out.audience = "required";
  if (f.audienceKind === "rfm" && f.rfmLabels.length === 0) out.audience = "rfmNeedOne";
  if (f.audienceKind === "rules") {
    if (!RULE_KEYS.some((k) => f.rules[k].trim())) out.audience = "rulesNeedOne";
    for (const key of RULE_KEYS) {
      const problem = ruleError(key, f.rules[key]);
      if (problem) out[`rules.${key}`] = problem;
    }
  }
  for (const b of f.blocks) for (const [field, problem] of Object.entries(blockProblems(b))) if (problem) out[`blocks.${b.key}.${field}`] = problem;
  if (forSending) {
    if (!f.subject.trim()) out.subject = "incompleteSubject";
    if (f.blocks.length === 0) out.blocks = "incompleteBlocks";
  }
  return out;
}

/** The blocks the preview can draw: only the complete ones. */
export function previewBlocks(f: CampaignDraftForm): EmailCampaignBlock[] {
  return f.blocks.filter((b) => Object.keys(blockProblems(b)).length === 0).map(blockPayload);
}

export function moveBlock(blocks: BlockDraft[], index: number, by: -1 | 1): BlockDraft[] {
  const to = index + by;
  if (to < 0 || to >= blocks.length) return blocks;
  const copy = [...blocks];
  [copy[index], copy[to]] = [copy[to], copy[index]];
  return copy;
}
