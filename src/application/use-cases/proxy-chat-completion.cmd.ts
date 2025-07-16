import z from "zod";
import { useRepository, useService } from "@/lib/di";
import { UserAggregate, IUserRepo, UserId } from "@/domain/user.agg";
import { PriceListAggregate, IPriceListRepo } from "@/domain/pricelist.agg";
import { TransactionAggregate, ITransactionRepository } from "@/domain/transaction.agg";
import { IQuotaRepository, LlmRouterAdapter, IBalanceCalculator, IUsageCostCalculator } from "@/domain/interfaces";
import { 
  RateLimitExceededError, 
  InvalidApiKeyError, 
  InsufficientFundsError, 
  ProviderError 
} from "@/domain/errors";
import { IQuotaRepositoryToken, LlmRouterAdapterToken, IBalanceCalculatorToken, IUsageCostCalculatorToken } from "@/domain/repository-tokens";
import { Usage } from "@/domain/usage.vo";

export const proxyChatCompletionCmdSchema = z.object({
  apiKey: z.string(),
  payload: z.any(), // TODO: Define a more specific schema for the LLM payload
});
export type ProxyChatCompletionCmd = z.infer<typeof proxyChatCompletionCmdSchema>;

export const proxyChatCompletion = async (
  dto: ProxyChatCompletionCmd
): Promise<any> => {
  const userRepo = useRepository<IUserRepo>(UserAggregate);
  const quotaRepo = useRepository<IQuotaRepository>(IQuotaRepositoryToken);
  const priceListRepo = useRepository<IPriceListRepo>(PriceListAggregate);
  const transactionRepo = useRepository<ITransactionRepository>(TransactionAggregate);
  const llmRouterAdapter = useRepository<LlmRouterAdapter>(LlmRouterAdapterToken);
  const balanceCalculator = useRepository<IBalanceCalculator>(IBalanceCalculatorToken);
  const usageCostCalculator = useRepository<IUsageCostCalculator>(IUsageCostCalculatorToken);

  // 1. Check Rate Limit
  // Для MVP, InMemoryQuotaRepo всегда возвращает true, но в реальной жизни здесь будет проверка
  const rateLimitOk = await quotaRepo.checkAndIncrement(dto.apiKey as UserId); // TODO: Quota check should be by user ID, not API key
  if (!rateLimitOk) {
    throw new RateLimitExceededError();
  }

  // 2. Authorize
  const user = await userRepo.findByApiKey(dto.apiKey);
  if (!user) {
    throw new InvalidApiKeyError();
  }
  

  // 3. Check Balance
  const currentBalance = await balanceCalculator.calculateFor(user.id);
  if (currentBalance <= 0) {
    throw new InsufficientFundsError();
  }

  // 4. Proxy to Provider
  let providerResponse: any;
  let usageData: Usage;
  try {
    const { response, usage } = await llmRouterAdapter.proxyChatCompletion(dto.payload);
    providerResponse = response;
    usageData = usage;
  } catch (error: any) {
    throw new ProviderError(error.message || "Unknown provider error");
  }

  // 5. Atomic Write Operation (DB Transaction)
  // В реальном приложении это будет обернуто в транзакцию БД
  const priceList = await priceListRepo.findActive();
  if (!priceList) {
    throw new Error("Active PriceList not found for cost calculation.");
  }

  // TODO: мы хотим сохранять в БД оригинальные данные usage для надежности
  // мы НЕ будем сохранять их в транзакции, а просто используем для расчета баланса в ЛК пользователя и перед выполнения запроса к Роутеру
  const cost = usageCostCalculator.calculate(usageData, priceList);
  
  // Создаем транзакцию с отрицательной стоимостью
  const transaction = TransactionAggregate.createUsage(
    user.id,
    usageData,
    -cost, // Стоимость должна быть отрицательной для списания
    "COMPLETED"
  );
  await transactionRepo.save(transaction);

  // Обновляем баланс пользователя
  user.debitTokens(cost);
  await userRepo.save(user);

  // 6. Return Response
  return providerResponse;
};
