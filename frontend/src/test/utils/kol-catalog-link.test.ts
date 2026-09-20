import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  kolCatalogBrowseHref,
  kolCatalogClipHref,
  kolCatalogDoctorSlugs,
} from '../../utils/kol-catalog-link';

describe('kolCatalogDoctorSlugs', () => {
  it('prefers explicit catalogDoctorSlug override', () => {
    expect(
      kolCatalogDoctorSlugs({
        id: 'traina',
        name: 'Dr. Anthony Traina',
        intel: { catalogDoctorSlug: 'dr-traina' },
      }),
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
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('builds public catalog doctor filter URL', () => {
    vi.stubGlobal('window', { location: { pathname: '/kols/bardia' } });
    expect(kolCatalogBrowseHref({ id: 'bardia' }, '/kols/bardia')).toBe(
      '/catalog?doctor=bardia',
    );
  });

  it('keeps in-app browse under /app/catalog (never homepage)', () => {
    expect(kolCatalogBrowseHref({ id: 'bardia' }, '/app/kols/bardia')).toBe(
      '/app/catalog?doctor=bardia',
    );
  });

  it('falls back to catalog base when slug is missing', () => {
    expect(kolCatalogBrowseHref({ id: '', name: '' }, '/app/kols')).toBe('/app/catalog');
  });
});

describe('kolCatalogClipHref', () => {
  it('uses /app/clip under the member shell', () => {
    expect(kolCatalogClipHref('abc', '/app/kols/x')).toBe('/app/clip/abc');
  });

  it('uses /catalog/clip on the public site', () => {
    expect(kolCatalogClipHref('abc', '/kols/x')).toBe('/catalog/clip/abc');
  });
});
