# MFD-DSL Syntax Reference

Complete reference for all 19 constructs. Use this when writing or fixing `.mfd` files.

---

## Primitive Types

```
string  number  boolean  date  datetime  uuid  void
```

**Modifiers:** `type?` (optional), `type[]` (array), `Type1 | Type2` (union)

---

## 1. system

```mfd
system "MySystem" @version(1.0) {
  import "shared"
  import "auth"
}
```

Entry point. Contains imports and/or components.

## 2. component

```mfd
component Auth @status(active) {
  dep -> Database @type(postgres)
  secret JWT_SECRET @required @rotation(90d)
  # ... entities, flows, apis, etc.
}
```

Top-level grouping. Contains all other constructs except `system`.

## 3. entity

```mfd
entity User {
  id: uuid @unique
  email: string @format(email)
  name: string
  role: UserRole
  orders: Order[] @relation(one_to_many)
  created_at: datetime
}
```

**With inheritance:**
```mfd
entity BaseEntity @abstract {
  id: uuid @unique
  created_at: datetime
  updated_at: datetime
}

entity Timestamped @interface {
  created_at: datetime
  updated_at: datetime
}

entity User extends BaseEntity implements Timestamped {
  email: string @format(email)
  name: string
}
```

## 4. enum

```mfd
enum OrderStatus { pending, confirmed, shipped, delivered, cancelled }
```

Simple comma-separated values. Used by `state` machines and entity fields.

## 5. flow

```mfd
flow create_order(CreateOrderInput) -> Order | OrderError {
  # Creates a new order from cart items
  on OrderRequested
  -> validate_input(input)
  | invalid -> reject("Invalid order data")
  -> calculate_total(items)
  -> persist_order(order)
  -> emit(OrderCreated) @async
  emits OrderCreated
  return order
}
```

**Key elements:**
- `on EventName` — reactive trigger (event that starts this flow)
- `-> step(args)` — calls an operation (when operations exist in model)
- `| condition -> branch(args)` — conditional branch
- `-> emit(EventName) @async` — emit event step
- `emits EventName` — declares output events
- `return result` — return value

**With inheritance:**
```mfd
flow base_crud @abstract (Input) -> Output {
  -> validate(input)
  -> persist(entity)
  return entity
}

flow create_user extends base_crud (CreateUserInput) -> User {
  override persist -> create_with_defaults(entity)
  -> send_welcome_email(user)
}
```

## 6. state

```mfd
enum OrderStatus { pending, confirmed, shipped, delivered, cancelled }

state order_lifecycle : OrderStatus {
  pending -> confirmed : on OrderConfirmed
  confirmed -> shipped : on OrderShipped
  shipped -> delivered : on OrderDelivered
  * -> cancelled : on OrderCancelled
}
```

**Rules:**
- Must reference a declared `enum` after the colon
- State names must **exactly match** enum values (case-sensitive)
- `*` = wildcard (any state)
- `: on EventName` trigger is optional but recommended

## 7. event

```mfd
event OrderCreated {
  order_id: uuid
  customer_id: uuid
  total: number
  created_at: datetime
}
```

Server-side events. Used in flows (`on`, `emits`), operations, and state triggers.

**With inheritance:**
```mfd
event BaseEvent @abstract {
  id: uuid
  timestamp: datetime
}

event OrderCreated extends BaseEvent {
  order_id: uuid
  total: number
}
```

## 8. signal

```mfd
signal ThemeChanged {
  theme: string
}

signal CartUpdated {
  item_count: number
  total: number
}
```

Client-side events. Used in actions (`on SignalName`, `emits SignalName`). **Different from `event`** (server-side).

**With inheritance:**
```mfd
signal BaseSignal @abstract {
  timestamp: datetime
}

signal UIRefresh extends BaseSignal {
  component: string
}
```

## 9. operation

```mfd
operation validate_order(CreateOrderInput) -> boolean {
  # Validates order data before processing
  handles POST /v1/orders/items    # serves this API endpoint
  calls POST /v1/payments/charge   # consumes external API
  emits OrderValidated
  on OrderRequested
  enforces max_order_limit
}
```

**Key clauses:**
- `handles METHOD /path` — this operation serves an API endpoint
- `calls METHOD /path` — this operation consumes an endpoint (including `@external`)
- `emits EventName` — output event
- `on EventName` — input trigger
- `enforces rule_name` — links to a rule

