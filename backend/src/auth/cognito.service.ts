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
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
  AdminGetUserCommand,
  ListUsersCommand,
  type AuthenticationResultType,
} from '@aws-sdk/client-cognito-identity-provider';
import { UserRole } from '@prisma/client';

/** Cognito groups defined in infrastructure/terraform/modules/security/cognito/main.tf */
export const COGNITO_GROUP_HCP = 'cht-hcp';
export const COGNITO_GROUP_ADMIN = 'cht-admin';

export interface CognitoTokens {
  idToken: string;
  accessToken: string;
  refreshToken?: string;
}

export interface CognitoIdTokenClaims {
  sub: string;
  email?: string;
  given_name?: string;
  family_name?: string;
  name?: string;
  /** Pool username: for Google IdP this is often `Google_<sub>`, not the email. */
  'cognito:username'?: string;
  'cognito:groups'?: string[];
}

export type CognitoLoginResult =
  | { kind: 'tokens'; tokens: CognitoTokens }
  | { kind: 'mfa'; challenge: 'SOFTWARE_TOKEN_MFA'; session: string };

@Injectable()
export class CognitoService {
  private readonly logger = new Logger(CognitoService.name);
  private readonly client: CognitoIdentityProviderClient;

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

  private get hostedUiBaseUrl(): string {
    const configured = this.configService.get<string>('cognito.hostedUiBaseUrl');
    if (configured) return configured.replace(/\/$/, '');
    const domain = this.configService.get<string>('cognito.domainPrefix');
    const region =
      this.configService.get<string>('cognito.region') ||
      this.configService.get<string>('aws.region') ||
      'us-east-1';
    if (domain) {
      return `https://${domain}.auth.${region}.amazoncognito.com`;
    }
    return '';
  }

  parseIdTokenClaims(idToken: string): CognitoIdTokenClaims {
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid ID token');
    }
    const payload = Buffer.from(parts[1], 'base64url').toString('utf8');
    return JSON.parse(payload) as CognitoIdTokenClaims;
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
        `[Cognito] Skipping group sync: no pool username for ${email.trim().toLowerCase()}`,
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
   * use `Google_<id>`: look them up via ListUsers email filter.
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
      // Cognito requires exact allowlist match, never forward ?from= / hash.
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
