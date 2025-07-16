import { ITransactionRepository } from "@/domain/interfaces";
import { TransactionAggregate, TransactionId } from "@/domain/transaction.agg";
import { UserId } from "@/domain/user.agg";

export class InMemoryTransactionRepo implements ITransactionRepository {
  private transactions = new Map<TransactionId, TransactionAggregate>();

  async save(transaction: TransactionAggregate): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async findAllByUserId(userId: UserId): Promise<TransactionAggregate[]> {
    return Array.from(this.transactions.values()).filter(
      (t) => t.userId === userId
    );
  }

  // Helper for tests
  public clear(): void {
    this.transactions.clear();
  }
}
