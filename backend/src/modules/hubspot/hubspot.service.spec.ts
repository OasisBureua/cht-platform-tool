import { ConfigService } from '@nestjs/config';
import { HubSpotService } from './hubspot.service';

describe('HubSpotService test-account guard', () => {
  const fetchMock = jest.fn();
  const realFetch = global.fetch;
  let service: HubSpotService;

  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ results: [{ id: '1' }] }),
      text: async () => '{}',
    });
    global.fetch = fetchMock as unknown as typeof fetch;
    service = new HubSpotService(
      new ConfigService({
        hubspot: { accessToken: 'pat-na1-00000000-test-token-for-spec' },
      }),
    );
  });

  afterAll(() => {
    global.fetch = realFetch;
  });

  it('does not upsert a test-account contact', async () => {
    await service.createOrUpdateContact({
      email: 'success+cpr49-01@simulator.amazonses.com',
      firstname: 'Test',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('does not record program activity for a test account', async () => {
    await service.recordProgramActivity({
      contact: { email: 'success+cpr49-02@simulator.amazonses.com' },
      programId: 'p-1',
      programTitle: '[TEST] Dry Run',
      registrationStatus: 'APPROVED',
      event: 'registration_approved',
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('still upserts a real contact', async () => {
    await service.createOrUpdateContact({
      email: 'dr.real@example-clinic.org',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain(
      '/crm/v3/objects/contacts/batch/upsert',
    );
  });
});
