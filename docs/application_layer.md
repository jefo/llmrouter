# Application Layer Documentation

## 1. Application Layer Principles

- **Thin Layer**: Coordinates but doesn't contain business rules.
- **Domain Isolation**: Only layer that can directly call domain aggregates and services.
- **Infrastructure Agnostic**: Depends on interfaces (ports), not concrete implementations (adapters).
- **Command/Query-Oriented**: Each use case handles a Command (write) or Query (read) representing user intent.

## 2. Use Cases (Commands & Queries)

### 2.1. Register New User
- **Name**: `RegisterNewUserUseCase`
- **Actor**: User (via Telegram bot)
- **Purpose**: Create an account and get the first API key.
- **Command**: `RegisterUserCommand { telegramId: number }`
- **Flow**:
    1. Check if User already exists (`IUserRepository.findByTelegramId`).
    2. If not, create a new `User` aggregate.
    3. Generate an API key (`user.generateApiKey()`).
    4. Save the user (`IUserRepository.save`).
    5. Return the new API key.
- **Errors**: `UserAlreadyExistsError`.

### 2.2. Revoke and Generate API Key
- **Name**: `RevokeAndGenerateApiKeyUseCase`
- **Actor**: User (via Telegram bot)
- **Purpose**: Deactivate the old key and issue a new one.
- **Command**: `RevokeAndGenerateApiKeyCommand { userId: string }`
- **Flow**:
    1. Find `User` (`IUserRepository.findById`).
    2. Call `user.revokeApiKey()` and `user.generateApiKey()`.
    3. Save the user (`IUserRepository.save`).
    4. Return the new API key.
- **Errors**: `UserNotFoundError`.

### 2.3. Proxy LLM Request
- **Name**: `ProxyChatCompletionUseCase`
- **Actor**: User (via API)
- **Purpose**: Get an LLM response after all checks and atomically record usage.
- **Dependencies**: `IQuotaRepository`, `IUserRepository`, `IPriceListRepository`, `ITransactionRepository`, `BalanceCalculator`, `UsageCostCalculator`, `LlmRouterAdapter`.
- **Errors**: `RateLimitExceededError`, `InvalidApiKeyError`, `UserIsLockedError`, `InsufficientFundsError`, `ProviderError`.
- **Flow**:
    1. **Check Rate Limit**: Use `IQuotaRepository`.
    2. **Authorize**: Find `User` by API key. Check `is_locked` status.
    3. **Check Balance**: Use `BalanceCalculator` to get current balance. If balance is zero or negative, reject.
    4. **Proxy to Provider**: Forward request to `LlmRouterAdapter`.
        - On provider error, return `ProviderError`. **No state is changed.**
        - On success, receive `usage_data` from provider.
    5. **Atomic Write Operation (DB Transaction)**:
        a. Calculate `cost` from `usage_data` using `UsageCostCalculator`.
        b. Create a new `Transaction` of type `usage` with the `usage_data` and calculated `cost`.
        c. Save the new `Transaction` via `ITransactionRepository`.
        d. Recalculate the new balance. If it's now negative, update the `user` aggregate by calling `user.lock()`.
        e. Save the updated `user` state via `IUserRepository`.
    6. **Return Response**: Return the original provider response to the client.

### 2.4. Initiate Balance Top-Up
- **Name**: `InitiateTopUpUseCase`
- **Actor**: User (via Telegram bot)
- **Purpose**: Get a payment link for balance top-up.
- **Command**: `InitiateTopUpCommand { userId: string, amount: Money }`
- **Flow**:
    1. Find `User`.
    2. Create a `PENDING` `Transaction`.
    3. Save `Transaction` (`ITransactionRepository.save`).
    4. Get payment link from `IPaymentGatewayAdapter`.
    5. Return payment link.

### 2.5. Confirm Top-Up (Webhook)
- **Name**: `ConfirmTopUpUseCase`
- **Actor**: Payment System (Telegram Pay)
- **Purpose**: Complete a transaction and credit funds to the user's balance.
- **Command**: `ConfirmTopUpCommand { providerPaymentId: string, status: 'completed' | 'failed', amount: Money }`
- **Flow**:
    1. Find `Transaction` by `providerPaymentId`.
    2. Mark transaction as `completed`.
    3. Save `Transaction`.
    4. Publish `BalanceToppedUp` event.
- **Errors**: `TransactionNotFoundError`, `TransactionAlreadyProcessedError`.

### 2.6. Get Models List (Query)
- **Name**: `GetModelsListUseCase`
- **Actor**: User (via API)
- **Purpose**: Get a list of available models and their prices.
- **Query**: `GetModelsListQuery {}`
- **Flow**:
    1. Fetch the active `PriceList` from `IPriceListRepository`.
    2. Format the data according to the API contract in `2_API_Contracts.md`.
    3. Return the list.

### 2.7. Check User Balance (Query)
- **Name**: `CheckBalanceUseCase`
- **Actor**: User (via Telegram bot)
- **Purpose**: Get the current balance in RUB.
- **Query**: `CheckBalanceQuery { userId: string }`
- **Flow**:
    1. Find all transactions for the user (`ITransactionRepository.getTransactionsFor(userId)`).
    2. Calculate the sum of all transactions (positive for top-ups, negative for usage).
    3. Return the final balance.
