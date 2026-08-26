import { KolVisibilityService } from './kol-visibility.service';
import type { PublicKolList } from './kol-network.types';

describe('KolVisibilityService', () => {
  const service = new KolVisibilityService({} as never);

  const sampleList: PublicKolList = {
    items: [
      {
        id: 'a',
        slug: 'dr-a',
        name: 'Dr A',
        title: null,
        specialty: null,
        institution: 'Hospital A',
        bio: null,
        photo_url: null,
        region: 'northeast',
        region_label: 'Northeast',
        shoot_count: 2,
        first_appeared_at: null,
        is_new: false,
      },
      {
        id: 'b',
        slug: 'dr-b',
        name: 'Dr B',
        title: null,
        specialty: null,
        institution: 'Hospital B',
        bio: null,
        photo_url: null,
        region: 'northeast',
        region_label: 'Northeast',
        shoot_count: 1,
        first_appeared_at: null,
        is_new: false,
      },
    ],
    total: 2,
    regions: [{ slug: 'northeast', label: 'Northeast', kol_count: 2 }],
    institutions: ['Hospital A', 'Hospital B'],
  };

  it('filters hidden KOLs per surface', () => {
    const visibility = new Map([
      ['dr-b', { visibleOnPublic: false, visibleOnApp: true }],
    ]);
    const publicList = service.filterKolList(sampleList, 'public', visibility);
    expect(publicList.items.map((k) => k.slug)).toEqual(['dr-a']);
    expect(publicList.total).toBe(1);
    expect(publicList.regions[0]?.kol_count).toBe(1);

    const appList = service.filterKolList(sampleList, 'app', visibility);
    expect(appList.items).toHaveLength(2);
  });
});
