import { PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  CreateReportDto,
  type DateRangeDays,
} from '../../reports/dto/create-report.dto';

/** Same range validation as Generate; query strings arrive as text. */
export class ReportInputsQueryDto extends PickType(CreateReportDto, [
  'dateRangeDays',
] as const) {
  @Type(() => Number)
  dateRangeDays?: DateRangeDays;
}
