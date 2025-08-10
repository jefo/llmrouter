# Domain Modeling Guidelines: Aggregate, Entity, or Value Object?

This guide is for developers new to Domain-Driven Design who need a practical, step-by-step process for modeling a business domain. The goal is to help you decide when to use a Value Object, an Entity, or an Aggregate.

## Before You Code: Start with the Language

First, talk to domain experts. Your primary goal is to understand the business and learn the **Ubiquitous Language**—the vocabulary that experts use to describe their own processes. Listen for the nouns and verbs they use. This language is the source of your future classes and methods.

## The 3-Step Modeling Process

Once you have a grasp of the language, follow these steps to build your model. We'll go from the simplest concept to the most complex.

### Step 1: Find the Value Objects (The Describers)

Value Objects (VOs) are the easiest to identify. They are objects that describe a characteristic of something else. They don't have a unique identity of their own; they are defined entirely by their attributes.

**Ask yourself these questions:**
- Does this concept describe a quality or measurement, rather than a unique thing?
- If I change one of its attributes, does it become a completely different object?
- Do I not care about tracking a specific instance of this concept?

**Litmus Test for a Value Object:**
- **[✓] No Unique ID:** It doesn't have a `.id` property.
- **[✓] Immutable:** Once created, it can never be changed.
- **[✓] Defined by its Attributes:** Two VOs are equal if all their attributes are the same.

**Examples:**
- `Money`: A value of "100 USD" is defined by its amount (100) and currency (USD). It's not a specific, trackable 100-dollar bill. If you change the amount to 101, it's a different `Money` object.
- `Address`: A shipping address is defined by its street, city, and zip. If the street changes, it's a new address.
- `DateRange`: Defined by its `start` and `end` dates.

**In Sota, you model a VO as an immutable class with a `zod` schema.**

### Step 2: Find the Entities (The Trackable Things)

Entities are the core objects in your domain that have a unique identity and a lifecycle. You care about *which specific one* you are dealing with, even if its attributes change over time.

**Ask yourself these questions:**
- Does this concept have a history? Do I need to track its changes over time?
- Is it a unique, identifiable "thing" in the domain?
- If I change its properties (like a person's name or address), is it still the same underlying thing?

**Litmus Test for an Entity:**
- **[✓] Has a Unique ID:** It has a stable identifier (`id`) that never changes throughout its life.
- **[✓] Mutable State:** Its attributes can change over time (e.g., a user's email can be updated).
- **[✓] Equality is Based on ID:** Two entity instances are considered the same if they have the same ID, even if their other attributes are different.

**Examples:**
- `User`: A user is still the same user even if they change their name.
- `Product`: A product in a catalog is the same product even if its price or description is updated.
- `Order`: An order placed by a customer has a unique ID and goes through various states (pending, paid, shipped).

### Step 3: Group into Aggregates (The Consistency Boundaries)

This is the most critical and challenging part. An Aggregate is a cluster of one or more entities and VOs that acts as a single unit for the purpose of data changes. Its job is to enforce **invariants**—business rules that must always be true for the group.

**Ask yourself this one, crucial question:**
> **When I change *this*, what else *must* be consistent within the same, single transaction?**

The answer to this question defines your boundary.

**Litmus Test for an Aggregate:**
- **[✓] It has a Root:** One entity within the aggregate is designated as the **Aggregate Root**. It's the only object the outside world is allowed to hold a reference to.
- **[✓] It Enforces Invariants:** The Aggregate Root contains the business logic to ensure the entire cluster of objects is always in a valid state. For example, an `Order` root ensures that the total price of its `OrderLine` items never exceeds a certain limit.
- **[✓] It is a Transactional Boundary:** Any change to any object inside the aggregate is part of a single transaction that begins and ends with the Aggregate Root.

#### Rules of Thumb for Defining Aggregates:

1.  **When in Doubt, Start Small.** Make a single entity its own aggregate. It is far easier to merge two small aggregates later than to split up one large, complex aggregate.
2.  **Reference Other Aggregates by ID Only.** This is the golden rule. An `Order` aggregate should contain a `customerId`, not the entire `Customer` object. This keeps aggregates decoupled and small.
3.  **One Transaction, One Aggregate.** Your use case should only ever load, modify, and save **one** aggregate instance per transaction. If a business process requires changing two aggregates, you use a domain event or a multi-step process orchestrated by the use case.

#### Walkthrough Example: E-Commerce

1.  **Language:** `Customer`, `Order`, `Product`, `Order Line`, `Address`, `Price`.
2.  **Value Objects:** `Address` and `Price` (Money) are descriptive attributes. They are VOs.
3.  **Entities:** `Customer`, `Product`, `Order`, and `Order Line` all seem to have unique IDs and lifecycles. They are entities.
4.  **Aggregates:**
    - **`Product`**: Can a product exist on its own? Yes. Does it have rules (e.g., stock cannot be negative)? Yes. **`Product` is an Aggregate Root.**
    - **`Customer`**: Can a customer exist on their own? Yes. **`Customer` is an Aggregate Root.**
    - **`Order` and `Order Line`**: 
        - Can an `Order Line` exist without an `Order`? No. It's part of an order.
        - If I add an `Order Line`, do I need to check a rule on the `Order` (e.g., "total order value cannot exceed $10,000")? Yes.
        - **Conclusion:** `Order` is the Aggregate Root. `Order Line` is an entity *inside* the `Order` aggregate. The outside world can only interact with `Order Line`s through the `Order`.

**Final Model:**
- **`Customer` Aggregate**
- **`Product` Aggregate**
- **`Order` Aggregate** (contains `OrderLine` entities and references `Customer` and `Product` by ID).