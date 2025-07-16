import { IBalanceCalculator, ITransactionRepository, IPriceListRepository, IUsageCostCalculator } from "../interfaces";
import { UserId } from "../user.agg";
import { TransactionType } from "../transaction.agg";
import { useRepository, useService } from "@/lib/di";
import { PriceListAggregate } from "../pricelist.agg";

export class BalanceCalculator implements IBalanceCalculator {
  private transactionRepo: ITransactionRepository;
  private priceListRepo: IPriceListRepository;
  private usageCostCalculator: IUsageCostCalculator;

  constructor(
    transactionRepo: ITransactionRepository,
    priceListRepo: IPriceListRepository,
    usageCostCalculator: IUsageCostCalculator
  ) {
    this.transactionRepo = transactionRepo;
    this.priceListRepo = priceListRepo;
    this.usageCostCalculator = usageCostCalculator;
  }

  async calculateFor(userId: UserId): Promise<number> {
    const transactions = await this.transactionRepo.findAllByUserId(userId);
    const priceList = await this.priceListRepo.findActive();

    if (!priceList) {
      // Если прайс-лист не найден, это критическая ошибка конфигурации
      throw new Error("Active PriceList not found.");
    }

    let balance = 0;

    for (const transaction of transactions) {
      if (transaction.status === "COMPLETED") {
        if (transaction.data.type === "top-up") {
          balance += transaction.data.amountCredits;
        } else if (transaction.data.type === "usage") {
          // Пересчитываем стоимость использования на лету, используя актуальный прайс-лист
          // Это гарантирует, что изменения в ценах не повлияют на уже списанные транзакции
          // Новые транзакции будут использовать новые цены
          const cost = this.usageCostCalculator.calculate(
            transaction.data.usageData,
            priceList
          );
          balance += cost; // cost уже отрицательный
        }
      }
    }

    return balance;
  }
}
