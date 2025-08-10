# Методология DDD + Clean/Hexagonal Architecture в стиле FP + CQRS

Эта методичка описывает подход к разработке программного обеспечения, сочетающий принципы Domain-Driven Design (DDD) с архитектурными стилями Clean/Hexagonal Architecture, функциональным программированием (FP) и паттерном Command Query Responsibility Segregation (CQRS). Особое внимание уделяется реализации use-cases как функций с использованием хуков для внедрения зависимостей.

## 1. Основные Принципы и Инструменты

*   **DDD (Domain-Driven Design):** Моделирование предметной области.
*   **Clean/Hexagonal Architecture:** Отделение бизнес-логики от инфраструктуры.
*   **FP (Functional Programming):** Чистые функции, неизменяемые данные.
*   **CQRS (Command Query Responsibility Segregation):** Разделение операций чтения/записи.
*   **`bottle.js`:** Легковесный контейнер для Dependency Injection (DI).
*   **`bun:test`:** Фреймворк для тестирования.
*   **`zod`:** Библиотека для валидации схем и вывода типов.

## 2. Доменные Примитивы

### 2.1. Branded ID (Брендированный Идентификатор)

Идентификаторы сущностей и агрегатов должны быть брендированными Value Objects для обеспечения типобезопасности и переиспользуемости. Это позволяет различать `id` разных доменных объектов на уровне типов.

```typescript
// domain/shared/id.vo.ts
import { z } from 'zod';

// Generic-функция для создания брендированного ID
export const createBrandedId = <Brand extends string>(brand: Brand) => {
  // Схема для UUID с брендом
  const BrandedIdSchema = z.string().uuid().brand(brand);
  type BrandedIdProps = z.infer<typeof BrandedIdSchema>;

  class BrandedId {
    public readonly value: BrandedIdProps;

    private constructor(value: BrandedIdProps) {
      this.value = value;
    }

    public static create(value: string): BrandedId {
      // Валидация и брендирование через zod
      return new BrandedId(BrandedIdSchema.parse(value));
    }

    public equals(other: BrandedId): boolean {
      return this.value === other.value;
    }

    public toString(): string {
      return this.value;
    }
  }

  return BrandedId;
};

// Примеры использования:
// export const UserId = createBrandedId('UserId');
// export const OrderId = createBrandedId('OrderId');
// export const ProductId = createBrandedId('ProductId');
```

### 2.2. Value Object (Объект-значение)

Определяется своими атрибутами, неизменяем. Валидация через `zod`.

```typescript
// domain/shared/money.vo.ts
import { z } from 'zod';

const MoneySchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
});

type MoneyProps = z.infer<typeof MoneySchema>;

export class Money {
  public readonly amount: number;
  public readonly currency: string;

  private constructor(props: MoneyProps) {
    this.amount = props.amount;
    this.currency = props.currency;
  }

  public static create(props: MoneyProps): Money {
    MoneySchema.parse(props);
    return new Money(props);
  }

  public add(other: Money): Money {
    if (this.currency !== other.currency) {
      throw new Error('Cannot add money of different currencies');
    }
    return Money.create({
      amount: this.amount + other.amount,
      currency: this.currency,
    });
  }

  public equals(other: Money): boolean {
    return this.amount === other.amount && this.currency === other.currency;
  }
}
```

### 2.3. Entity (Сущность)

Определяется своей идентичностью (ID), имеет жизненный цикл. Валидация свойств через `zod`.

```typescript
// domain/user/user.entity.ts
import { z } from 'zod';
import { createBrandedId } from '../shared/id.vo';

// Брендированный ID для User
export const UserId = createBrandedId('UserId');
export type UserId = InstanceType<typeof UserId>;

const UserSchema = z.object({
  id: UserId.create, // Использование брендированного ID
  name: z.string().min(3),
  email: z.string().email(),
});

type UserProps = z.infer<typeof UserSchema>;

export class User {
  public readonly id: UserId;
  public name: string;
  public email: string;

  private constructor(props: UserProps) {
    this.id = props.id;
    this.name = props.name;
    this.email = props.email;
  }

  public static create(props: { id: string; name: string; email: string }): User {
    const parsedProps = UserSchema.parse({ ...props, id: UserId.create(props.id) });
    return new User(parsedProps);
  }

  public updateEmail(newEmail: string): void {
    this.email = z.string().email().parse(newEmail);
  }
}
```

