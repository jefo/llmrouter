# Orchestration with Use Cases and Hooks

This document describes the canonical way to write and orchestrate business logic within the Sota framework. It focuses on structuring **Use Cases** as pure functions that receive their dependencies via a React-like hook mechanism.

This approach ensures a clean separation of concerns, high testability, and a declarative, functional style.

## The Core Idea: Use Cases as Functions

In Sota, a Use Case is a standalone, exported `async` function that represents a single, atomic operation in your application (e.g., `createOrder`, `findUserById`).

- **It contains orchestration logic:** It calls domain logic and ports to perform its task.
- **It is not a class:** It's just a function, which reduces boilerplate.
- **It receives dependencies via `usePort`:** It does not know the concrete implementation of its dependencies, only the contract (the Port).

## The `usePort` Hook and the DTO Convention

The `usePort` hook is the bridge between a Use Case (application layer) and its dependencies (infrastructure layer).

A critical convention in Sota is that **all ports must accept a single object argument, known as a Data Transfer Object (DTO)**. This DTO is defined using a plain TypeScript `type` or `interface`.

This practice improves the readability and scalability of function signatures. Validation of the data is the responsibility of the **Use Case** itself, which acts as the entry point to the application's core logic. It should validate all incoming data before passing it to any domain logic or ports.

```typescript
import { usePort } from './lib/di';
import { SomePort, SomePortDto } from './domain/ports';
import { z } from 'zod';

const SomeDtoSchema = z.object({ /* ... */ });

const myUseCase = async (input: unknown) => {
  // Validate input at the boundary
  const validInput = SomeDtoSchema.parse(input);

  const doWork = usePort(SomePort);

  // The validated DTO is passed to the port
  await doWork(validInput);
};
```

## A Practical Example: Creating an Order

Let's walk through the implementation of a `createOrder` use case.

### Step 1: Define the Ports and DTOs (The Contracts)

DTOs are simple types/interfaces. The ports that use them are agnostic to validation.

```typescript
import { createPort } from '../lib/di';
import { User } from './user.entity';
import { Order } from './order.aggregate';

// --- DTOs ---
export interface FindUserByIdDto {
  id: string;
}

export type SaveOrderDto = Order;

export interface SendEmailDto {
  to: string;
  subject: string;
  body: string;
}

// --- Ports ---
export const findUserByIdPort = createPort<(dto: FindUserByIdDto) => Promise<User | null>>();
export const saveOrderPort = createPort<(dto: SaveOrderDto) => Promise<void>>();
export const sendEmailPort = createPort<(dto: SendEmailDto) => Promise<void>>();
```

### Step 2: Write the Use Case (The Orchestrator)

The use case defines a `zod` schema to validate its own input. This ensures data is safe before being used.

```typescript
// application/use-cases/create-order.use-case.ts
import { z } from 'zod';
import { usePort } from '../../lib/di';
import { findUserByIdPort } from '../../domain/users/user.ports';
import { saveOrderPort } from '../../domain/orders/order.ports';
import { sendEmailPort } from '../ports/notification.port';
import { Order } from '../../domain/orders/order.aggregate';

// Zod schema for input validation
const CreateOrderInputSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive()
  })),
});

type CreateOrderInput = z.infer<typeof CreateOrderInputSchema>;

export const createOrderUseCase = async (input: CreateOrderInput) => {
  // 1. Validate input at the boundary of the use case
  const validInput = CreateOrderInputSchema.parse(input);

  // 2. Declare dependencies with hooks
  const findUserById = usePort(findUserByIdPort);
  const saveOrder = usePort(saveOrderPort);
  const sendEmail = usePort(sendEmailPort);

  // 3. Orchestrate logic, using validated data
  const user = await findUserById({ id: validInput.userId });
  if (!user) {
    throw new Error('User not found');
  }

  // 4. Call domain logic
  const order = Order.create(validInput);

  // 5. Use ports to interact with infrastructure
  await saveOrder(order);
  await sendEmail({
    to: user.email,
    subject: 'Order Created',
    body: `Your order with ID ${order.id} has been created.`
  });

  return { orderId: order.id };
};
```

### Step 3: Implement the Adapters (The Concrete Details)

Adapters receive the clean, typed DTOs, unaware of the validation that already happened.

```typescript
// infrastructure/db/user.adapter.ts
import { FindUserByIdDto } from '../../domain/users/user.ports';
export const userDbAdapter = async (dto: FindUserByIdDto) => {
  console.log(`Fetching user ${dto.id} from DB...`);
  return { id: dto.id, email: 'test@example.com' };
};
// ... other adapters
```

### Step 4: Bind Adapters to Ports (The Composition Root)

The binding process remains the same.

### Step 5: Testing Use Cases

Testing involves passing valid data that conforms to the use case's input schema.

```typescript
// application/use-cases/create-order.use-case.test.ts
// ... imports

describe('createOrderUseCase', () => {
  // ... mock adapters

  beforeEach(() => {
    resetDI();
    // ... setPortAdapter calls
  });

  it('should create an order and send a notification', async () => {
    const validInput = {
      userId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
      items: [{ productId: 'e7e7a5d6-8a5d-4f5d-96a0-5e5e5e5e5e5e', quantity: 1 }]
    };

    await createOrderUseCase(validInput);

    // Verify mocks were called with correct data
    expect(mockFindUserById).toHaveBeenCalledWith({ id: validInput.userId });
    // ... other expects
  });

  it('should throw a validation error for invalid input', async () => {
    const invalidInput = { userId: 'not-a-uuid', items: [] };
    // Zod will throw an error, which can be caught by the test runner
    await expect(createOrderUseCase(invalidInput)).rejects.toThrow();
  });
});
```
