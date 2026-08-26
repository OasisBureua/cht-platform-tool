import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateKolVisibilityDto {
  @ApiPropertyOptional({ description: 'Show on public /kol-network pages' })
  @IsOptional()
  @IsBoolean()
  visibleOnPublic?: boolean;

  @ApiPropertyOptional({ description: 'Show in the member app CHM Docs directory' })
  @IsOptional()
  @IsBoolean()
  visibleOnApp?: boolean;
}