### 2.4. Aggregate (Агрегат)

Кластер связанных объектов, рассматриваемых как единое целое. Имеет корневую сущность (Aggregate Root). Валидация свойств через `zod`.

```typescript
// domain/order/order.aggregate.ts
import { z } from 'zod';
import { createBrandedId } from '../shared/id.vo';
import { UserId } from '../user/user.entity';

export const OrderId = createBrandedId('OrderId');
export type OrderId = InstanceType<typeof OrderId>;

export const ProductId = createBrandedId('ProductId');
export type ProductId = InstanceType<typeof ProductId>;

const OrderSchema = z.object({
  id: OrderId.create,
  userId: UserId.create,
  items: z.array(z.object({
    productId: ProductId.create,
    quantity: z.number().positive(),
    price: z.number().positive(),
  })),
  status: z.enum(['pending', 'completed', 'cancelled']),
  createdAt: z.date(),
});

type OrderProps = z.infer<typeof OrderSchema>;

export class Order {
  public readonly id: OrderId;
  public readonly userId: UserId;
  public items: Array<{ productId: ProductId; quantity: number; price: number }>;
  public status: 'pending' | 'completed' | 'cancelled';
  public readonly createdAt: Date;

  private constructor(props: OrderProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.items = props.items;
    this.status = props.status;
    this.createdAt = props.createdAt;
  }

  public static create(props: { id: string; userId: string; items: Array<{ productId: string; quantity: number; price: number }>; status: 'pending' | 'completed' | 'cancelled'; createdAt: Date }): Order {
    const parsedProps = OrderSchema.parse({
      ...props,
      id: OrderId.create(props.id),
      userId: UserId.create(props.userId),
      items: props.items.map(item => ({ ...item, productId: ProductId.create(item.productId) }))
    });
    return new Order(parsedProps);
  }

  public completeOrder(): void {
    if (this.status !== 'pending') {
      throw new Error('Order cannot be completed unless it is pending.');
    }
    this.status = 'completed';
  }

  public addItem(productId: ProductId, quantity: number, price: number): void {
    this.items.push({ productId, quantity, price });
  }
}
```

## 3. Порты (Ports)

В функциональном подходе порты определяются как типы функций, а не абстрактные классы. Это позволяет избежать ООП-оберток и напрямую работать с функциями.

### 3.0. Утилита для создания портов

Для удобства и типобезопасности DI, порты создаются с помощью утилиты `createPort`, которая добавляет метаданные (имя) к функции-порту. Это имя используется `bottle.js` для регистрации и разрешения зависимостей.

```typescript
// di/create-port.ts

// Расширяем тип функции, добавляя свойство _name
type NamedFunction<T extends (...args: any[]) => any> = T & { _name: string };

// Утилита для создания порта с метаданными для DI
// TODO: Создает порт и регистрирует его в DI без импоементации. Позже мы сможем на СОЗДАННЫЙ порт навесить имплементацию
export function createPort<T extends (...args: any[]) => any>(
  name: string,
  portFunction: T
): NamedFunction<T> {
  // Присваиваем имя функции для использования в DI
  (portFunction as NamedFunction<T>)._name = name;
  return portFunction as NamedFunction<T>;
}
```

### 3.1. Domain Ports (Заменяют Репозитории)

Эти порты определяют контракты для взаимодействия с хранилищем доменных объектов. Для Агрегатов всегда создаются отдельные порты на чтение и запись. Для Сущностей (если они не являются частью агрегата и требуют прямого доступа) — только на чтение.

