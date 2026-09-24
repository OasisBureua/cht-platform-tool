import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CognitoM2mAuthGuard } from './cognito-m2m-auth.guard';
import { CognitoService } from './cognito.service';

describe('CognitoM2mAuthGuard', () => {
  const m2mClientId = 'm2m-client-id';
  let cognito: { isConfigured: jest.Mock; verifyM2mAccessToken: jest.Mock };
  let guard: CognitoM2mAuthGuard;

  beforeEach(() => {
    cognito = {
      isConfigured: jest.fn(() => true),
      verifyM2mAccessToken: jest.fn(),
    };
    const config = {
      get: (key: string) => {
        if (key === 'cognito.m2mExportClientId') return m2mClientId;
        if (key === 'cognito.m2mExportScope') return 'platform/export.read';
        return undefined;
      },
    } as unknown as ConfigService;
    guard = new CognitoM2mAuthGuard(
      cognito as unknown as CognitoService,
      config,
    );
  });

  function ctx(auth?: string) {
    const request: Record<string, unknown> = {
      headers: auth ? { authorization: auth } : {},
    };
    return {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
      request,
    };
  }

  it('rejects missing Bearer token', async () => {
    await expect(guard.canActivate(ctx() as never)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects invalid tokens with 401', async () => {
    cognito.verifyM2mAccessToken.mockRejectedValue(new Error('bad sig'));
    await expect(
      guard.canActivate(ctx('Bearer bad') as never),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects missing scope with 403', async () => {
    const err = new Error('Missing required scope') as Error & {
      code?: string;
    };
    err.code = 'MISSING_SCOPE';
    cognito.verifyM2mAccessToken.mockRejectedValue(err);
    await expect(
      guard.canActivate(ctx('Bearer tok') as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts a valid M2M token and attaches claim summary', async () => {
    cognito.verifyM2mAccessToken.mockResolvedValue({
      sub: m2mClientId,
      client_id: m2mClientId,
      scope: 'platform/export.read',
    });
    const context = ctx('Bearer good-token');
    await expect(guard.canActivate(context as never)).resolves.toBe(true);
    expect(context.request.m2m).toEqual({
      clientId: m2mClientId,
      scope: 'platform/export.read',
      sub: m2mClientId,
    });
  });
});
