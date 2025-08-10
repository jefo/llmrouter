# Domain Modeling in Sota: From Anemic Models to Rich Aggregates

This document provides a practical guide to Domain-Driven Design (DDD) within the Sota framework. It is specifically written for developers who may be accustomed to anemic domain models and want to understand how to build rich, robust, and maintainable systems.

## The Problem with Anemic Models

Many systems are built using an **anemic domain model**. In this style, domain objects are simple data structures (often called DTOs or POJOs/POCOs) with no business logic. All logic for manipulating these objects resides in external "service" or "manager" classes.

**The Anemic Way (Before):**

```typescript
// The Order object is just a bag of properties
interface Order {
  id: string;
  status: 'pending' | 'paid' | 'shipped';
  items: any[];
}

// All logic lives in a separate service
class OrderService {
  public shipOrder(order: Order) {
    // Business rules are scattered and not owned by the data
    if (order.status !== 'paid') {
      throw new Error('Order must be paid before shipping.');
    }
    order.status = 'shipped';
    // ... database logic to save the order
  }
}
```

This approach leads to several problems:
- **Scattered Logic:** Business rules are spread across various services, making them hard to find and maintain.
- **No Invariants:** The `Order` object cannot protect its own state. Any part of the system can set `status` to an invalid value or in an incorrect sequence.
- **Anemic = Not Object-Oriented:** It's a procedural approach that misses the core benefit of OO: the encapsulation of data and the processes that operate on that data.

## The Solution: Rich Domain Models & Aggregates

Sota champions the **rich domain model** approach. Here, data and the logic that operates on it are encapsulated within the same object. The central pattern for this is the **Aggregate**.

An **Aggregate** is a cluster of domain objects (Entities and Value Objects) that can be treated as a single unit. It acts as a **transactional consistency boundary**. This means that within a single transaction, all business rules (invariants) for the entire aggregate must be satisfied.

Key components:
- **Aggregate Root:** The single entry point to the aggregate. It's an entity that is responsible for loading the aggregate and enforcing its invariants.
- **Entity:** An object with a distinct identity (ID) that persists over time.
- **Value Object (VO):** An immutable object defined by its attributes, like `Money` or `Address`.

## Best Practices for Implementing Aggregates in Sota

Here is the canonical way to implement an Aggregate in Sota.

### 1. Define the Properties Schema with `zod`

Start by defining the shape and basic validation rules for your aggregate's data using a `zod` schema. This schema defines the `props` of your aggregate.

```typescript
// domain/order/order.schema.ts
import { z } from 'zod';

export const OrderItemSchema = z.object({
  productId: z.string().uuid(),
  quantity: z.number().positive(),
  price: z.number().nonnegative(),
});

export const OrderPropsSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(['pending', 'paid', 'shipped', 'cancelled']),
  items: z.array(OrderItemSchema),
  createdAt: z.date(),
});

// Export the inferred type for convenience
export type OrderProps = z.infer<typeof OrderPropsSchema>;
```

### 2. Create the Aggregate Class

Next, create a class for the aggregate. Its primary role is to hold the properties and expose methods that implement business logic.

- The constructor is **private**. This is critical. It forces all instantiation to go through a controlled factory method, ensuring no aggregate can be created in an invalid state.
- It holds its state in a private `props` object.

```typescript
// domain/order/order.aggregate.ts
import { OrderProps, OrderPropsSchema } from './order.schema';

export class Order {
  private readonly props: OrderProps;

  private constructor(props: OrderProps) {
    this.props = props;
  }

  // Getters to expose state in a controlled, read-only way
  get id(): string { return this.props.id; }
  get status(): string { return this.props.status; }
  get items() { return [...this.props.items]; // Return a copy to prevent mutation }
}
```

### 3. Use a Static `create()` Factory Method

This is the **only public way** to create a new instance of your aggregate. It takes raw data, validates it against the `zod` schema, and then returns a new, valid instance.

```typescript
// Inside the Order class

public static create(initialData: unknown): Order {
  // 1. Validate the input against the schema
  const props = OrderPropsSchema.parse(initialData);
  
  // 2. If valid, create a new instance
  return new Order(props);
}
```

### 4. Encapsulate Business Logic in Methods

Instead of a `OrderService`, add methods directly to the `Order` class. These methods contain the business rules (invariants) and are the only way to modify the aggregate's state.

```typescript
// Inside the Order class

public pay(): void {
  if (this.props.status !== 'pending') {
    throw new Error('Only pending orders can be paid.');
  }
  this.props.status = 'paid';
}

public ship(): void {
  if (this.props.status !== 'paid') {
    throw new Error('Order must be paid before it can be shipped.');
  }
  this.props.status = 'shipped';
}

public addItem(item: { productId: string; quantity: number; price: number }): void {
  if (this.props.status !== 'pending') {
    throw new Error('Items can only be added to pending orders.');
  }
  // You can add more complex logic, e.g., checking for duplicates
  this.props.items.push(item);
}
```

## Modeling Relationships

Correctly modeling relationships between different Aggregates is one of the most critical aspects of building a robust and scalable domain model. The core principle is to **always reference other Aggregates by their unique ID**, never by direct object reference.

This topic is extensive, with different strategies for one-to-one, one-to-many, and many-to-many relationships. To provide clear, practical examples, we have dedicated a separate document to this subject.

- **[Primary Guide: Modeling Relationships in Sota](./modeling-relationships.md)**

## Rules for Aggregate Interaction

To maintain loose coupling and clear boundaries, follow these three critical rules.

1.  **Reference Other Aggregates by ID Only**

    An `Order` aggregate needs to know about a `User`, but it should **only store the `userId`**, not the entire `User` aggregate object. 

    - **Why?** Loading a `User` object every time you load an `Order` is inefficient. More importantly, it creates tight coupling between the two aggregates. If you need user details, you use the `userId` to fetch them in a separate step, typically within a use case.

2.  **Modify Only One Aggregate per Transaction**

    Each transaction should only ever create or modify a single aggregate instance. 

    - **Why?** This rule simplifies transaction management and avoids complex distributed transaction scenarios. If a business process needs to update multiple aggregates (e.g., a customer placing an order should also update their "loyalty points"), this is orchestrated at the use case layer, often using domain events.

3.  **Segregate Read and Write Ports (CQRS)**

    To protect your aggregate's invariants, you must treat read and write operations differently at the port level.

    - **Write Ports (Commands):** These ports (`save`, `update`, `delete`) **must always** operate on the full Aggregate Root. This is the only way to guarantee that all business rules and invariants are checked before the state is changed.
      ```typescript
      // A write port ALWAYS takes the full aggregate
      export const saveOrderPort = createPort<(order: Order) => Promise<void>>();
      ```

    - **Read Ports (Queries):** These ports are more flexible. You are free to create ports that return whatever data shape is most efficient for a given use case. This can be:
        - The full Aggregate Root: `findOrderByIdPort`
        - A specific Entity within an aggregate: `findOrderItemByIdPort`
        - A custom, read-optimized DTO: `findOrderSummaryPort`

    - **Why?** This Command-Query Responsibility Segregation (CQRS) approach provides both safety for writes and performance/flexibility for reads.

By following these principles, you create a domain model that is robust, expressive, and a true reflection of your business processes. Your code becomes easier to understand, maintain, and test.
