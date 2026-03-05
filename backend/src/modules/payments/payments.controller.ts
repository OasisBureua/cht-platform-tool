import { Controller, Post, Get, Body, Param, Logger, UseGuards } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { CheckUserGuard } from '../../auth/check-user.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { Roles } from '../../auth/roles.decorator';
import { AdminOrDevGuard } from '../../auth/admin-or-dev.guard';
import { PaymentsService } from './payments.service';
import { BillService } from './bill.service';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { CreateConnectAccountResponseDto, AccountLinkResponseDto } from './dto/create-connect-account.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { AccountStatusDto } from './dto/account-status.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly billService: BillService,
  ) {}

  /**
   * POST /api/payments/:userId/connect-account
   * Create Bill.com vendor for user (auth required). Optional body with bank details.
   */
  @Post(':userId/connect-account')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async createConnectAccount(
    @Param('userId') userId: string,
    @Body() body?: CreateVendorDto,
  ): Promise<CreateConnectAccountResponseDto> {
    this.logger.log(`Creating Bill.com vendor for user: ${userId}`);
    return this.paymentsService.createConnectAccount(userId, body);
  }

  /**
   * POST /api/payments/:userId/account-link
   * Get payment settings URL (auth required)
   */
  @Post(':userId/account-link')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async createAccountLink(@Param('userId') userId: string): Promise<AccountLinkResponseDto> {
    this.logger.log(`Creating account link for user: ${userId}`);
    return this.paymentsService.createAccountLink(userId);
  }

  /**
   * GET /api/payments/test-connection
   * Test Bill.com API connection (login). Admin only in prod; X-Dev-User-Id bypass for local testing.
   */
  @Get('test-connection')
  @UseGuards(JwtAuthGuard, AdminOrDevGuard)
  async testConnection() {
    return this.paymentsService.testBillConnection();
  }

  /**
   * GET /api/payments/bill-element-session
   * Returns Bill.com Elements SDK credentials (sessionId, userId, orgId, devKey).
   * Frontend uses these to initialize the embedded vendorSetupApp Element.
   */
  @Get('bill-element-session')
  @UseGuards(JwtAuthGuard)
  async getBillElementSession() {
    return this.billService.getElementSession();
  }

  /**
   * POST /api/payments/:userId/save-vendor-id
   * Called by frontend after vendorSetupSuccess event to persist the Bill.com vendorId.
   */
  @Post(':userId/save-vendor-id')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async saveVendorId(
    @Param('userId') userId: string,
    @Body('vendorId') vendorId: string,
  ) {
    return this.paymentsService.saveVendorId(userId, vendorId);
  }

  /**
   * GET /api/payments/pending
   * List pending payments for admin "Pay now" flow (admin only)
   */
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPendingPayments() {
    return this.paymentsService.getPendingPayments();
  }

  /**
   * POST /api/payments/:paymentId/pay-now
   * Pay a PENDING payment via Bill.com (admin only)
   */
  @Post(':paymentId/pay-now')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async payNow(@Param('paymentId') paymentId: string) {
    return this.paymentsService.payNow(paymentId);
  }

  /**
   * GET /api/payments/:userId/account-status
   * Get user's payment account status (auth required)
   */
  @Get(':userId/account-status')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async getAccountStatus(@Param('userId') userId: string): Promise<AccountStatusDto> {
    this.logger.log(`Getting account status for user: ${userId}`);
    return this.paymentsService.getAccountStatus(userId);
  }

  /**
   * GET /api/payments/:userId/summary
   * Get payment summary (auth required)
   */
  @Get(':userId/summary')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async getSummary(@Param('userId') userId: string) {
    return this.paymentsService.getSummary(userId);
  }

  /**
   * GET /api/payments/:userId/history
   * Get payment history (auth required)
   */
  @Get(':userId/history')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async getHistory(@Param('userId') userId: string) {
    return this.paymentsService.getHistory(userId);
  }

  /**
   * POST /api/payments/payout
   * Create payout to user (admin only). Admins choose ACH or check and verify W-9 in Bill.com.
   */
  @Post('payout')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async createPayout(@Body() dto: CreatePayoutDto): Promise<PayoutResponseDto> {
    this.logger.log(`Creating payout for user: ${dto.userId}`);
    return this.paymentsService.createPayout(dto);
  }

  /**
   * POST /api/payments/:userId/sync-account
   * Sync account status from Bill.com (auth required)
   */
  @Post(':userId/sync-account')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async syncAccountStatus(@Param('userId') userId: string) {
    this.logger.log(`Syncing account status for user: ${userId}`);
    return this.paymentsService.syncAccountStatus(userId);
  }
}
