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

### Why Bill.com?
- ACH and paper check payouts to HCPs
- W-9 capture handled in-platform (native CHT flow, not third-party)
- 1099 generation via Bill.com reports
- Familiar to CHM finance team
