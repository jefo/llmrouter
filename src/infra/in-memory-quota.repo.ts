import { IQuotaRepository } from "@/domain/interfaces";
import { UserId } from "@/domain/user.agg";
import { QuotaAggregate, QuotaProps } from "@/domain/quota.agg";

export class InMemoryQuotaRepo implements IQuotaRepository {
  private quotas = new Map<UserId, QuotaAggregate>();
  private readonly RATE_LIMIT_PER_MINUTE = 5; // Пример: 5 запросов в минуту

  async findByUserId(userId: UserId): Promise<QuotaAggregate | null> {
    return this.quotas.get(userId) || null;
  }

  async save(quota: QuotaAggregate): Promise<void> {
    this.quotas.set(quota.userId, quota);
  }

  async checkAndIncrement(userId: UserId): Promise<boolean> {
    let quota = await this.findByUserId(userId);

    if (!quota) {
      quota = QuotaAggregate.create(userId);
      await this.save(quota);
    }

    const now = new Date();
    const lastResetTime = quota.lastResetTime;

    // Проверяем, нужно ли сбросить счетчик (например, если прошла минута)
    if (now.getTime() - lastResetTime.getTime() > 60 * 1000) {
      quota.resetQuota();
    }

    if (quota.requestsCount < this.RATE_LIMIT_PER_MINUTE) {
      quota.recordRequest();
      await this.save(quota);
      return true;
    } else {
      return false; // Лимит превышен
    }
  }

  // Вспомогательный метод для тестов
  public clear(): void {
    this.quotas.clear();
  }
}
