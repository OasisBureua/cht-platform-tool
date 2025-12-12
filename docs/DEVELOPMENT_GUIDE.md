# CHT Platform Development Guide

## Table of Contents
- [Prerequisites](#prerequisites)
- [Project Structure](#project-structure)
- [Initial Setup](#initial-setup)
- [Running Locally](#running-locally)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Software

- **Node.js** - v18+ (for backend)
- **Python** - v3.9+ (for worker)
- **Docker Desktop** - Latest version
- **Git** - Latest version
- **VS Code** (recommended) or your preferred IDE

### Optional Tools

- **Postman** or **Thunder Client** - API testing
- **TablePlus** or **pgAdmin** - Database GUI
- **Redis Insight** - Redis GUI

---

## Project Structure
```
cht-platform-tool/
├── backend/                  # NestJS Backend API
│   ├── src/
│   │   ├── auth/            # JWT authentication
│   │   ├── modules/         # Feature modules
│   │   │   ├── users/       # User management
│   │   │   ├── programs/    # CME programs
│   │   │   └── videos/      # Video tracking
│   │   ├── prisma/          # Database service
│   │   └── queue/           # Job queue service
│   ├── prisma/
│   │   └── schema.prisma    # Database schema
│   ├── package.json
│   └── .env                 # Environment variables
│
├── worker/                   # Python Worker Service
│   ├── app/
│   │   ├── jobs/            # Background jobs
│   │   │   ├── email_jobs.py
│   │   │   ├── payment_jobs.py
│   │   │   └── cme_jobs.py
│   │   ├── config.py        # Configuration
│   │   ├── celery_app.py    # Celery setup
│   │   └── database.py      # SQLAlchemy
│   ├── requirements.txt
│   └── .env                 # Environment variables
│
├── infrastructure/           # Terraform configs
│   └── terraform/
│       ├── modules/         # Infrastructure modules
│       └── variables/       # Environment configs
│
├── docs/                    # Documentation
│   ├── API_DOCUMENTATION.md
│   ├── DEVELOPMENT_GUIDE.md
│   ├── ARCHITECTURE.md
│   └── DEPLOYMENT_GUIDE.md
│
└── docker-compose.yml       # Local services
```

---

## Initial Setup

### 1. Clone Repository
```bash
git clone https://github.com/your-org/cht-platform-tool.git
cd cht-platform-tool
```

### 2. Checkout Development Branch
```bash
git checkout feature/api-and-worker-services
```

### 3. Backend Setup
```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Edit .env with your values
nano .env
```

**Backend .env file:**
```env
# Node Environment
NODE_ENV=development
PORT=3000

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cht_platform

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Auth0 (get from admin)
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_AUDIENCE=https://api.chtplatform.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret

# Stripe (optional for testing)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# SendGrid (optional for testing)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@chtplatform.com
```

### 4. Worker Setup
```bash
cd ../worker

# Create virtual environment
python3 -m venv venv

# Activate virtual environment
source venv/bin/activate  # macOS/Linux
# or
venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Create .env file
cp .env.example .env

# Edit .env
nano .env
```

**Worker .env file:**
```env
# Environment
ENVIRONMENT=development

# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cht_platform

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_DB=0

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# SendGrid (optional)
SENDGRID_API_KEY=
SENDGRID_FROM_EMAIL=noreply@chtplatform.com
```

### 5. Start Docker Services
```bash
cd ..  # Back to project root

# Start Postgres and Redis
docker-compose up -d

# Verify services are running
docker-compose ps
```

### 6. Run Database Migrations
```bash
cd backend

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Or create new migration
npx prisma migrate dev --name init

# Verify tables
docker exec -it cht-postgres psql -U postgres -d cht_platform -c "\dt"
```

---

## Running Locally

### Start All Services

You'll need **4 terminal windows**:

**Terminal 1: Docker Services**
```bash
cd ~/path/to/cht-platform-tool
docker-compose up
# or run in background: docker-compose up -d
```

**Terminal 2: Backend API**
```bash
cd backend
npm run start:dev
# Runs on http://localhost:3000
```

**Terminal 3: Worker Service**
```bash
cd worker
source venv/bin/activate
celery -A app.celery_app worker --loglevel=info
```

**Terminal 4: Testing/Development**
```bash
# Use this for running commands, tests, etc.
```

### Verify Services

**Check Backend:**
```bash
curl http://localhost:3000/health
# Should return: {"status":"ok","timestamp":"..."}
```

**Check Database:**
```bash
docker exec -it cht-postgres psql -U postgres -c "SELECT version();"
```

**Check Redis:**
```bash
docker exec -it cht-redis redis-cli ping
# Should return: PONG
```

**Check Worker:**
- Should see: `[INFO] celery@hostname ready.`
- Should list all tasks (send_email, process_payment, etc.)

---

## Development Workflow

### Making Changes to Backend

1. **Create a new feature branch:**
```bash
git checkout -b feature/your-feature-name
```

2. **Make changes to code**

3. **Test changes:**
```bash
cd backend
npm run build  # Check for TypeScript errors
npm run start:dev  # Hot reload enabled
```

4. **Test API endpoints:**
```bash
# Example: Create a user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "authId": "auth0|test123"
  }'
```

5. **Commit changes:**
```bash
git add .
git commit -m "feat: add new feature"
git push origin feature/your-feature-name
```

### Making Changes to Worker

1. **Make changes to Python code**

2. **Restart worker:**
```bash
# In worker terminal, press Ctrl+C
# Then restart:
celery -A app.celery_app worker --loglevel=info
```

3. **Test jobs:**
```bash
cd worker
source venv/bin/activate
python3

>>> from app.jobs.email_jobs import send_welcome_email
>>> result = send_welcome_email.delay("test@example.com", "Test User")
>>> print(result.id)
>>> exit()
```

### Database Schema Changes

1. **Update `backend/prisma/schema.prisma`**

2. **Create migration:**
```bash
cd backend
npx prisma migrate dev --name your_migration_name
```

3. **Generate Prisma client:**
```bash
npx prisma generate
```

4. **Restart backend** (if needed)

### Adding New API Endpoints

**Example: Add a new endpoint to Users**

1. **Add method to service** (`users.service.ts`):
```typescript
async findBySpecialty(specialty: string) {
  return this.prisma.user.findMany({
    where: { specialty },
  });
}
```

2. **Add route to controller** (`users.controller.ts`):
```typescript
@Get('specialty/:specialty')
findBySpecialty(@Param('specialty') specialty: string) {
  return this.usersService.findBySpecialty(specialty);
}
```

3. **Test:**
```bash
curl http://localhost:3000/users/specialty/Cardiology
```

### Adding New Background Jobs

**Example: Add a new email job**

1. **Add to worker** (`worker/app/jobs/email_jobs.py`):
```python
@celery_app.task(name="send_program_reminder")
def send_program_reminder(user_email: str, program_title: str):
    subject = f"Complete your program: {program_title}"
    html_content = f"<p>Don't forget to complete {program_title}!</p>"
    send_email.delay(user_email, subject, html_content)
```

2. **Export in `__init__.py`:**
```python
from app.jobs.email_jobs import send_program_reminder

__all__ = [
    # ... existing exports
    "send_program_reminder",
]
```

3. **Add to backend queue service** (`queue.service.ts`):
```typescript
async sendProgramReminder(userEmail: string, programTitle: string) {
  return this.queueTask('send_program_reminder', [userEmail, programTitle]);
}
```

4. **Call from backend:**
```typescript
await this.queueService.sendProgramReminder(
  user.email,
  program.title
);
```

---

## Testing

### Manual API Testing

**Using cURL:**
```bash
# Create user
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User","authId":"auth0|123"}'

# Get users
curl http://localhost:3000/users

# Create program
curl -X POST http://localhost:3000/programs \
  -H "Content-Type: application/json" \
  -d '{"title":"Test Program","description":"Test","creditAmount":1.5,"sponsorName":"Test Corp"}'
```

**Using Postman/Thunder Client:**

1. Import collection (to be created)
2. Set base URL: `http://localhost:3000`
3. Add JWT token to Authorization header

### Testing Background Jobs

**Method 1: Via Backend API**
```bash
# Create a user (triggers welcome email)
curl -X POST http://localhost:3000/users \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","firstName":"Test","lastName":"User","authId":"auth0|123"}'

# Watch worker terminal for job processing
```

**Method 2: Direct Worker Testing**
```bash
cd worker
source venv/bin/activate
python3

>>> from app.jobs.cme_jobs import generate_cme_certificate
>>> result = generate_cme_certificate.delay("user123", "program456", 2.5)
>>> print(f"Job ID: {result.id}")
>>> result.ready()  # Check if completed
>>> result.result   # Get result
>>> exit()
```

### Database Testing

**View data:**
```bash
docker exec -it cht-postgres psql -U postgres -d cht_platform

# List users
SELECT email, "firstName", "lastName", role FROM "User";

# List programs
SELECT id, title, "creditAmount", status FROM "Program";

# Exit
\q
```

**Clear test data:**
```bash
# Clear all users
docker exec -it cht-postgres psql -U postgres -d cht_platform -c 'DELETE FROM "User";'

# Clear all programs
docker exec -it cht-postgres psql -U postgres -d cht_platform -c 'DELETE FROM "Program";'
```

### Redis Queue Inspection
```bash
# Connect to Redis
docker exec -it cht-redis redis-cli

# Check queue length
LLEN celery

# View queue contents
LRANGE celery 0 -1

# Flush queue
FLUSHDB

# Exit
exit
```

---

## Troubleshooting

### Backend Won't Start

**Error: Port 3000 already in use**
```bash
# Find process using port 3000
lsof -i :3000

# Kill process
kill -9 <PID>

# Or use different port
PORT=3001 npm run start:dev
```

**Error: Cannot connect to database**
```bash
# Check if Postgres is running
docker-compose ps

# Restart Postgres
docker-compose restart postgres

# Check connection
docker exec -it cht-postgres psql -U postgres -c "SELECT 1;"
```

### Worker Won't Start

**Error: Cannot connect to Redis**
```bash
# Check if Redis is running
docker-compose ps

# Restart Redis
docker-compose restart redis

# Test connection
docker exec -it cht-redis redis-cli ping
```

**Error: ModuleNotFoundError**
```bash
# Make sure venv is activated
source venv/bin/activate

# Reinstall dependencies
pip install -r requirements.txt
```

### Jobs Not Processing

**Check worker is running:**
- Worker terminal should show `[INFO] celery@hostname ready.`

**Check queue:**
```bash
docker exec -it cht-redis redis-cli LLEN celery
# Should show number of pending jobs
```

**Clear stuck jobs:**
```bash
docker exec -it cht-redis redis-cli FLUSHDB
```

**Restart worker:**
```bash
# Ctrl+C in worker terminal
celery -A app.celery_app worker --loglevel=info
```

### Database Migration Issues

**Reset database:**
```bash
cd backend

# Delete migration files
rm -rf prisma/migrations

# Reset database
npx prisma migrate reset

# Create fresh migration
npx prisma migrate dev --name init
```

### Docker Issues

**Containers won't start:**
```bash
# Stop all containers
docker-compose down

# Remove volumes
docker-compose down -v

# Rebuild and start
docker-compose up --build -d
```

**Out of disk space:**
```bash
# Clean up Docker
docker system prune -a --volumes
```

---

## Useful Commands

### Backend
```bash
# Development
npm run start:dev

# Build
npm run build

# Run production
npm run start:prod

# Format code
npm run format

# Lint
npm run lint

# Prisma Studio (Database GUI)
npx prisma studio
```

### Worker
```bash
# Start worker
celery -A app.celery_app worker --loglevel=info

# Start worker with more verbosity
celery -A app.celery_app worker --loglevel=debug

# Check registered tasks
celery -A app.celery_app inspect registered

# Purge all tasks
celery -A app.celery_app purge
```

### Docker
```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres

# Restart service
docker-compose restart redis

# Rebuild service
docker-compose up --build backend
```

### Git
```bash
# Create feature branch
git checkout -b feature/your-feature

# Commit changes
git add .
git commit -m "feat: your feature"

# Push branch
git push origin feature/your-feature

# Pull latest changes
git pull origin feature/api-and-worker-services

# View status
git status
```

---

## Environment Variables Reference

### Backend (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `DATABASE_URL` | Postgres connection | `postgresql://...` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `AUTH0_DOMAIN` | Auth0 tenant | `tenant.auth0.com` |
| `AUTH0_AUDIENCE` | API identifier | `https://api.chtplatform.com` |
| `STRIPE_SECRET_KEY` | Stripe key | `sk_test_...` |
| `SENDGRID_API_KEY` | SendGrid key | `SG...` |

### Worker (.env)

| Variable | Description | Example |
|----------|-------------|---------|
| `ENVIRONMENT` | Environment | `development` |
| `DATABASE_URL` | Postgres connection | `postgresql://...` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `STRIPE_SECRET_KEY` | Stripe key | `sk_test_...` |
| `SENDGRID_API_KEY` | SendGrid key | `SG...` |

---

## Getting Help

- **GitHub Issues:** https://github.com/your-org/cht-platform-tool/issues
- **Team Slack:** #cht-platform-dev
- **Documentation:** See `/docs` folder

---

**Happy developing! 🚀**
