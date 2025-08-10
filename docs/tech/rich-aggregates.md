# Rich Aggregates in Sota

This document outlines the canonical, high-level pattern for creating robust, behavior-rich Aggregates in Sota. The goal is to provide a developer experience (DX) that is not only simple but also embeds Domain-Driven Design best practices directly into the framework's runtime.

## The Philosophy: An Aggregate as a State Machine

We treat every Aggregate as a self-contained, transactional state machine. It can only be modified through explicit actions, and it guarantees its own consistency (invariants) after every change. It also records its own history by producing domain events.

To achieve this, Sota provides a powerful factory function: `createAggregate`.

## The `createAggregate` Factory

This factory is the heart of domain modeling in Sota. You declaratively provide the "what" (schemas, rules, logic), and the factory builds the "how"—a secure, robust Aggregate class that handles the boilerplate for you.

### Developer Responsibilities

A developer defines an aggregate by providing a configuration object with four key properties:

1.  **`name`**: A string identifier for the aggregate type (e.g., 'Order'). Used for logging and event sourcing.
2.  **`schema`**: A `zod` schema that defines the shape and basic validation of the aggregate's properties (`props`).
3.  **`invariants`**: An array of pure functions `(state: TProps) => void` that define the business rules. Each function should throw an error if a rule is violated. These are the core guards of your aggregate's consistency.
4.  **`actions`**: An object containing pure functions that define the state transitions. Each action receives the current state and a payload, and must return a new state object. It can optionally also return a domain event.

### Framework Guarantees

The `createAggregate` factory returns a class that provides the following guarantees:

-   **Immutability and Consistency:** The aggregate's state can *only* be changed via the defined actions. After every action, all registered invariants are automatically checked. If any invariant fails, the state change is rejected, and the aggregate remains untouched.
-   **Built-in Event Sourcing:** Domain events are automatically collected as actions are performed. They can be retrieved in a single batch by the application layer *after* the transaction has been successfully persisted.
-   **Testability:** Since actions and invariants are pure functions, they are trivial to unit test without any mocking.

## Example: A Rich `Order` Aggregate

```typescript
// domain/order/order.aggregate.ts
import { z } from 'zod';
import { createAggregate } from '@sota/core'; // Assuming this will be the path
import { OrderPaidEvent, OrderShippedEvent } from './order.events';

// 1. Define the properties schema
const OrderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'paid', 'shipped']),
  items: z.array(z.object({ productId: z.string(), price: z.number() })),
});

type OrderState = z.infer<typeof OrderSchema>;

// 2. Define the aggregate using the factory
export const Order = createAggregate({
  name: 'Order',
  schema: OrderSchema,

  // 3. Define the INVARIANTS (business rules)
  invariants: [
    (state) => {
      if (state.status === 'shipped' && state.items.length === 0) {
        throw new Error('Cannot ship an empty order.');
      }
    },
    (state) => {
        const total = state.items.reduce((sum, item) => sum + item.price, 0);
        if (total > 10000) {
            throw new Error('Order total cannot exceed $10,000.');
        }
    }
  ],

  // 4. Define the ACTIONS (state transitions)
  actions: {
    pay: (state: OrderState) => {
      if (state.status !== 'pending') {
        throw new Error('Only pending orders can be paid.');
      }
      const newState = { ...state, status: 'paid' as const };
      // Return new state and the event that occurred
      return { state: newState, event: new OrderPaidEvent({ orderId: state.id }) };
    },

    ship: (state: OrderState) => {
      if (state.status !== 'paid') {
        throw new Error('Only paid orders can be shipped.');
      }
      const newState = { ...state, status: 'shipped' as const };
      return { state: newState, event: new OrderShippedEvent({ orderId: state.id }) };
    },
  },
});

export type Order = InstanceType<typeof Order>;
```

### How it's Used

The returned `Order` class would be used like this in a use case:

```typescript
// application/use-cases/pay-for-order.use-case.ts

// 1. Fetch the raw data and create an aggregate instance
const rawOrderData = await findOrderByIdPort({ id: 'some-id' });
const order = Order.create(rawOrderData); // Validates schema on creation

// 2. Call an action. The framework handles the state change and invariant checks.
order.actions.pay();

// 3. Get the resulting events
const events = order.getPendingEvents(); // Returns [OrderPaidEvent]

// 4. Persist the new state and dispatch the events
await saveOrderPort(order.state);
await eventBus.dispatch(events);
```

This model provides an extremely high level of safety and developer convenience, making it the cornerstone of the Sota framework's domain modeling strategy.