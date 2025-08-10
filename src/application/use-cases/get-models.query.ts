import { z } from "zod";
import { usePort } from "../../lib/di";
import { FindActivePriceListPort, PriceList } from "../../domain/pricelist.agg";

// Input schema for GetModelsQuery (empty for now)
export const GetModelsQueryInputSchema = z.object({});
export type GetModelsQueryInput = z.infer<typeof GetModelsQueryInputSchema>;

// Output schema for GetModelsQuery (based on 2_API_Contracts.md)
export const GetModelsQueryOutputSchema = z.object({
  object: z.literal("list"),
  data: z.array(
    z.object({
      id: z.string(),
      object: z.literal("model"),
      created: z.number(),
      owned_by: z.string(),
      pricing: z.object({
        prompt: z.string(),
        completion: z.string(),
      }),
    })
  ),
});
export type GetModelsQueryOutput = z.infer<typeof GetModelsQueryOutputSchema>;

/**
 * Use case to get a list of available models and their prices.
 */
export const GetModelsQuery = async (
  input: GetModelsQueryInput = {} // Default empty object for no input
): Promise<GetModelsQueryOutput> => {
  // Get the port implementation via DI
  const findActivePriceList = usePort(FindActivePriceListPort);

  // Fetch the active price list aggregate
  const priceListAggregate = await findActivePriceList();

  if (!priceListAggregate) {
    // If no price list is found, return an empty list or throw an error
    return {
      object: "list",
      data: [],
    };
  }

  // Access the state of the PriceList aggregate to get active prices
  const activePrices = priceListAggregate.state.prices.filter(p => p.isActive);

  // Format the data according to the API contract
  const formattedData = activePrices.map((price) => ({
    id: price.modelName,
    object: "model" as const,
    created: Math.floor(priceListAggregate.state.createdAt.getTime() / 1000), // Convert Date to Unix timestamp
    owned_by: price.modelName.split("/")[1] || "unknown", // Simple heuristic for owned_by
    pricing: {
      prompt: `${(Number(price.inputPriceKopecksPer1M) / 100).toFixed(2)} RUB/1M tokens`,
      completion: `${(Number(price.outputPriceKopecksPer1M) / 100).toFixed(2)} RUB/1M tokens`,
    },
  }));

  return GetModelsQueryOutputSchema.parse({
    object: "list",
    data: formattedData,
  });
};