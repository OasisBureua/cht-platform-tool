import { describe, expect, it } from 'vitest';
import {
  extractKolLastName,
  lastNameSlugCandidates,
  matchCatalogDoctorSlugsByLastName,
} from '../../utils/kol-catalog-doctor-match';

describe('extractKolLastName', () => {
  it('reads surname from Dr. prefix names', () => {
    expect(extractKolLastName('Dr. Aditya Bardia')).toBe('bardia');
  });

  it('strips credentials after comma', () => {
    expect(extractKolLastName('Atilla Soran, MD, MPH')).toBe('soran');
  });
});

describe('lastNameSlugCandidates', () => {
  it('returns bare and dr- prefixed slugs', () => {
    expect(lastNameSlugCandidates('Bardia')).toEqual(['bardia', 'dr-bardia']);
  });
});

describe('matchCatalogDoctorSlugsByLastName', () => {
  const doctors = [
    { slug: 'dr-aditya-bardia' },
    { slug: 'bardia' },
    { slug: 'dr-jane-smith' },
    { slug: 'dr-john-smith' },
  ];

  it('prefers a unique exact surname slug', () => {
    expect(matchCatalogDoctorSlugsByLastName('bardia', doctors)).toEqual(['bardia']);
  });

  it('disambiguates with kol slug when multiple share a surname', () => {
    expect(matchCatalogDoctorSlugsByLastName('smith', doctors, 'jane-smith')).toEqual([
      'dr-jane-smith',
    ]);
  });

  it('returns empty for ambiguous surnames without kol slug hint', () => {
    expect(matchCatalogDoctorSlugsByLastName('smith', doctors)).toEqual([]);
  });
});
