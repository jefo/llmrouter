# 2. Спецификация контрактов API

## 2.1. Аутентификация

Все запросы к API (кроме вебхуков) должны содержать заголовок:

`Authorization: Bearer <your_api_key>`

## 2.2. Эндпоинты

### GET /v1/models

Возвращает список моделей, доступных для использования.

**Успешный ответ (200 OK):**

```json
{
  "object": "list",
  "data": [
    {
      "id": "openrouter/openai/gpt-4o",
      "object": "model",
      "created": 1626777600,
      "owned_by": "openai",
      "pricing": {
        "prompt": "350.00 RUB/1M tokens",
        "completion": "1050.00 RUB/1M tokens"
      }
    }
    // ... другие модели
  ]
}
```

### POST /v1/chat/completions

Создает ответ модели на чат.

**Тело запроса:**

```json
{
  "model": "openrouter/openai/gpt-4o",
  "messages": [
    { "role": "user", "content": "Расскажи анекдот про программиста" }
  ],
  "stream": false // ВАЖНО: запросы с stream: true вернут ошибку
}
```

**Успешный ответ (200 OK):** Оригинальный OpenAI-совместимый ответ от провайдера.

**Ошибки:** См. `Error_Handling.md`.

### POST /v1/webhooks/telegram

Эндпоинт для приема вебхуков от Telegram Pay.

*   **Аутентификация**: Проверка HMAC-подписи в заголовке `telegram-webhook-signature`.
*   **Тело запроса**: Структура `SuccessfulPayment` от Telegram.
*   **Успешный ответ (200 OK)**: Пустое тело.
