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
} from '@nestjs/common';
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
import { BillService } from './bill.service';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import {
  CreateConnectAccountResponseDto,
  AccountLinkResponseDto,
} from './dto/create-connect-account.dto';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { SubmitW9Dto } from './dto/submit-w9.dto';
import { AccountStatusDto } from './dto/account-status.dto';
import { BillFundingAccountsResponseDto } from './dto/bill-funding-accounts.dto';

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
  async createAccountLink(
    @Param('userId') userId: string,
  ): Promise<AccountLinkResponseDto> {
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
   * GET /api/payments/bill-funding-accounts
   * Lists Bill.com org bank funding accounts (GET /v3/funding-accounts/banks). Use an account `id` (often `bac*`) for BILL_FUNDING_ACCOUNT_ID.
   */
  @Get('bill-funding-accounts')
  @UseGuards(JwtAuthGuard, AdminOrDevGuard)
  @ApiBearerAuth('session-token')
  @ApiOperation({
    summary:
      'List Bill.com funding bank accounts (recommended BILL_FUNDING_ACCOUNT_ID)',
    description:
      'Uses server env Bill.com credentials to call GET /v3/funding-accounts/banks. Returns `recommendedFundingAccountId` when Bill marks an account as default for payables. Does not return passwords, dev keys, or session IDs.',
  })
  @ApiOkResponse({ type: BillFundingAccountsResponseDto })
  async listBillFundingAccounts(): Promise<BillFundingAccountsResponseDto> {
    return this.billService.listBankFundingAccountsWithRecommendation();
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
   * List pending payments for admin "Pay now" flow (admin only)
   */
  @Get('pending')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getPendingPayments() {
    return this.paymentsService.getPendingPayments();
  }

  /**
   * GET /api/payments/failed
   * List failed payments for admin retry flow (admin only)
   */
  @Get('failed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  async getFailedPayments() {
    return this.paymentsService.getFailedPayments();
  }

  /**
   * POST /api/payments/:paymentId/retry
   * Retry a FAILED payment by resetting it to PENDING and re-attempting via Bill.com (admin only)
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
  async getAccountStatus(
    @Param('userId') userId: string,
  ): Promise<AccountStatusDto> {
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
   * POST /api/payments/:userId/w9
   * Submit W-9 tax form (auth required). User must have Bill.com vendor first.
   */
  @Post(':userId/w9')
  @UseGuards(JwtAuthGuard, CheckUserGuard)
  async submitW9(@Param('userId') userId: string, @Body() body: SubmitW9Dto) {
    return this.paymentsService.submitW9(userId, body);
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
