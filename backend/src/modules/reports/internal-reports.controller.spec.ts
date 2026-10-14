import {
  INestApplication,
  UnauthorizedException,
  ValidationPipe,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  InternalReportsController,
  ReportsNotifyM2mGuard,
} from './internal-reports.controller';
import { ReportReadyService } from './report-ready.service';

describe('InternalReportsController (HTTP)', () => {
  let app: INestApplication;
  const server = () => app.getHttpServer() as Parameters<typeof request>[0];
  const ready = {
    assertAuthorized: jest.fn(),
    handleReady: jest.fn(),
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InternalReportsController],
      providers: [
        ReportsNotifyM2mGuard,
        { provide: ReportReadyService, useValue: ready },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    // Same as main.ts.
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    ready.assertAuthorized.mockReset().mockResolvedValue(undefined);
    ready.handleReady
      .mockReset()
      .mockResolvedValue({ status: 'sent', sent: 1, failed: 0 });
  });

  it('POST /api/internal/reports/:id/ready passes reportId, campaignId and version through', async () => {
    const res = await request(server())
      .post('/api/internal/reports/rep-1/ready')
      .set('Authorization', 'Bearer a.b.c')
      .send({ campaignId: '9', version: 2 })
      .expect(200);

    expect(res.body).toEqual({ status: 'sent', sent: 1, failed: 0 });
    expect(ready.assertAuthorized).toHaveBeenCalledWith('Bearer a.b.c');
    expect(ready.handleReady).toHaveBeenCalledWith('rep-1', '9', 2);
  });

  it('checks auth before the body: an unauthenticated bad body is 401, not 400', async () => {
    ready.assertAuthorized.mockRejectedValue(
      new UnauthorizedException('Missing Authorization Bearer token'),
    );

    await request(server())
      .post('/api/internal/reports/rep-1/ready')
      .send({ version: 'nope' })
      .expect(401);
    expect(ready.handleReady).not.toHaveBeenCalled();
  });

  it('400s a bad body from an authorized caller', async () => {
    await request(server())
      .post('/api/internal/reports/rep-1/ready')
      .set('Authorization', 'Bearer a.b.c')
      .send({ campaignId: '9', version: 0 })
      .expect(400);
    await request(server())
      .post('/api/internal/reports/rep-1/ready')
      .set('Authorization', 'Bearer a.b.c')
      .send({ campaignId: 'a#b', version: 1 })
      .expect(400);
    expect(ready.handleReady).not.toHaveBeenCalled();
  });
});
