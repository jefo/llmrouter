import { Hono } from 'hono';
import { toHonoAdapter, createApiHandler } from './api-handler';
import { GetModelsQuery, GetModelsQueryInputSchema } from '../../application/use-cases/get-models.query'; // Import InputSchema
import { RegisterUserCommand, RegisterUserCommandInputSchema } from '../../application/use-cases/register-user.cmd'; // Import InputSchema

export const app = new Hono();

// Models endpoint
app.get('/v1/models', toHonoAdapter(createApiHandler(GetModelsQuery, GetModelsQueryInputSchema)));

// Register User endpoint
app.post('/v1/register', toHonoAdapter(createApiHandler(RegisterUserCommand, RegisterUserCommandInputSchema)));

// Health check route
app.get('/health', (c) => c.text('OK'));

// Global error handler for Hono (catches errors not caught by createApiHandler)
app.onError((err, c) => {
  console.error(`${err}`);
  return c.json({
    error: {
      code: "internal_server_error",
      message: "An unexpected error occurred.",
      type: "api_error",
      param: null,
    },
  }, 500);
});

// Custom 404 handler for Hono
app.notFound((c) => {
  return c.json({
    error: {
      code: "not_found",
      message: "The requested resource was not found.",
      type: "request_error",
      param: null,
    },
  }, 404);
});
