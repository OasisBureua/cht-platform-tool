import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InternalReportsAuthService } from './internal-reports-auth.service';

describe('InternalReportsAuthService', () => {
  const config = {
    get: jest.fn((key: string) =>
      key === 'internalReports.secret' ? 'test-secret' : undefined,
    ),
  } as unknown as ConfigService;

  let service: InternalReportsAuthService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new InternalReportsAuthService(config);
  });

  it('accepts a matching X-BFF-Auth secret', () => {
    expect(() => service.assertBffAuth('test-secret')).not.toThrow();
  });

  it('rejects a missing header', () => {
    expect(() => service.assertBffAuth(undefined)).toThrow(UnauthorizedException);
  });

  it('rejects a wrong secret', () => {
    expect(() => service.assertBffAuth('wrong')).toThrow(UnauthorizedException);
  });

  it('rejects when the secret is not configured', () => {
    const unconfigured = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;
    const unconfiguredService = new InternalReportsAuthService(unconfigured);

    expect(() => unconfiguredService.assertBffAuth('anything')).toThrow(
      UnauthorizedException,
    );
  });
});
