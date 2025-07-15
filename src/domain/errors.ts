export class UserAlreadyExistsError extends Error {
  constructor(telegramId: number) {
    super(`User with telegramId ${telegramId} already exists.`);
    this.name = "UserAlreadyExistsError";
  }
}
