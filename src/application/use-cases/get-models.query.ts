import {
  IPriceListRepo,
  PriceListAggregate,
} from "./../../domain/pricelist.agg";
import { useRepository } from "@/lib/di";

// --- DTOs ---

export type ModelDto = {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
  pricing: {
    prompt: string; // e.g., "350.00 RUB/1M tokens"
    completion: string; // e.g., "1050.00 RUB/1M tokens"
  };
};

export type GetModelsListResponseDto = {
  object: "list";
  data: ModelDto[];
};

// --- Query ---

export const getModelsList = async (): Promise<GetModelsListResponseDto> => {
  const priceListRepo = useRepository<IPriceListRepo>(PriceListAggregate);
  const priceList = await priceListRepo.findActive();
  if (!priceList) {
    return { object: "list", data: [] };
  }
  const activePrices = priceList.getActivePrices();
  const modelDtos: ModelDto[] = activePrices.map((price) => ({
    id: price.modelName,
    object: "model",
    created: Math.floor(Date.now() / 1000), // Placeholder
    owned_by: price.modelName.split("/")[0] || "unknown",
    pricing: {
      prompt: `${price.inputPriceCreditsPer1M.toFixed(
        2
      )} Credits/1M tokens`,
      completion: `${price.outputPriceCreditsPer1M.toFixed(
        2
      )} Credits/1M tokens`,
    },
  }));
  return { object: "list", data: modelDtos };
};
