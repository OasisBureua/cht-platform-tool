import { Controller, Post, Get, Body, Param, Logger } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CreatePayoutDto, PayoutResponseDto } from './dto/create-payout.dto';
import { CreateConnectAccountResponseDto, AccountLinkResponseDto } from './dto/create-connect-account.dto';
import { AccountStatusDto } from './dto/account-status.dto';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * POST /api/payments/:userId/connect-account
   * Create Stripe Connect account for user
   */
  @Post(':userId/connect-account')
  async createConnectAccount(
    @Param('userId') userId: string,
  ): Promise<CreateConnectAccountResponseDto> {
    this.logger.log(`Creating Connect account for user: ${userId}`);
    return this.paymentsService.createConnectAccount(userId);
  }

  /**
   * POST /api/payments/:userId/account-link
   * Generate new onboarding link (refresh)
   */
  @Post(':userId/account-link')
  async createAccountLink(@Param('userId') userId: string): Promise<AccountLinkResponseDto> {
    this.logger.log(`Creating account link for user: ${userId}`);
    return this.paymentsService.createAccountLink(userId);
  }

  /**
   * GET /api/payments/:userId/account-status
   * Get user's payment account status
   */
  @Get(':userId/account-status')
  async getAccountStatus(@Param('userId') userId: string): Promise<AccountStatusDto> {
    this.logger.log(`Getting account status for user: ${userId}`);
    return this.paymentsService.getAccountStatus(userId);
  }

  /**
   * POST /api/payments/payout
   * Create payout to user (admin only - will add auth later)
   */
  @Post('payout')
  async createPayout(@Body() dto: CreatePayoutDto): Promise<PayoutResponseDto> {
    this.logger.log(`Creating payout for user: ${dto.userId}`);
    return this.paymentsService.createPayout(dto);
  }

  /**
   * POST /api/payments/:userId/sync-account
   * Sync account status from Stripe (for testing without webhooks)
   */
  @Post(':userId/sync-account')
  async syncAccountStatus(@Param('userId') userId: string) {
    this.logger.log(`Syncing account status for user: ${userId}`);
    return this.paymentsService.syncAccountStatus(userId);
  }
}
