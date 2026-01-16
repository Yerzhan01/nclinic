# Patient Assistant System

Production-ready backend foundation for a patient companion system (MVP).

## Tech Stack

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript (strict mode)
- **Database**: PostgreSQL + Prisma ORM
- **Cache/Queue**: Redis + BullMQ
- **Validation**: Zod
- **Logging**: Pino
- **Testing**: Vitest

## Quick Start (Docker)

```bash
# Start all services
docker-compose -f docker-compose.dev.yml up --build

# In another terminal, apply database schema and seed
docker exec -it nclinic-api npx prisma db push
docker exec -it nclinic-api npx prisma db seed
```

## Local Development (without Docker)

```bash
# Install dependencies
npm install

# Setup environment
cp .env.example .env
# Edit .env with your local postgres/redis URLs

# Generate Prisma client
npm run db:generate

# Apply schema to database
npm run db:push

# Seed database
npm run db:seed

# Start dev server
npm run dev
```

## API Endpoints

### Health Check
```bash
curl http://localhost:3000/health
```

### Auth

**Login:**
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@local.test","password":"admin123"}'
```

**Get Profile:**
```bash
curl http://localhost:3000/api/v1/auth/me \
  -H "Authorization: Bearer <TOKEN>"
```

### Users (ADMIN only)

```bash
# List users
curl http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <TOKEN>"

# Create user
curl -X POST http://localhost:3000/api/v1/users \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"email":"staff@test.com","password":"pass123","fullName":"Staff User"}'

# Update user
curl -X PUT http://localhost:3000/api/v1/users/<ID> \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"fullName":"Updated Name"}'

# Delete user (soft delete)
curl -X DELETE http://localhost:3000/api/v1/users/<ID> \
  -H "Authorization: Bearer <TOKEN>"
```

## Response Format

**Success:**
```json
{ "success": true, "data": { ... }, "meta": { ... } }
```

**Error:**
```json
{ "success": false, "error": "message", "code": "ERROR_CODE" }
```

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build TypeScript to dist/ |
| `npm run start` | Start production server |
| `npm run test` | Run tests |
| `npm run lint` | Run ESLint |
| `npm run format` | Format with Prettier |
| `npm run db:push` | Apply schema to DB |
| `npm run db:seed` | Seed database |
| `npm run db:studio` | Open Prisma Studio |

## Default Admin

- **Email**: admin@local.test
- **Password**: admin123

## Project Structure

```
/src
  /app          # Fastify server, plugins, routes
  /config       # Environment, database, redis, queue
  /common       # Shared utilities and errors
  /modules      # Feature modules (auth, users)
/prisma         # Database schema and seed
/docker         # Docker configuration
```