**When operations exist in the model, flow steps are strictly validated against operation names.**

## 10. rule

```mfd
rule max_order_limit {
  when order.total > 10000
  then reject("Order exceeds maximum limit")
}
```

**With elseif/else:**
```mfd
rule pricing_tier {
  when quantity > 100
  then apply_bulk_discount("20%")
  elseif quantity > 50
  then apply_bulk_discount("10%")
  else apply_standard_price("0%")
}
```

**Clause order:** `when` -> `then` -> [`elseif` -> `then`]* -> `else`

The `else` clause must always be **last**. No `elseif` after `else`.

## 11. api

```mfd
api REST @prefix(/v1/orders) {
  GET /items -> Order[]
  GET /items/:id -> Order
  POST /items (CreateOrderInput) -> Order | OrderError @auth
  PUT /items/:id (UpdateOrderInput) -> Order @auth
  DELETE /items/:id -> void @auth
  STREAM /items/events -> OrderUpdated
}
```

**STREAM rules:**
- No input type: `STREAM /path -> EventType` (not `STREAM /path (Input) -> EventType`)
- Return type must be a declared **event** (not entity)
- Read-only subscription

**External API:**
```mfd
api REST @external @prefix(/v1/payments) {
  POST /charge (ChargeInput) -> ChargeResult
  GET /balance -> Balance
}
```

`@external` marks APIs consumed from third parties (Stripe, SendGrid, etc.).

## 12. dep

```mfd
dep -> Database @type(postgres)
dep -> Redis @type(redis)
dep -> Auth @type(internal)
```

Component dependency declaration. Must be inside a `component`.

## 13. secret

```mfd
secret JWT_SECRET @required @rotation(90d)
secret SMTP_API_KEY @required @provider(sendgrid)
secret DB_PASSWORD @required
```

Secret/credential declaration. Must be inside a `component`.

## 14. screen

```mfd
screen OrderList @layout(list) {
  uses DataTable -> orderTable
  uses SearchBar -> search
  form FilterForm {
    status: OrderStatus
    date_from: date
    date_to: date
  }
}
```

Container/composition of elements. Not a building block itself.

**With inheritance:**
```mfd
screen BaseList @abstract @layout(list) {
  uses DataTable -> table
}

screen Filterable @interface {
  form FilterForm { query: string }
}

screen OrderList extends BaseList implements Filterable {
  form FilterForm { query: string, status: OrderStatus }
}
```

## 15. element

```mfd
element DataTable @abstract {
  prop sortable: boolean
  prop paginated: boolean
  prop pageSize: number
}

element Clickable @interface {
  prop onClick: string
}

element OrderTable extends DataTable implements Clickable {
  prop onClick: string
  prop orders: Order[]
  form InlineEdit {
    status: OrderStatus
  }
}
```

Universal UI building block (page, modal, button, table, card, indicator, etc.).

## 16. action

Four mutually exclusive patterns:

**Imperative (calls endpoint):**
```mfd
action create_order(CreateOrderInput) {
  from OrderForm
  calls POST /v1/orders/items
  | success -> OrderDetail
  | error -> OrderForm
}
```

**Reactive STREAM (server-sent events):**
```mfd
action refresh_orders {
  from OrderList
  on STREAM /v1/orders/items/events
  | updated -> OrderList
}
```

**Reactive Signal (client-side):**
```mfd
action on_theme_change {
  from Dashboard
  on ThemeChanged
  | dark -> Dashboard
  | light -> Dashboard
}
```

**Pure (navigation/toggle, no calls or reactive):**
```mfd
action go_settings {
  from Dashboard
  | ok -> SettingsScreen
}
```

**With signal emission:**
```mfd
action add_to_cart {
  from ProductDetail
  emits CartUpdated
  | ok -> ProductDetail
}
```

**Rules:**
- Cannot mix `calls` with `on STREAM` or `on Signal`
- Cannot mix `on STREAM` with `on Signal`
- `| label -> ScreenName` for results (`end` for terminal)
- `from` must reference a declared screen

## 17. journey

