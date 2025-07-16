# 5. Руководство по обработке ошибок

## 5.1. Стандартная структура ответа

```json
{
  "error": {
    "code": "INSUFFICIENT_FUNDS",
    "message": "Your balance is below zero. Please top up your account to continue using the API.",
    "type": "billing_error",
    "param": null
  }
}
```

## 5.2. Коды ошибок

| HTTP Status | error.code            | error.message (Пример)                                     | error.type         |
| ----------- | --------------------- | ---------------------------------------------------------- | ------------------ |
| 401         | invalid_api_key       | Invalid API key provided.                                  | auth_error         |
| 402         | insufficient_funds    | Your balance is below zero. Please top up your account.    | billing_error      |
| 403         | user_locked           | Your account is locked due to a negative balance.          | billing_error      |
| 429         | rate_limit_exceeded   | You have exceeded the rate limit. Please try again later.  | rate_limit_error   |
| 400         | invalid_request       | stream: true is not supported in this version.             | request_error      |
| 500         | internal_server_error | An unexpected error occurred. Please contact support.      | api_error          |
