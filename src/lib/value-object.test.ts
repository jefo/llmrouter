import { describe, it, expect } from 'bun:test';
import { z } from 'zod';
import { createValueObject } from './value-object';

// Define a simple schema for testing
const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  zip: z.string().length(5),
  coords: z.object({
    lat: z.number(),
    lon: z.number(),
  }).optional(),
});
type AddressProps = z.infer<typeof AddressSchema>;

// Create the Value Object class
const Address = createValueObject(AddressSchema);

describe('createValueObject', () => {
  const validAddressData: AddressProps = {
    street: '123 Main St',
    city: 'Anytown',
    zip: '12345',
    coords: { lat: 10, lon: 20 },
  };

  it('should create a Value Object instance with valid data', () => {
    const address = Address.create(validAddressData);
    expect(address).toBeInstanceOf(Address);
    expect(address.props.street).toBe('123 Main St');
    expect(address.props.coords?.lat).toBe(10);
  });

  it('should throw an error if initial data violates the schema', () => {
    const invalidData = { ...validAddressData, zip: '123' }; // Invalid zip length
    expect(() => Address.create(invalidData)).toThrow();
  });

  it('should ensure immutability of the Value Object', () => {
    const address = Address.create(validAddressData);
    
    // Attempt to modify a top-level property
    expect(() => {
      (address.props as any).street = 'New Street';
    }).toThrow(TypeError);

    // Attempt to modify a nested property
    expect(() => {
      if (address.props.coords) {
        (address.props.coords as any).lat = 99;
      }
    }).toThrow(TypeError);

    // Verify that the original values are unchanged
    expect(address.props.street).toBe('123 Main St');
    expect(address.props.coords?.lat).toBe(10);
  });

  it('should correctly check for structural equality', () => {
    const address1 = Address.create(validAddressData);
    const address2 = Address.create(validAddressData);
    const address3 = Address.create({ ...validAddressData, city: 'Othertown' });
    const address4 = Address.create({ ...validAddressData, coords: { lat: 10, lon: 20 } }); // Same data, new object

    expect(address1.equals(address2)).toBe(true);
    expect(address1.equals(address3)).toBe(false);
    expect(address1.equals(address4)).toBe(true); // Structural equality
    expect(address1.equals(undefined)).toBe(false);
    expect(address1.equals(null)).toBe(false);
  });

  it('should handle optional properties correctly in equality check', () => {
    const dataWithoutCoords = { ...validAddressData };
    delete dataWithoutCoords.coords;

    const addressA = Address.create(dataWithoutCoords);
    const addressB = Address.create(dataWithoutCoords);
    const addressC = Address.create(validAddressData);

    expect(addressA.equals(addressB)).toBe(true);
    expect(addressA.equals(addressC)).toBe(false);
  });
});
