# 3. Детальная схема базы данных

### Таблица `users`

| Column          | Type          | Constraints           | Description                                           |
| --------------- | ------------- | --------------------- | ----------------------------------------------------- |
| id              | SERIAL        | PRIMARY KEY           | Внутренний ID                                         |
| telegram_id     | BIGINT        | UNIQUE NOT NULL       | ID в Telegram                                         |
| balance_kopecks | BIGINT        | NOT NULL DEFAULT 0    | Больше не используется. Заменено вычисляемой логикой. |
| is_locked       | BOOLEAN       | NOT NULL DEFAULT FALSE| Флаг блокировки при отрицательном балансе             |
| created_at      | TIMESTAMPTZ   | NOT NULL DEFAULT NOW()|                                                       |

### Таблица `api_keys`

| Column     | Type         | Constraints                   | Description                               |
| ---------- | ------------ | ----------------------------- | ----------------------------------------- |
| id         | SERIAL       | PRIMARY KEY                   | Внутренний ID                             |
| user_id    | INTEGER      | NOT NULL REFERENCES users(id) | Владелец ключа                            |
| key_prefix | VARCHAR(8)   | NOT NULL, INDEX               | Префикс для поиска (первые 7 символов)    |
| key_hash   | VARCHAR(255) | UNIQUE NOT NULL               | Хеш ключа (SHA256)                        |
| is_active  | BOOLEAN      | NOT NULL DEFAULT TRUE         | Отозван ли ключ                           |
| created_at | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()        |                                           |

### Таблица `transactions`

| Column              | Type         | Constraints                   | Description                               |
| ------------------- | ------------ | ----------------------------- | ----------------------------------------- |
| id                  | UUID         | PRIMARY KEY                   | ID транзакции                             |
| user_id             | INTEGER      | NOT NULL REFERENCES users(id) | Пользователь                              |
| amount_kopecks      | INTEGER      | NOT NULL                      | Сумма пополнения в копейках               |
| provider_invoice_id | VARCHAR(255) | UNIQUE NOT NULL               | ID от платежки для дедупликации           |
| status              | VARCHAR(50)  | NOT NULL                      | 'pending', 'completed', 'failed'          |
| created_at          | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()        |                                           |
| updated_at          | TIMESTAMPTZ  | NOT NULL DEFAULT NOW()        |                                           |

### Новая таблица `prices`

| Column                      | Type    | Constraints | Description                                  |
| --------------------------- | ------- | ----------- | -------------------------------------------- |
| model_name                  | VARCHAR(255) | PRIMARY KEY | ID модели (e.g., 'openrouter/openai/gpt-4o') |
| input_price_kopecks_per_1m  | BIGINT  | NOT NULL    | Цена за 1М входных токенов в копейках        |
| output_price_kopecks_per_1m | BIGINT  | NOT NULL    | Цена за 1М выходных токенов в копейках       |
| is_active                   | BOOLEAN | NOT NULL DEFAULT TRUE | Доступна ли модель пользователям             |
