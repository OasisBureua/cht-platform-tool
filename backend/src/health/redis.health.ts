import { Injectable } from '@nestjs/common';
import { HealthIndicatorResult } from '@nestjs/terminus';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(private redis: RedisService) {}

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const testKey = 'health:check';
      const testValue = Date.now().toString();
      
      await this.redis.set(testKey, testValue, 5);
      const result = await this.redis.get(testKey);
      
      if (result === testValue) {
        return {
          [key]: {
            status: 'up',
            message: 'Redis connection is healthy',
          },
        };
      }
      
      // Redis not working but not critical - still return "up" with warning
      return {
        [key]: {
          status: 'up',
          message: 'Redis not available - using fallback (degraded)',
          degraded: true,
        },
      };
    } catch (error) {
      // Redis failure is not critical - still return "up" with warning
      return {
        [key]: {
          status: 'up',
          message: 'Redis not available - using fallback (degraded)',
          degraded: true,
          error: error.message,
        },
      };
    }
  }
}
