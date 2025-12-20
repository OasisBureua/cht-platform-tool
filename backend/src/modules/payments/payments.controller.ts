import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CreatePayoutDto } from './dto/payout.dto';
import { Public } from '../../auth/decorators/public.decorator';

@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
    constructor(private readonly paymentsService: PaymentsService) {}

    /**
     * POST  /payments/connect-account
     * Create Stripe Connect account for current user
     */
    @Post('connect-account')
    @Public() // TODO: Remove after Auth0 is set up
    async createConnectAccount(@Request() req) {
        // TODO: Get userId from req.user after Auth0 is configurewd
        // For now, hardcode a test user ID
        const userId = 'cmjdk4k1g0000mpho6zt1y57g'; // Replace with actual user ID from database

        return this.paymentsService.createConnectAccount(userId);
    }

    /**
     * POST /payments/account-link
     * Generate new onboarding link (for refresh)
     */
    @Post('account-link')
    @Public() // TODO: Remove after Auth0 is set up
    async createAccountLink(@Request() req) {
        const userId = 'cmjdk4k1g0000mpho6zt1y57g'; // Replace with req.user.userId
        return this.paymentsService.createAccountLink(userId);
    }

    /**
     * GET /payments/account-status
     * Get current user's Stripe account status
     */
    @Get('account-status')
    @Public() // TODO: Remove after Auth0 is set up
    async getAccountStatus(@Request() req) {
        const userId = 'cmjdk4k1g0000mpho6zt1y57g'; // Replace with req.user.userId
        return this.paymentsService.getAccountStatus(userId);
    }

    /**
     * POST /payments/payout
     * Create payout to user (admin only)
     */
    @Post('payout')
    @Public() // TODO: Add @Roles('ADMIN') after Auth0 is set up
    async createPayout(@Body() createPayoutDto: CreatePayoutDto) {
        return this.paymentsService.createPayout(createPayoutDto);
    }

    /**
   * POST /payments/sync-account
   * Manually sync account status from Stripe
   */
    @Post('sync-account')
    @Public() // TODO: Remove after Auth0 is set up
    async syncAccount(@Request() req) {
        const userId = 'cmjdk4k1g0000mpho6zt1y57g'; // TODO: Replace with your actual test user ID
        return this.paymentsService.syncAccountStatus(userId);
    }
}