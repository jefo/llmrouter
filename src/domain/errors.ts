import { z } from 'zod';

// Existing errors (if any) would be here.
// For now, assuming this file is new or can be overwritten for this example.

export class DomainError extends Error {
  constructor(message: string, public code: string, public type: string, public param: string | null = null) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class InvalidApiKeyError extends DomainError {
  constructor(message: string = "Invalid API key provided.") {
    super(message, "invalid_api_key", "auth_error");
  }
}

export class InsufficientFundsError extends DomainError {
  constructor(message: string = "Your balance is below zero. Please top up your account to continue using the API.") {
    super(message, "insufficient_funds", "billing_error");
  }
}

export class UserLockedError extends DomainError {
  constructor(message: string = "Your account is locked due to a negative balance.") {
    super(message, "user_locked", "billing_error");
  }
}

export class RateLimitExceededError extends DomainError {
  constructor(message: string = "You have exceeded the rate limit. Please try again later.") {
    super(message, "rate_limit_exceeded", "rate_limit_error");
  }
}

export class InvalidRequestError extends DomainError {
  constructor(message: string = "Invalid request payload or parameters.") {
    super(message, "invalid_request", "request_error");
  }
}

export class UserAlreadyExistsError extends DomainError {
  constructor(message: string = "User with this identifier already exists.") {
    super(message, "user_already_exists", "auth_error");
  }
}

export class InternalServerError extends DomainError {
  constructor(message: string = "An unexpected error occurred. Please contact support.") {
    super(message, "internal_server_error", "api_error");
  }
}