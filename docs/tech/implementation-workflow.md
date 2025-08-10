# Implementation Workflow: Building a Hexagon in Sota

This document provides a complete, step-by-step workflow for developing a new feature (a "Hexagon") within the Sota framework. The process is designed to be "inside-out," meaning we start with the core business logic and work our way outwards to the infrastructure.

This test-driven approach ensures that your business logic is the central focus, remains decoupled from infrastructure, and is highly testable from the very beginning.

## The Goal: A New Feature

Let's assume our goal is to implement a new feature: **"Allow a user to create a new blog post."**

## The Workflow

### Step 1: Define the Use Case and its Contract

First, we define the entry point to our feature. This is the Use Case. We don't implement the logic yet; we just define the shape of the operation.

> For a detailed explanation of this layer, see [Orchestration with Use Cases and Hooks](./use-cases.md).

1.  **Create the Use Case file:** `application/use-cases/create-post.use-case.ts`

2.  **Define the Input Schema:** Using `zod`, define the data required to execute this use case. This schema is the public contract of your feature.

    ```typescript
    // application/use-cases/create-post.use-case.ts
    import { z } from 'zod';

    export const CreatePostInputSchema = z.object({
      authorId: z.string().uuid(),
      title: z.string().min(5),
      content: z.string().min(20),
    });
    export type CreatePostInput = z.infer<typeof CreatePostInputSchema>;
    ```

3.  **Sketch the Use Case and Declare Dependencies:** Write the function signature. Inside, using `usePort`, declare the dependencies (ports) you *think* you will need. You are defining the *need* for a capability, not its implementation.

    ```typescript
    // ... continuing in create-post.use-case.ts
    import { usePort } from '../../lib/di';
    import { findUserByIdPort, savePostPort } from '../../domain/posts/post.ports';

    export const createPostUseCase = async (input: CreatePostInput) => {
      // For now, we just declare our needs
      const findUserById = usePort(findUserByIdPort);
      const savePost = usePort(savePostPort);

      // We'll implement the rest later
      console.log('Logic to be implemented...');
      return { postId: 'new-post-id' };
    };
    ```

4.  **Define the Port Contracts:** Create the actual port definitions. They are just type-safe contracts at this point.

    ```typescript
    // domain/posts/post.ports.ts
    import { createPort } from '../../lib/di';
    import { Post } from './post.aggregate';
    import { User } from '../users/user.entity'; // Assuming a User entity exists

    export const findUserByIdPort = createPort<(dto: { id: string }) => Promise<User | null>>();
    export const savePostPort = createPort<(post: Post) => Promise<void>>();
    ```

**Result of Step 1:** We have a clear, but unimplemented, definition of our feature's inputs and dependencies.

### Step 2: Implement the Domain Logic

Now, we build the core business objects (Aggregates) needed by the use case.

> For a detailed explanation of this layer, see [Domain Modeling in Sota](./domain-modeling.md).

1.  **Create the Aggregate:** Following the modeling guide, create the `Post` aggregate.

    ```typescript
    // domain/posts/post.aggregate.ts
    import { z } from 'zod';

    const PostPropsSchema = z.object({ /* ... */ });
    type PostProps = z.infer<typeof PostPropsSchema>;

    export class Post {
      private readonly props: PostProps;
      private constructor(props: PostProps) { this.props = props; }

      public static create(data: { authorId: string, title: string, content: string }): Post {
        const props = PostPropsSchema.parse({ id: crypto.randomUUID(), ...data });
        return new Post(props);
      }

      // ... other business logic methods like publish(), updateTitle(), etc.
    }
    ```

2.  **Flesh out the Use Case:** Now, connect the domain logic to the use case.

    ```typescript
    // application/use-cases/create-post.use-case.ts
    // ... (imports)
    import { Post } from '../../domain/posts/post.aggregate';

    export const createPostUseCase = async (input: CreatePostInput) => {
      const findUserById = usePort(findUserByIdPort);
      const savePost = usePort(savePostPort);

      // 1. Check preconditions using a port
      const author = await findUserById({ id: input.authorId });
      if (!author || !author.canPost()) { // Assuming User has business logic
        throw new Error('Author is not allowed to create posts.');
      }

      // 2. Create the aggregate
      const post = Post.create(input);

      // 3. Persist the new aggregate using a port
      await savePost(post);

      return { postId: post.id };
    };
    ```

