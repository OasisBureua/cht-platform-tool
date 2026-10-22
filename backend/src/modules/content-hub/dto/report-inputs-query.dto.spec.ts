import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ReportInputsQueryDto } from './report-inputs-query.dto';

const parse = (query: Record<string, unknown>) => {
  const dto = plainToInstance(ReportInputsQueryDto, query);
  return { dto, errors: validateSync(dto) };
};

describe('ReportInputsQueryDto', () => {
  it('reads a numeric range from the query string', () => {
    const { dto, errors } = parse({ dateRangeDays: '30' });
    expect(errors).toHaveLength(0);
    expect(dto.dateRangeDays).toBe(30);
  });

  it('allows the range to be omitted', () => {
    const { dto, errors } = parse({});
    expect(errors).toHaveLength(0);
    expect(dto.dateRangeDays).toBeUndefined();
  });

  it('rejects a range Generate does not offer', () => {
    expect(parse({ dateRangeDays: '45' }).errors).not.toHaveLength(0);
    expect(parse({ dateRangeDays: 'abc' }).errors).not.toHaveLength(0);
  });
});
