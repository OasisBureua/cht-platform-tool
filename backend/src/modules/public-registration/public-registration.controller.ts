import { Body, Controller, Get, Param, Post, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { PublicRegistrationService } from './public-registration.service';
import {
  PublicRegisterDto,
  PublicSurveySubmitDto,
} from './dto/public-registration.dto';

/**
 * Public registration (no login). Writes use the tight `auth` throttle bucket
 * (10 per 15 minutes per client); registering also needs reCAPTCHA.
 */
@Controller('public')
export class PublicRegistrationController {
  constructor(private readonly service: PublicRegistrationService) {}

  @Get('programs/:programId/registration')
  getProgram(@Param('programId') programId: string) {
    return this.service.getProgram(programId);
  }

  @Post('programs/:programId/registration')
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  register(
    @Param('programId') programId: string,
    @Body() dto: PublicRegisterDto,
    @Req() req: Request,
  ) {
    return this.service.register(programId, dto, req.ip);
  }

  @Get('registration-survey/:token')
  getSurvey(@Param('token') token: string) {
    return this.service.getSurvey(token);
  }

  @Post('registration-survey/:token')
  @Throttle({ auth: { limit: 10, ttl: 900_000 } })
  submit(@Param('token') token: string, @Body() dto: PublicSurveySubmitDto) {
    return this.service.submit(token, dto.answers);
  }
}
