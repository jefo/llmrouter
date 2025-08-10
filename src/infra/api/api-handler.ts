import { Context } from 'hono';
import { ZodError, z } from 'zod'; // Import z for ZodType
import {
  DomainError,
  InvalidApiKeyError,
  InsufficientFundsError,
  UserLockedError,
  RateLimitExceededError,
  InvalidRequestError,
  UserAlreadyExistsError,
  InternalServerError,
} from '../../domain/errors'; // Adjust path as needed

// 1. Standardized Interfaces
export interface UniversalApiRequest {
  pathParams: Record<string, string>;
  queryParams: Record<string, any>;
  body: unknown;
}

export interface UniversalApiResponse {
  statusCode: number;
  body: unknown;
}

// A standard Use Case function signature
// UseCase now takes a validated input and returns a promise
type UseCase<TInput, TOutput> = (input: TInput) => Promise<TOutput>;

// 2. The Core Component: createApiHandler
// Now accepts an inputSchema to perform validation before calling the useCase
export function createApiHandler<TInput, TOutput>(
  useCase: UseCase<TInput, TOutput>,
  inputSchema: z.ZodType<TInput> // Add inputSchema parameter
) {
  return async (request: UniversalApiRequest): Promise<UniversalApiResponse> => {
    // Aggregate all inputs into a single object
    const rawInput = {
      ...(request.body || {}),
      ...request.pathParams,
      ...request.queryParams,
    };

    try {
      // Validate the raw input against the provided schema FIRST
      const validatedInput = inputSchema.parse(rawInput);

      // Execute the use case with the validated input
      const result = await useCase(validatedInput);

      // Default success response
      return {
        statusCode: 200,
        body: result,
      };
    } catch (error) {
      // Centralized Error Handling
      let statusCode: number = 500;
      let errorBody: any = {
        error: {
          code: "internal_server_error",
          message: "An unexpected error occurred.",
          type: "api_error",
          param: null,
        },
      };

      if (error instanceof ZodError) {
        statusCode = 400;
        errorBody = {
          error: {
            code: "invalid_request",
            message: "Validation failed",
            type: "request_error",
            errors: error.format(), // This provides a more detailed, structured error object
          },
        };
      } else if (error instanceof DomainError) {
        statusCode = mapDomainErrorToStatusCode(error);
        errorBody = {
          error: {
            code: error.code,
            message: error.message,
            type: error.type,
            param: error.param,
          },
        };
      } else if (error instanceof Error) {
        // Catch any other generic Error instances
        console.error("Unhandled application error:", error); // Log for debugging
        errorBody.error.message = error.message; // Expose generic error message for now, refine later if needed
      }

      return {
        statusCode,
        body: errorBody,
      };
    }
  };
}

// Helper to map DomainError types to HTTP status codes
function mapDomainErrorToStatusCode(error: DomainError): number {
  switch (error.constructor) {
    case InvalidApiKeyError:
      return 401;
    case InsufficientFundsError:
      return 402;
    case UserLockedError:
      return 403;
    case RateLimitExceededError:
      return 429;
    case InvalidRequestError:
      return 400;
    case UserAlreadyExistsError:
      return 409; // Conflict
    case InternalServerError:
      return 500;
    default:
      return 500; // Fallback for any unmapped DomainError
  }
}

// 3. The Hono Adapter: toHonoAdapter
export function toHonoAdapter<TInput, TOutput>(
  universalHandler: (request: UniversalApiRequest) => Promise<UniversalApiResponse>
) {
  return async (c: Context) => {
    let body: unknown;
    try {
      // Attempt to parse body as JSON, if content-type is appropriate
      if (c.req.header('Content-Type')?.includes('application/json')) {
        body = await c.req.json();
      } else {
        // For other content types, or if no body, use an empty object or null
        body = null;
      }
    } catch (e) {
      // If JSON parsing fails (e.g., malformed JSON), treat as bad request
      return c.json({
        error: {
          code: "invalid_request",
          message: "Malformed JSON body.",
          type: "request_error",
          param: null,
        },
      }, 400);
    }

    const request: UniversalApiRequest = {
      pathParams: c.req.param(),
      queryParams: c.req.query(),
      body: body,
    };

    const response = await universalHandler(request);

    return c.json(response.body, response.statusCode);
  };
}