```typescript
// domain/user/ports.ts
import { User, UserId } from './user.entity';
import { createPort } from '../../di/create-port';

// Порт для чтения Сущностей (только чтение)
export const FindUserByIdPort = createPort(
  'FindUserByIdPort',
  (id: UserId) => Promise.resolve<User | null>(null) // Пример заглушки
);
export type FindUserByIdPort = typeof FindUserByIdPort;

export const FindUserByEmailPort = createPort(
  'FindUserByEmailPort',
  (email: string) => Promise.resolve<User | null>(null) // Пример заглушки
);
export type FindUserByEmailPort = typeof FindUserByEmailPort;

// domain/order/ports.ts
import { Order, OrderId, UserId } from './order.aggregate';
import { createPort } from '../../di/create-port';

// Порты для чтения Агрегатов
export const FindOrderByIdPort = createPort(
  'FindOrderByIdPort',
  (id: OrderId) => Promise.resolve<Order | null>(null) // Пример заглушки
);
export type FindOrderByIdPort = typeof FindOrderByIdPort;

export const FindOrdersByUserIdPort = createPort(
  'FindOrdersByUserIdPort',
  (userId: UserId) => Promise.resolve<Order[]>([] as Order[]) // Пример заглушки
);
export type FindOrdersByUserIdPort = typeof FindOrdersByUserIdPort;

// Порты для записи Агрегатов
export const SaveOrderPort = createPort(
  'SaveOrderPort',
  (order: Order) => Promise.resolve<void>(undefined) // Пример заглушки
);
export type SaveOrderPort = typeof SaveOrderPort;

export const DeleteOrderPort = createPort(
  'DeleteOrderPort',
  (id: OrderId) => Promise.resolve<void>(undefined) // Пример заглушки
);
export type DeleteOrderPort = typeof DeleteOrderPort;
```

### 3.2. Application Ports (Порты Приложения) и DTO

Эти порты определяют контракты для взаимодействия с внешними сервисами, которые нужны слою приложения (например, отправка уведомлений, интеграция с платежными системами). **Важно:** Порты приложения должны работать с Data Transfer Objects (DTO), которые определяются с помощью `zod` схем. Это обеспечивает четкое разделение между доменными объектами и данными, передаваемыми через границы системы.

```typescript
// application/ports/dtos/notification.dto.ts
import { z } from 'zod';

export const SendEmailNotificationDtoSchema = z.object({
  to: z.string().email(),
  subject: z.string().min(1),
  body: z.string().min(1),
});
export type SendEmailNotificationDto = z.infer<typeof SendEmailNotificationDtoSchema>;

// application/ports/notification.port.ts
import { SendEmailNotificationDto } from './dtos/notification.dto';
import { createPort } from '../../di/create-port';

export const SendEmailNotificationPort = createPort(
  'SendEmailNotificationPort',
  (dto: SendEmailNotificationDto) => Promise.resolve<void>(undefined) // Пример заглушки
);
export type SendEmailNotificationPort = typeof SendEmailNotificationPort;

// application/ports/dtos/payment.dto.ts
import { z } from 'zod';

export const ProcessPaymentRequestDtoSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().length(3),
  token: z.string().min(1),
});
export type ProcessPaymentRequestDto = z.infer<typeof ProcessPaymentRequestDtoSchema>;

export const ProcessPaymentResponseDtoSchema = z.object({
  success: z.boolean(),
  transactionId: z.string().uuid().optional(),
  errorMessage: z.string().optional(),
});
export type ProcessPaymentResponseDto = z.infer<typeof ProcessPaymentResponseDtoSchema>;

// application/ports/payment.port.ts
import { ProcessPaymentRequestDto, ProcessPaymentResponseDto } from './dtos/payment.dto';
import { createPort } from '../../di/create-port';

// TODO: createPort automaticly add ID property for DI and register it in container automaticly too
// later developer will use hook usePropt(ProcessPaymentPort) that will be resolved with impleentation from infrastructure layer with setPortAdapter(ProcessPaymentPort, ChatGPTPortAdapter)
export const ProcessPaymentPort = createPort(
  (request: ProcessPaymentRequestDto) => Promise.resolve<ProcessPaymentResponseDto>({
    success: true,
    transactionId: 'mock-transaction-id',
  }) // Пример заглушки
);
export type ProcessPaymentPort = typeof ProcessPaymentPort;
```

## 4. Слой Приложения: Use Cases (Команды и Запросы)

Use Cases реализуются как чистые функции, использующие хуки для получения зависимостей.

### 4.1. Dependency Injection с `bottle.js`

`bottle.js` используется для регистрации и разрешения зависимостей. Порты регистрируются по их `_name` свойству.

```typescript
// di/container.ts
import Bottle from 'bottlejs';

export const container = new Bottle();

// Generic метод для получения зависимостей (портов) внутри слоя приложения
export function usePort<T extends (...args: any[]) => any>(port: T & { _name: string }): T {
  return container.get(port._name);
}

// 1) TODO: добавить функцию которая зарегистрирует порт в DI - createPort.
// 2) TODO: добавить фцнкцию которая для зарегистрированного порта добавит реализацию, что позволит использовать usePort.

// TODO: implement setPortAdapter(port, adapterClass);

// Пример регистрации зависимостей (в инфраструктурном слое или при старте приложения)
// import { FindUserByIdPort, SaveOrderPort, SendEmailNotificationPort, ProcessPaymentPort } from '../domain/...'; // Импорт всех портов

// container.service(FindUserByIdPort._name, () => async (id) => { /* ... */ });
// container.service(SaveOrderPort._name, () => async (order) => { /* ... */ });
// container.service(SendEmailNotificationPort._name, () => async (dto) => { /* ... */ });
// container.service(ProcessPaymentPort._name, () => async (request) => { /* ... */ });
```

