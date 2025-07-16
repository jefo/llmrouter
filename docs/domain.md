# Domain Model Documentation

## 1. Ubiquitous Language (Единый Язык)

- **User**: Клиент сервиса, идентифицируемый через Telegram ID. Является владельцем API-ключей и Транзакций.
- **ApiKey**: Учетные данные для аутентификации запросов к Шлюзу.
- **Transaction**: Неизменяемая запись о финансовой операции. Бывает типов `top-up` (пополнение) и `usage` (списание за использование).
- **Usage**: **Value Object**, содержащий данные о потреблении токенов (`prompt_tokens`, `completion_tokens`, `model_name`), полученные от OpenRouter. Хранится внутри `usage`-транзакции.
- **Balance**: **Вычисляемое значение** в рублях. Не хранится в БД, всегда рассчитывается на лету.
- **PriceList**: Агрегат, хранящий цены в рублях за 1M токенов для каждой модели.
- **Quota**: Сущность для управления Rate Limiting.

## 2. Bounded Contexts (Ограниченные Контексты)

### 2.1. Core Domain: "Billing & Access Context"

**Responsibilities**:
- Управление `User` и `ApiKey`.
- Хранение истории операций в виде `Transaction`.
- Управление `PriceList`.
- **Вычисление** `Balance` и `Usage Cost`.
- Авторизация запросов.

**Key Aggregates**:
- `User`
- `Transaction`
- `PriceList`

**Key Domain Services**:
- `BalanceCalculator`
- `UsageCostCalculator`

## 3. Core Domain Design: Billing & Access Context

### Aggregates

#### User Aggregate
- **Root**: `User`
- **Behavior**: `generateApiKey()`, `revokeApiKey()`

#### Transaction Aggregate
- **Root**: `Transaction` (identified by `TransactionId`)
- **State**: `UserId`, `Type` ('top-up' | 'usage'), `Timestamp`, `Status`
- **Data**:
  - For `top-up`: `amount_kopecks` (e.g., 50000)
  - For `usage`: `usage_data` (Value Object: `{prompt_tokens, completion_tokens, model_name}`)

#### PriceList Aggregate
- **Root**: `PriceList`
- **Entities**: `Price` (model_name, input_price_kopecks, output_price_kopecks)

### Domain Services

#### UsageCostCalculator
- **Purpose**: Рассчитывает стоимость одного `Usage` в копейках.
- **Method**: `calculate(usage_data: Usage, priceList: PriceList): number`
- **Logic**: Инкапсулирует формулу расчета на основе токенов и цен из прайс-листа.

#### BalanceCalculator
- **Purpose**: Реализует бизнес-правило "Баланс всегда вычисляется на лету". Является **оркестратором**, а не простой считалкой.
- **Dependencies**: `ITransactionRepository`, `IPriceListRepository`, `UsageCostCalculator`.
- **Method**: `calculateFor(userId: UserId): Money`
- **Flow**:
    1. Получает **все** транзакции пользователя.
    2. Получает **актуальный** прайс-лист.
    3. Итерирует по транзакциям, суммируя пополнения и вычитая стоимость каждого `usage`, предварительно рассчитанную через `UsageCostCalculator`.

### Repository Contracts

- `IUserRepository`: `findById`, `findByApiKey`, `save`.
- `ITransactionRepository`: `save`, `findAllByUserId`.
- `IPriceListRepository`: `findActive`, `save`.
- `IQuotaRepository`: `findById`, `save`.
