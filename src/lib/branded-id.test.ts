import { describe, it, expect } from 'bun:test';
import { createBrandedId } from './branded-id';

// Create two distinct ID types for testing
const UserId = createBrandedId('UserId');
type UserId = InstanceType<typeof UserId>;

const OrderId = createBrandedId('OrderId');
type OrderId = InstanceType<typeof OrderId>;

describe('createBrandedId', () => {
  const validUUID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
  const anotherValidUUID = 'e8a5b5a0-5bfa-4a0e-8b0a-0e02b2c3d479';

  it('should create a branded ID with a valid UUID', () => {
    const userId = UserId.create(validUUID);
    expect(userId).toBeInstanceOf(UserId);
    expect(userId.value).toBe(validUUID);
  });

  it('should throw an error for an invalid UUID', () => {
    const invalidUUID = 'not-a-uuid';
    expect(() => UserId.create(invalidUUID)).toThrow();
  });

  it('should correctly convert the ID to a string', () => {
    const userId = UserId.create(validUUID);
    expect(userId.toString()).toBe(validUUID);
  });

  it('should correctly check for equality', () => {
    const userId1 = UserId.create(validUUID);
    const userId2 = UserId.create(validUUID);
    const userId3 = UserId.create(anotherValidUUID);

    expect(userId1.equals(userId2)).toBe(true);
    expect(userId1.equals(userId3)).toBe(false);
  });

  
});
