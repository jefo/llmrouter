import { z } from "zod";
import { usePort } from "../../lib/di";
import { UserId, User, FindUserByTelegramIdPort, SaveUserPort } from "../../domain/user.agg";
import { UserAlreadyExistsError, InternalServerError } from "../../domain/errors";

// Input schema for RegisterUserCommand
export const RegisterUserCommandInputSchema = z.object({
  telegramId: z.number().int().positive(),
});
export type RegisterUserCommandInput = z.infer<typeof RegisterUserCommandInputSchema>;

// Output schema for RegisterUserCommand
export const RegisterUserCommandOutputSchema = z.object({
  userId: z.string().uuid(),
  apiKey: z.string(),
});
export type RegisterUserCommandOutput = z.infer<typeof RegisterUserCommandOutputSchema>;

/**
 * Use case to register a new user and generate their first API key.
 */
export const RegisterUserCommand = async (
  input: RegisterUserCommandInput
): Promise<RegisterUserCommandOutput> => {
  // Get port implementations via DI
  const findUserByTelegramId = usePort(FindUserByTelegramIdPort);
  const saveUser = usePort(SaveUserPort);

  // Check if user already exists
  const existingUser = await findUserByTelegramId(input.telegramId);
  if (existingUser) {
    throw new UserAlreadyExistsError(`User with telegramId ${input.telegramId} already exists.`);
  }

  // Create a new User aggregate instance using the overridden User.create
  // This now handles initial API key generation and setting default properties
  const newUser = User.create({
    telegramId: input.telegramId,
    // tokenBalance and apiKeys will be set by the overridden User.create
  });

  // Extract the generated API key from the instance (attached by the overridden User.create)
  const generatedApiKey = (newUser as any)._generatedApiKey;

  if (!generatedApiKey) {
    throw new InternalServerError("Failed to generate API key during user registration.");
  }

  // Save the new user
  await saveUser(newUser);

  return {
    userId: newUser.state.id,
    apiKey: generatedApiKey,
  };
};
