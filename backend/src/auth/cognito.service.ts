import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  RespondToAuthChallengeCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  ResendConfirmationCodeCommand,
  ForgotPasswordCommand,
  ConfirmForgotPasswordCommand,
  ChangePasswordCommand,
  AssociateSoftwareTokenCommand,
  VerifySoftwareTokenCommand,
  SetUserMFAPreferenceCommand,
  GetUserCommand,
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  type AuthenticationResultType,
} from '@aws-sdk/client-cognito-identity-provider';
import { UserRole } from '@prisma/client';
import * as jwt from 'jsonwebtoken';
import type { JwksClient, SigningKey } from 'jwks-rsa';

/** Cognito groups defined in infrastructure/terraform/modules/security/cognito/main.tf */
export const COGNITO_GROUP_HCP = 'cht-hcp';
export const COGNITO_GROUP_ADMIN = 'cht-admin';

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  /**
   * Cognito refresh token from the IdP response. Kept for a possible future
   * server-side refresh path — never returned in login API JSON bodies.
   */
  refreshToken?: string;
}

export interface CognitoIdTokenClaims {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  token_use?: 'id' | 'access' | string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  /** Pool username — for Google IdP this is often `Google_<sub>`, not the email. */
  'cognito:username'?: string;
  'cognito:groups'?: string[];
}

export interface CognitoAccessTokenClaims {
  sub: string;
  client_id?: string;
  token_use?: 'id' | 'access' | string;
  iss?: string;
  exp?: number;
  username?: string;
  scope?: string;
}