### 4.2. Command Use Case (Команда)

Изменяет состояние системы.

```typescript
// app/use-cases/create-order.command.ts
import { Order, OrderId, ProductId } from '../../domain/order/order.aggregate';
import { UserId } from '../../domain/user/user.entity';
import { SaveOrderPort } from '../../domain/order/ports';
import { SendEmailNotificationPort, SendEmailNotificationDto } from '../ports/notification.port';
import { usePort } from '../../di/container';
import { z } from 'zod';

const CreateOrderCommandSchema = z.object({
  userId: z.string().uuid(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().positive(),
    price: z.number().positive(),
  })),
});

export type CreateOrderCommandInput = z.infer<typeof CreateOrderCommandSchema>;

export const createOrder = async (input: CreateOrderCommandInput): Promise<OrderId> => {
  CreateOrderCommandSchema.parse(input);

  // Получение зависимостей через хуки (usePort) с использованием брендированных портов
  const saveOrder = usePort(SaveOrderPort);
  const sendEmailNotification = usePort(SendEmailNotificationPort);

  const newOrderId = OrderId.create(crypto.randomUUID());
  const newUserId = UserId.create(input.userId);
  const newItems = input.items.map(item => ({
    ...item,
    productId: ProductId.create(item.productId)
  }));

  const newOrder = Order.create({
    id: newOrderId.value,
    userId: newUserId.value,
    items: newItems,
    status: 'pending',
    createdAt: new Date(),
  });

  await saveOrder(newOrder);

  const notificationDto: SendEmailNotificationDto = {
    to: 'user@example.com',
    subject: `Order ${newOrderId.toString()} Created`,
    body: `Your order with ID ${newOrderId.toString()} has been successfully created.`,
  };
  await sendEmailNotification(notificationDto);

  return newOrderId;
};
```

### 4.3. Query Use Case (Запрос)

Получает данные без изменения состояния.

```typescript
// app/use-cases/get-order-by-id.query.ts
import { Order, OrderId } from '../../domain/order/order.aggregate';
import { FindOrderByIdPort } from '../../domain/order/ports';
import { usePort } from '../../di/container';
import { z } from 'zod';

const GetOrderByIdQuerySchema = z.object({
  orderId: z.string().uuid(),
});

export type GetOrderByIdQueryInput = z.infer<typeof GetOrderByIdQuerySchema>;

export const OrderDetailsDtoSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  status: z.enum(['pending', 'completed', 'cancelled']),
  totalAmount: z.number().positive(),
});
export type OrderDetailsDto = z.infer<typeof OrderDetailsDtoSchema>;

export const getOrderById = async (input: GetOrderByIdQueryInput): Promise<OrderDetailsDto | null> => {
  GetOrderByIdQuerySchema.parse(input);

  const findOrderById = usePort(FindOrderByIdPort);

  const orderId = OrderId.create(input.orderId);

  const order = await findOrderById(orderId);

  if (!order) {
    return null;
  }

  const orderDetails: OrderDetailsDto = {
    id: order.id.toString(),
    userId: order.userId.toString(),
    status: order.status,
    totalAmount: order.items.reduce((sum, item) => sum + item.price * item.quantity, 0),
  };

  return OrderDetailsDtoSchema.parse(orderDetails);
};
```

## 5. Порядок Имплементации (Workflow для Агента)

Рекомендуемый порядок имплементации для новой функциональности, оптимизированный для LLM-Агента:

1.  **Use Case (Application Layer):**
    *   Определите цель (команда или запрос).
    *   Создайте файл Use Case (например, `create-order.command.ts` или `get-order-by-id.query.ts`).
    *   Определите `zod` схему для входных данных (обычно строки для ID).
    *   Напишите функцию Use Case, используя `usePort` для получения необходимых портов. **Внутри Use Case преобразуйте входные строковые ID в брендированные Value Objects** перед передачей в доменную логику или порты.
    *   **Не имплементируйте доменную логику или инфраструктуру на этом этапе.** Просто определите сигнатуру и зависимости.