```mfd
journey order_checkout @persona(customer) {
  ProductList -> ProductDetail : on SelectProduct
  ProductDetail -> Cart : on AddToCart
  Cart -> Checkout : on StartCheckout
  Checkout -> OrderConfirmation : on CompleteOrder
  OrderConfirmation -> end : on Finish
  * -> ProductList : on Reset
}
```

User journey through screens. `*` = wildcard origin. `end` = terminal.

## 18. import

```mfd
import "shared"
import "auth"
import "catalog"
```

References other `.mfd` files (without extension). Used in multi-file projects.

## 19. @decorators

Common decorators:
```
@version(1.0)           # system/component version
@status(active)         # lifecycle: active, implementing, deprecated, planned
@unique                 # entity field uniqueness
@format(email)          # field format validation
@min(0) @max(100)       # numeric constraints
@optional               # field is optional (prefer type? syntax)
@auth                   # endpoint requires authentication
@rate_limit(100/min)    # rate limiting
@cache(5m)              # caching duration
@async                  # async step in flow
@prefix(/v1/orders)     # API path prefix
@layout(list)           # screen layout hint
@impl(src/path.ts)      # implementation file path(s)
@tests(passing)         # test status
@requires(admin)        # role requirement
@rotation(90d)          # secret rotation period
@provider(aws)          # secret/service provider
@external               # external API (third-party)
@abstract               # can be extended, cannot be instantiated
@interface              # contract that must be implemented
@relation(one_to_many)  # entity field relationship cardinality
```

---

## Decision Trees

### Which action pattern?

```
Does the action call an API endpoint?
  YES -> Imperative: use `calls METHOD /path`
  NO ->
    Does it react to server events?
      YES -> Reactive STREAM: use `on STREAM /path`
      NO ->
        Does it react to client-side events?
          YES -> Reactive Signal: use `on SignalName`
          NO -> Pure: just `from` + result branches
```

### event vs signal?

```
Server-side (backend emits, triggers flows/state)?
  YES -> event
Client-side only (UI state, theme, navigation)?
  YES -> signal
```

### @abstract vs @interface?

```
Provides partial implementation (shared fields/steps)?
  YES -> @abstract (can be extended with `extends`)
Defines pure contract (fields/props that must exist)?
  YES -> @interface (can be implemented with `implements`)
Both?
  NO -> @abstract and @interface CANNOT coexist on the same construct
```

### Where to define in multi-file?

Two sharing mechanisms exist:
- **shared.mfd** (no `component` block) = Shared Vocabulary: enums, @abstract, @interface
- **Shared component** (with `component` block, e.g. `protocolo.mfd`) = Protocol: integration events, signals, integration state machines

Decision tree by construct type:

```
enum?
  Used by 2+ components? -> shared.mfd (Shared Vocabulary)
  Used by 1 component?   -> <component>.mfd

entity @abstract or @interface?
  -> shared.mfd (Shared Vocabulary)

entity (concrete, managed)?
  -> <managing-component>.mfd (Ownership Principle)
  NEVER in shared.mfd — managed entities have an owner

event or signal (integration)?
  Emitted by one component, consumed by others?
  -> protocolo.mfd (component Protocol)
  Used internally by 1 component?
  -> <component>.mfd

state machine?
  Transitions triggered by integration events?
  -> protocolo.mfd (component Protocol)
  Local to one component?
  -> <component>.mfd

flow, operation, rule, api?
  -> ALWAYS in <component>.mfd (never shared)

screen, action, journey, element?
  -> ALWAYS in <component>.mfd (never shared)

system + imports?
  -> main.mfd
```

**Three named patterns:**

| Pattern | File | Contains |
|---------|------|----------|
| Shared Vocabulary | `shared.mfd` (no component) | enums, @abstract, @interface |
| Shared Domain | `<name>.mfd` (with component) | managed entities + enums + state machines |
| Protocol | `protocolo.mfd` (with component) | integration events, signals, protocol enums |

**Anti-pattern: God Core** — If 60%+ of constructs are centralized in a single component, redistribute: managed entities to their owning component, integration events to a Protocol component, base types to shared.mfd.

---

## Reserved Words

```
system component entity enum flow state event signal operation
rule api dep secret screen element action journey
import include
extends implements override
on emits handles calls enforces
when then elseif else
return
from uses prop form
string number boolean date datetime uuid void
STREAM GET POST PUT PATCH DELETE
```
