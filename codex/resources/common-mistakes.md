# MFD-DSL Common Mistakes

Top errors when writing `.mfd` files, with wrong and correct examples.

---

## 1. INHERIT_NOT_ABSTRACT — `extends` without `@abstract` on parent

**Error:** `entity 'Child' extends 'Parent' which is not marked @abstract`

```mfd
# WRONG
entity Parent { id: uuid }
entity Child extends Parent { name: string }

# CORRECT
entity Parent @abstract { id: uuid }
entity Child extends Parent { name: string }
```

Applies to: entity, component, flow, screen, element, event, signal.

---

## 2. INHERIT_NOT_INTERFACE — `implements` without `@interface` on target

**Error:** `entity 'User' implements 'Timestamped' which is not marked @interface`

```mfd
# WRONG
entity Timestamped { created_at: datetime }
entity User implements Timestamped { name: string }

# CORRECT
entity Timestamped @interface { created_at: datetime }
entity User implements Timestamped { name: string, created_at: datetime }
```

Remember: implementor must include all fields from interface.

---

## 3. DECORATOR_CONFLICT — `@abstract` + `@interface` on same construct

**Error:** `@abstract and @interface cannot coexist`

```mfd
# WRONG
entity BadEntity @abstract @interface { id: uuid }

# CORRECT — choose one:
entity AbstractBase @abstract { id: uuid }       # for shared implementation
entity ContractSpec @interface { id: uuid }       # for pure contract
```

---

## 4. STREAM_HAS_INPUT — STREAM with input type

**Error:** `STREAM endpoint must not have an input type`

```mfd
# WRONG
api REST @prefix(/api) {
  STREAM /events (FilterInput) -> OrderUpdated
}

# CORRECT — STREAM is read-only, no input
api REST @prefix(/api) {
  STREAM /events -> OrderUpdated
}
```

---

## 5. STREAM_INVALID_RETURN — STREAM returning entity instead of event

**Error:** `STREAM endpoint returns 'Order' which is not a declared event`

```mfd
# WRONG
entity Order { id: uuid }
api REST @prefix(/api) {
  STREAM /orders/events -> Order    # Order is entity, not event!
}

# CORRECT — declare an event for the stream
event OrderUpdated { order_id: uuid, status: string }
api REST @prefix(/api) {
  STREAM /orders/events -> OrderUpdated
}
```

---

## 6. ACTION_MIXED_PATTERNS — mixing action patterns

**Error:** `Action cannot have both 'calls' and reactive trigger`

```mfd
# WRONG — mixes imperative and reactive
action bad_action {
  from MyScreen
  calls POST /api/items          # imperative
  on STREAM /api/items/events    # reactive
  | ok -> MyScreen
}

# CORRECT — split into two actions
action create_item(Input) {
  from MyScreen
  calls POST /api/items
  | ok -> MyScreen
}

action listen_items {
  from MyScreen
  on STREAM /api/items/events
  | update -> MyScreen
}
```

Also cannot mix `on STREAM` with `on Signal` in same action.

---

## 7. RULE_CLAUSE_ORDER — `else` before `elseif`

**Error:** `Rule has 'elseif' after 'else'`

```mfd
# WRONG
rule pricing {
  when qty > 100
  then bulk("20%")
  else standard("0%")
  elseif qty > 50          # ERROR: elseif after else
  then medium("10%")
}

# CORRECT — order: when -> then -> elseif -> then -> else
rule pricing {
  when qty > 100
  then bulk("20%")
  elseif qty > 50
  then medium("10%")
  else standard("0%")
}
```

---

## 8. STATE_INVALID — state value not in enum

**Error:** `State 'shipped' is not a value of enum 'Status'`

```mfd
# WRONG — state uses value not in enum
enum Status { pending, active, done }
state lifecycle : Status {
  pending -> shipped       # 'shipped' not in Status!
}

# CORRECT — all state names must match enum values exactly
enum Status { pending, active, done }
state lifecycle : Status {
  pending -> active
  active -> done
}
```

State names are **case-sensitive**: `Active` != `active`.

---

## 9. FLOW_STEP_UNRESOLVED — flow step not a declared operation

**Error:** `Flow step 'validate' is not a declared operation`

This error **only appears when the model declares operations** (strict mode).

```mfd
# WRONG (when operations exist in model)
operation persist(Order) -> Order
flow create(OrderInput) -> Order {
  -> validate(input)      # 'validate' not declared as operation
  -> persist(order)
  return order
}

# CORRECT — declare all operations
operation validate(OrderInput) -> boolean
operation persist(Order) -> Order
flow create(OrderInput) -> Order {
  -> validate(input)
  -> persist(order)
  return order
}
```

If no operations are declared, flow steps are not strictly validated.

---

## 10. STREAM_MISSING_RETURN — STREAM without return type

**Error:** `STREAM endpoint must have a return type`

```mfd
# WRONG
api REST @prefix(/api) {
  STREAM /events              # no return type
}

# CORRECT
event ItemUpdated { id: uuid, status: string }
api REST @prefix(/api) {
  STREAM /events -> ItemUpdated
}
```

---

## Pre-Validation Checklist

Before running `mfd validate`, verify:

- [ ] Every `extends` target has `@abstract`
- [ ] Every `implements` target has `@interface`
- [ ] No construct has both `@abstract` and `@interface`
- [ ] Every `state` references a declared `enum`, and all state names match enum values exactly
- [ ] Every STREAM endpoint has a return type that is a declared `event` (not entity)
- [ ] Every STREAM endpoint has no input type
- [ ] Each `action` uses only ONE pattern (imperative / reactive STREAM / reactive Signal / pure)
- [ ] All `from` screens, `on` events, `emits` events/signals are declared
- [ ] Rule clauses follow order: `when` -> `then` -> `elseif` -> `then` -> `else`
- [ ] If operations exist, all flow steps reference declared operations
