import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from './jwt-auth.guard';
import { OptionalJwtAuthGuard } from './optional-jwt-auth.guard';
import { SKIP_TERMS_CHECK } from './skip-terms-check.decorator';
import { TERMS_NOT_ACCEPTED_CODE } from '../common/terms';

const SESSION_TOKEN = '5b0c6d0e-3f4a-4b8e-9c1d-2a7e6f8b9c01';

describe('JwtAuthGuard', () => {
  const resolveSession = jest.fn();
  const findByUserId = jest.fn();
  const hasAcceptedTerms = jest.fn();
  const authService = {
    getSession: jest.fn(),
    resolveSession,
    findByUserId,
    hasAcceptedTerms,
  };
  const configService = {
    get: jest.fn().mockReturnValue(undefined),
  };
  const originalNodeEnv = process.env.NODE_ENV;

  class SkippedController {
    handler() {
      return undefined;
    }
  }
  Reflect.defineMetadata(SKIP_TERMS_CHECK, true, SkippedController);

  class GuardedController {
    handler() {
      return undefined;
    }
  }

  const buildContext = (
    request: Record<string, unknown>,
    controller:
      | typeof GuardedController
      | typeof SkippedController = GuardedController,
  ) => {
    const handler: () => undefined = new controller().handler;
    return {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ cookie: jest.fn() }),
      }),
      getHandler: () => handler,
      getClass: () => controller,
    } as never;
  };

  const sessionRequest = () => ({
    headers: {},
    cookies: { cht_session: SESSION_TOKEN },
  });

  const buildGuard = () =>
    new JwtAuthGuard(
      configService as never,
      authService as never,
      new Reflector(),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    resolveSession.mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('rejects X-Dev-User-Id in production when JWT is not configured', async () => {
    process.env.NODE_ENV = 'production';
    const context = buildContext({
      headers: { 'x-dev-user-id': 'user-1' },
      cookies: {},
    });

    await expect(buildGuard().canActivate(context)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  describe('terms acceptance', () => {
    beforeEach(() => {
      resolveSession.mockResolvedValue({
        user: { userId: 'user-1', email: 'hcp@example.com', role: 'HCP' },
        cookieMaxAgeSeconds: 0,
      });
    });

    it('allows the request when the current terms are accepted', async () => {
      hasAcceptedTerms.mockResolvedValue(true);

      await expect(
        buildGuard().canActivate(buildContext(sessionRequest())),
      ).resolves.toBe(true);
      expect(hasAcceptedTerms).toHaveBeenCalledWith('user-1');
    });

    it('returns 403 TERMS_NOT_ACCEPTED when terms are not accepted', async () => {
      hasAcceptedTerms.mockResolvedValue(false);

      const err: unknown = await buildGuard()
        .canActivate(buildContext(sessionRequest()))
        .catch((e: unknown) => e);

      expect(err).toBeInstanceOf(ForbiddenException);
      expect((err as ForbiddenException).getResponse()).toMatchObject({
        code: TERMS_NOT_ACCEPTED_CODE,
      });
    });

    it('skips the check on routes marked @SkipTermsCheck()', async () => {
      hasAcceptedTerms.mockResolvedValue(false);

      await expect(
        buildGuard().canActivate(
          buildContext(sessionRequest(), SkippedController),
        ),
      ).resolves.toBe(true);
      expect(hasAcceptedTerms).not.toHaveBeenCalled();
    });

    it('optional auth still identifies users who have not accepted', async () => {
      hasAcceptedTerms.mockResolvedValue(false);
      const request: Record<string, unknown> = sessionRequest();

      await expect(
        new OptionalJwtAuthGuard(buildGuard()).canActivate(
          buildContext(request),
        ),
      ).resolves.toBe(true);
      expect(request.user).toMatchObject({ userId: 'user-1' });
      expect(hasAcceptedTerms).not.toHaveBeenCalled();
    });
  });
});
