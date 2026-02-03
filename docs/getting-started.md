# Getting Started

## Prerequisites

- Node.js 20+
- Python 3.11+
- Docker Desktop
- AWS CLI (for deployment)
- Terraform (for infrastructure)

## Local Development Setup

### 1. Start Database & Redis
```bash
docker-compose up -d
```

### 2. Setup Backend
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your values
npx prisma migrate dev
npm run start:dev
```

### 3. Setup Worker
```bash
cd worker
pip install -r requirements.txt
cp .env.example .env
# Edit .env with your values
python start_workers.py
```

### 4. Setup Frontend
```bash
cd frontend
npm install
cp .env.example .env
# Edit .env with your values
npm run dev
```

## Access Points

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Docs: http://localhost:3000/api
- Database: localhost:5432
- Redis: localhost:6379
