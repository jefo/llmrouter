import { z } from "zod";
import { randomUUID, createHash } from "crypto";

// --- Value Objects and Schemas ---

/**
 * Схема для UserId.
 * Используем Zod-бренд для создания номинального типа, что обеспечивает
 * типобезопасность на уровне компиляции.
 */
export const UserIdSchema = z.string().uuid().brand<"UserId">();
export type UserId = z.infer<typeof UserIdSchema>;

/**
 * Фабричная функция для создания UserId.
 * @param id - опциональный UUID. Если не предоставлен, генерируется новый.
 */
export const createUserId = (id?: string): UserId => {
  return UserIdSchema.parse(id || randomUUID());
};

/**
 * Статус API-ключа.
 * - ACTIVE: Ключ активен и может использоваться для запросов.
 * - REVOKED: Ключ отозван и больше не действителен.
 */
export const ApiKeyStatusSchema = z.enum(["ACTIVE", "REVOKED"]);
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;

/**
 * Схема для представления API-ключа.
 * Каждый ключ имеет уникальный ID, хешированное значение, статус и дату создания.
 */
export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  hashedKey: z.string(),
  status: ApiKeyStatusSchema,
  createdAt: z.date(),
});
export type ApiKey = z.infer<typeof ApiKeySchema>;

/**
 * Схема свойств для агрегата User.
 * Валидирует инварианты на уровне данных.
 */
export const UserPropsSchema = z.object({
  id: UserIdSchema,
  telegramId: z.number().int().positive(),
  tokenBalance: z.number().int().min(0, "Token balance cannot be negative"),
  apiKeys: z.array(ApiKeySchema),
});
export type UserProps = z.infer<typeof UserPropsSchema>;

// --- Aggregate Root ---

/**
 * Агрегат User.
 * Центральная сущность в контексте "Billing & Access".
 * Управляет жизненным циклом API-ключей и балансом токенов пользователя.
 */
export class UserAggregate {
  static name: string = "User";
  private props: UserProps;

  private constructor(props: UserProps) {
    // Валидация инвариантов при создании или восстановлении объекта
    UserPropsSchema.parse(props);
    this.props = props;
  }

  /**
   * Фабричный метод для создания нового пользователя.
   * @param telegramId - Уникальный идентификатор пользователя в Telegram.
   * @param initialTokenBalance - Начальный баланс токенов.
   * @returns Экземпляр класса User и сгенерированный API-ключ.
   */
  public static create(
    telegramId: number,
    initialTokenBalance = 10000
  ): { user: UserAggregate; apiKey: string } {
    const { apiKey, hashedApiKey } = UserAggregate.generateHashedApiKey();

    const user = new UserAggregate({
      id: createUserId(),
      telegramId,
      tokenBalance: initialTokenBalance,
      apiKeys: [
        {
          id: randomUUID(),
          hashedKey: hashedApiKey,
          status: "ACTIVE",
          createdAt: new Date(),
        },
      ],
    });

    return { user, apiKey };
  }

  /**
   * Восстанавливает существующего пользователя из хранилища.
   * @param props - Свойства пользователя.
   * @returns Экземпляр класса User.
   */
  public static restore(props: UserProps): UserAggregate {
    return new UserAggregate(props);
  }

  /**
   * Генерирует новый API-ключ для пользователя.
   * @returns Сгенерированный API-ключ (нехешированный).
   */
  public generateApiKey(): { apiKey: string } {
    if (this.props.apiKeys.filter((k) => k.status === "ACTIVE").length >= 5) {
      throw new Error("User cannot have more than 5 active API keys.");
    }

    const { apiKey, hashedApiKey } = UserAggregate.generateHashedApiKey();

    const newKey: ApiKey = {
      id: randomUUID(),
      hashedKey: hashedApiKey,
      status: "ACTIVE",
      createdAt: new Date(),
    };

    this.props.apiKeys.push(newKey);
    // В реальном приложении здесь бы публиковалось событие ApiKeyGenerated
    return { apiKey };
  }

  /**
   * Отзывает API-ключ.
   * @param apiKeyId - ID ключа, который нужно отозвать.
   */
  public revokeApiKey(apiKeyId: string): void {
    const key = this.props.apiKeys.find((k) => k.id === apiKeyId);

    if (!key) {
      throw new Error("API key not found.");
    }
    if (key.status === "REVOKED") {
      // Можно бросить ошибку или просто проигнорировать
      console.warn(`API key ${apiKeyId} is already revoked.`);
      return;
    }

    key.status = "REVOKED";
    // В реальном приложении здесь бы публиковалось событие ApiKeyRevoked
  }

  /**
   * Списывает токены с баланса пользователя.
   * @param amount - Количество токенов для списания.
   */
  public debitTokens(amount: number): void {
    if (amount <= 0) {
      throw new Error("Amount must be positive.");
    }
    if (this.props.tokenBalance < amount) {
      throw new Error("Insufficient token balance."); // 402 Payment Required
    }
    this.props.tokenBalance -= amount;
  }

  /**
   * Пополняет баланс токенов пользователя.
   * @param amount - Количество токенов для начисления.
   */
  public creditTokens(amount: number): void {
    if (amount <= 0) {
      throw new Error("Amount must be positive.");
    }
    this.props.tokenBalance += amount;
  }

  /**
   * Проверяет, действителен ли предоставленный API-ключ.
   * @param apiKey - Ключ для проверки.
   * @returns true, если ключ активен.
   */
  public isApiKeyValid(apiKey: string): boolean {
    const hashedKey = UserAggregate.hashApiKey(apiKey);
    return this.props.apiKeys.some(
      (k) => k.hashedKey === hashedKey && k.status === "ACTIVE"
    );
  }

  // --- Вспомогательные методы ---

  private static generateHashedApiKey(): {
    apiKey: string;
    hashedApiKey: string;
  } {
    const apiKey = `sk-${randomUUID()}`;
    const hashedApiKey = UserAggregate.hashApiKey(apiKey);
    return { apiKey, hashedApiKey };
  }

  private static hashApiKey(apiKey: string): string {
    return createHash("sha256").update(apiKey).digest("hex");
  }

  // --- Геттеры для доступа к состоянию ---

  public get id(): UserId {
    return this.props.id;
  }

  public get telegramId(): number {
    return this.props.telegramId;
  }

  public get tokenBalance(): number {
    return this.props.tokenBalance;
  }

  public get apiKeys(): Readonly<ApiKey[]> {
    return this.props.apiKeys;
  }

  /**
   * Возвращает состояние агрегата для сохранения в БД.
   * ВАЖНО: При сохранении нужно будет преобразовать UserId в строку.
   * Например: { ...user.getProps(), id: user.id.value }
   */
  public getProps(): UserProps {
    return { ...this.props };
  }
}

export interface IUserRepo {
  save(user: UserAggregate): Promise<void>;
  findById(id: UserId): Promise<UserAggregate | null>;
  findByTelegramId(telegramId: number): Promise<UserAggregate | null>;
}
