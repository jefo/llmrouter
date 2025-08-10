import { z } from "zod";
import { createValueObject } from "../lib/value-object";
import { createAggregate } from "../lib/aggregate";
import { createBrandedId } from "../lib/branded-id";
import { createPort } from "../lib/di";

// --- Branded ID ---
export const PriceListId = createBrandedId("PriceListId");
export type PriceListId = InstanceType<typeof PriceListId>;

// --- Value Object: Price ---
/**
 * Схема для цены одной модели.
 * Содержит ID модели и цены за 1M токенов в копейках.
 */
export const PriceSchema = z.object({
  modelName: z.string(),
  inputPriceKopecksPer1M: z.number(),
  outputPriceKopecksPer1M: z.number(),
  isActive: z.boolean(),
});
export type PriceProps = z.infer<typeof PriceSchema>;
export const Price = createValueObject(PriceSchema);
export type Price = InstanceType<typeof Price>;

// --- Aggregate: PriceList ---
/**
 * Схема свойств для агрегата PriceList.
 */
export const PriceListPropsSchema = z.object({
  id: z.string().uuid(), // Use z.string().uuid() directly here
  prices: z.array(PriceSchema),
  createdAt: z.date(),
});
export type PriceListProps = z.infer<typeof PriceListPropsSchema>;

export const PriceList = createAggregate({
  name: "PriceList",
  schema: PriceListPropsSchema,
  invariants: [
    // Example invariant: ensure no duplicate model names
    (state) => {
      const modelNames = state.prices.map(p => p.modelName);
      if (new Set(modelNames).size !== modelNames.length) {
        throw new Error("PriceList cannot contain duplicate model names.");
      }
    },
  ],
  actions: {
    // Action to get active prices (can be a getter too, but actions are for state transitions)
    // For now, we'll keep it simple and assume direct access to state.prices is fine for queries.
    // If we needed to modify the list, we'd add actions like addPrice, updatePrice, etc.
    getPrices: (state: PriceListProps) => state.prices.filter(p => p.isActive),
  },
});
export type PriceList = InstanceType<typeof PriceList>;

// --- Port: IPriceListRepository ---
// This port defines the contract for fetching the active price list.
export const FindActivePriceListPort = createPort<() => Promise<PriceList | null>>();
export type FindActivePriceListPort = typeof FindActivePriceListPort;