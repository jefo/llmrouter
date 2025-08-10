import { describe, it, expect, beforeEach } from "bun:test";
import { app } from "./server"; // Import the Hono app instance
import { setupDI } from "../../setup"; // Import the DI setup function
import { resetDI } from "../../lib/di"; // Import resetDI for test isolation

describe("API Integration Tests", () => {
  beforeEach(() => {
    resetDI(); // Reset DI container before each test
    setupDI(); // Re-setup DI bindings
  });

  it("GET /v1/models should return a list of models", async () => {
    const req = new Request("http://localhost/v1/models");
    const res = await app.request(req);

    expect(res.status).toBe(200);

    const json = await res.json();

    expect(json).toEqual({
      object: "list",
      data: expect.arrayContaining([
        expect.objectContaining({
          id: "openrouter/openai/gpt-4o",
          object: "model",
          pricing: {
            prompt: "350.00 RUB/1M tokens",
            completion: "1050.00 RUB/1M tokens",
          },
        }),
        expect.objectContaining({
          id: "google/gemini-flash-1.5",
          object: "model",
          pricing: {
            prompt: "30.00 RUB/1M tokens",
            completion: "60.00 RUB/1M tokens",
          },
        }),
      ]),
    });
    expect(json.data.length).toBe(3); // Expecting 3 active models from in-memory adapter
  });

  it("POST /v1/register should register a new user", async () => {
    const telegramId = 12345;
    const req = new Request("http://localhost/v1/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telegramId }),
    });
    const res = await app.request(req);

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.userId).toBe('string');
    expect(typeof json.apiKey).toBe('string');
    expect(json.userId).toMatch(/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/); // UUID format
    expect(json.apiKey).toMatch(/^sk-[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/); // sk-UUID format
  });

  it("POST /v1/register should return 409 if user already exists", async () => {
    const telegramId = 54321;

    // First registration
    let req = new Request("http://localhost/v1/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId }),
    });
    let res = await app.request(req);
    expect(res.status).toBe(200); // Should succeed

    // Second registration with same telegramId
    req = new Request("http://localhost/v1/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ telegramId }),
    });
    res = await app.request(req);

    expect(res.status).toBe(409); // Should conflict
    const json = await res.json();
    expect(json).toEqual({
      error: {
        code: "user_already_exists",
        message: `User with telegramId ${telegramId} already exists.`, // Use backticks for template literal
        type: "auth_error",
        param: null,
      },
    });
  });

  it("POST /v1/register should return 400 for invalid input", async () => {
    const req = new Request("http://localhost/v1/register", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ telegramId: "not-a-number" }), // Invalid input
    });
    const res = await app.request(req);

    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json).toEqual(
      expect.objectContaining({
        error: expect.objectContaining({
          code: "invalid_request",
          message: "Validation failed",
          type: "request_error",
          errors: expect.objectContaining({ // Expecting an object for errors
            _errors: expect.any(Array), // Global errors
            telegramId: expect.objectContaining({ // Field-specific errors
              _errors: expect.arrayContaining([
                "Invalid input: expected number, received string"
              ]),
            }),
          }),
        }),
      })
    );
  });

  it("GET /health should return OK", async () => {
    const req = new Request("http://localhost/health");
    const res = await app.request(req);

    expect(res.status).toBe(200);
    expect(await res.text()).toBe("OK");
  });

  it("should return 404 for unknown routes", async () => {
    const req = new Request("http://localhost/unknown-route");
    const res = await app.request(req);

    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json).toEqual({
      error: {
        code: "not_found",
        message: "The requested resource was not found.",
        type: "request_error",
        param: null,
      },
    });
  });
});