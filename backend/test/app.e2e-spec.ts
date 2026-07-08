import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';

const mockPrismaService = {
  $connect: jest.fn().mockResolvedValue(undefined),
  $disconnect: jest.fn().mockResolvedValue(undefined),
  $queryRaw: jest.fn().mockResolvedValue([{ 1: 1 }]),
  onModuleInit: jest.fn().mockResolvedValue(undefined),
  onModuleDestroy: jest.fn().mockResolvedValue(undefined),
};

describe('App (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrismaService)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api', {
      exclude: [
        'health',
        'health/ready',
        'health/live',
        'health/detail',
        'actuator/info',
      ],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('/api (GET) returns API info', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('name', 'CHT Platform API');
        expect(res.body).toHaveProperty('version');
      });
  });

  it('/health (GET) returns health status', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('status');
      });
  });

  it('/actuator/info (GET) returns deployment metadata', () => {
    return request(app.getHttpServer())
      .get('/actuator/info')
      .expect(200)
      .expect((res) => {
        expect(res.body).toHaveProperty('app-name', 'cht-platform-backend');
        expect(res.body).toHaveProperty('env');
        expect(res.body).toHaveProperty('region');
        expect(res.body).toHaveProperty('image-tag');
        expect(res.body).toHaveProperty('auth-provider');
      });
  });
});
