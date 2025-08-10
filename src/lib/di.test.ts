import { describe, it, expect, beforeEach } from 'bun:test';
import { createPort, usePort, setPortAdapter, resetDI } from './di';

// Define the port type once for all tests
type FindUserPort = (id: string) => Promise<{ id: string; name: string }>;

describe('Sota DI Workflow', () => {
  // A hook that runs before each test in this suite
  beforeEach(() => {
    // Reset the DI state to ensure tests are isolated
    resetDI();
  });

  it('should throw an error if usePort is called before an adapter is set', () => {
    const findUserPort = createPort<FindUserPort>();
    
    // Check that the error message contains the key phrase, not the full text with UUID
    expect(() => {
      usePort(findUserPort);
    }).toThrow('No implementation found for the port. Did you forget to call setPortAdapter()?');
  });

  it('should follow the full developer workflow for DI', async () => {
    // 1. The developer defines a port
    const findUserPort = createPort<FindUserPort>();

    // 2. For tests, they provide a mock adapter
    const mockUserAdapter: FindUserPort = async (id: string) => {
      console.log(`[Mock] Finding user ${id}...`);
      return { id, name: 'Mock User' };
    };
    setPortAdapter(findUserPort, mockUserAdapter);

    // 3. The developer writes a use case
    const getUserUseCase = async (userId: string) => {
      const userFinder = usePort(findUserPort);
      return await userFinder(userId);
    };

    // 4. Check that the use case works with the mock implementation
    let user = await getUserUseCase('123');
    expect(user).toEqual({ id: '123', name: 'Mock User' });

    // 5. The developer creates a real adapter
    const userPostgresAdapter: FindUserPort = async (id: string) => {
      console.log(`[Postgres] Finding user ${id} in the database...`);
      return { id, name: 'Real User from DB' };
    };

    // 6. Reset the container and bind the real adapter
    resetDI();
    setPortAdapter(findUserPort, userPostgresAdapter);

    // 7. Call the use case again and check that it now uses the real adapter
    user = await getUserUseCase('456');
    expect(user).toEqual({ id: '456', name: 'Real User from DB' });
  });

  it('should throw an error when calling the port directly', () => {
    const findUserPort = createPort<FindUserPort>();

    // Check that the error message contains the key phrase
    expect(() => {
      findUserPort('any-id');
    }).toThrow('is an interface and cannot be called directly');
  });
});