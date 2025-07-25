# 1. Модель Ценообразования и Экономика

Этот документ определяет, как сервис зарабатывает деньги и как формируется стоимость для конечного пользователя.

## 1.1. Валюта и Баланс

*   **Валюта**: Все расчеты и балансы пользователей ведутся в российских рублях (RUB).
*   **Баланс**: Баланс пользователя хранится и отображается в рублях с точностью до копейки.

## 1.2. Принцип ценообразования

Мы используем модель "Cost-Plus" (затраты плюс).

1.  Мы берем базовую стоимость моделей у провайдера (OpenRouter) в USD.
2.  Мы конвертируем ее в RUB по внутреннему курсу, включающему комиссию за конвертацию и валютные риски.
3.  Мы добавляем собственную маржу для покрытия операционных расходов и получения прибыли.

Результатом является наш внутренний **Прайс-лист**.

## 1.3. Прайс-лист (Price List)

Прайс-лист — это внутренняя конфигурация системы, которая сопоставляет каждую доступную модель с ее стоимостью для пользователя.

**Пример прайс-листа для MVP:**

| model_name (ID модели)      | Цена за 1M токенов (Вход) | Цена за 1M токенов (Выход) |
| --------------------------- | ------------------------- | -------------------------- |
| `openrouter/openai/gpt-4o`  | 350.00 RUB                | 1050.00 RUB                |
| `google/gemini-flash-1.5`   | 30.00 RUB                 | 60.00 RUB                  |
| `anthropic/claude-3-haiku`  | 20.00 RUB                 | 90.00 RUB                  |

## 1.4. Расчет стоимости запроса

Стоимость одного API-запроса вычисляется по формуле:

`Cost = (prompt_tokens / 1,000,000 * Price_Input) + (completion_tokens / 1,000,000 * Price_Output)`

Эта логика инкапсулируется в `IUsageRepository`, который получает `usage` от OpenRouter и, используя `PriceList`, возвращает итоговую стоимость в рублях.
