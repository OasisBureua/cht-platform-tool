import { Controller, Get } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { HealthCheck, HealthCheckService, HealthCheckResult } from '@nestjs/terminus';
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
    return this.health.check([
      async () => ({ app: { status: 'up' } }),
    ]);
  }

  /**
   * Readiness check - Service ready to accept traffic
   * GET /health/ready
   */
  @Get('health/ready')
  @HealthCheck()
  async readiness(): Promise<HealthCheckResult> {
    return this.health.check([
      async () => this.prismaHealth.isHealthy('database'),
      async () => this.redisHealth.isHealthy('redis'),
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