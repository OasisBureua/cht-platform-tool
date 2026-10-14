import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdateSurveyDto {
  @ApiPropertyOptional({ description: 'Survey display title' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ description: 'Survey description' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description:
      'Native schema: { version, sections: [{ id, title, questions: [{ id, type, prompt, required, options? }] }] }',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  questions?: Record<string, unknown>;

  @ApiPropertyOptional({
    description:
      'Survey type. Can only change while the survey has no responses.',
    enum: ['INTAKE', 'FEEDBACK', 'PRE_TEST', 'POST_TEST'],
  })
  @IsOptional()
  @IsEnum(['INTAKE', 'FEEDBACK', 'PRE_TEST', 'POST_TEST'])
  type?: 'INTAKE' | 'FEEDBACK' | 'PRE_TEST' | 'POST_TEST';

  @ApiPropertyOptional({ description: 'Whether completion is required' })
  @IsOptional()
  @IsBoolean()
  required?: boolean;

  /** Link to an existing Jotform form. When set, the survey will embed this form and receive webhook submissions. */
  @ApiPropertyOptional({ description: 'Legacy Jotform form ID' })
  @IsOptional()
  @IsString()
  jotformFormId?: string;
}
