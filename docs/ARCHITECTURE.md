# CHT Platform Architecture

## Table of Contents
- [System Overview](#system-overview)
- [Architecture Diagram](#architecture-diagram)
- [Technology Stack](#technology-stack)
- [Service Architecture](#service-architecture)
- [Data Flow](#data-flow)
- [Database Design](#database-design)
- [Security Architecture](#security-architecture)
- [Scalability Considerations](#scalability-considerations)

---

## System Overview

CHT (Clinical Health Technologies) Platform is a healthcare education platform that connects Key Opinion Leaders (KOLs) and Healthcare Professionals (HCPs) with pharmaceutical clients through AI-powered content and CME (Continuing Medical Education) credit programs.

### Key Features

- **User Management** - HCPs and Admins with role-based access
- **CME Programs** - Educational programs with video content
- **Video Tracking** - Progress tracking and completion monitoring
- **CME Credits** - Automated credit calculation and certificate generation
- **Background Jobs** - Email notifications, payment processing, analytics
- **External Integrations** - Vimeo/YouTube (videos), Stripe (payments), SendGrid (emails)

### System Architecture Type

**Modular Monolith with Microservice Worker**

- **Backend API**: Modular monolith (NestJS) - All HTTP operations in one deployable unit
- **Worker Service**: Separate microservice (Python) - Background job processing
- **Communication**: Asynchronous via Redis queue

---

## Architecture Diagram
```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  Web App (React)          Mobile App (React Native)          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ HTTPS/REST
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                    AUTHENTICATION LAYER                      │
├─────────────────────────────────────────────────────────────┤
│                        Auth0 (JWT)                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 │ JWT Token
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                      API GATEWAY (ALB)                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ↓
┌─────────────────────────────────────────────────────────────┐
│                   BACKEND API (NestJS)                       │
├─────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  Users   │  │ Programs │  │  Videos  │  │   Auth   │   │
│  │  Module  │  │  Module  │  │  Module  │  │  Module  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │   CME    │  │ Payments │  │  Queue   │                 │
│  │  Module  │  │  Module  │  │  Service │                 │
│  └──────────┘  └──────────┘  └────┬─────┘                 │
└────────┬───────────────────────────┼──────────────────────┘
         │                           │
         │                           │ Job Queue
         ↓                           ↓
┌─────────────────┐         ┌──────────────────┐
│   PostgreSQL    │         │   Redis Queue    │
│   (Primary DB)  │         │  (Job Storage)   │
└─────────────────┘         └────────┬─────────┘
                                     │
                                     │ Celery Protocol
                                     ↓
                            ┌──────────────────────┐
                            │  WORKER SERVICE      │
                            │    (Python/Celery)   │
                            ├──────────────────────┤
                            │ ┌──────────────────┐ │
                            │ │   Email Jobs     │ │
                            │ ├──────────────────┤ │
                            │ │  Payment Jobs    │ │
                            │ ├──────────────────┤ │
                            │ │   CME Jobs       │ │
                            │ ├──────────────────┤ │
                            │ │ Analytics Jobs   │ │
                            │ └──────────────────┘ │
                            └──────────┬───────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    ↓                  ↓                  ↓
            ┌───────────┐      ┌──────────┐     ┌──────────┐
            │ SendGrid  │      │  Stripe  │     │    S3    │
            │  (Email)  │      │(Payments)│     │  (Files) │
            └───────────┘      └──────────┘     └──────────┘
```

---

## Technology Stack

### Backend API

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Runtime** | Node.js | 18+ | JavaScript runtime |
| **Framework** | NestJS | 10+ | API framework |
| **Language** | TypeScript | 5+ | Type safety |
| **Database ORM** | Prisma | 6+ | Database access |
| **Validation** | class-validator | 0.14+ | DTO validation |
| **Authentication** | Passport JWT | 10+ | JWT validation |
| **Queue Client** | ioredis | 5+ | Redis connection |

### Worker Service

| Component | Technology | Version | Purpose |
|-----------|------------|---------|---------|
| **Runtime** | Python | 3.9+ | Python runtime |
| **Task Queue** | Celery | 5.3+ | Job processing |
| **Database ORM** | SQLAlchemy | 2.0+ | Database access |
| **PDF Generation** | ReportLab | 4.0+ | Certificate PDFs |
| **HTTP Client** | httpx | 0.25+ | External APIs |
| **Configuration** | Pydantic | 2.5+ | Settings management |

### Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL 15 | Primary data store |
| **Cache/Queue** | Redis 7 | Job queue & caching |
| **Container** | Docker | Local development |
| **Orchestration** | AWS ECS Fargate | Container hosting |
| **Load Balancer** | AWS ALB | Traffic distribution |
| **IaC** | Terraform | Infrastructure as Code |
| **Storage** | AWS S3 | File storage |

### External Services

| Service | Purpose |
|---------|---------|
| **Auth0** | Authentication & user management |
| **Stripe** | Payment processing |
| **SendGrid** | Transactional emails |
| **Vimeo/YouTube** | Video hosting |

---

## Service Architecture

### Backend API (NestJS)

**Pattern:** Modular Monolith

**Modules:**
```
src/
├── auth/                    # Authentication & authorization
│   ├── strategies/          # JWT strategy
│   ├── guards/              # Auth guards, RBAC
│   └── decorators/          # Custom decorators
├── modules/
│   ├── users/              # User management
│   ├── programs/           # CME programs
│   ├── videos/             # Video tracking
│   ├── surveys/            # Assessments (planned)
│   ├── payments/           # Payments (planned)
│   └── cme/                # CME credits (planned)
├── queue/                  # Job queue service
├── prisma/                 # Database service
└── common/                 # Shared utilities
```

**Design Patterns:**

- **Module Pattern** - Feature-based organization
- **Service Pattern** - Business logic separation
- **Repository Pattern** - Data access via Prisma
- **DTO Pattern** - Request/response validation
- **Decorator Pattern** - Route protection (@Roles, @Public)

**Key Decisions:**

1. **Why Modular Monolith?**
   - Easier to develop and deploy initially
   - Lower operational overhead
   - Can split into microservices later if needed
   - Good for ~1000-10000 users

2. **Why NestJS?**
   - TypeScript for type safety
   - Excellent module system
   - Built-in dependency injection
   - Great for enterprise applications

3. **Why Prisma?**
   - Type-safe database access
   - Automatic migrations
   - Excellent TypeScript integration
   - Good developer experience

---

### Worker Service (Python/Celery)

**Pattern:** Task Queue with Workers

**Job Types:**
```python
app/jobs/
├── email_jobs.py           # Email notifications
│   ├── send_welcome_email
│   ├── send_enrollment_confirmation
│   └── send_cme_certificate_email
├── payment_jobs.py         # Payment processing
│   ├── process_payment
│   └── process_honorarium
├── cme_jobs.py            # Certificate generation
│   └── generate_cme_certificate
└── analytics_jobs.py      # Data aggregation (planned)
    └── aggregate_daily_analytics
```

**Key Decisions:**

1. **Why Python for Worker?**
   - Better PDF generation libraries
   - Easier data processing
   - Simpler for ML/AI integration (future)
   - Celery is battle-tested

2. **Why Celery?**
   - Mature and reliable
   - Built-in retry logic
   - Task routing and prioritization
   - Good monitoring tools (Flower)

3. **Why Separate Service?**
   - Different scaling needs
   - Language-specific strengths
   - Isolation of long-running tasks
   - Independent deployment

---

## Data Flow

### User Creation Flow
```
1. User signs up via Auth0
   ↓
2. Frontend receives JWT token
   ↓
3. Frontend calls API with JWT
   ↓
4. API validates JWT (JwtStrategy)
   ↓
5. API checks if user exists in DB
   ↓
6. If not exists:
   - Create user in PostgreSQL
   - Queue welcome email job to Redis
   ↓
7. Return user data to frontend
   ↓
8. Worker picks up email job from Redis
   ↓
9. Worker sends email via SendGrid
   ↓
10. Job marked as complete
```

### Program Enrollment Flow
```
1. HCP clicks "Enroll" on frontend
   ↓
2. Frontend calls: POST /programs/:id/enroll
   ↓
3. API validates JWT & user permissions
   ↓
4. API creates ProgramEnrollment record
   ↓
5. API queues enrollment email job
   ↓
6. Return enrollment data to frontend
   ↓
7. Worker sends confirmation email
```

### Video Progress Tracking
```
1. User watches video (frontend)
   ↓
2. Every 10 seconds: POST /videos/:id/track
   {watchedSeconds: 120, completed: false}
   ↓
3. API calculates progress %
   ↓
4. API upserts VideoView record
   ↓
5. If completed:
   - Update enrollment progress
   - Check if program completed
   - If yes: Queue certificate generation
   ↓
6. Worker generates PDF certificate
   ↓
7. Worker uploads to S3
   ↓
8. Worker queues certificate email
```

### Background Job Processing
```
Backend API                 Redis Queue              Worker Service
    │                           │                         │
    │─────Queue Job────────────→│                         │
    │                           │                         │
    │                           │←────Poll for Jobs──────│
    │                           │                         │
    │                           │─────Job Data──────────→│
    │                           │                         │
    │                           │                         │─┐
    │                           │                         │ │ Process
    │                           │                         │ │ Job
    │                           │                         │←┘
    │                           │                         │
    │                           │←────Mark Complete──────│
    │                           │                         │
```

---

## Database Design

### Entity Relationship Diagram
```
┌─────────────┐
│    User     │
├─────────────┤
│ id          │──┐
│ email       │  │
│ authId      │  │
│ role        │  │
│ npiNumber   │  │
│ specialty   │  │
└─────────────┘  │
                 │
                 │ 1:N
                 │
    ┌────────────┴────────────┐
    │                         │
    ↓                         ↓
┌─────────────┐       ┌──────────────┐
│ VideoView   │       │ProgramEnroll │
├─────────────┤       ├──────────────┤
│ userId      │       │ userId       │
│ videoId     │       │ programId    │
│ progress    │       │ progress     │
│ completed   │       │ completed    │
└─────────────┘       └──────────────┘
    │                         │
    │ N:1                     │ N:1
    │                         │
    ↓                         ↓
┌─────────────┐       ┌──────────────┐
│   Video     │       │   Program    │
├─────────────┤       ├──────────────┤
│ id          │       │ id           │
│ programId   │───────│ title        │
│ title       │  N:1  │ creditAmount │
│ duration    │       │ status       │
│ platform    │       │ sponsorName  │
└─────────────┘       └──────────────┘
```

### Key Tables

**User**
- Stores HCP and admin information
- Links to Auth0 via `authId`
- Tracks specialty, NPI, license info

**Program**
- CME educational programs
- Status: DRAFT, ACTIVE, COMPLETED, ARCHIVED
- Tracks credit amount and sponsor

**Video**
- Individual videos within programs
- External hosting (Vimeo/YouTube)
- Sequential ordering

**VideoView**
- Tracks user video progress
- Real-time progress updates
- Completion tracking

**ProgramEnrollment**
- Links users to programs
- Tracks overall program progress
- Completion status

**CMECredit**
- Issued CME credits
- Links to certificates
- Expiration tracking

**Payment**
- Payment transactions
- Stripe integration
- W9 tracking for HCPs

### Indexes

**Performance-critical indexes:**
```sql
-- User lookups
CREATE INDEX idx_user_email ON "User"(email);
CREATE INDEX idx_user_authid ON "User"("authId");

-- Video progress
CREATE INDEX idx_videoview_user ON "VideoView"("userId");
CREATE INDEX idx_videoview_video ON "VideoView"("videoId");

-- Program enrollments
CREATE INDEX idx_enrollment_user ON "ProgramEnrollment"("userId");
CREATE INDEX idx_enrollment_program ON "ProgramEnrollment"("programId");

-- Videos by program
CREATE INDEX idx_video_program ON "Video"("programId");
```

---

## Security Architecture

### Authentication Flow
```
1. User → Auth0 Login
   ↓
2. Auth0 validates credentials
   ↓
3. Auth0 returns JWT token
   ↓
4. Frontend stores token (localStorage/sessionStorage)
   ↓
5. Every API request includes:
   Authorization: Bearer <jwt_token>
   ↓
6. API validates JWT:
   - Signature verification (RS256)
   - Expiration check
   - Audience verification
   ↓
7. Auto-sync user to database (if new)
   ↓
8. Attach user to request context
   ↓
9. RBAC check (if @Roles decorator present)
   ↓
10. Execute route handler
```

### Role-Based Access Control (RBAC)

**Roles:**
- `ADMIN` - Full access to all resources
- `HCP` - Access to own data, can enroll in programs

**Permission Matrix:**

| Action | HCP | Admin |
|--------|-----|-------|
| View programs | ✅ | ✅ |
| Enroll in program | ✅ | ✅ |
| Track video progress | ✅ | ✅ |
| View own enrollments | ✅ | ✅ |
| Create program | ❌ | ✅ |
| Delete program | ❌ | ✅ |
| View all users | ❌ | ✅ |
| Manage users | ❌ | ✅ |
| View all enrollments | ❌ | ✅ |

**Implementation:**
```typescript
// Protect entire controller
@Controller('admin')
@Roles('ADMIN')
export class AdminController {}

// Protect single route
@Get('analytics')
@Roles('ADMIN')
getAnalytics() {}

// Public route
@Get('programs')
@Public()
getPrograms() {}
```

### Data Security

**At Rest:**
- PostgreSQL encryption (AWS RDS encryption)
- Secrets stored in AWS Secrets Manager
- S3 encryption (SSE-S3)

**In Transit:**
- HTTPS/TLS 1.2+ for all API traffic
- Redis TLS (optional in production)
- Database SSL connections

**Sensitive Data:**
- Passwords never stored (Auth0 handles)
- JWT secrets in environment variables
- API keys in Secrets Manager
- PII encryption (planned)

---

## Scalability Considerations

### Current Capacity

**Single Instance:**
- Backend: ~100 concurrent requests
- Worker: ~10 concurrent jobs
- Database: ~450 active users (current)
- Expected: Up to 1000 users

### Horizontal Scaling

**Backend API:**
```
Current:  [Backend Instance 1]
           ↓
          [ALB]
           ↓
      [PostgreSQL]

Scaled:   [Backend 1] [Backend 2] [Backend 3]
               ↓         ↓         ↓
              [ALB (Auto-scaling)]
                       ↓
            [RDS Aurora (Multi-AZ)]
```

**Worker Service:**
```
Current:  [Worker 1]
           ↓
      [Redis Queue]

Scaled:   [Worker 1] [Worker 2] [Worker 3]
               ↓         ↓         ↓
           [Redis Queue (ElastiCache)]
```

### Database Scaling

**Read Replicas:**
- Primary for writes
- Read replicas for heavy queries
- Analytics on replica

**Connection Pooling:**
- Prisma connection pooling
- PgBouncer for connection management

**Caching Strategy:**
- Redis for frequently accessed data
- Program listings (5 min TTL)
- User profiles (15 min TTL)

### Cost-Effective Scaling Path

**Phase 1: 0-1,000 users (Current)**
- 1 Backend instance (Fargate 0.25 vCPU)
- 1 Worker instance
- RDS Aurora Serverless v2 (0.5-2 ACU)
- **Cost:** ~$80-105/month

**Phase 2: 1,000-5,000 users**
- 2 Backend instances (auto-scale)
- 2 Worker instances
- RDS Aurora (0.5-4 ACU)
- **Cost:** ~$175-210/month

**Phase 3: 5,000-10,000 users**
- 3-5 Backend instances
- 3-4 Worker instances
- RDS Aurora (1-8 ACU, Multi-AZ)
- ElastiCache Redis
- **Cost:** ~$410-470/month

---

## Monitoring & Observability

### Logging

**Backend:**
- NestJS built-in logger
- Structured JSON logs
- CloudWatch Logs

**Worker:**
- Python logging module
- Celery task logs
- CloudWatch Logs

### Metrics

**Backend:**
- Request latency
- Error rates
- Authentication success/failure
- Endpoint usage

**Worker:**
- Job queue length
- Job processing time
- Job success/failure rates
- Worker health

### Monitoring Tools

**Planned:**
- CloudWatch Dashboards
- CloudWatch Alarms
- Celery Flower (job monitoring)
- Prisma Studio (database)
- Sentry (error tracking)

---

## Future Architecture Enhancements

### Short-term (3-6 months)

1. **Caching Layer**
   - Redis caching for programs/videos
   - Response caching for heavy queries

2. **Search Service**
   - ElasticSearch for program search
   - Full-text search capabilities

3. **File Processing**
   - Async file uploads
   - Image optimization

### Medium-term (6-12 months)

1. **Real-time Features**
   - WebSockets for live updates
   - Real-time progress tracking

2. **Analytics Service**
   - Separate analytics database
   - BI dashboards

3. **CDN Integration**
   - CloudFront for static assets
   - Edge caching

### Long-term (12+ months)

1. **Microservices Split**
   - Separate CME service
   - Separate analytics service
   - Event-driven architecture

2. **AI/ML Integration**
   - Content recommendations
   - Personalized learning paths
   - Automated content tagging

3. **Multi-region**
   - Global deployment
   - Data replication
   - Regional compliance

---

## Technical Debt & Trade-offs

### Current Trade-offs

1. **Modular Monolith vs Microservices**
   - **Choice:** Modular monolith
   - **Why:** Faster development, lower ops overhead
   - **When to reconsider:** >10,000 users or team >10 people

2. **External Video Hosting**
   - **Choice:** Vimeo/YouTube (not self-hosted)
   - **Why:** $200/month savings, less infrastructure
   - **Trade-off:** Less control, dependency on external service

3. **Synchronous Worker Communication**
   - **Choice:** Fire-and-forget jobs (no callbacks)
   - **Why:** Simpler implementation
   - **Trade-off:** No automatic retry notification to frontend

### Known Limitations

1. **No request caching** - Will add Redis caching
2. **Basic error handling** - Will improve error recovery
3. **Limited monitoring** - Will add comprehensive observability
4. **No rate limiting** - Will add API rate limits

---

**Architecture Version:** 1.0  
**Last Updated:** December 2025  
**Next Review:** January 2026
