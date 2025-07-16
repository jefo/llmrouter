import z from "zod";
import { UserAggregate } from "@/domain/user.agg";
import { IUserRepo } from "@/domain/user.agg"; // Import the interface
import { UserAlreadyExistsError } from "@/domain/errors"; // Import the custom error
import { useRepository } from "@/lib/di";

export const registerUserCmdSchema = z.object({
  telegramId: z.number().int().positive(),
});
export type RegisterUserCmd = z.infer<typeof registerUserCmdSchema>;

export const registerUser = async (
  dto: RegisterUserCmd
): Promise<{ apiKey: string }> => {
  const userRepo = useRepository<IUserRepo>(UserAggregate); // Use IUserRepo interface

  // 1. Проверить существование пользователя
  const existingUser = await userRepo.findByTelegramId(dto.telegramId);
  if (existingUser) {
    throw new UserAlreadyExistsError(dto.telegramId);
  }

  // 2. Создать новый агрегат User
  const { user, apiKey } = UserAggregate.create(dto.telegramId);

  // 3. Сохранить агрегат User
  await userRepo.save(user);

  // 4. Вернуть API-ключ
  return { apiKey };
};
