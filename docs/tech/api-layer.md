# The API Layer: A Port & Adapter Approach

This document describes the Sota methodology for building a flexible, framework-agnostic API layer that remains true to the principles of Hexagonal Architecture.

## Philosophy: Your Framework is an Adapter

Instead of locking you into a specific web framework, Sota provides the core logic to wrap your use cases into a standardized format. You can then use a simple adapter to plug this logic into any web framework of your choice, be it Express, Fastify, Koa, or `bun:serve`.

This keeps your application logic completely decoupled from the delivery mechanism (the web framework).

## The Core Component: `createApiHandler`

The heart of this pattern is a single, framework-agnostic function: `createApiHandler`. Its job is to take a Sota use case and return a standardized, universal request handler.

```typescript
const universalHandler = createApiHandler(myUseCase);
```

This `universalHandler` performs the logic we described previously:
1.  **Input Aggregation:** It expects a generic `request` object and extracts the necessary data for the use case.
2.  **Execution:** It calls the use case with the aggregated input.
3.  **Error & Success Handling:** It catches errors (Zod, etc.) and formats a standardized `response` object (e.g., `{ statusCode: 200, body: ... }`).

This handler knows nothing about Express `req` or `res` objects; it is completely pure and testable in isolation.

## The Adapters: Connecting to the Real World

To connect this universal handler to a real web server, you use a framework-specific adapter. The adapter's only job is to translate the framework's native request/response objects to and from the universal format that `createApiHandler` understands.

---

## Deep Dive: Inside `createApiHandler`

To understand the pattern fully, let's look at a potential implementation of `createApiHandler` and the standardized interfaces it uses.

### 1. Standardized Interfaces

The handler operates on a universal, framework-agnostic request/response format.

```typescript
import { ZodError } from 'zod';

// The input that adapters must create from the native request
export interface UniversalApiRequest {
  pathParams: Record<string, string>;
  queryParams: Record<string, any>;
  body: unknown;
}

// The output that adapters will translate into a native response
export interface UniversalApiResponse {
  statusCode: number;
  body: unknown;
}

// A standard Sota use case function signature
type UseCase = (input: any) => Promise<any>;
```

### 2. The Factory Implementation

The factory itself is a higher-order function that returns the actual handler.

```typescript
export function createApiHandler(useCase: UseCase) {
  /**
   * This is the returned universal handler. It contains the core logic.
   */
  return async (request: UniversalApiRequest): Promise<UniversalApiResponse> => {
    // Step 1: Aggregate all inputs into a single object
    const input = {
      ...(request.body || {}),
      ...request.pathParams,
      ...request.queryParams,
    };

    try {
      // Step 2: Execute the use case with the aggregated input
      const result = await useCase(input);

      // Step 3: Handle success
      return {
        statusCode: 200, // Or 201 for POST, can be configured
        body: result,
      };
    } catch (error) {
      // Step 4: Handle errors

      if (error instanceof ZodError) {
        // Handle validation errors
        return {
          statusCode: 400,
          body: {
            message: 'Validation failed',
            errors: error.errors.map((e) => ({ path: e.path, message: e.message })),
          },
        };
      }

      if (error instanceof Error) {
        // Handle known business logic errors
        // This could be expanded to look for custom error types
        if (error.message.includes('not found')) {
          return { statusCode: 404, body: { message: error.message } };
        }
        // For other generic errors, return 500
        return { statusCode: 500, body: { message: error.message } };
      }

      // Handle unknown errors
      return {
        statusCode: 500,
        body: { message: 'An unexpected error occurred' },
      };
    }
  };
}
```



### Example: Using Sota with Express

Let's assume we have an adapter package `@sota/adapter-express`.

```typescript
// index.ts
import express from 'express';
import { createApiHandler, toExpress } from '@sota/adapter-express'; // Hypothetical adapter
import { bindPorts } from './composition-root';
import { createPostUseCase } from './application/use-cases/create-post';
import { findPostByIdUseCase } from './application/use-cases/find-post-by-id';

// 1. Standard Sota setup
bindPorts();
const app = express();
app.use(express.json());

// 2. Create universal handlers from your use cases
const createPostHandler = createApiHandler(createPostUseCase);
const findPostByIdHandler = createApiHandler(findPostByIdUseCase);

// 3. Use the adapter to plug the universal handlers into Express routes
app.post('/posts', toExpress(createPostHandler));
app.get('/posts/:id', toExpress(findPostByIdHandler));

// 4. You retain full control over your server
app.listen(3000, () => {
  console.log('Sota application running on Express server at port 3000');
});
```

### How the `toExpress` Adapter Works

The `toExpress` function is a higher-order function that takes your universal handler and returns a native Express request handler `(req, res, next) => { ... }`.

Inside, it would:
1.  Read the Express `req` object (`req.params`, `req.query`, `req.body`).
2.  Create the universal `request` object from this data.
3.  `await` the call to your `universalHandler(request)`.
4.  Take the universal `response` object that is returned.
5.  Use the Express `res` object to send the final HTTP response (e.g., `res.status(response.statusCode).json(response.body)`).

## Benefits of This Approach

-   **Framework-Agnostic:** Your core application logic can be served via Express today, Fastify tomorrow, or as a serverless function, with minimal changes.
-   **Highly Testable:** You can unit test your `createApiHandler` logic without ever spinning up a real HTTP server.
-   **Ultimate Flexibility:** You are not limited by the features Sota provides. You can still use any middleware or feature of your chosen web framework, as you have full control over its instance.