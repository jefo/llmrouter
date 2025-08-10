import { setPortAdapter } from "./lib/di";
import { FindActivePriceListPort, PriceList, PriceListId, Price } from "./domain/pricelist.agg";
import { User, UserId, FindUserByIdPort, FindUserByTelegramIdPort, SaveUserPort } from "./domain/user.agg";

// --- In-Memory Stores ---
const inMemoryUsers: User[] = []; // Simple array to store user aggregates

// --- In-Memory Adapters ---

// In-memory implementation for FindActivePriceListPort
const inMemoryPriceListAdapter = async () => {
  // Simulate fetching a price list from a data source
  const mockPrices = [
    Price.create({
      modelName: "openrouter/openai/gpt-4o",
      inputPriceKopecksPer1M: 35000, // 350.00 RUB
      outputPriceKopecksPer1M: 105000, // 1050.00 RUB
      isActive: true,
    }),
    Price.create({
      modelName: "google/gemini-flash-1.5",
      inputPriceKopecksPer1M: 3000, // 30.00 RUB
      outputPriceKopecksPer1M: 6000, // 60.00 RUB
      isActive: true,
    }),
    Price.create({
      modelName: "anthropic/claude-3-haiku",
      inputPriceKopecksPer1M: 2000, // 20.00 RUB
      outputPriceKopecksPer1M: 9000, // 90.00 RUB
      isActive: true,
    }),
    Price.create({
      modelName: "inactive/model",
      inputPriceKopecksPer1M: 1000,
      outputPriceKopecksPer1M: 2000,
      isActive: false, // This one should not appear in the output
    }),
  ];

  // Create a PriceList aggregate instance
  const priceList = PriceList.create({
    id: PriceListId.create("a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11").value, // Example UUID
    prices: mockPrices.map(p => p.props), // Pass raw props from Value Objects
    createdAt: new Date(),
  });

  return priceList;
};

// In-memory implementation for FindUserByTelegramIdPort
const inMemoryFindUserByTelegramIdAdapter = async (telegramId: number) => {
  const user = inMemoryUsers.find(u => u.state.telegramId === telegramId);
  return user || null;
};

// In-memory implementation for SaveUserPort
const inMemorySaveUserAdapter = async (user: User) => {
  const existingIndex = inMemoryUsers.findIndex(u => u.id === user.id);
  if (existingIndex > -1) {
    inMemoryUsers[existingIndex] = user; // Update existing user
  } else {
    inMemoryUsers.push(user); // Add new user
  }
};

// In-memory implementation for FindUserByIdPort (optional for now, but good to have)
const inMemoryFindUserByIdAdapter = async (id: UserId) => {
  const user = inMemoryUsers.find(u => u.id === id.value);
  return user || null;
};


// --- DI Setup ---

export function setupDI() {
  // Bind PriceList ports
  setPortAdapter(FindActivePriceListPort, inMemoryPriceListAdapter);

  // Bind User ports
  setPortAdapter(FindUserByTelegramIdPort, inMemoryFindUserByTelegramIdAdapter);
  setPortAdapter(SaveUserPort, inMemorySaveUserAdapter);
  setPortAdapter(FindUserByIdPort, inMemoryFindUserByIdAdapter); // Bind this too
}

// Call setupDI to configure the container when this module is imported
setupDI();
