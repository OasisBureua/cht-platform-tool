import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateReportDto } from './create-report.dto';

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(CreateReportDto, body);
  const errors = await validate(dto);
  return { dto, fields: errors.map((e) => e.property) };
}

describe('CreateReportDto', () => {
  it('accepts the spec body and normalises emails', async () => {
    const { dto, fields } = await errorsFor({
      campaignId: 'AZ-25-01_LIV001',
      sources: ['zoom', 'surveys'],
      dateRangeDays: 60,
      templateType: 'executive_summary',
      notifyEmails: [' Admin@CHT.com '],
    });

    expect(fields).toEqual([]);
    expect(dto.notifyEmails).toEqual(['admin@cht.com']);
  });

  it('only allows 30, 60 or 90 days', async () => {
    const { fields } = await errorsFor({ campaignId: 'c1', dateRangeDays: 45 });
    expect(fields).toContain('dateRangeDays');
  });

  it('rejects invalid notify emails', async () => {
    const { fields } = await errorsFor({
      campaignId: 'c1',
      notifyEmails: ['not-an-email'],
    });
    expect(fields).toContain('notifyEmails');
  });
});
