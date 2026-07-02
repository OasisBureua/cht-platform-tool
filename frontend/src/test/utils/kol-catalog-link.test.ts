import { describe, it, expect } from 'vitest';
import {
  kolCatalogBrowseHref,
  kolCatalogDoctorSlugs,
} from '../../utils/kol-catalog-link';

describe('kolCatalogDoctorSlugs', () => {
  it('prefers explicit catalogDoctorSlug override', () => {
    expect(
      kolCatalogDoctorSlugs({ id: 'traina', intel: { catalogDoctorSlug: 'dr-traina' } }),
    ).toEqual(['dr-traina', 'traina']);
  });

  it('adds dr- prefix fallback for bare ids', () => {
    expect(kolCatalogDoctorSlugs({ id: 'bardia' })).toEqual(['bardia', 'dr-bardia']);
  });
});

describe('kolCatalogBrowseHref', () => {
  it('builds catalog doctor filter URL', () => {
    expect(kolCatalogBrowseHref({ id: 'bardia' })).toBe('/catalog?doctor=bardia');
  });
});
