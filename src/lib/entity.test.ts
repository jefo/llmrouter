import { describe, it, expect } from "bun:test";
import { z } from "zod";
import { createEntity } from "./entity";
import { randomUUIDv7 } from "bun";

// Define a simple schema for testing
const UserSchema = z.object({
	id: z.string().uuid(),
	name: z.string().min(1),
	email: z.string().email(),
	isActive: z.boolean().default(true),
});
type UserProps = z.infer<typeof UserSchema>;

// Create the Entity class
const User = createEntity({
	schema: UserSchema,
	actions: {
		updateName: (state: UserProps, newName: string) => {
			return { ...state, name: newName };
		},
		updateEmail: (state: UserProps, newEmail: string) => {
			// In a real scenario, you might add email validation here
			return { ...state, email: newEmail };
		},
		deactivate: (state: UserProps) => {
			return { ...state, isActive: false };
		},
	},
});

describe("createEntity", () => {
	const validUserData: UserProps = {
		id: "f47ac10b-58cc-4372-a567-0e02b2c3d479",
		name: "John Doe",
		email: "john.doe@example.com",
		isActive: true,
	};

	it("should create an Entity instance with valid data", () => {
		const user = User.create(validUserData);
		expect(user).toBeInstanceOf(User);
		expect(user.id).toBe(validUserData.id);
		expect(user.state.name).toBe("John Doe");
	});

	it("should throw an error if initial data violates the schema", () => {
		const invalidData = { ...validUserData, email: "invalid-email" };
		expect(() => User.create(invalidData)).toThrow();
	});

	it("should allow state modification through actions", () => {
		const user = User.create(validUserData);
		user.actions.updateName("Jane Doe");
		expect(user.state.name).toBe("Jane Doe");

		user.actions.updateEmail("jane.doe@new.com");
		expect(user.state.email).toBe("jane.doe@new.com");

		user.actions.deactivate();
		expect(user.state.isActive).toBe(false);
	});

	it("should ensure immutability of the returned state object", () => {
		const user = User.create(validUserData);
		const state = user.state;

		expect(() => {
			(state as any).name = "Attempted Change";
		}).toThrow(TypeError);

		expect(user.state.name).toBe("John Doe"); // Original state should be unchanged
	});

	it("should correctly check for identity equality", () => {
		const user1 = User.create(validUserData);
		const user2 = User.create(validUserData); // Same ID, different instance
		const user3 = User.create({ ...validUserData, id: randomUUIDv7() }); // Different ID

		expect(user1.equals(user2)).toBe(true); // Same ID, same type
		expect(user1.equals(user3)).toBe(false); // Different ID
		expect(user1.equals(undefined)).toBe(false);
		expect(user1.equals(null)).toBe(false);

		// Test equality with a different entity type (if we had one)
		const AnotherUser = createEntity({
			schema: z.object({ id: z.string().uuid(), username: z.string() }),
			actions: {},
		});
		const anotherUser = AnotherUser.create({
			id: randomUUIDv7(),
			username: "test",
		});
		expect(user1.equals(anotherUser)).toBe(false); // Different type, even if same ID
	});
});
