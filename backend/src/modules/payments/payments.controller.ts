import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  Logger,
  UseGuards,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiOkResponse,
  ApiQuery,
  ApiResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CheckUserGuard } from '../../auth/check-user.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { AdminOrDevGuard } from '../../auth/admin-or-dev.guard';
import { PaymentsService } from './payments.service';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { CreateManualPaymentDto } from './dto/create-manual-payment.dto';
import {
  CreateConnectAccountResponseDto,
  AccountLinkResponseDto,
} from './dto/create-connect-account.dto';
import { SubmitW9Dto } from './dto/submit-w9.dto';
import { AccountStatusDto } from './dto/account-status.dto';
import { ProgramPaymentSummaryResponseDto } from './dto/program-payment-summary.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
  ) {}

  /**
   * POST /api/payments/:userId/connect-account
   * Stripe Connect: creates Express recipient + returns hosted Account Link URL.
   */
  @Post(':userId/connect-account')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async createConnectAccount(
    @Param('userId') userId: string,
  ): Promise<CreateConnectAccountResponseDto> {
    this.logger.log(`Creating Stripe Connect account for user: ${userId}`);
    return this.paymentsService.createConnectAccount(userId);
  }

  /**
   * POST /api/payments/:userId/account-link
   * Stripe Account Link (hosted onboarding URL).
   */
  @Post(':userId/account-link')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async createAccountLink(
    @Param('userId') userId: string,
  ): Promise<AccountLinkResponseDto> {
    this.logger.log(`Creating account link for user: ${userId}`);
    return this.paymentsService.createAccountLink(userId);
  }

  /**
   * POST /api/payments/:userId/account-session
   * Stripe Connect Embedded onboarding Account Session (client_secret).
   */
  @Post(':userId/account-session')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  @ApiOperation({
    summary: 'Create Stripe Account Session for embedded Connect onboarding',
  })
  async createAccountSession(@Param('userId') userId: string) {
    this.logger.log(`Creating Stripe account session for user: ${userId}`);
    return this.paymentsService.createStripeAccountSession(userId);
  }

  /**
   * DELETE /api/payments/by-user-program?userId=xxx&programId=yyy
   * Delete payments by userId and programId (admin/dev only). For cleaning up test entries.
   */
  @Delete('by-user-program')
  @UseGuards(JwtAuthGuard, AdminOrDevGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Delete payments by userId and programId (admin/dev only)',
  })
  @ApiQuery({ name: 'userId', required: true, description: 'User ID' })
  @ApiQuery({
    name: 'programId',
    required: false,
    description: 'Program ID (omit to delete all payments for user)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns count of deleted payments',
  })
  async deleteByUserAndProgram(
    @Query('userId') userId: string,
    @Query('programId') programId?: string,
  ) {
    return this.paymentsService.deleteByUserAndProgram(userId, programId);
  }

  /**
   * GET /api/payments/pending
   * List pending payments for admin "Pay now" flow (admin only).
   * Optional programId: omit | none | program cuid.
   */
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiQuery({
    name: 'programId',
    required: false,
    description: 'Program id, or "none" for payments with no program',
  })
  async getPendingPayments(@Query('programId') programId?: string) {
    return this.paymentsService.getPendingPayments(programId);
  }

  /**
   * GET /api/payments/failed
   * List failed payments for admin retry flow (admin only).
   * Optional programId: omit | none | program cuid.
   */
  @Get('failed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiQuery({
    name: 'programId',
    required: false,
    description: 'Program id, or "none" for payments with no program',
  })
  async getFailedPayments(@Query('programId') programId?: string) {
    return this.paymentsService.getFailedPayments(programId);
  }

  /**
   * GET /api/payments/paid
   * Successful payouts (admin payments page).
   * Without programId: recent window (default 200, max 500).
   * With programId / none: scoped list (default 1000, max 2000).
   */
  @Get('paid')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'List PAID payments (admin); optional program scope' })
  @ApiQuery({
    name: 'limit',
    required: false,
    description:
      'Max rows. Unscoped: 1–500 (default 200). Scoped by programId: 1–2000 (default 1000).',
  })
  @ApiQuery({
    name: 'programId',
    required: false,
    description: 'Program id, or "none" for payments with no program',
  })
  async getPaidPayments(
    @Query('limit') limit?: string,
    @Query('programId') programId?: string,
  ) {
    const n = limit != null && limit !== '' ? parseInt(limit, 10) : undefined;
    return this.paymentsService.getPaidPaymentsForAdmin(
      Number.isFinite(n as number) ? n : undefined,
      programId,
    );
  }

  /**
   * GET /api/payments/program-summary
   * All-time PENDING / PAID / FAILED totals per program (admin).
   * Static path — must stay before :userId / :paymentId routes.
   */
  @Get('program-summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary:
      'All-time payment totals by program (PENDING / PAID / FAILED) for admin Payments drill-down',
  })
  @ApiOkResponse({ type: ProgramPaymentSummaryResponseDto })
  async getProgramPaymentSummary(): Promise<ProgramPaymentSummaryResponseDto> {
    return this.paymentsService.getProgramPaymentSummary();
  }

  /**
   * GET /api/payments/export.csv
   * Download payments as CSV (admin).
   */
  @Get('export.csv')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Export payments CSV (admin)' })
  @ApiQuery({
    name: 'status',
    required: false,
    description: 'PENDING | FAILED | PAID | ALL (default ALL)',
  })
  @ApiQuery({ name: 'from', required: false, description: 'ISO start date' })
  @ApiQuery({ name: 'to', required: false, description: 'ISO end date' })
  async exportPaymentsCsv(
    @Res() res: Response,
    @Query('status') status?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const normalized =
      status &&
      ['PENDING', 'FAILED', 'PAID', 'ALL'].includes(status.toUpperCase())
        ? (status.toUpperCase() as 'PENDING' | 'FAILED' | 'PAID' | 'ALL')
        : 'ALL';
    const csv = await this.paymentsService.exportPaymentsCsv({
      status: normalized,
      from,
      to,
    });
    const stamp = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="cht-payments-${normalized.toLowerCase()}-${stamp}.csv"`,
    );
    res.send(csv);
  }

  /**
   * POST /api/payments/:paymentId/retry
   * Retry a FAILED payment by resetting it to PENDING and re-attempting via Stripe Connect (admin only).
   */
  @Post(':paymentId/retry')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async retryPayment(@Param('paymentId') paymentId: string) {
    return this.paymentsService.retryPayment(paymentId);
  }

  /**
   * DELETE /api/payments/:paymentId
   * Delete a payment by ID (admin/dev only). For removing test entries.
   */
  @Delete(':paymentId')
  @UseGuards(JwtAuthGuard, AdminOrDevGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Delete payment by ID (admin/dev only)' })
  @ApiResponse({ status: 200, description: 'Payment deleted' })
  async deletePayment(@Param('paymentId') paymentId: string) {
    return this.paymentsService.deletePaymentById(paymentId);
  }

  /**
   * POST /api/payments/:paymentId/pay-now
   * Pay a PENDING payment via Stripe Connect (admin only).
   */
  @Post(':paymentId/pay-now')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async payNow(@Param('paymentId') paymentId: string) {
    return this.paymentsService.payNow(paymentId);
  }

  /**
   * GET /api/payments/:userId/account-status
   * Get user's payment account status (auth required).
   */
  @Get(':userId/account-status')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async getAccountStatus(
    @Param('userId') userId: string,
  ): Promise<AccountStatusDto> {
    this.logger.log(`Getting account status for user: ${userId}`);
    return this.paymentsService.getAccountStatus(userId);
  }

  /**
   * GET /api/payments/:userId/summary
   * Get payment summary (auth required).
   */
  @Get(':userId/summary')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async getSummary(@Param('userId') userId: string) {
    return this.paymentsService.getSummary(userId);
  }

  /**
   * GET /api/payments/:userId/history
   * Get payment history (auth required).
   */
  @Get(':userId/history')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async getHistory(@Param('userId') userId: string) {
    return this.paymentsService.getHistory(userId);
  }

  /**
   * GET /api/payments/manual-eligibility
   * Attendance / survey ack preview before admin queues a manual honorarium.
   */
  @Get('manual-eligibility')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary: 'Check honorarium eligibility for manual payment (admin)',
  })
  @ApiQuery({ name: 'userId', required: true })
  @ApiQuery({ name: 'programId', required: true })
  async getManualEligibility(
    @Query('userId') userId: string,
    @Query('programId') programId: string,
  ) {
    return this.paymentsService.getManualHonorariumEligibility(
      userId,
      programId,
    );
  }

  /**
   * POST /api/payments/manual
   * Queue a manual PENDING payment for admin pay-now flow.
   */
  @Post('manual')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  @ApiBearerAuth('session-token')
  @ApiOperation({ summary: 'Create manual pending payment (admin)' })
  async createManualPayment(@Body() dto: CreateManualPaymentDto) {
    return this.paymentsService.createManualPendingPayment(dto);
  }

  /**
   * POST /api/payments/payout
   * Create payout to user via Stripe Connect (admin only).
   */
  @Post('payout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createPayout(@Body() dto: CreatePayoutDto): Promise<PayoutResponseDto> {
    this.logger.log(`Creating payout for user: ${dto.userId}`);
    return this.paymentsService.createPayout(dto);
  }

  /**
   * POST /api/payments/:userId/w9
   * Stripe Connect: syncs w9Submitted from Connect requirements.
   */
  @Post(':userId/w9')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async submitW9(@Param('userId') userId: string, @Body() body: SubmitW9Dto) {
    return this.paymentsService.submitW9(userId, body);
  }

  /**
   * POST /api/payments/:userId/sync-account
   * Sync Stripe Connect account status (auth required).
   */
  @Post(':userId/sync-account')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async syncAccountStatus(@Param('userId') userId: string) {
    this.logger.log(`Syncing account status for user: ${userId}`);
    return this.paymentsService.syncAccountStatus(userId);
  }
}
