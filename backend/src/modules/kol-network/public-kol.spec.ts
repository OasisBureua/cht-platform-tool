import { toPublicKol, toPublicKolList } from './public-kol';
import type { PublicKol } from './kol-network.types';

describe('toPublicKol', () => {
  const kol: PublicKol = {
    id: 'a',
    slug: 'bardia',
    name: 'Dr. Aditya Bardia',
    title: 'Professor of Medicine',
    specialty: 'Hematology & Oncology',
    institution: 'UCLA Health',
    bio: 'Bio',
    photo_url: null,
    region: 'california',
    region_label: 'California',
    shoot_count: 2,
    first_appeared_at: null,
    is_new: false,
    intel: {
      npi: '1639210107',
      specialty: 'Oncologist',
      location: 'Los Angeles, IL',
      email: 'someone@example.com',
      affiliation: 'Somewhere Else',
      publications_approx: 17,
      open_payments: { total: 1000, records: 2, years: '2023' },
      ai_brief: { who_they_are: 'Brief' },
    },
  };

  it('keeps only the NPI number and AI brief from intel', () => {
    expect(toPublicKol(kol).intel).toEqual({
      npi: '1639210107',
      ai_brief: { who_they_are: 'Brief' },
    });
  });

  it('leaves curated KOL fields untouched', () => {
    const out = toPublicKol(kol);
    expect(out.specialty).toBe('Hematology & Oncology');
    expect(out.institution).toBe('UCLA Health');
  });

  it('passes through KOLs without intel', () => {
    const noIntel = { ...kol, intel: null };
    expect(toPublicKol(noIntel)).toBe(noIntel);
  });

  it('sanitizes every item in a list', () => {
    const list = toPublicKolList({
      items: [kol, kol],
      total: 2,
      regions: [],
      institutions: [],
    });
    expect(list.items.every((k) => k.intel && !('email' in k.intel))).toBe(
      true,
    );
  });
});
