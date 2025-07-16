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
    inputPriceKopecksPer1M: 35000n, // 350.00 RUB
    outputPriceKopecksPer1M: 105000n, // 1050.00 RUB
    isActive: true,
  },
  {
    modelName: "google/gemini-flash-1.5",
    inputPriceKopecksPer1M: 3000n,
    outputPriceKopecksPer1M: 6000n,
    isActive: true,
  },
  {
    modelName: "anthropic/claude-3-haiku",
    inputPriceKopecksPer1M: 2000n,
    outputPriceKopecksPer1M: 9000n,
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
    expect(gpt4o?.pricing.prompt).toBe("350.00 RUB/1M tokens");
    expect(gpt4o?.pricing.completion).toBe("1050.00 RUB/1M tokens");
    expect(gpt4o?.owned_by).toBe("openrouter");

    const gemini = result.data.find((m) => m.id === "google/gemini-flash-1.5");
    expect(gemini).toBeDefined();
    expect(gemini?.pricing.prompt).toBe("30.00 RUB/1M tokens");
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
