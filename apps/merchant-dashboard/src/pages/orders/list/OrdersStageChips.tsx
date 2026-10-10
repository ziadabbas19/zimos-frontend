import type { OrderPipeline, OrderStage } from "@store-builder/api-client";
import { ChipRow, type ChipItem } from "@/components/list";
import { useT, type Messages } from "@/i18n/LocaleContext";
import { useOrderLabels } from "../orderLabels";
import { COD_STAGE_ORDER } from "./useOrdersQuery";

const STRINGS = {
  en: { label: "Filter orders by stage", all: "All" },
  ar: { label: "تصفية الطلبات حسب المرحلة", all: "الكل" },
} satisfies Messages;

type StageChip = "all" | OrderStage;

/** The stages whose count asks to be looked at: calls to make, parcels that came back undelivered. */
const TONE: Partial<Record<OrderStage, "attention" | "danger">> = {
  pending_confirmation: "attention",
  delivery_failed: "danger",
};

/**
 * The stage of the list, as the kit's one scrolling row of chips: "All" first,
 * then the stages in the order a cash-on-delivery order lives through them,
 * each with how many orders it holds under the search and filters in effect.
 * A stage with nothing in it waits behind "More". The choice is `?stage=`.
 */
export function OrdersStageChips({
  value,
  onChange,
  pipeline,
  countsLoading,
}: {
  value: OrderStage | null;
  onChange: (next: OrderStage | null) => void;
  /** null while the counts are unknown (not read yet, or they could not be). */
  pipeline: OrderPipeline | null;
  countsLoading: boolean;
}) {
  const t = useT(STRINGS);
  const labels = useOrderLabels();

  // `null` rather than nothing: the chip keeps room for a figure and shows a dash while the counts load.
  const items: ChipItem<StageChip>[] = [
    { value: "all", label: t.all, count: pipeline ? pipeline.total : null },
    ...COD_STAGE_ORDER.map(
      (stage): ChipItem<StageChip> => ({
        value: stage,
        label: labels.stage(stage),
        count: pipeline ? (pipeline.stages[stage] ?? 0) : null,
        tone: TONE[stage],
      })
    ),
  ];

  return (
    <ChipRow
      items={items}
      value={value ?? "all"}
      onChange={(next) => onChange(next === "all" ? null : next)}
      label={t.label}
      countsLoading={countsLoading}
    />
  );
}
