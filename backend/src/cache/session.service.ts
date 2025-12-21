import { Injectable } from '@nestjs/common';
import { RedisService } from './redis.service';

const SESSION_TTL = 3 * 60 * 60; // 3 hours in seconds

@Injectable()
export class SessionService {
  constructor(private redis: RedisService) {}

  /**
   * Create session (3-hour TTL)
   */
  async createSession(userId: string, sessionData: any): Promise<string> {
    const sessionId = this.generateSessionId();
    const key = `session:${sessionId}`;
    
    await this.redis.set(
      key,
      JSON.stringify({ userId, ...sessionData }),
      SESSION_TTL
    );

    return sessionId;
  }

  /**
   * Get session
   */
  async getSession(sessionId: string): Promise<any | null> {
    const key = `session:${sessionId}`;
    const data = await this.redis.get(key);
    
    if (!data) return null;

    // Refresh TTL on access (sliding expiration)
    await this.redis.expire(key, SESSION_TTL);
    
    return JSON.parse(data);
  }

  /**
   * Destroy session
   */
  async destroySession(sessionId: string): Promise<void> {
    const key = `session:${sessionId}`;
    await this.redis.del(key);
  }

  /**
   * Cache API response (5-min TTL for dashboard)
   */
  async cacheDashboard(userId: string, data: any): Promise<void> {
    const key = `dashboard:${userId}`;
    await this.redis.set(key, JSON.stringify(data), 5 * 60); // 5 minutes
  }

  /**
   * Get cached dashboard
   */
  async getCachedDashboard(userId: string): Promise<any | null> {
    const key = `dashboard:${userId}`;
    const data = await this.redis.get(key);
    return data ? JSON.parse(data) : null;
  }

  private generateSessionId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}