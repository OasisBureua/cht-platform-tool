import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { ZoomMeetingSdkService } from './zoom-meeting-sdk.service';

describe('ZoomMeetingSdkService', () => {
  const sdkKey = 'testSdkKey123';
  const sdkSecret = 'testSdkSecret456';

  function makeService(env: Record<string, string | undefined>) {
    const config = {
      get: (k: string) => env[k],
    } as unknown as ConfigService;
    return new ZoomMeetingSdkService(config);
  }

  it('signs a JWT Zoom can verify (appKey + sdkKey + mn + role)', () => {
    const svc = makeService({
      'zoom.sdkKey': ` ${sdkKey}\n`,
      'zoom.sdkSecret': ` ${sdkSecret} `,
    });
    const token = svc.generateSignature('  987 654 321  ', 0);
    const decoded = jwt.decode(token) as jwt.JwtPayload;
    expect(decoded.appKey).toBe(sdkKey);
    expect(decoded.sdkKey).toBe(sdkKey);
    expect(decoded.mn).toBe('987654321');
    expect(decoded.role).toBe(0);
    expect(typeof decoded.iat).toBe('number');
    expect((decoded.exp as number) - (decoded.iat as number)).toBe(7200);
    expect(decoded.tokenExp).toBe(decoded.exp);
    jwt.verify(token, sdkSecret, { algorithms: ['HS256'] });
  });

  it('falls back to Zoom client id/secret when SDK pair is unset', () => {
    const svc = makeService({
      'zoom.clientId': 'generalAppClientId',
      'zoom.clientSecret': 'generalAppClientSecret',
    });
    expect(svc.isConfigured()).toBe(true);
    const token = svc.generateSignature('11122233344', 0);
    const decoded = jwt.verify(token, 'generalAppClientSecret') as jwt.JwtPayload;
    expect(decoded.appKey).toBe('generalAppClientId');
  });
});
