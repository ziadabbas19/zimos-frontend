import { FUNNEL_OFFER_STEP_TYPES, funnelsDuplicate, funnelsListSteps, funnelsUpdateStep } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import type { Locale } from "@/i18n/LocaleContext";
import { createAiFunnel, type AiFunnelSettings } from "../AiFunnelOption";
import { createFunnelFromStarter, type StarterTemplateId } from "../funnelAdapter";

/**
 * "Build the funnel": the wizard's answers turned into a funnel, with the same
 * calls the wizard always made — a starter (POST the funnel, then its steps
 * and links), a copy of one of the store's funnels (POST /funnels/:id/duplicate)
 * or the AI's page (AiFunnelOption) — then the finishing touches: the product
 * on every page that has sections and, when the funnel has an offer step, the
 * offer chosen for it (PATCH step { offerId }, what the inspector's offer
 * block saves).
 *
 * Nothing here throws. Once the funnel exists a failed finishing touch still
 * returns `created`, with what did not get through, so the wizard opens the
 * editor and says what to choose by hand.
 */

export type WizardTemplate =
  | { kind: "starter"; id: StarterTemplateId; lang: Locale }
  | { kind: "copy"; funnelId: string }
  | { kind: "ai"; settings: AiFunnelSettings };

export interface WizardAnswers {
  goal: "sell" | "leads";
  /** "" when none was chosen: the pages then follow the store's newest product, as before. */
  productId: string;
  /** The offer for the offer step (upsell); null when there is none to write. */
  offerId: string | null;
  template: WizardTemplate;
  /** Trimmed, not empty. */
  name: string;
  /** Lower case, already checked; "" lets the server make one from the name. */
  subdomain: string;
}

export type BuildOutcome =
  | {
      status: "created";
      id: string;
      name: string;
      /** A starter whose steps or links did not all get created (the funnel is open to finish by hand). */
      partial: unknown | null;
      /** The product could not be written. */
      touchError: unknown | null;
      /** The offer could not be written to the offer step. */
      offerError: unknown | null;
    }
  | { status: "failed"; source: "funnel" | "ai"; error: unknown };

function partialIdOf(err: unknown): string | null {
  const id = (err as { partialFunnelId?: unknown } | null)?.partialFunnelId;
  return typeof id === "string" ? id : null;
}

export async function buildFunnel(workspaceId: string, answers: WizardAnswers): Promise<BuildOutcome> {
  const { template, name, subdomain } = answers;
  const created = (id: string, label: string, rest?: Partial<{ partial: unknown; touchError: unknown; offerError: unknown }>): BuildOutcome => ({
    status: "created",
    id,
    name: label,
    partial: rest?.partial ?? null,
    touchError: rest?.touchError ?? null,
    offerError: rest?.offerError ?? null,
  });

  /**
   * The product goes on every page that has sections (the pages read it from
   * the tree's root); the offer goes on the first offer step that has none.
   * One read of the steps serves both.
   */
  const applyProductAndOffer = async (id: string): Promise<{ offerError: unknown | null }> => {
    const wantsProduct = answers.productId !== "" && answers.goal === "sell";
    const wantsOffer = answers.offerId !== null && answers.goal === "sell";
    if (!wantsProduct && !wantsOffer) return { offerError: null };
    const steps = await funnelsListSteps(apiClient, workspaceId, id);
    if (wantsProduct) {
      for (const s of steps) {
        const tree = s.builderData && typeof s.builderData === "object" ? (s.builderData as Record<string, unknown>) : null;
        if (!tree || !Array.isArray(tree.sections) || tree.sections.length === 0) continue;
        await funnelsUpdateStep(apiClient, workspaceId, id, s.id, { builderData: { ...tree, productId: answers.productId } });
      }
    }
    if (!wantsOffer) return { offerError: null };
    // Only a step that takes an offer gets one; a funnel without such a step is left as it is.
    const offerStep = steps.find((s) => s.stepType === "upsell" && !s.offerId) ?? steps.find((s) => FUNNEL_OFFER_STEP_TYPES.includes(s.stepType) && !s.offerId);
    if (!offerStep) return { offerError: null };
    try {
      await funnelsUpdateStep(apiClient, workspaceId, id, offerStep.id, { offerId: answers.offerId });
      return { offerError: null };
    } catch (err) {
      return { offerError: err };
    }
  };

  if (template.kind === "copy") {
    try {
      const copy = await funnelsDuplicate(apiClient, workspaceId, template.funnelId, { name, ...(subdomain ? { subdomain } : {}) });
      return created(copy.id, copy.name);
    } catch (error) {
      return { status: "failed", source: "funnel", error };
    }
  }

  if (template.kind === "ai") {
    try {
      const id = await createAiFunnel(workspaceId, { productId: answers.productId, name, subdomain: subdomain || undefined, settings: template.settings });
      return created(id, name);
    } catch (error) {
      return { status: "failed", source: "ai", error };
    }
  }

  let id: string;
  let funnelName: string;
  try {
    const funnel = await createFunnelFromStarter(workspaceId, name, template.id, template.lang, subdomain || undefined);
    id = funnel.id;
    funnelName = funnel.name;
  } catch (error) {
    const partial = partialIdOf(error);
    if (partial) return created(partial, name, { partial: error });
    return { status: "failed", source: "funnel", error };
  }
  // The product and the offer are finishing touches: a failure here still
  // leaves a usable funnel, so the merchant is taken to it either way.
  try {
    const { offerError } = await applyProductAndOffer(id);
    return created(id, funnelName, { offerError });
  } catch (touchError) {
    return created(id, funnelName, { touchError });
  }
}
