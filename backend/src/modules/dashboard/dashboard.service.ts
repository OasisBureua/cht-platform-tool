import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { EarningsResponseDto, WeeklyEarnings } from './dto/earnings-response.dto';
import { StatsResponseDto, PeerBenchmark } from './dto/stats-response.dto';
import { ProfileResponseDto } from './dto/profile-response.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  /**
   * Get user's earnings breakdown (with caching)
   */
  async getEarnings(userId: string): Promise<EarningsResponseDto> {
    // Check cache first (5 minute TTL)
    const cacheKey = this.redis.keys.dashboardEarnings(userId);
    const cached = await this.redis.get<EarningsResponseDto>(cacheKey);
    
    if (cached) {
      this.logger.log(`✅ CACHE HIT - Returning cached earnings for user: ${userId}`);
      return cached;
    }

    this.logger.log(`❌ CACHE MISS - Fetching earnings from database for user: ${userId}`);

    // Get all payments for user
    const payments = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    // Calculate total earnings (paid payments only)
    const paidPayments = payments.filter((p) => p.status === 'PAID');
    const totalEarnings = paidPayments.reduce((sum, p) => sum + p.amount, 0) / 100;

    // Calculate pending payments
    const pendingPayments = payments
      .filter((p) => p.status === 'PENDING' || p.status === 'PROCESSING')
      .reduce((sum, p) => sum + p.amount, 0) / 100;

    // Get last payment date
    const lastPaidPayment = paidPayments[0];
    const lastPaymentDate = lastPaidPayment?.paidAt?.toISOString();

    // Calculate weekly earnings (last 12 weeks)
    const weeklyEarnings = await this.calculateWeeklyEarnings(userId);

    // Get current week earnings
    const currentWeekStart = this.getWeekStart(new Date());
    const currentWeekEarnings =
      weeklyEarnings.find((w) => w.weekStartDate === currentWeekStart.toISOString())?.amount || 0;

    const result = {
      totalEarnings,
      weeklyEarnings,
      pendingPayments,
      lastPaymentDate,
      currentWeekEarnings,
    };

    // Cache for 5 minutes
    await this.redis.set(cacheKey, result, this.redis.ttl.dashboard);
    this.logger.log(`💾 Cached earnings for user: ${userId} (TTL: ${this.redis.ttl.dashboard}s)`);

    return result;
  }

  /**
   * Get user's activity statistics (with caching)
   */
  async getStats(userId: string): Promise<StatsResponseDto> {
    // Check cache first (5 minute TTL)
    const cacheKey = this.redis.keys.dashboardStats(userId);
    const cached = await this.redis.get<StatsResponseDto>(cacheKey);
    
    if (cached) {
      this.logger.log(`✅ CACHE HIT - Returning cached stats for user: ${userId}`);
      return cached;
    }

    this.logger.log(`❌ CACHE MISS - Fetching stats from database for user: ${userId}`);

    // Get enrollments
    const enrollments = await this.prisma.programEnrollment.findMany({
      where: { userId },
      include: {
        program: true,
      },
    });

    const activitiesCompleted = enrollments.filter((e) => e.completed === true).length;
    const activitiesInProgress = enrollments.filter((e) => e.completed === false).length;

    // Get surveys completed
    const surveysCompleted = await this.prisma.surveyResponse.count({
      where: { userId },
    });

    // Calculate CME credits earned
    const completedEnrollments = enrollments.filter((e) => e.completed === true);
    const cmeCreditsEarned = completedEnrollments.reduce(
      (sum, e) => sum + (e.program.creditAmount || 0),
      0,
    );

    // Calculate completion rate
    const completionRate = enrollments.length > 0 ? (activitiesCompleted / enrollments.length) * 100 : 0;

    // Get peer benchmark (anonymized)
    const peerBenchmark = await this.calculatePeerBenchmark(userId);

    const result = {
      activitiesCompleted,
      activitiesInProgress,
      surveysCompleted,
      cmeCreditsEarned,
      completionRate: Math.round(completionRate),
      peerBenchmark,
    };

    // Cache for 5 minutes
    await this.redis.set(cacheKey, result, this.redis.ttl.dashboard);
    this.logger.log(`💾 Cached stats for user: ${userId} (TTL: ${this.redis.ttl.dashboard}s)`);

    return result;
  }

  /**
   * Get user profile for Settings page
   */
  async getProfile(userId: string): Promise<ProfileResponseDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });
    if (!user) {
      throw new Error('User not found');
    }

    const stats = await this.getStats(userId);
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim() || user.email;

    return {
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      name,
      specialty: user.specialty ?? undefined,
      role: user.role,
      createdAt: user.createdAt.toISOString(),
      totalEarnings: user.totalEarnings / 100,
      activitiesCompleted: stats.activitiesCompleted,
    };
  }

  /**
   * Calculate weekly earnings for last 12 weeks
   */
  private async calculateWeeklyEarnings(userId: string): Promise<WeeklyEarnings[]> {
    const weeks: WeeklyEarnings[] = [];
    const now = new Date();

    for (let i = 0; i < 12; i++) {
      const weekStart = this.getWeekStart(now, i);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Get payments for this week
      const payments = await this.prisma.payment.findMany({
        where: {
          userId,
          status: 'PAID',
          paidAt: {
            gte: weekStart,
            lte: weekEnd,
          },
        },
      });

      const amount = payments.reduce((sum, p) => sum + p.amount, 0) / 100;
      const activitiesCount = payments.length;

      weeks.push({
        weekStartDate: weekStart.toISOString(),
        weekEndDate: weekEnd.toISOString(),
        amount,
        activitiesCount,
      });
    }

    return weeks.reverse(); // Oldest first
  }

  /**
   * Calculate peer benchmark (anonymized)
   */
  private async calculatePeerBenchmark(userId: string): Promise<PeerBenchmark | undefined> {
    // Get current user's total earnings
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { totalEarnings: true },
    });

    if (!user) return undefined;

    // Get all users' earnings (anonymized)
    const allUsers = await this.prisma.user.findMany({
      where: {
        totalEarnings: { gt: 0 },
      },
      select: { totalEarnings: true },
    });

    if (allUsers.length < 5) {
      // Not enough data for meaningful benchmark
      return undefined;
    }

    // Calculate average
    const totalEarnings = allUsers.reduce((sum, u) => sum + u.totalEarnings, 0);
    const averageEarnings = totalEarnings / allUsers.length / 100;

    // Calculate percentile
    const sortedEarnings = allUsers.map((u) => u.totalEarnings).sort((a, b) => a - b);
    const userRank = sortedEarnings.filter((e) => e <= user.totalEarnings).length;
    const percentile = Math.round((userRank / sortedEarnings.length) * 100);

    // Get top earners range (top 10%)
    const topIndex = Math.floor(sortedEarnings.length * 0.9);
    const topEarnersMin = sortedEarnings[topIndex] / 100;
    const topEarnersMax = sortedEarnings[sortedEarnings.length - 1] / 100;
    const topEarnersRange = `$${Math.round(topEarnersMin)}-$${Math.round(topEarnersMax)}`;

    return {
      averageEarnings: Math.round(averageEarnings),
      percentile,
      topEarnersRange,
    };
  }

  /**
   * Get start of week (Sunday) for a given date
   */
  private getWeekStart(date: Date, weeksAgo = 0): Date {
    const d = new Date(date);
    d.setDate(d.getDate() - weeksAgo * 7);
    const day = d.getDay();
    const diff = d.getDate() - day;
    const weekStart = new Date(d.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);
    return weekStart;
  }
}