**Result of Step 2:** We have a fully defined piece of business logic, but it's still untestable because the ports have no implementation.

### Step 3: Test the Business Logic in Isolation

This is the most important step. We will test our entire business flow without touching a real database or API.

1.  **Create the Test File:** `application/use-cases/create-post.use-case.test.ts`

2.  **Write the Test:**

    ```typescript
    import { describe, it, expect, beforeEach, mock } from 'bun:test';
    import { resetDI, setPortAdapter } from '../../lib/di';
    import { createPostUseCase, CreatePostInputSchema } from './create-post.use-case';
    import { findUserByIdPort, savePostPort } from '../../domain/posts/post.ports';

    describe('createPostUseCase', () => {
      // 1. Create mock implementations for all port dependencies
      const mockFindUserById = mock(() => Promise.resolve({ id: 'user-1', canPost: () => true }));
      const mockSavePost = mock(() => Promise.resolve());

      beforeEach(() => {
        // 2. Reset the DI container before each test
        resetDI();
        // 3. Bind the ports to our MOCKS
        setPortAdapter(findUserByIdPort, mockFindUserById);
        setPortAdapter(savePostPort, mockSavePost);
      });

      it('should create and save a post for a valid user', async () => {
        const input = { authorId: 'user-1', title: 'My First Post', content: 'This is some valid content for the post.' };
        
        await createPostUseCase(input);

        // 4. Assert that our mocks were called correctly
        expect(mockFindUserById).toHaveBeenCalledWith({ id: 'user-1' });
        expect(mockSavePost).toHaveBeenCalled();
        // We can even inspect the object passed to the mock
        const savedPost = mockSavePost.mock.calls[0][0];
        expect(savedPost.title).toBe('My First Post');
      });

      it('should throw an error if the user cannot post', async () => {
        // Override the mock for this specific test case
        mockFindUserById.mockResolvedValue({ id: 'user-2', canPost: () => false });
        const input = { authorId: 'user-2', title: 'A Post', content: 'Some content' };

        await expect(createPostUseCase(input)).rejects.toThrow('Author is not allowed to create posts.');
      });
    });
    ```

**Result of Step 3:** We have 100% confidence that our business logic is correct. We have tested our rules and orchestration without any slow or flaky external dependencies.

### Step 4: Implement Infrastructure Adapters

Now, and only now, do we write code that talks to the outside world.

1.  **Create Adapter Files:**
    -   `infrastructure/db/prisma-user.adapter.ts`
    -   `infrastructure/db/prisma-post.adapter.ts`

2.  **Implement the Adapters:** Write the real code that implements the port contracts.

    ```typescript
    // infrastructure/db/prisma-post.adapter.ts
    import { Post } from '../../domain/posts/post.aggregate';
    import { prisma } from '../prisma-client'; // Your Prisma client instance

    export const savePostAdapter = async (post: Post) => {
      // This is where you map your rich domain object to a flat DB structure
      await prisma.post.create({
        data: {
          id: post.id,
          title: post.title,
          content: post.content,
          authorId: post.authorId,
          status: post.status,
        },
      });
    };
    ```

### Step 5: Bind Real Adapters in the Composition Root

Finally, in your application's main entry point, you wire everything together.

```typescript
// index.ts
import { setPortAdapter } from './lib/di';
import { findUserByIdPort, savePostPort } from './domain/posts/post.ports';
import { findUserByIdPrismaAdapter } from './infrastructure/db/prisma-user.adapter';
import { savePostAdapter } from './infrastructure/db/prisma-post.adapter';

// This is the only place where the domain and infrastructure are coupled
setPortAdapter(findUserByIdPort, findUserByIdPrismaAdapter);
setPortAdapter(savePostPort, savePostAdapter);

// The application is now fully configured and ready to run.
```

By following this workflow, you build robust, maintainable, and highly-testable features that are a pleasure to work with.