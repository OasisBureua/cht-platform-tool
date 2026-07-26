import { describe, it, expect } from 'vitest';
import {
  kolCatalogBrowseHref,
  kolCatalogDoctorSlugs,
} from '../../utils/kol-catalog-link';

describe('kolCatalogDoctorSlugs', () => {
  it('prefers explicit catalogDoctorSlug override', () => {
    expect(
      kolCatalogDoctorSlugs({ id: 'traina', name: 'Dr. Anthony Traina', intel: { catalogDoctorSlug: 'dr-traina' } }),
    ).toEqual(['dr-traina', 'traina']);
  });

  it('adds dr- prefix fallback for bare ids', () => {
    expect(kolCatalogDoctorSlugs({ id: 'bardia', name: 'Dr. Aditya Bardia' })).toEqual([
      'bardia',
      'dr-bardia',
    ]);
  });

  it('matches catalog doctors by surname when id differs', () => {
    expect(
      kolCatalogDoctorSlugs(
        { id: 'aditya-bardia-md', name: 'Dr. Aditya Bardia' },
        [{ slug: 'dr-aditya-bardia' }, { slug: 'bardia' }],
      ),
    ).toContain('bardia');
  });
});

describe('kolCatalogBrowseHref', () => {
  it('builds catalog doctor filter URL', () => {
    expect(kolCatalogBrowseHref({ id: 'bardia' })).toBe('/catalog?doctor=bardia');
  });
});
