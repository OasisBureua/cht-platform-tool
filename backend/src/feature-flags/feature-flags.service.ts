import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AppConfigDataClient,
  GetLatestConfigurationCommand,
  StartConfigurationSessionCommand,
} from '@aws-sdk/client-appconfigdata';
import {
  AuthFeatureFlags,
  DEFAULT_AUTH_FEATURE_FLAGS,
  parseAuthFeaturesConfig,
} from './feature-flags.types';

const POLL_INTERVAL_MS = 45_000;

@Injectable()
export class FeatureFlagsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FeatureFlagsService.name);
  private readonly client: AppConfigDataClient | null;
  private readonly application: string;
  private readonly environment: string;
  private readonly profile: string;
  private readonly pollingEnabled: boolean;

  private flags: AuthFeatureFlags = DEFAULT_AUTH_FEATURE_FLAGS;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private pollInFlight = false;
  private configurationToken: string | null = null;

  constructor(private readonly configService: ConfigService) {
    this.application =
      this.configService.get<string>('appconfig.application')?.trim() || '';
    this.environment =
      this.configService.get<string>('appconfig.environment')?.trim() || '';
    this.profile =
      this.configService.get<string>('appconfig.profile')?.trim() || '';
    this.pollingEnabled =
      this.application !== '' &&
      this.environment !== '' &&
      this.profile !== '';

    const region =
      this.configService.get<string>('aws.region')?.trim() || 'us-east-1';
    this.client = this.pollingEnabled
      ? new AppConfigDataClient({ region })
      : null;

    if (!this.pollingEnabled) {
      this.logger.log(
        'AppConfig feature flags disabled (APPCONFIG_* env vars not set); MFA gate defaults to off.',
      );
    }
  }

  onModuleInit(): void {
    if (!this.pollingEnabled || !this.client) return;

    void this.pollOnce();
    this.pollTimer = setInterval(() => {
      void this.pollOnce();
    }, POLL_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  getAuthFeatures(): AuthFeatureFlags {
    return this.flags;
  }

  isMfaEnrollmentEnabled(): boolean {
    return this.flags.mfa.enabled;
  }

  private async pollOnce(): Promise<void> {
    if (!this.client || !this.pollingEnabled || this.pollInFlight) return;

    this.pollInFlight = true;
    try {
      if (!this.configurationToken) {
        const session = await this.client.send(
          new StartConfigurationSessionCommand({
            ApplicationIdentifier: this.application,
            EnvironmentIdentifier: this.environment,
            ConfigurationProfileIdentifier: this.profile,
          }),
        );
        this.configurationToken =
          session.InitialConfigurationToken?.trim() || null;
        if (!this.configurationToken) {
          this.logger.warn(
            'AppConfig StartConfigurationSession returned no token; keeping last feature flags.',
          );
          return;
        }
      }

      const latest = await this.client.send(
        new GetLatestConfigurationCommand({
          ConfigurationToken: this.configurationToken,
        }),
      );

      this.configurationToken =
        latest.NextPollConfigurationToken?.trim() ||
        this.configurationToken;

      const payload = latest.Configuration;
      if (!payload || payload.byteLength === 0) {
        return;
      }

      const text = new TextDecoder().decode(payload);
      const parsed = JSON.parse(text) as unknown;
      this.flags = parseAuthFeaturesConfig(parsed);
      this.logger.debug(
        `AppConfig auth-features refreshed: mfa.enabled=${this.flags.mfa.enabled} mfa.method=${this.flags.mfa.method}`,
      );
    } catch (err) {
      this.logger.warn(
        `AppConfig feature flag poll failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    } finally {
      this.pollInFlight = false;
    }
  }
}
