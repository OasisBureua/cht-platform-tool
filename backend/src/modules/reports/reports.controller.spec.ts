import {
  ConflictException,
  ExecutionContext,
  INestApplication,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AdminCapabilityGuard } from '../../auth/admin-capability.guard';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { RolesGuard } from '../../auth/roles.guard';
import { RedisCacheService } from '../../cache/redis-cache.service';
import { ReportGenerationLimitService } from './report-generation-limit.service';
import { ReportRecipientsService } from './report-recipients.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';

const REPORT_ID = '0f8fad5b-d9cb-469f-a165-70867728950e';

describe('ReportsController caps (CPR-21, HTTP)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];
  const reports = { create: jest.fn(), regenerate: jest.fn() };
  let user = 'admin-1';

  beforeEach(async () => {
    reports.create.mockReset().mockResolvedValue({ reportId: REPORT_ID });
    reports.regenerate.mockReset().mockResolvedValue({ reportId: REPORT_ID });
    user = 'admin-1';

    const moduleRef = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportGenerationLimitService,
        { provide: ReportsService, useValue: reports },
        { provide: ReportRecipientsService, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: (key: string) =>
              ({ 'reports.generatePerHour': 2, 'reports.generatePerDay': 20 })[
                key
              ],
          },
        },
        {
          provide: RedisCacheService,
          useValue: {
            isEnabled: () => false,
            increment: () => Promise.resolve(null),
            decrement: () => Promise.resolve(null),
          },
        },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({
        canActivate: (ctx: ExecutionContext) => {
          ctx.switchToHttp().getRequest<{ user: { userId: string } }>().user = {
            userId: user,
          };
          return true;
        },
      })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(AdminCapabilityGuard)
      .useValue({ canActivate: () => true })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers 429 once Generate and Regenerate together pass the hourly cap', async () => {
    await request(server())
      .post('/api/reports')
      .send({ campaignId: '9' })
      .expect(202);
    await request(server())
      .post(`/api/reports/${REPORT_ID}/regenerate`)
      .send({})
      .expect(202);

    const res = await request(server())
      .post('/api/reports')
      .send({ campaignId: '9' })
      .expect(429);
    const body = res.body as { message: string; retryAfterSeconds: number };
    expect(body.message).toMatch(
      /^You can generate up to 2 reports an hour\. Try again in \d+ minutes?\.$/,
    );
    expect(body.retryAfterSeconds).toBeGreaterThan(0);
    await request(server())
      .post(`/api/reports/${REPORT_ID}/regenerate`)
      .send({})
      .expect(429);
    expect(reports.create).toHaveBeenCalledTimes(1);
    expect(reports.regenerate).toHaveBeenCalledTimes(1);

    user = 'admin-2';
    await request(server())
      .post('/api/reports')
      .send({ campaignId: '9' })
      .expect(202);
  });

  it('lets only the cap through when requests arrive together', async () => {
    reports.create.mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ reportId: REPORT_ID }), 20),
        ),
    );

    const statuses = await Promise.all(
      [0, 1, 2].map(async (i) =>
        i === 2
          ? (
              await request(server())
                .post(`/api/reports/${REPORT_ID}/regenerate`)
                .send({})
            ).status
          : (
              await request(server())
                .post('/api/reports')
                .send({ campaignId: '9' })
            ).status,
      ),
    );

    expect(statuses.filter((s) => s === 429)).toHaveLength(1);
    expect(statuses.filter((s) => s === 202)).toHaveLength(2);
  });

  it('does not count a request that was refused', async () => {
    reports.create.mockRejectedValueOnce(
      new ConflictException('A report is already generating'),
    );
    await request(server())
      .post('/api/reports')
      .send({ campaignId: '9' })
      .expect(409);

    await request(server())
      .post('/api/reports')
      .send({ campaignId: '9' })
      .expect(202);
    await request(server())
      .post('/api/reports')
      .send({ campaignId: '9' })
      .expect(202);
    await request(server())
      .post('/api/reports')
      .send({ campaignId: '9' })
      .expect(429);
  });
});
