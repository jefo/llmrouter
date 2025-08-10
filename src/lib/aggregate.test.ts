import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createAggregate } from './aggregate';

// --- Test Setup ---

// 1. Define a sample event
class OrderPaidEvent {
  constructor(public readonly aggregateId: string, public readonly timestamp = new Date()) {}
}

// 2. Define the schema for our test aggregate
const OrderSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'paid', 'shipped']),
  amount: z.number(),
});
type OrderState = z.infer<typeof OrderSchema>;

// 3. Define the aggregate using our factory
const Order = createAggregate({
  name: 'Order',
  schema: OrderSchema,
  invariants: [
    (state) => {
      if (state.amount <= 0) {
        throw new Error('Order amount must be positive.');
      }
    },
  ],
  actions: {
    pay: (state: OrderState, paymentMethod: string) => {
      if (state.status !== 'pending') {
        throw new Error('Only pending orders can be paid.');
      }
      console.log(`Paid with ${paymentMethod}`);
      return {
        state: { ...state, status: 'paid' as const },
        event: new OrderPaidEvent(state.id),
      };
    },
    ship: (state: OrderState) => {
      if (state.status !== 'paid') {
        throw new Error('Only paid orders can be shipped.');
      }
      return { state: { ...state, status: 'shipped' as const } }; // Action without an event
    },
  },
});

// --- Tests ---

describe('createAggregate', () => {
  const validOrderData = {
    id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    status: 'pending' as const,
    amount: 100,
  };

  it('should create an aggregate instance with valid data', () => {
    const order = Order.create(validOrderData);
    expect(order).toBeInstanceOf(Order);
    expect(order.state.status).toBe('pending');
  });

  it('should throw an error if initial data violates the schema', () => {
    const invalidData = { ...validOrderData, amount: 'not-a-number' };
    expect(() => Order.create(invalidData)).toThrow();
  });

  it('should successfully execute an action and change state', () => {
    const order = Order.create(validOrderData);
    order.actions.pay('credit-card');
    expect(order.state.status).toBe('paid');
  });

  it('should collect domain events when an action is executed', () => {
    const order = Order.create(validOrderData);
    order.actions.pay('credit-card');
    const events = order.getPendingEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(OrderPaidEvent);
    expect(events[0].aggregateId).toBe(validOrderData.id);
  });

  it('getPendingEvents should clear the event queue', () => {
    const order = Order.create(validOrderData);
    order.actions.pay('credit-card');
    order.getPendingEvents(); // First call gets the event
    const subsequentEvents = order.getPendingEvents(); // Second call should be empty
    expect(subsequentEvents).toHaveLength(0);
  });

  it("should throw an error if an action's precondition is not met", () => {
    const paidOrderData = { ...validOrderData, status: 'paid' as const };
    const order = Order.create(paidOrderData);
    expect(() => order.actions.pay('credit-card')).toThrow('Only pending orders can be paid.');
  });

  

  it('should not change state if an invariant fails', () => {
    const orderDataWithInvalidAmount = { ...validOrderData, amount: -5 };
    // The invariant should be checked on creation via the schema if possible, but this tests the runtime invariant logic.
    // Let's assume it was created and then an action leads to an invalid state.
    const order = Order.create(validOrderData);

    // We need a way to test an action that *would* violate an invariant.
    // Let's add a faulty action to the config for this test.
    const FaultyOrder = createAggregate({
        ...Order.config, // This is not directly possible, so we re-define for the test
        name: 'FaultyOrder',
        schema: OrderSchema,
        invariants: [(state) => { if (state.amount < 0) throw new Error('Amount cannot be negative.'); }],
        actions: {
            setBadAmount: (state: OrderState) => ({ state: { ...state, amount: -10 } })
        }
    });

    const faultyOrder = FaultyOrder.create(validOrderData);

    expect(() => faultyOrder.actions.setBadAmount()).toThrow(
      'Amount cannot be negative.'
    );
    expect(faultyOrder.state.amount).toBe(100); // State should NOT have changed.
  });
});
