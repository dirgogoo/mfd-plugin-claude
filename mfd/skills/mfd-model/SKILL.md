---
name: mfd-model
description: Create or edit an MFD model through natural language conversation. Use when the user wants to define, modify, or evolve a system model.
user-invocable: true
---

# /mfd-model — Create or Edit MFD Model

You are now in **MFD modeling mode**. Your job is to generate or edit `.mfd` files based on the user's natural language description.

## Arguments

`$ARGUMENTS` — Optional: path to existing .mfd file to edit, or description of what to model.

## Protocol

0. **Load modeling protocol.** Run:
   ```
   mfd_prompt get modelagem
   ```
   This loads the clarifying questions protocol, completeness checklist, and modeling patterns. Follow this protocol for all modeling decisions.

1. **Understand the domain.** Ask clarifying questions about:
   - What entities exist and their key fields
   - What operations/flows the system supports
   - What states entities go through
   - What events are emitted
   - What business rules apply
   - What APIs are exposed

2. **Generate the model.** Write a complete `.mfd` file following these rules:
   - Use semantic comments (`#`) to explain business decisions
   - Include appropriate decorators (`@status`, `@version`, etc.)
   - Use proper type references (entities, enums, primitives)
   - Organize constructs logically within components

3. **Validate immediately.** After writing the .mfd file, run:
   ```bash
   npx mfd validate <file>
   ```
   Fix any errors before presenting to the user.

4. **Show stats.** Run:
   ```bash
   npx mfd stats <file>
   ```

5. **Consider multi-file structure.** For projects with 3+ components or 200+ lines:
   - Generate `main.mfd` with system declaration + `import` statements
   - Generate one file per component (kebab-case: `FichaTecnica` -> `ficha-tecnica.mfd`)
   - Generate `shared.mfd` for entities/enums used by 2+ components
   - For smaller projects (< 3 components, < 200 lines), a single file is acceptable

6. **Present the result.** Show:
   - A natural language summary of the model
   - The key design decisions made
   - Completeness metrics
   - Suggestions for what to add next

## MFD-DSL Syntax Reference

### Structure
```mfd
system "Name" @version(1.0) {
  import "shared"
  import "auth"
  component Name @status(active) {
    dep -> OtherComponent @type(kind)
    secret SECRET_NAME @required

    entity Name { field: type @decorator }
    enum Name { value1, value2, value3 }
  }
}
```

### Inheritance and Interfaces
```mfd
# Abstract entity — provides shared fields, cannot be used directly
entity BaseUser @abstract {
  id: uuid @unique
  email: string @format(email)
}

# Interface entity — defines a contract of required fields
entity Timestamped @interface {
  created_at: datetime
  updated_at: datetime
}

# Concrete entity — extends ONE parent, implements MULTIPLE interfaces
entity Admin extends BaseUser implements Timestamped {
  permissions: string[]
  created_at: datetime
  updated_at: datetime
}

# Abstract flow with override
flow crud @abstract (Input) -> Output {
  -> validate(input)
  -> persist(entity)
  return entity
}

flow create_user extends crud (UserInput) -> User {
  override persist -> create_with_defaults(entity)
  -> send_welcome_email(user)
}

# Component interfaces (capability contracts)
component PaymentProvider @interface {
  operation charge(ChargeInput) -> Charge
}

component StripeProvider implements PaymentProvider {
  operation charge(ChargeInput) -> Charge { emits ChargeDone }
}

# Event inheritance
event DomainEvent @abstract { id: uuid, timestamp: datetime }
event OrderPlaced extends DomainEvent { orderId: uuid }

# Signal (client-side event, separate from server-side event)
signal BaseSignal @abstract { timestamp: datetime }
signal ThemeChanged extends BaseSignal { theme: string }
signal CartUpdated { itemCount: number }

# Screen inheritance
screen CrudList @abstract @layout(list) { uses ListItem -> item }
screen UserList extends CrudList { uses UserItem -> item }
```

