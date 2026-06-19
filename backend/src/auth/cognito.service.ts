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
  AdminAddUserToGroupCommand,
  AdminRemoveUserFromGroupCommand,
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
    );
  }

  async resendConfirmationCode(email: string): Promise<void> {
    await this.client.send(
      new ResendConfirmationCodeCommand({
        ClientId: this.clientId,
        Username: email.trim().toLowerCase(),
      }),
    );
  }

  async forgotPassword(email: string): Promise<void> {
    await this.client.send(
      new ForgotPasswordCommand({
        ClientId: this.clientId,
        Username: email.trim().toLowerCase(),
      }),
    );
  }

  /**
   * Keep Cognito groups aligned with Postgres User.role (HCP/KOL → cht-hcp, ADMIN → cht-admin).
   */
  async syncGroupsForRole(email: string, role: UserRole): Promise<void> {
    if (!this.isConfigured()) return;

    const username = email.trim().toLowerCase();
    if (!username.includes('@')) return;

    const addGroup =
      role === UserRole.ADMIN ? COGNITO_GROUP_ADMIN : COGNITO_GROUP_HCP;
    const removeGroup =
      role === UserRole.ADMIN ? COGNITO_GROUP_HCP : COGNITO_GROUP_ADMIN;

    await this.addUserToGroup(username, addGroup);
    await this.removeUserFromGroup(username, removeGroup);
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
      const msg = err instanceof Error ? err.message : String(err);
      if (/user does not exist|usernotfound/i.test(msg)) {
        this.logger.warn(
          `[Cognito] Skipped add to ${groupName}: ${username} not in pool`,
        );
        return;
      }
      this.logger.warn(
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
      const msg = err instanceof Error ? err.message : String(err);
      if (
        /user does not exist|usernotfound|not a member|not found/i.test(msg)
      ) {
        return;
      }
      this.logger.warn(
        `[Cognito] Failed to remove ${username} from ${groupName}: ${msg}`,
      );
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
      redirect_uri: redirectUri.trim(),
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
