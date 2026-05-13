import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import {
  HealthCheck,
  HealthCheckService,
  HealthCheckResult,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { PrismaHealthIndicator } from './prisma.health';
import { RedisHealthIndicator } from './redis.health';

@SkipThrottle()
@Controller()
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private prismaHealth: PrismaHealthIndicator,
    private redisHealth: RedisHealthIndicator,
  ) {}

  /**
   * Basic health check - ALB uses this
   * GET /health
   */
  @Get('health')
  @HealthCheck()
  async check(): Promise<HealthCheckResult> {
    return this.health.check([async () => ({ app: { status: 'up' } })]);
  }

  /**
   * Readiness check - Service ready to accept traffic
   * GET /health/ready
   * Checks DB and Redis with 5s timeout each (parallel). On timeout, returns 200
   * with degraded status (never 500).
   */
  @Get('health/ready')
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    const TIMEOUT_MS = 5000;
    const checkWithTimeout = async (
      p: Promise<HealthIndicatorResult>,
      key: string,
    ): Promise<HealthIndicatorResult> => {
      try {
        return await Promise.race([
          p,
          new Promise<HealthIndicatorResult>((_, reject) =>
            setTimeout(() => reject(new Error('timeout')), TIMEOUT_MS),
          ),
        ]);
      } catch {
        return {
          [key]: {
            status: 'up',
            message: 'degraded (check timed out)',
            degraded: true,
          },
        };
      }
    };
    const [dbResult, redisResult] = await Promise.all([
      checkWithTimeout(this.prismaHealth.isHealthy('database'), 'database'),
      checkWithTimeout(this.redisHealth.isHealthy('redis'), 'redis'),
    ]);
    return this.health.check([
      () => Promise.resolve(dbResult),
      () => Promise.resolve(redisResult),
    ]);
  }

  /**
   * Liveness check - Service is alive
   * GET /health/live
   */
  @Get('health/live')
  live() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: Math.floor(process.uptime()),
    };
  }

  /**
   * Detailed health with all components
   * GET /health/detail
   */
  @Get('health/detail')
  async detail() {
    try {
      const dbCheck = await this.prismaHealth.isHealthy('database');
      const redisCheck = await this.redisHealth.isHealthy('redis');

      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        components: {
          database: dbCheck.database,
          redis: redisCheck.redis,
        },
        application: {
          version: process.env.APP_VERSION || '1.0.0',
          uptime: Math.floor(process.uptime()),
          environment: process.env.NODE_ENV || 'development',
          nodeVersion: process.version,
        },
      };
    } catch (error) {
      return {
        status: 'error',
        timestamp: new Date().toISOString(),
        error: error.message,
      };
    }
  }
}