export type CognitoLoginResult =
  | { kind: 'tokens'; tokens: CognitoTokens }
  | { kind: 'mfa'; challenge: 'SOFTWARE_TOKEN_MFA'; session: string };

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;
  private jwks: JwksClient | null = null;

  constructor(private readonly configService: ConfigService) {
    const region =
      this.configService.get<string>('cognito.region') ||
      this.configService.get<string>('aws.region') ||
      'us-east-1';
    this.client = new CognitoIdentityProviderClient({ region });
  }

  /** Bound Cognito API calls so login cannot hang until the frontend 30s abort. */
  private cognitoAbortSignal(): AbortSignal {
    return AbortSignal.timeout(10_000);
  }

  isConfigured(): boolean {
    return !!(
      this.configService.get<string>('cognito.userPoolId') &&
      this.configService.get<string>('cognito.clientId')
    );
  }

  private get clientId(): string {
    return this.configService.get<string>('cognito.clientId') || '';
  }

  private get userPoolId(): string {
    return this.configService.get<string>('cognito.userPoolId') || '';
  }

  private get region(): string {
    return (
      this.configService.get<string>('cognito.region') ||
      this.configService.get<string>('aws.region') ||
      'us-east-1'
    );
  }

  /** Expected Cognito issuer for this pool (primary region). */
  getIssuer(): string {
    return `https://cognito-idp.${this.region}.amazonaws.com/${this.userPoolId}`;
  }

  /**
   * Cognito MRR / updated OIDC issuer can put a different `iss` on tokens while
   * still signing with keys served from the primary JWKS. Accept known variants.
   */
  private getValidIssuers(): [string, ...string[]] {
    const poolId = this.userPoolId;
    const primary = this.region;
    const replica =
      this.configService.get<string>('cognito.replicaRegion')?.trim() ||
      'us-east-2';
    const regions = Array.from(new Set([primary, replica].filter(Boolean)));
    const issuers: string[] = [];
    for (const region of regions) {
      issuers.push(`https://cognito-idp.${region}.amazonaws.com/${poolId}`);
      // Multi-region "Updated" OIDC issuer (console Issuer URL change).
      issuers.push(
        `https://issuer-cognito-idp.${region}.amazonaws.com/${poolId}`,
      );
    }
    if (issuers.length === 0) {
      return [this.getIssuer()];
    }
    return issuers as [string, ...string[]];
  }

  private get jwksUri(): string {
    const override = this.configService.get<string>('cognito.jwksUri')?.trim();
    if (override) return override;
    return `${this.getIssuer()}/.well-known/jwks.json`;
  }

  private getJwksClient(): JwksClient {
    if (!this.jwks) {
      // Lazy require: jwks-rsa → jose is ESM and breaks Jest when imported at module load.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('jwks-rsa') as
        | ((options: {
            jwksUri: string;
            cache?: boolean;
            rateLimit?: boolean;
            jwksRequestsPerMinute?: number;
          }) => JwksClient)
        | {
            default: (options: {
              jwksUri: string;
              cache?: boolean;
              rateLimit?: boolean;
              jwksRequestsPerMinute?: number;
            }) => JwksClient;
          };
      const createClient = typeof mod === 'function' ? mod : mod.default;
      this.jwks = createClient({
        jwksUri: this.jwksUri,
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
      });
    }
    return this.jwks;
  }

  private async getSigningKey(kid: string): Promise<string> {
    const key: SigningKey = await this.getJwksClient().getSigningKey(kid);
    return key.getPublicKey();
  }

  private get hostedUiBaseUrl(): string {
    const configured = this.configService.get<string>('cognito.hostedUiBaseUrl');
    if (configured) return configured.replace(/\/$/, '');
    const domain = this.configService.get<string>('cognito.domainPrefix');
    const region = this.region;
    if (domain) {
      return `https://${domain}.auth.${region}.amazoncognito.com`;
    }
    return '';
  }

  /**
   * Verify a Cognito ID token (JWKS RS256 + iss/aud/exp/token_use=id).
   * Used by login / MFA / PKCE callback before creating a Postgres session.
   */
  async parseIdTokenClaims(idToken: string): Promise<CognitoIdTokenClaims> {
    const claims = await this.verifyJwt(idToken, {
      expectedTokenUse: 'id',
      audience: this.clientId,
    });
    return claims as CognitoIdTokenClaims;
  }

  /**
   * Verify a Cognito access token (JWKS RS256 + iss/exp/token_use=access + client_id).
   */
  async verifyAccessToken(
    accessToken: string,
  ): Promise<CognitoAccessTokenClaims> {
    const claims = await this.verifyJwt(accessToken, {
      expectedTokenUse: 'access',
    });
    const accessClaims = claims as CognitoAccessTokenClaims;
    if (accessClaims.client_id !== this.clientId) {
      throw new Error('Invalid access token client_id');
    }
    return accessClaims;
  }

  /**
   * Verify both tokens returned by Cognito before session creation.
   */
  async verifyTokenPair(tokens: CognitoTokens): Promise<CognitoIdTokenClaims> {
    const [idClaims, accessClaims] = await Promise.all([
      this.parseIdTokenClaims(tokens.idToken),
      this.verifyAccessToken(tokens.accessToken),
    ]);
    if (idClaims.sub !== accessClaims.sub) {
      throw new Error('ID and access token subject mismatch');
    }
    return idClaims;
  }

  private async verifyJwt(
    token: string,
    opts: {
      expectedTokenUse: 'id' | 'access';
      audience?: string;
    },
  ): Promise<jwt.JwtPayload> {
    if (!this.userPoolId || !this.clientId) {
      throw new Error('Cognito is not configured');
    }

    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header?.kid) {
      throw new Error('Invalid token');
    }

    let publicKey: string;
    try {
      publicKey = await this.getSigningKey(decoded.header.kid);
    } catch (err) {
      this.logger.warn(
        `[Cognito] JWKS lookup failed for kid=${decoded.header.kid}: ${err}`,
      );
      throw new Error('Unable to verify token signature');
    }

    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(token, publicKey, {
        algorithms: ['RS256'],
        issuer: this.getValidIssuers(),
        audience: opts.audience,
        clockTolerance: 60,
      }) as jwt.JwtPayload;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      const unverified = decoded.payload as jwt.JwtPayload;
      this.logger.warn(
        `[Cognito] JWT verify failed token_use=${String(unverified?.token_use)} iss=${String(unverified?.iss)} expectedIssuers=${this.getValidIssuers().join('|')}: ${message}`,
      );
      throw new Error(`Token verification failed: ${message}`);
    }

    if (payload.token_use !== opts.expectedTokenUse) {
      throw new Error(
        `Invalid token_use (expected ${opts.expectedTokenUse}, got ${String(payload.token_use)})`,
      );
    }

    if (!payload.sub || typeof payload.sub !== 'string') {
      throw new Error('Token missing sub');
    }

    return payload;
  }

  async loginWithPassword(
    email: string,
    password: string,
  ): Promise<CognitoLoginResult> {
    const response = await this.client.send(
      new InitiateAuthCommand({
        ClientId: this.clientId,
        AuthFlow: 'USER_PASSWORD_AUTH',
        AuthParameters: {
          USERNAME: email.trim().toLowerCase(),
          PASSWORD: password,
        },
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );

    if (response.ChallengeName === 'SOFTWARE_TOKEN_MFA') {
      if (!response.Session) {
        throw new Error('MFA challenge missing session');
      }
      return {
        kind: 'mfa',
        challenge: 'SOFTWARE_TOKEN_MFA',
        session: response.Session,
      };
    }

    const tokens = this.toTokens(response.AuthenticationResult);
    if (!tokens) {
      throw new Error('Cognito login did not return tokens');
    }
    return { kind: 'tokens', tokens };
  }

  async respondToMfaChallenge(
    session: string,
    code: string,
    email: string,
  ): Promise<CognitoTokens> {
    const response = await this.client.send(
      new RespondToAuthChallengeCommand({
        ClientId: this.clientId,
        ChallengeName: 'SOFTWARE_TOKEN_MFA',
        Session: session,
        ChallengeResponses: {
          USERNAME: email.trim().toLowerCase(),
          SOFTWARE_TOKEN_MFA_CODE: code.trim(),
        },
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );

    const tokens = this.toTokens(response.AuthenticationResult);
    if (!tokens) {
      throw new Error('MFA verification did not return tokens');
    }
    return tokens;
  }

  async signUp(
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ): Promise<{ userSub: string; userConfirmed: boolean }> {
    const response = await this.client.send(
      new SignUpCommand({
        ClientId: this.clientId,
        Username: email.trim().toLowerCase(),
        Password: password,
        UserAttributes: [
          { Name: 'email', Value: email.trim().toLowerCase() },
          ...(firstName?.trim()
            ? [{ Name: 'given_name', Value: firstName.trim() }]
            : []),
          ...(lastName?.trim()
            ? [{ Name: 'family_name', Value: lastName.trim() }]
            : []),
        ],
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );

    if (!response.UserSub) {
      throw new Error('Cognito signup did not return UserSub');
    }

    return {
      userSub: response.UserSub,
      userConfirmed: response.UserConfirmed === true,
    };
  }

  async confirmSignUp(email: string, code: string): Promise<void> {
    await this.client.send(
      new ConfirmSignUpCommand({
        ClientId: this.clientId,
        Username: email.trim().toLowerCase(),
        ConfirmationCode: code.trim(),
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );
  }

  async resendConfirmationCode(email: string): Promise<void> {
    await this.client.send(
      new ResendConfirmationCodeCommand({
        ClientId: this.clientId,
        Username: email.trim().toLowerCase(),
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.send(
      new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email.trim().toLowerCase(),
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );
  }

  async confirmForgotPassword(
    email: string,
    code: string,
    password: string,
  ): Promise<void> {
    await this.client.send(
      new ConfirmForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email.trim().toLowerCase(),
        ConfirmationCode: code.trim(),
        Password: password,
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );
  }

  /**
   * Change password for a signed-in Cognito user (requires a valid access token).
   */
  async changePassword(
    accessToken: string,
    previousPassword: string,
    proposedPassword: string,
  ): Promise<void> {
    await this.client.send(
      new ChangePasswordCommand({
        AccessToken: accessToken,
        PreviousPassword: previousPassword,
        ProposedPassword: proposedPassword,
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );
  }

  /**
   * Start TOTP enrollment. Returns the shared secret for an authenticator app.
   */
  async associateSoftwareToken(accessToken: string): Promise<{ secretCode: string }> {
    const response = await this.client.send(
      new AssociateSoftwareTokenCommand({ AccessToken: accessToken }),
      { abortSignal: this.cognitoAbortSignal() },
    );
    if (!response.SecretCode) {
      throw new Error('Cognito did not return an MFA secret');
    }
    return { secretCode: response.SecretCode };
  }

  /**
   * Confirm TOTP enrollment and prefer software-token MFA for the user.
   */
  async verifySoftwareTokenAndEnable(
    accessToken: string,
    code: string,
    friendlyDeviceName = 'Authenticator app',
  ): Promise<void> {
    const verify = await this.client.send(
      new VerifySoftwareTokenCommand({
        AccessToken: accessToken,
        UserCode: code.trim(),
        FriendlyDeviceName: friendlyDeviceName,
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );
    if (verify.Status && verify.Status !== 'SUCCESS') {
      throw new Error('MFA code verification failed');
    }

    await this.client.send(
      new SetUserMFAPreferenceCommand({
        AccessToken: accessToken,
        SoftwareTokenMfaSettings: {
          Enabled: true,
          PreferredMfa: true,
        },
      }),
      { abortSignal: this.cognitoAbortSignal() },
    );
  }

  /** Whether the Cognito user has software-token MFA enabled. */
  async isSoftwareTokenMfaEnabled(accessToken: string): Promise<boolean> {
    const user = await this.client.send(
      new GetUserCommand({ AccessToken: accessToken }),
      { abortSignal: this.cognitoAbortSignal() },
    );
    const settings = user.UserMFASettingList ?? [];
    return settings.includes('SOFTWARE_TOKEN_MFA');
  }

  buildOtpauthUri(secretCode: string, email: string): string {
    const label = encodeURIComponent(`CHT:${email.trim().toLowerCase()}`);
    const issuer = encodeURIComponent('Community Health');
    return `otpauth://totp/${label}?secret=${encodeURIComponent(secretCode)}&issuer=${issuer}`;
  }

  /**
   * Keep Cognito groups aligned with Postgres User.role (HCP/KOL → cht-hcp, ADMIN → cht-admin).
   * @param preferredUsername Optional pool Username from the ID token (`cognito:username`).
   */
  async syncGroupsForRole(
    email: string,
    role: UserRole,
    preferredUsername?: string | null,
  ): Promise<void> {
    if (!this.isConfigured()) return;

    const preferred = preferredUsername?.trim();
    const username =
      (preferred && preferred.length > 0 ? preferred : null) ??
      (await this.resolveUsername(email));
    if (!username) {
      this.logger.warn(
        `[Cognito] Skipping group sync — no pool username for ${email.trim().toLowerCase()}`,
      );
      return;
    }

    const addGroup =
      role === UserRole.ADMIN ? COGNITO_GROUP_ADMIN : COGNITO_GROUP_HCP;
    const removeGroup =
      role === UserRole.ADMIN ? COGNITO_GROUP_HCP : COGNITO_GROUP_ADMIN;

    await this.addUserToGroup(username, addGroup);
    await this.removeUserFromGroup(username, removeGroup);
  }

  /**
   * Resolve pool Username. Native users often match email; Google/federated users
   * use `Google_<id>` — look them up via ListUsers email filter.
   */
  async resolveUsername(email: string): Promise<string | null> {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes('@')) return null;

    try {
      const response = await this.client.send(
        new AdminGetUserCommand({
          UserPoolId: this.userPoolId,
          Username: normalized,
        }),
        { abortSignal: this.cognitoAbortSignal() },
      );
      return response.Username ?? normalized;
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      if (
        !/UserNotFoundException/i.test(name) &&
        !/user does not exist/i.test(msg)
      ) {
        this.logger.warn(
          `[Cognito] resolveUsername AdminGetUser failed for ${normalized}: ${name || msg}`,
        );
      }
    }

    try {
      const listed = await this.client.send(
        new ListUsersCommand({
          UserPoolId: this.userPoolId,
          Filter: `email = "${normalized.replace(/"/g, '')}"`,
          Limit: 5,
        }),
        { abortSignal: this.cognitoAbortSignal() },
      );
      const match = listed.Users?.find((u) => u.Username)?.Username;
      if (match) return match;
      this.logger.warn(
        `[Cognito] Cannot sync groups: ${normalized} not found in pool`,
      );
      return null;
    } catch (err) {
      const name = err instanceof Error ? err.name : '';
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `[Cognito] resolveUsername ListUsers failed for ${normalized}: ${name || msg}`,
      );
      return null;
    }
  }

  private cognitoErrorMessage(err: unknown): string {
    if (err instanceof Error) {
      return err.name ? `${err.name}: ${err.message}` : err.message;
    }
    return String(err);
  }

  private async addUserToGroup(
    username: string,
    groupName: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new AdminAddUserToGroupCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          GroupName: groupName,
        }),
      );
      this.logger.log(`[Cognito] Added ${username} to ${groupName}`);
    } catch (err) {
      const msg = this.cognitoErrorMessage(err);
      if (/UserNotFoundException|user does not exist/i.test(msg)) {
        this.logger.warn(
          `[Cognito] Skipped add to ${groupName}: ${username} not in pool`,
        );
        return;
      }
      this.logger.error(
        `[Cognito] Failed to add ${username} to ${groupName}: ${msg}`,
      );
    }
  }

  private async removeUserFromGroup(
    username: string,
    groupName: string,
  ): Promise<void> {
    try {
      await this.client.send(
        new AdminRemoveUserFromGroupCommand({
          UserPoolId: this.userPoolId,
          Username: username,
          GroupName: groupName,
        }),
      );
      this.logger.log(`[Cognito] Removed ${username} from ${groupName}`);
    } catch (err) {
      const msg = this.cognitoErrorMessage(err);
      if (
        /UserNotFoundException|user does not exist|not a member|ResourceNotFoundException/i.test(
          msg,
        )
      ) {
        return;
      }
      this.logger.error(
        `[Cognito] Failed to remove ${username} from ${groupName}: ${msg}`,
      );
    }
  }

  private normalizeOAuthRedirectUri(uri: string): string {
    const trimmed = uri.trim();
    if (!trimmed) return trimmed;
    try {
      const u = new URL(trimmed);
      u.search = '';
      u.hash = '';
      const path = u.pathname.replace(/\/$/, '') || '';
      return path ? `${u.origin}${path}` : u.origin;
    } catch {
      return trimmed.split('#')[0].split('?')[0].replace(/\/$/, '');
    }
  }

  async exchangeAuthorizationCode(
    code: string,
    redirectUri: string,
    codeVerifier: string,
  ): Promise<CognitoTokens> {
    const tokenUrl = `${this.hostedUiBaseUrl}/oauth2/token`;
    if (!tokenUrl.startsWith('https://')) {
      throw new Error('Cognito hosted UI URL is not configured');
    }

    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.clientId,
      code: code.trim(),
      // Cognito requires exact allowlist match — never forward ?from= / hash.
      redirect_uri: this.normalizeOAuthRedirectUri(redirectUri),
      code_verifier: codeVerifier.trim(),
    });

    const res = await fetch(tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const data = (await res.json().catch(() => ({}))) as {
      id_token?: string;
      access_token?: string;
      refresh_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!res.ok) {
      const msg =
        data.error_description || data.error || 'Token exchange failed';
      this.logger.warn(`[Cognito] code exchange failed: ${msg}`);
      throw new Error(msg);
    }

    if (!data.id_token || !data.access_token) {
      throw new Error('Token exchange did not return tokens');
    }

    return {
      idToken: data.id_token,
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  private toTokens(
    result?: AuthenticationResultType,
  ): CognitoTokens | null {
    if (!result?.IdToken || !result.AccessToken) return null;
    return {
      idToken: result.IdToken,
      accessToken: result.AccessToken,
      refreshToken: result.RefreshToken,
    };
  }
}
