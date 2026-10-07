import { ContentHubCampaignService } from './content-hub-campaign.service';
import type { ContentHubClientService } from './content-hub-client.service';

describe('ContentHubCampaignService campaign KOLs', () => {
  const kol = {
    id: '3f2c1b7e-0d4a-4b8e-9a51-7c6d2e1f0a9b',
    slug: 'dr-a',
    name: 'Dr. A',
    title: 'MD',
    institution: 'UCSF',
  };
  const client = {
    getAdmin: jest.fn().mockResolvedValue({ items: [kol] }),
    putAdmin: jest.fn().mockResolvedValue({ items: [kol] }),
  };
  const service = new ContentHubCampaignService(
    client as unknown as ContentHubClientService,
  );

  beforeEach(() => jest.clearAllMocks());

  it('lists attached KOLs uncached', async () => {
    await expect(service.listCampaignKols(42)).resolves.toEqual({
      items: [kol],
    });
    expect(client.getAdmin).toHaveBeenCalledWith(
      '/campaigns/42/kols',
      undefined,
      { cache: false },
    );
  });

  it('replaces attached KOLs with a PUT', async () => {
    await service.setCampaignKols('42', [kol.id]);
    expect(client.putAdmin).toHaveBeenCalledWith('/campaigns/42/kols', {
      kolIds: [kol.id],
    });
  });
});
