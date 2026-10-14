import { beforeEach, describe, expect, it, vi } from 'vitest';
import { campaignKolsApi } from '../../api/reports';

const get = vi.fn();
const put = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
  },
}));

const kol = {
  id: '3f2c1b7e-0d4a-4b8e-9a51-7c6d2e1f0a9b',
  slug: 'dr-a',
  name: 'Dr. A',
  title: 'MD',
  institution: 'UCSF',
};

describe('campaign KOLs (CPR-45)', () => {
  beforeEach(() => {
    get.mockReset();
    put.mockReset();
  });

  it('lists KOLs attached to a campaign', async () => {
    get.mockResolvedValueOnce({ data: { items: [kol] } });
    await expect(campaignKolsApi.list('42')).resolves.toEqual([kol]);
    expect(get).toHaveBeenCalledWith('/admin/content-hub/campaigns/42/kols');
  });

  it('replaces the attached set', async () => {
    put.mockResolvedValueOnce({ data: { items: [kol] } });
    await expect(campaignKolsApi.set('42', [kol.id])).resolves.toEqual([kol]);
    expect(put).toHaveBeenCalledWith('/admin/content-hub/campaigns/42/kols', {
      kolIds: [kol.id],
    });
  });
});
