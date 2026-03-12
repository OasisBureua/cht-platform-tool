# Architecture Overview

## System Architecture
```
User → CloudFront → Frontend (React)
                        ↓
                   Backend API (NestJS)
                   ├── Auth0 (JWT)
                   ├── Redis (Cache)
                   ├── RDS (Database)
                   └── SQS (Payment Queue)
                        ↓
                   Worker (Python)
                   └── Payment Jobs
```

## Data Flow

### User Completes Program

1. User completes last video
2. Backend updates enrollment (completed=true)
3. Backend sends payment job to SQS (honorarium if applicable)
4. Worker records payment as PENDING for admin review

## Technology Decisions

### Why NestJS?
- TypeScript for type safety
- Built-in dependency injection
- Excellent testing support
- Production-ready architecture

### Why SQS over direct API calls?
- Decoupled architecture
- Automatic retries
- Dead letter queues
- Scalable processing

### Why Redis?
- Fast session management
- JWT token caching
- API response caching
- Rate limiting

### Why Stripe Connect?
- No W9 storage needed
- Automatic 1099 generation
- Identity verification built-in
- International support
