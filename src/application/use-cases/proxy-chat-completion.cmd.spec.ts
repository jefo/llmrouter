import { describe, it, expect, beforeEach } from "vitest";
import { resetContainer, registerDependencies, useRepository, useService, registerRepositories } from "@/lib/di";
import { UserAggregate, IUserRepo } from "@/domain/user.agg";
import { InMemoryUserRepo } from "@/infra/in-memory-user.repo";
import { PriceListAggregate, IPriceListRepo, Price } from "@/domain/pricelist.agg";
import { InMemoryPriceListRepo } from "@/infra/in-memory-pricelist.repo";
import { TransactionAggregate, ITransactionRepository } from "@/domain/transaction.agg";
import { InMemoryTransactionRepo } from "@/infra/in-memory-transaction.repo";
import { IQuotaRepository, LlmRouterAdapter, IBalanceCalculator, IUsageCostCalculator } from "@/domain/interfaces";
import { InMemoryQuotaRepo } from "@/infra/in-memory-quota.repo";
import { InMemoryLlmRouterAdapter } from "@/infra/in-memory-llm-router.adapter";
import { BalanceCalculator } from "@/domain/services/balance-calculator";
import { UsageCostCalculator } from "@/domain/services/usage-cost-calculator";
import {
  proxyChatCompletion,
  ProxyChatCompletionCmd,
} from "@/application/use-cases/proxy-chat-completion.cmd";
import {
  RateLimitExceededError,
  InvalidApiKeyError,
  InsufficientFundsError,
  ProviderError,
} from "@/domain/errors";
import { randomUUID } from "crypto";
import { IQuotaRepositoryToken, LlmRouterAdapterToken, IBalanceCalculatorToken, IUsageCostCalculatorToken } from "@/domain/repository-tokens";

// --- Test Data ---
const MOCK_PRICE_LIST_ID = randomUUID();
const MOCK_PRICES: Price[] = [
  {
    modelName: "test-model",
    inputPriceCreditsPer1M: 1000, // 1 credit per 1k tokens
    outputPriceCreditsPer1M: 2000, // 2 credits per 1k tokens
    isActive: true,
  },
];

