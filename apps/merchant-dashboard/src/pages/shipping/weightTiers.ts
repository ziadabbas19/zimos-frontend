import type { BostaTierPackage, WeightTier } from "@store-builder/api-client";
import { apiClient } from "@/lib/apiClient";
import { useWorkspaceId } from "@/lib/useWorkspaceId";
import { useAsync } from "@/lib/useAsync";
import { formatKg } from "@/lib/weight";
import { useT, fmt, type Messages } from "@/i18n/LocaleContext";

const STRINGS = {
  en: {
    tierRange: "{from}–{to} kg",
    tierOpen: "Over {from} kg",
  },
  ar: {
    tierRange: "{from}–{to} كجم",
    tierOpen: "أكثر من {from} كجم",
  },
} satisfies Messages;

/** "0–1 kg" / "Over 3 kg" for a tier. */
export function useTierLabel() {
  const t = useT(STRINGS);
  return (tier: Pick<WeightTier, "fromGrams" | "upToGrams">) =>
    tier.upToGrams === null
      ? fmt(t.tierOpen, { from: formatKg(tier.fromGrams) })
      : fmt(t.tierRange, { from: formatKg(tier.fromGrams), to: formatKg(tier.upToGrams) });
}

/** The store's tiers (GET /shipping/weight-tiers needs shipping.manage). */
export function useWeightTiers() {
  const workspaceId = useWorkspaceId();
  return useAsync(() => apiClient.getWeightTiers(workspaceId).then((s) => s.tiers), [workspaceId]);
}

/** Drops mappings for tiers the store no longer has (the backend drops them too). */
export function pruneTierMap(
  tierMap: Record<string, BostaTierPackage> | undefined,
  tiers: WeightTier[] | null
): Record<string, BostaTierPackage> | undefined {
  if (!tierMap || !tiers) return tierMap;
  const ids = new Set(tiers.map((tier) => tier.id));
  return Object.fromEntries(Object.entries(tierMap).filter(([id]) => ids.has(id)));
}
