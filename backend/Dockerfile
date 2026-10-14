# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Prisma needs OpenSSL present at generate time (Alpine otherwise warns and
# may default to openssl-1.1.x; we target linux-musl-openssl-3.0.x).
RUN apk add --no-cache openssl

COPY package*.json ./
COPY prisma ./prisma/

RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# Production stage
FROM node:20-alpine

WORKDIR /app

# Prisma query engine needs OpenSSL; curl for ECS container health check
RUN apk add --no-cache openssl curl

ENV NODE_ENV=production

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma ./prisma

EXPOSE 3000

# Run migrations on startup, then start the app
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/src/main.js"]