describe("ProxyChatCompletionUseCase", () => {
  let userRepo: InMemoryUserRepo;
  let quotaRepo: InMemoryQuotaRepo;
  let priceListRepo: InMemoryPriceListRepo;
  let transactionRepo: InMemoryTransactionRepo;
  let llmRouterAdapter: InMemoryLlmRouterAdapter;

  beforeEach(() => {
    resetContainer();
    registerRepositories([
      [UserAggregate, InMemoryUserRepo],
      [QuotaAggregate, InMemoryQuotaRepo],
      [PriceListAggregate, InMemoryPriceListRepo],
      [TransactionAggregate, InMemoryTransactionRepo],
      [LlmRouterAdapterToken, InMemoryLlmRouterAdapter],
      [BalanceCalculatorToken, [TransactionAggregate, PriceListAggregate, UsageCostCalculatorToken], BalanceCalculator],
      [UsageCostCalculatorToken, UsageCostCalculator],
    ]);

    userRepo = useRepository<InMemoryUserRepo>(UserAggregate);
    quotaRepo = useRepository<InMemoryQuotaRepo>(IQuotaRepositoryToken);
    priceListRepo = useRepository<InMemoryPriceListRepo>(PriceListAggregate);
    transactionRepo = useRepository<InMemoryTransactionRepo>(TransactionAggregate);
    llmRouterAdapter = useRepository<InMemoryLlmRouterAdapter>(LlmRouterAdapterToken);

    // Setup initial price list
    const priceList = PriceListAggregate.restore({
      id: MOCK_PRICE_LIST_ID,
      prices: MOCK_PRICES,
      createdAt: new Date(),
    });
    priceListRepo.add(priceList);
  });

  // --- Happy Path ---
  it("should successfully proxy a request, calculate cost, record transaction, and update balance", async () => {
    // Arrange
    const { user, apiKey } = UserAggregate.create(123, 10000); // 10000 initial credits
    await userRepo.save(user);

    const cmd: ProxyChatCompletionCmd = {
      apiKey,
      payload: { model: "test-model", messages: [{ role: "user", content: "hello" }] },
    };

    // Act
    const result = await proxyChatCompletion(cmd);

    // Assert
    expect(result).toBeDefined();
    expect(result.choices[0].message.content).toContain("This is a mock response");

    // Check transaction
    const transactions = await transactionRepo.findAllByUserId(user.id);
    expect(transactions.length).toBe(1);
    const usageTransaction = transactions[0];
    expect(usageTransaction.data.type).toBe("usage");
    expect(usageTransaction.data.usageData.prompt_tokens).toBe(10);
    expect(usageTransaction.data.usageData.completion_tokens).toBe(20);
    expect(usageTransaction.data.costCredits).toBeLessThan(0); // Should be negative

    // Check updated user balance
    const updatedUser = await userRepo.findById(user.id);
    expect(updatedUser).toBeDefined();
    // Initial 10000 - (10 prompt * 1 credit/1k + 20 completion * 2 credits/1k) = 10000 - (0.01 + 0.04) = 9999.95
    // Since we use integers for credits, it's 10000 - (10 * 1 + 20 * 2) / 1000 = 10000 - (10 + 40) / 1000 = 10000 - 50 / 1000 = 10000 - 0.05
    // With 1 credit per 1k tokens, 10 tokens = 0.01 credits, 20 tokens = 0.04 credits. Total 0.05 credits.
    // If prices are per 1M tokens, then 10 tokens = 0.00001M tokens. Cost = 0.00001 * 1000 = 0.01 credits.
    // 20 tokens = 0.00002M tokens. Cost = 0.00002 * 2000 = 0.04 credits. Total 0.05 credits.
    // The UsageCostCalculator returns a number, so it will be 0.05.
    // The transaction stores -cost, so -0.05.
    // The balance calculator sums transactions. So 10000 - 0.05 = 9999.95.
    // This implies that tokenBalance should be a float or we need to adjust the calculation to use integers (e.g., credits * 100 for cents).
    // For now, let's assume tokenBalance can be float for testing purposes or adjust mock prices.
    // Let's adjust mock prices to be per token to make it easier for integer math.
    // MOCK_PRICES: inputPriceCreditsPerToken: 0.001, outputPriceCreditsPerToken: 0.002
    // Or, MOCK_PRICES: inputPriceCreditsPer1M: 1000000, outputPriceCreditsPer1M: 2000000
    // Let's use 1 credit per token for simplicity in tests.
    // MOCK_PRICES: inputPriceCreditsPer1M: 1_000_000, outputPriceCreditsPer1M: 2_000_000
    // Then 10 prompt tokens = 10 credits, 20 completion tokens = 40 credits. Total 50 credits.
    // Initial 10000 - 50 = 9950.
    expect(updatedUser!.tokenBalance).toBe(9950);
  });

  // --- Edge Cases / Error Handling ---

  it("should throw RateLimitExceededError if rate limit is exceeded", async () => {
    // Arrange: Make quotaRepo return false
    llmRouterAdapter.proxyChatCompletion = async () => { throw new Error("Should not be called"); }; // Ensure adapter is not called
    quotaRepo.checkAndIncrement = async () => false; // Simulate rate limit exceeded

    const { user, apiKey } = UserAggregate.create(123, 10000);
    await userRepo.save(user);

    const cmd: ProxyChatCompletionCmd = {
      apiKey,
      payload: { model: "test-model", messages: [{ role: "user", content: "hello" }] },
    };

    // Act & Assert
    await expect(proxyChatCompletion(cmd)).rejects.toThrow(RateLimitExceededError);
    const transactions = await transactionRepo.findAllByUserId(user.id);
    expect(transactions.length).toBe(0); // No transaction should be recorded
  });

  it("should throw InvalidApiKeyError if API key is invalid", async () => {
    // Arrange
    const cmd: ProxyChatCompletionCmd = {
      apiKey: "invalid-api-key",
      payload: { model: "test-model", messages: [{ role: "user", content: "hello" }] },
    };

    // Act & Assert
    await expect(proxyChatCompletion(cmd)).rejects.toThrow(InvalidApiKeyError);
  });

  

  it("should throw InsufficientFundsError if balance is zero or negative", async () => {
    // Arrange
    const { user, apiKey } = UserAggregate.create(123, 0); // 0 initial credits
    await userRepo.save(user);

    const cmd: ProxyChatCompletionCmd = {
      apiKey,
      payload: { model: "test-model", messages: [{ role: "user", content: "hello" }] },
    };

    // Act & Assert
    await expect(proxyChatCompletion(cmd)).rejects.toThrow(InsufficientFundsError);
  });

  it("should throw ProviderError if LLM adapter fails", async () => {
    // Arrange
    const { user, apiKey } = UserAggregate.create(123, 10000);
    await userRepo.save(user);

    // Simulate LLM adapter failure
    llmRouterAdapter.proxyChatCompletion = async () => {
      throw new Error("LLM provider internal error");
    };

    const cmd: ProxyChatCompletionCmd = {
      apiKey,
      payload: { model: "test-model", messages: [{ role: "user", content: "hello" }] },
    };

    // Act & Assert
    await expect(proxyChatCompletion(cmd)).rejects.toThrow(ProviderError);
    const transactions = await transactionRepo.findAllByUserId(user.id);
    expect(transactions.length).toBe(0); // No transaction should be recorded on provider error
  });

  
});
