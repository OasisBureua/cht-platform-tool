import {
  IsString,
  IsNumber,
  IsBoolean,
  IsArray,
  IsOptional,
} from 'class-validator';

export class VideoDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsString()
  platform: string;

  @IsString()
  videoId: string;

  @IsString()
  embedUrl: string;

  @IsNumber()
  duration: number;

  @IsNumber()
  order: number;
}

export class ProgramResponseDto {
  @IsString()
  id: string;

  @IsString()
  title: string;

  @IsString()
  description: string;

  @IsString()
  @IsOptional()
  thumbnailUrl?: string;

  @IsNumber()
  creditAmount: number;

  @IsString()
  @IsOptional()
  accreditationBody?: string;

  @IsString()
  status: string;

  @IsString()
  sponsorName: string;

  @IsString()
  @IsOptional()
  sponsorLogo?: string;

  @IsString()
  @IsOptional()
  sessionHeroImageUrl?: string;

  @IsString()
  @IsOptional()
  sessionDisclaimer?: string;

  @IsNumber()
  @IsOptional()
  honorariumAmount?: number;

  @IsArray()
  videos: VideoDto[];

  @IsString()
  @IsOptional()
  zoomSessionType?: string;

  @IsString()
  @IsOptional()
  zoomJoinUrl?: string;

  /** True when an approved learner may use zoomJoinUrl (within live join window). */
  @IsBoolean()
  @IsOptional()
  canJoinSession?: boolean;

  /** ISO time when Join session becomes available (15 min before start). */
  @IsString()
  @IsOptional()
  joinSessionOpensAt?: string;

  /** Human-readable reason when canJoinSession is false. */
  @IsString()
  @IsOptional()
  joinSessionReason?: string;

  @IsString()
  @IsOptional()
  zoomStartUrl?: string;

  @IsString()
  @IsOptional()
  startDate?: string;

  @IsNumber()
  @IsOptional()
  duration?: number;

  @IsString()
  @IsOptional()
  zoomSessionEndedAt?: string;

  @IsString()
  @IsOptional()
  jotformSurveyUrl?: string;

  @IsString()
  @IsOptional()
  jotformIntakeFormUrl?: string;

  @IsBoolean()
  @IsOptional()
  hasPostEventSurvey?: boolean;

  @IsBoolean()
  @IsOptional()
  hasIntakeSurvey?: boolean;

  @IsString()
  @IsOptional()
  feedbackSurveyId?: string;

  @IsString()
  @IsOptional()
  intakeSurveyId?: string;

  @IsBoolean()
  @IsOptional()
  feedbackUsesJotform?: boolean;

  @IsBoolean()
  @IsOptional()
  intakeUsesJotform?: boolean;

  @IsString()
  @IsOptional()
  jotformPreEventUrl?: string;

  @IsBoolean()
  @IsOptional()
  registrationRequiresApproval?: boolean;

  @IsString()
  @IsOptional()
  hostDisplayName?: string;

  @IsString()
  @IsOptional()
  hostBio?: string;

  @IsArray()
  @IsOptional()
  speakers?: string[];
}