**Rules:**
- `extends`: max 1 parent, parent MUST have `@abstract`
- `implements`: N interfaces, each MUST have `@interface`
- `@abstract` + `@interface` on same construct = error
- `override` only in flows that extend another flow
- Events do NOT support `@interface` or `implements`
- Signals do NOT support `@interface` or `implements` (only `extends`)
- Order: `name extends Parent implements Iface1, Iface2 @decorators`

### Behavior
```mfd
operation name(ParamType) -> ReturnType {
  # Description of what this operation does
  handles POST /v1/resource/items    # serves this endpoint
  calls POST /v1/external/charge     # consumes endpoint (incl @external)
  emits EventName
  on TriggerEvent
  enforces rule_name
}

flow name(ParamType) -> ReturnType | ErrorType {
  # Description of what this flow does
  handles POST /v1/items           # serves this endpoint (flows only — operations use calls)
  handles PUT /v1/items/:id        # can have multiple handles
  on TriggerEvent
  -> step_one(args)
  -> step_two(result)
  | condition -> branch_step()
  -> emit(EventName) @async
  emits OutputEvent
  return result
}

state lifecycle : StatusEnum {
  state1 -> state2 : on EventName
  * -> cancelled : on CancelledEvent @requires(admin)
  # Reactive pattern: triggers should reference declared events
}

event EventName {
  field: type
}
```

### Contracts
```mfd
api @prefix(/v1/resource) {
  GET    /items -> Item[]
  POST   /items (CreateInput) -> Item | ValidationError
  GET    /items/:id -> Item | NotFound @auth
  PUT    /items/:id (UpdateInput) -> Item @auth
  DELETE /items/:id -> void @auth @requires(admin)
  STREAM /items/events -> ItemUpdated
}

# External API consumed from a third-party (Stripe, SendGrid, etc.)
api REST @external @prefix(/v1) {
  POST /charges (ChargeInput) -> Charge
}

rule rule_name {
  # Business justification
  when condition
  then action("message")
}

dep -> TargetComponent @type(kind) @optional

secret SECRET_NAME @required @rotation(90d) @provider(vault)
```

### Types
- Primitives: `string`, `number`, `boolean`, `date`, `datetime`, `uuid`, `void`
- Optional: `type?`
- Array: `type[]`
- Union: `Type1 | Type2`

### Common Decorators
`@version(n)` `@status(v)` `@unique` `@format(v)` `@min(n)` `@max(n)` `@optional` `@auth` `@rate_limit(r)` `@cache(d)` `@async` `@prefix(p)` `@impl(path, ...)` `@tests(v)` `@requires(role)` `@external`

### Experience
```mfd
screen ScreenName @layout(list) {
  uses ElementName -> alias
  form FormName { field: type }
}

# Imperative action (calls an API endpoint)
action create_item(CreateInput) {
  from ScreenName
  calls POST /v1/resource/items
  | success -> DetailScreen
  | error -> end
}

# Reactive action (subscribes to a STREAM endpoint)
action refresh_list {
  from ScreenName
  on STREAM /v1/resource/items/events
  | updated -> ScreenName
}

journey journey_name @persona(role) {
  ScreenA -> ScreenB : on trigger
  ScreenB -> end : on exit
  * -> ScreenA : on reset
}
```

## Important Rules

- ALWAYS validate the generated .mfd file
- ALWAYS use semantic comments to explain WHY, not what
- NEVER leave type references unresolved (entity/enum fields must reference declared types)
- Prefer explicit over implicit — declare all entities, even simple DTOs
- Group related constructs within the same component
- API declarations MUST include a style keyword (REST, GraphQL, or gRPC) before decorators
- STREAM endpoints must NOT have input types (subscriptions are read-only) and MUST return a declared event type
- Actions use TWO mutually exclusive patterns: imperative (`calls METHOD /path`) OR reactive (`on STREAM /path`) — never both
- `on STREAM /path` must reference a STREAM endpoint declared in an API block (with prefix resolved)
- Flow `on EventName` triggers the flow reactively when the event occurs — the event must be declared
- Flow `emits EventName` declares that the flow produces a side-effect event — the event must be declared
- `api @external` marks an API consumed from a third-party provider (Stripe, SendGrid, etc.), NOT exposed by the system
