import { STORE_LIST_CARD_FIELDS_ENABLED } from "./features";

/** What a list that only draws product cards adds to its request (lib/features: STORE_LIST_CARD_FIELDS_ENABLED). */
export const CARD_FIELDS: { fields?: "card" } = STORE_LIST_CARD_FIELDS_ENABLED ? { fields: "card" } : {};
