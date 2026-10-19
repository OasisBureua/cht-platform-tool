import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReportInputsQueryDto } from './report-inputs-query.dto';

const parse = (query: Record<string, unknown>) => {
  const dto = plainToInstance(ReportInputsQueryDto, query);
  return { dto, errors: validateSync(dto) };
};

describe('ReportInputsQueryDto', () => {
  it('accepts a single source and a numeric range from the query string', () => {
    const { dto, errors } = parse({ dateRangeDays: '30', sources: 'sessions' });
    expect(errors).toHaveLength(0);
    expect(dto.dateRangeDays).toBe(30);
    expect(dto.sources).toEqual(['sessions']);
  });

  it('accepts repeated sources', () => {
    const { dto, errors } = parse({ sources: ['sessions', 'surveys'] });
    expect(errors).toHaveLength(0);
    expect(dto.sources).toEqual(['sessions', 'surveys']);
  });

  it('rejects a range Generate does not offer', () => {
    expect(parse({ dateRangeDays: '45' }).errors).not.toHaveLength(0);
  });
});
