import { IsEnum } from 'class-validator';

export class UpdateProgramStatusDto {
  @IsEnum(['DRAFT', 'PUBLISHED', 'ARCHIVED'])
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}
