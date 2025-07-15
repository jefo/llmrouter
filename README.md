📘 Инженерная документация: MVP российского аналога OpenRouter

🎯 Цель проекта

Создать LLM API-прокси-сервис для рынка СНГ, предоставляющий:

доступ к ведущим языковым моделям (GPT-4, Claude 3, Mistral, Gemini и др.),

оплату через Telegram Pay (на старте),

прозрачный биллинг с учётом токенов,

простой SDK и документацию для быстрого старта.

🧱 Архитектура

[ Клиент (SDK/бот/Web) ]
        │
        ▼
[ TypeScript Gateway (обвязка) ] ←→ Redis ←→ PostgreSQL
        │
        ▼
[ LiteLLM Proxy ]
        │
        ▼
[ OpenRouter API ]
        │
        ▼
[ Модели: GPT-4, Claude 3, Gemini... ]

Компоненты:

TypeScript Gateway — точка входа. Проверка ключей, биллинг, проксирование.

LiteLLM Proxy — стандартный OpenAI-совместимый прокси. Управление fallback, API маршрутизацией.

Redis — хранение rate-limit и runtime usage.

PostgreSQL — учёт токенов, ключей, транзакций, пользователей.

Telegram Pay — платёжный шлюз.

📦 Используемый стек

TypeScript + Hono или Express

LiteLLM (Docker)

PostgreSQL (ORM: Drizzle или Prisma)

Redis

Telegram Bot API

Docker Compose

Zod для валидации

🧩 Модули системы

1. 📘 Auth & API Keys

Генерация ключей (/v1/key/generate)

Привязка ключа к юзеру

Установка квот (в токенах или рублях)

Проверка авторизации через Bearer Header

2. 📊 Биллинг и учёт токенов

Хранение баланса токенов

Списание токенов по usage.total_tokens от LiteLLM

Лимиты и ограничения (daily, monthly, total)

История расходов

Пополнение через Telegram Pay

3. 📡 Прокси-запросов

Принимает OpenAI-совместимые вызовы (/v1/chat/completions и др.)

Форвард на LiteLLM, с подменой model → openrouter/

Обработка ошибок и прокидывание оригинальных ответов

Логгирование x-router-log-id

4. 🧾 Telegram Billing API

Привязка Telegram user ID к аккаунту

Генерация ссылок оплаты

Вебхуки на успешные платежи

Начисление токенов по тарифам

Базовые команды:

/start, /balance, /pay, /invite

5. 📄 Документация (публичная)

OpenAPI spec (/openapi.json)

Примеры вызова через curl, Python, Node.js

Гайды: как подключить LLM к своему боту / backend / IDE

⚙️ Конфигурация LiteLLM (пример)

general_settings:
  master_key: sk-admin-secret
  telemetry: true
api_keys:
  test-key: { monthly_quota: 1_000_000 }
model_list:
  - model_name: openrouter/gpt-4
    litellm_params:
      model: openrouter/openai/gpt-4
      api_key: <openrouter-key>

🧪 Тестирование

Unit-тесты для всех middleware и core-функций (auth, billing, proxy)

E2E тесты: LiteLLM ↔ Gateway ↔ Telegram Pay

Локальный запуск через docker-compose up

📈 Масштабирование

Перенос LiteLLM на отдельный сервис (при нагрузке)

Шардинг Redis (если >10k RPS)

Переход на ClickHouse для логов и аналитики

Stripe и другие платёжные шлюзы в будущем

🔐 Безопасность и антифрод

Rate limit на API ключи (Redis)

Защита от повторных оплат (webhook deduplication)

HMAC-подписи Telegram webhook

Контроль IP / страна (в будущем)

📅 Этапы внедрения

Этап

Цель

1. MVP

Генерация API-ключей, проксирование запросов, Telegram оплата

2. Биллинг

Учёт токенов, выставление тарифов, пополнение через Telegram

3. Документация

Публикация OpenAPI и SDK

4. Рост

Реферальная система, админка, Stripe/Qiwi подключение