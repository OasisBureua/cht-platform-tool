import { OutboundSyncService } from './outbound-sync.service';
import type { HubSpotService } from '../hubspot/hubspot.service';
import type { ContentHubSyncService } from './contenthub-sync.service';

describe('OutboundSyncService test-account guard', () => {
  const hubspot = {
    isConfigured: jest.fn().mockReturnValue(true),
    createOrUpdateContact: jest.fn().mockResolvedValue(undefined),
    recordProgramActivity: jest.fn().mockResolvedValue(undefined),
  };
  const contentHub = { upsertHCP: jest.fn().mockResolvedValue(true) };
  const service = new OutboundSyncService(
    hubspot as unknown as HubSpotService,
    contentHub as unknown as ContentHubSyncService,
  );
  const base = {
    firstName: 'Test',
    lastName: 'User',
    npiNumber: '1234567893',
  };

  beforeEach(() => jest.clearAllMocks());

  it('sends a test account nowhere, even with a valid NPI', async () => {
    const user = await service.syncUser({
      ...base,
      email: 'success+cpr49-03@simulator.amazonses.com',
    });
    const event = await service.syncProgramEvent({
      ...base,
      email: 'success+cpr49-03@simulator.amazonses.com',
      programId: 'p-1',
      programTitle: '[TEST] Dry Run',
      registrationStatus: 'PENDING',
      event: 'registration_pending',
    });

    expect(user).toEqual({ hubspot: false, contenthub: false });
    expect(event).toEqual({ hubspot: false, contenthub: false });
    expect(hubspot.createOrUpdateContact).not.toHaveBeenCalled();
    expect(hubspot.recordProgramActivity).not.toHaveBeenCalled();
    expect(contentHub.upsertHCP).not.toHaveBeenCalled();
  });

  it('still syncs a real user', async () => {
    const result = await service.syncUser({
      ...base,
      email: 'dr.real@example-clinic.org',
    });
    expect(result).toEqual({ hubspot: true, contenthub: true });
    expect(hubspot.createOrUpdateContact).toHaveBeenCalledTimes(1);
    expect(contentHub.upsertHCP).toHaveBeenCalledTimes(1);
  });
});
