export class UserAlreadyExistsError extends Error {
  constructor(telegramId: number) {
    super(`User with telegramId ${telegramId} already exists.`);
    this.name = "UserAlreadyExistsError";
  }
}

export class UserNotFoundError extends Error {
  constructor(userId: string) {
    super(`User with ID ${userId} not found.`);
    this.name = "UserNotFoundError";
  }
}

export class RateLimitExceededError extends Error {
  constructor() {
    super("You have exceeded the rate limit. Please try again later.");
    this.name = "RateLimitExceededError";
  }
}

export class InvalidApiKeyError extends Error {
  constructor() {
    super("Invalid API key provided.");
    this.name = "InvalidApiKeyError";
  }
}



export class InsufficientFundsError extends Error {
  constructor() {
    super("Your balance is below zero. Please top up your account to continue using the API.");
    this.name = "InsufficientFundsError";
  }
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(`Provider error: ${message}`);
    this.name = "ProviderError";
  }
}
