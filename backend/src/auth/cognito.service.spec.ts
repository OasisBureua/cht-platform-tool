import { generateKeyPairSync } from 'crypto';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

jest.mock('jwks-rsa', () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      getSigningKey: jest.fn(async () => ({
        getPublicKey: () => publicKey,
      })),
    })),
  };
});

import { CognitoService } from './cognito.service';

describe('CognitoService token verification', () => {
  const region = 'us-east-1';
  const userPoolId = 'us-east-1_TestPool';
  const clientId = 'test-client-id';
  const issuer = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`;

  let service: CognitoService;

  beforeEach(() => {
    const config = {
      get: (key: string) => {
        const map: Record<string, string> = {
          'cognito.userPoolId': userPoolId,
          'cognito.clientId': clientId,
          'cognito.region': region,
          'aws.region': region,
        };
        return map[key];
      },
    } as unknown as ConfigService;

    service = new CognitoService(config);
  });

  function signIdToken(
    claims: Record<string, unknown>,
    opts?: jwt.SignOptions,
  ): string {
    return jwt.sign(
      {
        token_use: 'id',
        aud: clientId,
        iss: issuer,
        email: 'user@example.com',
        ...claims,
      },
      privateKey,
      {
        algorithm: 'RS256',
        keyid: 'test-kid',
        expiresIn: '1h',
        ...opts,
      },
    );
  }

  function signAccessToken(
    claims: Record<string, unknown>,
    opts?: jwt.SignOptions,
  ): string {
    return jwt.sign(
      {
        token_use: 'access',
        client_id: clientId,
        iss: issuer,
        ...claims,
      },
      privateKey,
      {
        algorithm: 'RS256',
        keyid: 'test-kid',
        expiresIn: '1h',
        ...opts,
      },
    );
  }

  it('verifies a valid ID token and returns claims', async () => {
    const token = signIdToken({ sub: 'user-sub-1', given_name: 'Ada' });
    const claims = await service.parseIdTokenClaims(token);
    expect(claims.sub).toBe('user-sub-1');
    expect(claims.email).toBe('user@example.com');
    expect(claims.given_name).toBe('Ada');
    expect(claims.token_use).toBe('id');
  });

  it('rejects ID token with wrong audience', async () => {
    const token = signIdToken({ sub: 'user-sub-1', aud: 'other-client' });
    await expect(service.parseIdTokenClaims(token)).rejects.toThrow(
      /Token verification failed|audience/i,
    );
  });

  it('accepts MRR replica-region issuer for the same pool id', async () => {
    const replicaIssuer = `https://cognito-idp.us-east-2.amazonaws.com/${userPoolId}`;
    const token = signIdToken({
      sub: 'user-sub-1',
      iss: replicaIssuer,
    });
    const claims = await service.parseIdTokenClaims(token);
    expect(claims.sub).toBe('user-sub-1');
    expect(claims.iss).toBe(replicaIssuer);
  });

  it('rejects ID token with wrong issuer', async () => {
    const token = signIdToken({
      sub: 'user-sub-1',
      iss: 'https://cognito-idp.us-east-1.amazonaws.com/us-east-1_Other',
    });
    await expect(service.parseIdTokenClaims(token)).rejects.toThrow(
      /Token verification failed|audience|issuer/i,
    );
  });

  it('rejects ID token with token_use=access', async () => {
    const token = signIdToken({ sub: 'user-sub-1', token_use: 'access' });
    await expect(service.parseIdTokenClaims(token)).rejects.toThrow(
      /token_use/,
    );
  });

  it('rejects expired ID token', async () => {
    const token = signIdToken({ sub: 'user-sub-1' }, { expiresIn: -120 });
    await expect(service.parseIdTokenClaims(token)).rejects.toThrow(
      /Token verification failed|expired/i,
    );
  });

  it('verifies a valid access token via client_id', async () => {
    const token = signAccessToken({ sub: 'user-sub-1' });
    const claims = await service.verifyAccessToken(token);
    expect(claims.sub).toBe('user-sub-1');
    expect(claims.client_id).toBe(clientId);
    expect(claims.token_use).toBe('access');
  });

  it('rejects access token with wrong client_id', async () => {
    const token = signAccessToken({
      sub: 'user-sub-1',
      client_id: 'wrong-client',
    });
    await expect(service.verifyAccessToken(token)).rejects.toThrow(
      /client_id/,
    );
  });

  it('verifyTokenPair accepts matching id+access tokens', async () => {
    const idToken = signIdToken({ sub: 'user-sub-1' });
    const accessToken = signAccessToken({ sub: 'user-sub-1' });
    const claims = await service.verifyTokenPair({ idToken, accessToken });
    expect(claims.sub).toBe('user-sub-1');
  });

  it('verifyTokenPair rejects subject mismatch', async () => {
    const idToken = signIdToken({ sub: 'user-a' });
    const accessToken = signAccessToken({ sub: 'user-b' });
    await expect(
      service.verifyTokenPair({ idToken, accessToken }),
    ).rejects.toThrow(/subject mismatch/);
  });

  it('rejects unsigned / tampered payload', async () => {
    const token = signIdToken({ sub: 'user-sub-1' });
    const [h, p] = token.split('.');
    const tamperedPayload = Buffer.from(
      JSON.stringify({
        sub: 'attacker',
        token_use: 'id',
        aud: clientId,
        iss: issuer,
        exp: Math.floor(Date.now() / 1000) + 3600,
      }),
    ).toString('base64url');
    const tampered = `${h}.${tamperedPayload}.fakesig`;
    await expect(service.parseIdTokenClaims(tampered)).rejects.toThrow();
    expect(p).not.toBe(tamperedPayload);
  });

  it('buildOtpauthUri encodes label and issuer', () => {
    const uri = service.buildOtpauthUri('SECRET123', 'Admin@Example.com');
    expect(uri).toContain('otpauth://totp/');
    expect(uri).toContain('secret=SECRET123');
    expect(uri).toContain('issuer=Community%20Health');
    expect(uri.toLowerCase()).toContain(encodeURIComponent('CHT:admin@example.com').toLowerCase());
  });
});
