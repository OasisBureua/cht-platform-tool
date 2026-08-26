import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AppInfoService } from './app-info.service';

describe('AppInfoService', () => {
  let service: AppInfoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppInfoService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const values: Record<string, string> = {
                'app.name': 'cht-platform-backend',
                'app.environment': 'dev',
                'app.imageTag': 'v2.2.8',
                'app.containerImage':
                  '233636046512.dkr.ecr.us-east-1.amazonaws.com/cht-platform-backend:v2.2.8',
                'aws.region': 'us-east-1',
                nodeEnv: 'development',
                frontendUrl: 'https://devapp.communityhealth.media',
                'cognito.userPoolId': 'us-east-1_test',
              };
              return values[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AppInfoService>(AppInfoService);
  });

  it('returns actuator info payload', () => {
    const info = service.getInfo();

    expect(info['app-name']).toBe('cht-platform-backend');
    expect(info.env).toBe('dev');
    expect(info.region).toBe('us-east-1');
    expect(info['image-tag']).toBe('v2.2.8');
    expect(info['auth-provider']).toBe('cognito');
    expect(info['frontend-url']).toBe('https://devapp.communityhealth.media');
    expect(info.build.image).toContain('v2.2.8');
    expect(info.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(info['uptime-seconds']).toBeGreaterThanOrEqual(0);
  });
});
