# Application Layer Documentation

## 1. Application Layer Principles

- **Thin Layer**: Coordinates but doesn't contain business rules
- **Domain Isolation**: Only layer that can directly call domain entities/services  
- **Infrastructure Agnostic**: Depends on interfaces, not implementations
- **Command-Oriented**: Each use case handles a Command representing user intent

## 2. Use Cases

### 2.1. Register New User
**Name**: RegisterNewUserUseCase  
**Actor**: User (via Telegram bot)  
**Purpose**: Create account and get first API key  

**Command**:  
```typescript
RegisterUserCommand {
  telegramId: number
}
```

**Happy Path**:
1. Check if User exists (IUserRepository.findByTelegramId)
2. Create new User aggregate
3. Generate API key (user.generateApiKey())
4. Save user (IUserRepository.save)
5. Return API key

**Errors**: UserAlreadyExistsError

---

### 2.2. Initiate Balance Top-Up  
**Name**: InitiateTopUpUseCase  
**Actor**: User (via Telegram bot)  
**Purpose**: Get payment link for balance top-up  

**Command**:  
```typescript
InitiateTopUpCommand {
  userId: string,
  amount: Money
}
```

**Happy Path**:
1. Find User (IUserRepository.findById)
2. Create PENDING Transaction
3. Save Transaction (ITransactionRepository.save)
4. Get payment link (IPaymentGatewayAdapter.createInvoice)
5. Return payment link

**Errors**: UserNotFoundError

---

### 2.3. Confirm Top-Up (Webhook)  
**Name**: ConfirmTopUpUseCase  
**Actor**: Payment System (Telegram Pay)  
**Purpose**: Complete Transaction and record funds  

**Command**:  
```typescript
ConfirmTopUpCommand {
  providerPaymentId: string,
  status: 'completed' | 'failed',
  amount: Money
}
```

**Happy Path**:
1. Find Transaction (ITransactionRepository)
2. Verify status is 'completed'
3. Complete transaction (transaction.complete())
4. Save Transaction
5. Publish BalanceToppedUp event

**Errors**: TransactionNotFoundError, TransactionAlreadyProcessedError

---

### 2.4. Proxy LLM Request  
**Name**: ProxyChatCompletionUseCase  
**Actor**: User (via API)  
**Purpose**: Get LLM response after auth/balance checks  

**Command**:  
```typescript
ProxyChatCommand {
  apiKey: string,
  requestPayload: object
}
```

**Happy Path**:
1. Find User by API key (IUserRepository.findByApiKey)
2. Calculate balance (BalanceCalculator)
3. Verify balance > 0
4. Forward request (LlmRouter.forwardRequest)
5. Return LLM response

**Errors**: InvalidApiKeyError, InsufficientFundsError, ProviderError

---

### 2.5. Check User Balance  
**Name**: CheckBalanceUseCase  
**Actor**: User (via Telegram bot)  
**Purpose**: Get current balance  

**Query**:  
```typescript
CheckBalanceQuery {
  userId: string
}
```

**Flow**:
1. Find User
2. Calculate balance (BalanceCalculator)
3. Return balance

**Note**: This is a Query (read-only operation)

## 3. Implementation Guidance

This documentation formalizes the application layer API. Development team can use it to:
- Implement controllers/RPC handlers
- Maintain clear boundary between orchestration and domain logic
- Build flexible, testable system
