import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ActuatorInfoResponse {
  'app-name': string;
  env: string;
  region: string;
  'image-tag': string;
  'node-env': string;
  'uptime-seconds': number;
  timestamp: string;
  'auth-provider': 'cognito' | 'gotrue' | 'dev';
  'frontend-url': string;
  build: {
    image: string | null;
  };
}

@Injectable()
export class AppInfoService {
  constructor(private readonly config: ConfigService) {}

  getInfo(): ActuatorInfoResponse {
    const cognitoPoolId = this.config.get<string>('cognito.userPoolId')?.trim();
    const gotrueSecret = this.config.get<string>('gotrue.jwtSecret')?.trim();
    const supabaseUrl = this.config.get<string>('supabase.url')?.trim();

    let authProvider: ActuatorInfoResponse['auth-provider'] = 'dev';
    if (cognitoPoolId) {
      authProvider = 'cognito';
    } else if (gotrueSecret || supabaseUrl) {
      authProvider = 'gotrue';
    }

    const imageTag =
      this.config.get<string>('app.imageTag')?.trim() ||
      process.env.APP_VERSION?.trim() ||
      'local';

    return {
      'app-name':
        this.config.get<string>('app.name')?.trim() || 'cht-platform-backend',
      env:
        this.config.get<string>('app.environment')?.trim() ||
        this.config.get<string>('nodeEnv') ||
        'development',
      region:
        this.config.get<string>('aws.region')?.trim() ||
        process.env.AWS_REGION?.trim() ||
        'us-east-1',
      'image-tag': imageTag,
      'node-env': this.config.get<string>('nodeEnv') || 'development',
      'uptime-seconds': Math.floor(process.uptime()),
      timestamp: new Date().toISOString(),
      'auth-provider': authProvider,
      'frontend-url': this.config.get<string>('frontendUrl') || '',
      build: {
        image: this.config.get<string>('app.containerImage')?.trim() || null,
      },
    };
  }
}
