# The Transactional Linker: A Pattern for Atomic Cross-Aggregate Operations

This document describes the canonical Sota pattern for a common, complex scenario: performing a single business action that requires an atomic, consistent state change across two independent Aggregates.

## The Recipe: Linking an `Order` and a `Shipment`

This is the quick, how-to guide. For a detailed explanation of the theory, see the section below.

**Scenario:** When an `Order` is shipped, we must atomically change the `Order`'s status and link it to a newly created `Shipment`.

### Step 1: Define the Independent Aggregates

Each aggregate manages its own state and is unaware of the linking process.

```typescript
// domain/orders/order.aggregate.ts
export const Order = createAggregate({
  name: 'Order',
  schema: z.object({
    id: OrderId.schema,
    status: z.enum(['pending', 'paid', 'shipped']),
    shipmentId: ShipmentId.schema.optional(),
  }),
  actions: {
    moveToShipped: (state, shipmentId: ShipmentId) => {
      if (state.status !== 'paid') throw new Error('Order must be paid first.');
      return { ...state, status: 'shipped', shipmentId };
    },
  },
});

// domain/shipments/shipment.aggregate.ts
export const Shipment = createAggregate({
  name: 'Shipment',
  schema: z.object({
    id: ShipmentId.schema,
    orderId: OrderId.schema, // Set on creation
  }),
});
```

### Step 2: Create the Linker with the Library Factory

Use the `createTransactionalLinker` factory to define the orchestration logic. This avoids boilerplate.

```typescript
// domain/shipping/order-shipment-linker.ts
import { createTransactionalLinker } from '../../lib/transactional-linker';
import { Order, OrderSchema } from '../orders/order.aggregate';
import { Shipment, ShipmentSchema } from '../shipments/shipment.aggregate';

export const OrderShipmentLinker = createTransactionalLinker({
  name: 'OrderShipmentLinker',
  schemaA: Order.schema,
  schemaB: Shipment.schema,
  // This lambda contains the specific orchestration logic
  link: ({ entityA: order, entityB: shipment }) => {
    order.actions.moveToShipped(shipment.id);
  },
});
```

### Step 3: Execute in a Use Case

The application layer uses the linker to perform the operation.

```typescript
// application/use-cases/ship-order.use-case.ts
const shipOrder = async (input: { orderId: OrderId }) => {
  const order = await usePort(findOrderByIdPort)({ id: input.orderId });
  const shipment = Shipment.create({ orderId: order.id, ... });

  const linker = OrderShipmentLinker.create();
  linker.actions.link({ entityA: order, entityB: shipment });

  // The repository will handle the atomic database transaction
  const saveLink = usePort(saveOrderShipmentLinkPort);
  await saveLink(linker);
};
```

--- 

## The Theory: Why This Pattern is a Superior Approach

Here we explain the design principles behind the Transactional Linker pattern.

### The Core Problem: Atomicity vs. Encapsulation

A fundamental challenge in DDD is that a business transaction (which must be atomic) can sometimes span multiple aggregates. For example, shipping an order logically affects both the `Order` and the `Shipment`.

The naive solution is to place the orchestration logic inside one of the aggregates, for instance, in the `Order`:

```typescript
// ANTI-PATTERN: God-Object Aggregate
class Order {
  ship(shipmentService: any) { // <-- Violates SRP, needs external services
    if (this.props.status !== 'paid') { /*...*/ }
    
    const shipment = shipmentService.create(this.id); // <-- Tightly coupled
    
    this.props.status = 'shipped';
    this.props.shipmentId = shipment.id;
    
    // Now the Order needs to know how to save itself AND the shipment
  }
}
```

This approach fails for several reasons:
- **Violates Single Responsibility Principle (SRP):** The `Order` aggregate is now responsible for its own logic AND the logic of creating and linking shipments.
- **Creates Tight Coupling:** The `Order` becomes coupled to the `Shipment` creation process.
- **Obscures Transactional Boundary:** It's no longer clear what the true boundary of the transaction is.

### Our Solution: The Transactional Linker Aggregate

By extracting this logic into a dedicated linker, we solve all these problems.

1.  **It Adheres to SOLID Principles:**
    - The `Order` is only responsible for being an order.
    - The `Shipment` is only responsible for being a shipment.
    - The `OrderShipmentLinker` has only one responsibility: to orchestrate the transactional link between them. 

2.  **It Defines a Clear Transactional Boundary:**
    - The linker aggregate *is* the transaction. Its state contains everything that must be persisted atomically. When you pass the linker to its repository, it's an explicit instruction to the infrastructure layer: "Make this entire operation succeed, or fail completely."

3.  **It is Highly Testable:**
    - You can unit test the internal logic of the `Order` and `Shipment` aggregates in isolation.
    - You can unit test the orchestration logic of the `OrderShipmentRelation` in isolation by providing mock entities and asserting that their actions were called correctly.

This pattern provides a clean, robust, and scalable way to manage complex, transactional state changes between independent aggregates, forming a cornerstone of the Sota development methodology.