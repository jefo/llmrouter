import { z } from "zod";
import { randomUUID } from "crypto";
import { UserId, UserIdSchema } from "./user.agg";

// --- Value Objects and Schemas ---

/**
 * Схема для QuotaId.
 * Используем Zod-бренд для создания номинального типа, что обеспечивает
 * типобезопасность на уровне компиляции.
 */
export const QuotaIdSchema = z.uuid().brand<"QuotaId">();
export type QuotaId = z.infer<typeof QuotaIdSchema>;

/**
 * Фабричная функция для создания QuotaId.
 * @param id - опциональный UUID. Если не предоставлен, генерируется новый.
 */
export const createQuotaId = (id?: string): QuotaId => {
  return QuotaIdSchema.parse(id || randomUUID());
};

/**
 * Схема свойств для агрегата Quota.
 * Валидирует инварианты на уровне данных.
 */
export const QuotaPropsSchema = z.object({
  id: QuotaIdSchema,
  userId: UserIdSchema,
  requestsCount: z.number().int().min(0),
  lastResetTime: z.date(),
  // Можно добавить другие параметры квоты, например, лимит запросов в секунду/минуту
  // rateLimit: z.number().int().positive(),
  // timeWindowSeconds: z.number().int().positive(),
});
export type QuotaProps = z.infer<typeof QuotaPropsSchema>;

// --- Aggregate Root ---

/**
 * Агрегат Quota.
 * Управляет состоянием квот пользователя для Rate Limiting.
 */
export class QuotaAggregate {
  static name: string = "Quota";
  private props: QuotaProps;

  private constructor(props: QuotaProps) {
    // Валидация инвариантов при создании или восстановлении объекта
    QuotaPropsSchema.parse(props);
    this.props = props;
  }

  /**
   * Фабричный метод для создания новой квоты для пользователя.
   * @param userId - ID пользователя, для которого создается квота.
   * @returns Экземпляр класса Quota.
   */
  public static create(userId: UserId): QuotaAggregate {
    return new QuotaAggregate({
      id: createQuotaId(),
      userId,
      requestsCount: 0,
      lastResetTime: new Date(),
    });
  }

  /**
   * Восстанавливает существующую квоту из хранилища.
   * @param props - Свойства квоты.
   * @returns Экземпляр класса Quota.
   */
  public static restore(props: QuotaProps): QuotaAggregate {
    return new QuotaAggregate(props);
  }

  /**
   * Увеличивает счетчик запросов.
   */
  public recordRequest(): void {
    this.props.requestsCount++;
  }

  /**
   * Сбрасывает счетчик запросов и обновляет время последнего сброса.
   */
  public resetQuota(): void {
    this.props.requestsCount = 0;
    this.props.lastResetTime = new Date();
  }

  // --- Геттеры для доступа к состоянию ---

  public get id(): QuotaId {
    return this.props.id;
  }

  public get userId(): UserId {
    return this.props.userId;
  }

  public get requestsCount(): number {
    return this.props.requestsCount;
  }

  public get lastResetTime(): Date {
    return this.props.lastResetTime;
  }

  /**
   * Возвращает состояние агрегата для сохранения в БД.
   */
  public getProps(): QuotaProps {
    return { ...this.props };
  }
}
