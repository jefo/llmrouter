import { describe, it, expect, beforeEach } from "vitest";
import { resetContainer, registerRepositories, useRepository } from "@/lib/di";
import { UserAggregate, IUserRepo } from "@/domain/user.agg";
import { InMemoryUserRepo } from "@/infra/in-memory-user.repo";
import { revokeAndGenerateApiKey, RevokeAndGenerateApiKeyCmd } from "@/application/use-cases/revoke-and-generate-api-key.cmd";
import { UserNotFoundError } from "@/domain/errors";

describe("RevokeAndGenerateApiKeyUseCase", () => {
  let userRepo: InMemoryUserRepo;

  beforeEach(() => {
    resetContainer();
    registerRepositories([[UserAggregate, InMemoryUserRepo]]);
    userRepo = useRepository<InMemoryUserRepo>(UserAggregate);
  });

  // --- Happy Path ---
  it("should revoke all active API keys and generate a new one", async () => {
    // Arrange: Создаем пользователя с несколькими ключами
    const { user: initialUser, apiKey: initialApiKey1 } = UserAggregate.create(123);
    initialUser.generateApiKey(); // Генерируем второй ключ
    await userRepo.save(initialUser);

    const cmd: RevokeAndGenerateApiKeyCmd = { userId: initialUser.id };

    // Act
    const result = await revokeAndGenerateApiKey(cmd);

    // Assert
    expect(result).toHaveProperty("apiKey");
    expect(result.apiKey).toMatch(/^sk-.*/);
    expect(result.apiKey).not.toBe(initialApiKey1); // Новый ключ отличается от старого

    const updatedUser = await userRepo.findById(initialUser.id);
    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.apiKeys.length).toBe(3); // Изначально 1 + 1 сгенерированный + 1 новый
    expect(updatedUser!.apiKeys.filter(k => k.status === "ACTIVE").length).toBe(1); // Только один активный ключ
    expect(updatedUser!.apiKeys.find(k => k.hashedKey === UserAggregate["hashApiKey"](result.apiKey))).not.toBeUndefined(); // Новый ключ присутствует и активен
  });

  // --- Edge Case: User not found ---
  it("should throw UserNotFoundError if user does not exist", async () => {
    const cmd: RevokeAndGenerateApiKeyCmd = { userId: "non-existent-id" };

    await expect(revokeAndGenerateApiKey(cmd)).rejects.toThrow(UserNotFoundError);
  });

  // --- Edge Case: User with no active keys ---
  it("should generate a new key even if no active keys exist", async () => {
    // Arrange: Создаем пользователя, отзываем все ключи
    const { user: initialUser } = UserAggregate.create(123);
    initialUser.revokeAllActiveApiKeys();
    await userRepo.save(initialUser);

    const cmd: RevokeAndGenerateApiKeyCmd = { userId: initialUser.id };

    // Act
    const result = await revokeAndGenerateApiKey(cmd);

    // Assert
    expect(result).toHaveProperty("apiKey");
    expect(result.apiKey).toMatch(/^sk-.*/);

    const updatedUser = await userRepo.findById(initialUser.id);
    expect(updatedUser).not.toBeNull();
    expect(updatedUser!.apiKeys.length).toBe(2); // Изначально 1 (отозванный) + 1 новый
    expect(updatedUser!.apiKeys.filter(k => k.status === "ACTIVE").length).toBe(1); // Только один активный ключ
  });
});
