import { InMemoryPriceListRepo } from "./../../infra/in-memory-pricelist.repo";
import { Price, PriceListAggregate } from "./../../domain/pricelist.agg";
import { describe, it, expect, beforeEach } from "vitest";
import { registerRepositories, resetContainer, useRepository } from "@/lib/di";

import { getModelsList } from "./get-models.query";
import { randomUUID } from "crypto";

// --- Test Data ---
const mockPrices: Price[] = [
  {
    modelName: "openrouter/openai/gpt-4o",
    inputPriceCreditsPer1M: 350, // 350.00 Credits
    outputPriceCreditsPer1M: 1050, // 1050.00 Credits
    isActive: true,
  },
  {
    modelName: "google/gemini-flash-1.5",
    inputPriceCreditsPer1M: 30,
    outputPriceCreditsPer1M: 60,
    isActive: true,
  },
  {
    modelName: "anthropic/claude-3-haiku",
    inputPriceCreditsPer1M: 20,
    outputPriceCreditsPer1M: 90,
    isActive: false, // This one should be filtered out
  },
];

describe("GetModelsListQuery", () => {
  let priceListRepo: InMemoryPriceListRepo;

  beforeEach(() => {
    resetContainer();
    registerRepositories([[PriceListAggregate, InMemoryPriceListRepo]]);
    priceListRepo = useRepository<InMemoryPriceListRepo>(PriceListAggregate);
  });

  it("should return a list of active models with correct pricing format", async () => {
    // Arrange
    const priceList = PriceListAggregate.restore({
      id: randomUUID(),
      prices: mockPrices,
      createdAt: new Date(),
    });
    priceListRepo.add(priceList);

    // Act
    const result = await getModelsList();

    // Assert
    expect(result.object).toBe("list");
    expect(result.data.length).toBe(2); // Only active models

    const gpt4o = result.data.find((m) => m.id === "openrouter/openai/gpt-4o");
    expect(gpt4o).toBeDefined();
    expect(gpt4o?.pricing.prompt).toBe("350.00 Credits/1M tokens");
    expect(gpt4o?.pricing.completion).toBe("1050.00 Credits/1M tokens");
    expect(gpt4o?.owned_by).toBe("openrouter");

    const gemini = result.data.find((m) => m.id === "google/gemini-flash-1.5");
    expect(gemini).toBeDefined();
    expect(gemini?.pricing.prompt).toBe("30.00 Credits/1M tokens");
  });

  it("should return an empty list if no active pricelist is found", async () => {
    // Arrange: No data in repo

    // Act
    const result = await getModelsList();

    // Assert
    expect(result.object).toBe("list");
    expect(result.data.length).toBe(0);
  });
});
