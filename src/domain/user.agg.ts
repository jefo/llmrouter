import { z } from "zod";
import { createBrandedId } from "../lib/branded-id";
import { createValueObject } from "../lib/value-object";
import { createAggregate } from "../lib/aggregate";
import { createPort } from "../lib/di";

// --- Helper Functions (moved outside aggregate) ---
// Using Bun's crypto for hashing
import { randomUUID } from "crypto";

function generateHashedApiKey(): {
  apiKey: string;
  hashedApiKey: string;
} {
  const apiKey = `sk-${randomUUID()}`;
  // Bun.password.hash is async, so we need to use a synchronous hash for now
  // or make the action async and handle it in the use case.
  // For simplicity and to match original sync behavior, using createHash.
  const hashedApiKey = hashApiKey(apiKey);
  return { apiKey, hashedApiKey };
}

function hashApiKey(apiKey: string): string {
  // Using Node.js crypto for hashing, compatible with Bun
  const crypto = require('crypto');
  return crypto.createHash("sha256").update(apiKey).digest("hex");
}

// --- Branded ID: UserId ---
export const UserId = createBrandedId("UserId");
export type UserId = InstanceType<typeof UserId>;

// --- Value Object: ApiKey ---
export const ApiKeyStatusSchema = z.enum(["ACTIVE", "REVOKED"]);
export type ApiKeyStatus = z.infer<typeof ApiKeyStatusSchema>;

export const ApiKeySchema = z.object({
  id: z.string().uuid(),
  hashedKey: z.string(),
  status: ApiKeyStatusSchema,
  createdAt: z.date(),
});
export type ApiKeyProps = z.infer<typeof ApiKeySchema>;
export const ApiKey = createValueObject(ApiKeySchema);
export type ApiKey = InstanceType<typeof ApiKey>;

// --- Aggregate: User ---
export const UserPropsSchema = z.object({
  id: z.string().uuid(), // Use string UUID for schema, convert to BrandedId in aggregate creation
  telegramId: z.number().int().positive(),
  tokenBalance: z.number().int().min(0, "Token balance cannot be negative"),
  apiKeys: z.array(ApiKeySchema),
  isLocked: z.boolean().default(false), // Added from ProductBacklog
});
export type UserProps = z.infer<typeof UserPropsSchema>;

export const User = createAggregate({
  name: "User",
  schema: UserPropsSchema,
  invariants: [
    (state) => {
      if (state.tokenBalance < 0 && !state.isLocked) {
        throw new Error("User with negative balance must be locked.");
      }
      if (state.tokenBalance >= 0 && state.isLocked) {
        throw new Error("User with positive balance cannot be locked.");
      }
    },
    (state) => {
      const activeKeysCount = state.apiKeys.filter(k => k.props.status === "ACTIVE").length;
      if (activeKeysCount > 5) {
        throw new Error("User cannot have more than 5 active API keys.");
      }
    }
  ],
  actions: {
    // Removed initialize action. User.create will handle initial setup.

    generateApiKey: (state: UserProps) => {
      const activeKeysCount = state.apiKeys.filter(k => k.props.status === "ACTIVE").length;
      if (activeKeysCount >= 5) {
        throw new Error("User cannot have more than 5 active API keys.");
      }

      const { apiKey, hashedApiKey } = generateHashedApiKey();
      const newKey = ApiKey.create({
        id: randomUUID(),
        hashedKey: hashedApiKey,
        status: "ACTIVE",
        createdAt: new Date(),
      });

      const updatedApiKeys = [...state.apiKeys, newKey.props];
      return { state: { ...state, apiKeys: updatedApiKeys }, event: { type: "ApiKeyGenerated", userId: state.id, apiKey } };
    },

    revokeApiKey: (state: UserProps, apiKeyId: string) => {
      const keyToRevoke = state.apiKeys.find(k => k.props.id === apiKeyId);
      if (!keyToRevoke) {
        throw new Error("API key not found.");
      }
      if (keyToRevoke.props.status === "REVOKED") {
        console.warn(`API key ${apiKeyId} is already revoked.`);
        return { state: state }; // No state change if already revoked
      }

      const updatedApiKeys = state.apiKeys.map(k =>
        k.props.id === apiKeyId ? { ...k.props, status: "REVOKED" } : k.props
      );
      return { state: { ...state, apiKeys: updatedApiKeys }, event: { type: "ApiKeyRevoked", userId: state.id, apiKeyId } };
    },

    debitTokens: (state: UserProps, amount: number) => {
      if (amount <= 0) {
        throw new Error("Amount must be positive.");
      }
      const newBalance = state.tokenBalance - amount;
      const isLocked = newBalance < 0; // Lock if balance goes negative
      return { state: { ...state, tokenBalance: newBalance, isLocked } };
    },

    creditTokens: (state: UserProps, amount: number) => {
      if (amount <= 0) {
        throw new Error("Amount must be positive.");
      }
      const newBalance = state.tokenBalance + amount;
      const isLocked = newBalance < 0; // Still locked if balance is negative after credit
      return { state: { ...state, tokenBalance: newBalance, isLocked } };
    },

    lock: (state: UserProps) => {
      if (state.isLocked) {
        return { state: state }; // Already locked
      }
      return { state: { ...state, isLocked: true } };
    },

    unlock: (state: UserProps) => {
      if (!state.isLocked) {
        return { state: state }; // Already unlocked
      }
      return { state: { ...state, isLocked: false } };
    },

    isApiKeyValid: (state: UserProps, apiKey: string) => {
      const hashedKey = hashApiKey(apiKey);
      const isValid = state.apiKeys.some(
        (k) => k.props.hashedKey === hashedKey && k.props.status === "ACTIVE"
      );
      return { state: state, event: { type: "ApiKeyValidation", userId: state.id, isValid } }; // Actions must return state, can return event
    },
  },
});
export type User = InstanceType<typeof User>;

// --- Ports for User Repository ---
export const FindUserByIdPort = createPort<(id: UserId) => Promise<User | null>>();
export type FindUserByIdPort = typeof FindUserByIdPort;

export const FindUserByTelegramIdPort = createPort<(telegramId: number) => Promise<User | null>>();
export type FindUserByTelegramIdPort = typeof FindUserByTelegramIdPort;

export const SaveUserPort = createPort<(user: User) => Promise<void>>();
export type SaveUserPort = typeof SaveUserPort;

// Override User.create to handle initial API key generation
// This is a common pattern when the aggregate's initial state depends on external factors (like generating a key)
const originalUserCreate = User.create;
User.create = (props: UserProps): User => {
  // If creating a brand new user (no ID provided, or minimal props)
  if (!props.id || props.apiKeys.length === 0) {
    const { apiKey, hashedApiKey } = generateHashedApiKey();
    const newKey = ApiKey.create({
      id: randomUUID(),
      hashedKey: hashedApiKey,
      status: "ACTIVE",
      createdAt: new Date(),
    });

    const initialProps: UserProps = {
      id: randomUUID(), // Generate new ID for new user
      telegramId: props.telegramId, // Use telegramId from props
      tokenBalance: props.tokenBalance || 1500, // Default bonus 15.00 RUB (1500 kopecks)
      apiKeys: [newKey.props], // Store props of Value Object
      isLocked: false,
    };
    const userInstance = originalUserCreate(initialProps);
    // Attach the generated API key to the instance for retrieval by the use case
    (userInstance as any)._generatedApiKey = apiKey;
    return userInstance;
  }
  // If restoring from DB, just use original create
  return originalUserCreate(props);
};