2.  **Domain (Domain Layer):**
    *   На основе потребностей Use Case, определите или уточните доменные объекты:
        *   **Branded IDs:** Создайте новые брендированные ID (например, `OrderId`, `UserId`) используя `createBrandedId`.
        *   **Value Objects:** Если нужны новые неизменяемые объекты-значения.
        *   **Entities:** Если нужны новые сущности (с ID). Используйте брендированные ID для свойства `id`.
        *   **Aggregates:** Если нужен новый агрегат (корневая сущность с инвариантами). Используйте брендированные ID для свойства `id` и для любых связанных ID других агрегатов/сущностей.
    *   Для каждого доменного объекта:
        *   Определите `zod` схему свойств, используя `BrandedId.create` для полей ID.
        *   Создайте класс с приватным конструктором и статическим фабричным методом `create` для валидации через `zod.parse`.
        *   Добавьте доменную логику (методы, изменяющие состояние агрегата/сущности или выполняющие операции для Value Object).
    *   Определите **типы функций портов** для взаимодействия с инфраструктурой, используя `createPort`:
        *   Для **Агрегатов**: отдельные типы функций для чтения (`Find<AggregateName>ByIdPort`, `Find<AggregateName>By<Property>Port`) и записи (`Save<AggregateName>Port`, `Delete<AggregateName>Port`). Методы должны принимать и возвращать брендированные ID.
        *   Для **Сущностей** (если они не являются частью агрегата и требуют прямого доступа): только типы функций для чтения (`Find<EntityName>ByIdPort`). Методы должны принимать и возвращать брендированные ID.

3.  **Application Ports (Порты Приложения) и DTO:**
    *   Определите `zod` схемы для Data Transfer Objects (DTO), которые будут использоваться портами приложения для входных и выходных данных.
    *   Создайте типы функций для портов приложения, используя `createPort` и эти DTO в качестве параметров и возвращаемых значений.

4.  **Tests (Unit/Integration) с `bun:test`:**
    *   Напишите юнит-тесты для доменных объектов (Branded IDs, Value Objects, Entities, Aggregates) и их доменной логики.
    *   Напишите юнит-тесты для Use Cases, мокая зависимости, полученные через `usePort`.
    *   Используйте `bun:test` для выполнения тестов.

5.  **Tests OK:**
    *   Запустите тесты (`bun test`).
    *   Убедитесь, что все тесты проходят. Это подтверждает корректность доменной логики и Use Cases в изоляции.

6.  **Infra (Infrastructure Layer):**
    *   Реализуйте конкретные функции для каждого типа порта, определенного в доменном и прикладном слоях.
    *   Эти реализации будут взаимодействовать с внешними системами (базы данных, внешние API). **Важно:** В этом слое происходит преобразование брендированных ID обратно в примитивные типы (например, строки) для взаимодействия с БД/внешними API и наоборот. Также здесь происходит преобразование DTO в формат, необходимый для внешних систем, и наоборот.
    *   Зарегистрируйте эти конкретные функции в контейнере `bottle.js` по их `_name` свойству (см. пример `di/container.ts`).

## 6. Артефакты

*   **Исходный код:** Соответствует описанной архитектуре и принципам.
*   **Документация:** Данная методичка, диаграммы Bounded Contexts, агрегатов, потоков данных.
*   **Тесты:** Юнит-тесты для доменной логики и use-cases, интеграционные тесты для взаимодействия со слоем инфраструктуры, написанные с использованием `bun:test`.

## 7. Метрики

*   **Тестируемость:** Высокий процент покрытия тестами доменной логики и use-cases. Легкость написания юнит-тестов с `bun:test`.
*   **Понятность:** Легкость понимания бизнес-логики и архитектуры новыми членами команды.
*   **Масштабируемость:** Возможность независимого развития, тестирования и развертывания Bounded Contexts.
*   **Гибкость:** Легкость адаптации к изменениям требований благодаря четкому разделению слоев и использованию хуков для DI через `bottle.js`.
*   **Производительность:** Соответствие требованиям по производительности для команд и запросов (особенно важно для CQRS).
*   **Согласованность:** Соблюдение принципов DDD, FP и Clean/Hexagonal Architecture по всей кодовой базе.
