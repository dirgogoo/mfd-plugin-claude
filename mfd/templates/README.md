# MFD Templates

Ready-to-use MFD model templates for common architectural patterns. Each template is validated and can be used as a starting point with `mfd init`.

## Available Templates

### auth-basic.mfd
**JWT Authentication with Session Management**

Use when your system needs:
- User registration and login
- JWT access tokens + refresh tokens
- Role-based access control (admin, user, guest)
- Password hashing and validation
- Session lifecycle management

Includes: 3 entities, 2 enums, 4 flows, 4 events, 1 state machine, 5 API endpoints, 4 business rules, 2 secrets.

### crud-api.mfd
**Standard REST CRUD API**

Use when you need a resource with:
- Create, Read, Update, Delete operations
- REST API with pagination
- Soft-delete (archive instead of remove)
- Input validation and authorization
- Resource lifecycle (active/inactive/archived)

Includes: 1 entity, 1 enum, 4 flows, 3 events, 1 state machine, 5 API endpoints, 4 business rules.

### event-driven.mfd
**Event-Driven Architecture**

Use when your system needs:
- Asynchronous message processing
- Producer/consumer pattern
- Dead-letter queue handling
- Event idempotency and ordering
- Processing retry with backoff

Includes: 4 entities, 3 enums, 4 flows, 4 events, 1 state machine, 9 API endpoints, 4 business rules.

## Usage

```bash
# Validate a template
mfd validate templates/auth-basic.mfd

# View template statistics
mfd stats templates/auth-basic.mfd

# Initialize a new project from template
mfd init --template auth-basic --name MyProject
```

## Customization

Templates use `{{PROJECT_NAME}}` as a placeholder for your system name. The `mfd init` command replaces this automatically.

To customize a template:
1. Copy it to your project
2. Add/modify entities, flows, and rules
3. Run `mfd validate` to check for errors
4. Run `mfd stats` to see completeness metrics
