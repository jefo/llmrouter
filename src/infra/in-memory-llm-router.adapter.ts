import { LlmRouterAdapter } from "@/domain/interfaces";
import { Usage } from "@/domain/usage.vo";

export class InMemoryLlmRouterAdapter implements LlmRouterAdapter {
  // Заглушка для проксирования запросов к LLM
  async proxyChatCompletion(
    payload: any
  ): Promise<{ response: any; usage: Usage }> {
    // Имитация ответа от OpenRouter
    const mockResponse = {
      id: "chatcmpl-mock",
      object: "chat.completion",
      created: Date.now(),
      model: payload.model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "This is a mock response from " + payload.model,
          },
          logprobs: null,
          finish_reason: "stop",
        },
      ],
    };

    const mockUsage: Usage = {
      prompt_tokens: 10,
      completion_tokens: 20,
      model_name: payload.model,
    };

    return {
      response: mockResponse,
      usage: mockUsage,
    };
  }
}
