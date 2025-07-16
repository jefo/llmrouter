import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import { resetContainer, registerRepositories, useRepository } from "@/lib/di";
import { UserAggregate, IUserRepo } from "@/domain/user.agg";
import { InMemoryUserRepo } from "@/infra/in-memory-user.repo";
import { registerUser, RegisterUserCmd } from "@/application/use-cases/register-user.cmd";
import { UserAlreadyExistsError } from "@/domain/errors";

describe("RegisterUserUseCase", () => {
  let userRepo: InMemoryUserRepo;

  beforeEach(() => {
    // Сбрасываем DI контейнер и регистрируем зависимости заново
    resetContainer();
    registerRepositories([[UserAggregate, InMemoryUserRepo]]);
    userRepo = useRepository<InMemoryUserRepo>(UserAggregate);
  });

  // --- Happy Path ---
  it("should register a new user and return an API key", async () => {
    const cmd: RegisterUserCmd = { telegramId: 12345 };

    const result = await registerUser(cmd);

    // 1. Проверяем, что результат содержит API-ключ
    expect(result).toHaveProperty("apiKey");
    expect(result.apiKey).toMatch(/^sk-.*/);

    // 2. Проверяем, что пользователь был сохранен в репозитории
    const savedUser = await userRepo.findByTelegramId(cmd.telegramId);
    expect(savedUser).not.toBeNull();
    expect(savedUser!.telegramId).toBe(cmd.telegramId);
    expect(savedUser!.tokenBalance).toBe(10000); // Проверяем начальный баланс
    expect(savedUser!.apiKeys.length).toBe(1);
    expect(savedUser!.apiKeys[0].status).toBe("ACTIVE");
  });

  // --- Edge Case ---
  it("should throw UserAlreadyExistsError if user with the same telegramId exists", async () => {
    // Arrange: создаем пользователя с таким же telegramId
    const existingCmd: RegisterUserCmd = { telegramId: 12345 };
    await registerUser(existingCmd);

    // Act & Assert: пытаемся зарегистрировать еще раз и ожидаем ошибку
    const newCmd: RegisterUserCmd = { telegramId: 12345 };
    await expect(registerUser(newCmd)).rejects.toThrow(UserAlreadyExistsError);
  });
});
