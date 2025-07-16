import z from "zod";
import { UserAggregate, UserId, IUserRepo } from "@/domain/user.agg";
import { UserNotFoundError } from "@/domain/errors";
import { useRepository } from "@/lib/di";

export const revokeAndGenerateApiKeyCmdSchema = z.object({
  userId: UserId,
});
export type RevokeAndGenerateApiKeyCmd = z.infer<
  typeof revokeAndGenerateApiKeyCmdSchema
>;

export const revokeAndGenerateApiKey = async (
  dto: RevokeAndGenerateApiKeyCmd
): Promise<{ apiKey: string }> => {
  const userRepo = useRepository<IUserRepo>(UserAggregate);

  // 1. Найти пользователя по userId
  const user = await userRepo.findById(dto.userId);
  if (!user) {
    throw new UserNotFoundError(dto.userId);
  }

  // 2. Отозвать все активные API-ключи пользователя
  user.revokeAllActiveApiKeys();

  // 3. Сгенерировать новый API-ключ
  const { apiKey } = user.generateApiKey();

  // 4. Сохранить обновленного пользователя
  await userRepo.save(user);

  // 5. Вернуть новый API-ключ
  return { apiKey };
};
