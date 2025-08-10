import { app } from './infra/api/server';
import { setupDI } from './setup'; // Import the setupDI function

// Initialize DI container
setupDI();

const port = process.env.PORT ? parseInt(process.env.PORT) : 3000;

console.log(`Server is running on port ${port}`);

// Bun.serve is the entry point for Bun's HTTP server
// It takes a Hono app directly
export default {
  port,
  fetch: app.fetch,
};