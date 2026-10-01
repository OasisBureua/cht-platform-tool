import { describe, it, expect } from 'vitest';
import type { PublicKol } from '../../api/kol-network';
import { deriveKolUsState, kolInstitutionLabel, kolStateDisplayName } from '../../utils/kol-state';
import { mergePublicKolToEntry } from '../../utils/kol-directory-merge';
import { kolStaticEnrichment } from '../../data/dol-network';

function kol(partial: Partial<PublicKol>): PublicKol {
  return {
    id: '1',
    slug: 'test',
    name: 'Dr. Test',
    title: null,
    specialty: null,
    institution: null,
    bio: null,
    photo_url: null,
    region: null,
    region_label: null,
    shoot_count: 0,
    first_appeared_at: null,
    is_new: false,
    ...partial,
  };
}

describe('deriveKolUsState', () => {
  it('uses region_label when practice text has no state', () => {
    expect(
      deriveKolUsState(
        kol({ region_label: 'New York', region: 'ny-northeast' }),
      ),
    ).toBe('NY');
  });

  it('prefers practice location in role over region_label', () => {
    expect(
      deriveKolUsState(
        kol({ region_label: 'New York', region: 'ny-northeast' }),
        { role: 'Director - Yale School of Medicine, New Haven, CT.' },
      ),
    ).toBe('CT');
  });

  it('uses MSK affiliation for state when role omits ", ST"', () => {
    expect(
      deriveKolUsState(
        kol({
          region_label: 'New York',
          institution: 'University of Illinois',
        }),
        { role: 'Medical Oncologist; Associate Professor, Memorial Sloan Kettering.' },
      ),
    ).toBe('NY');
  });

  it('parses state from region slug prefix', () => {
    expect(deriveKolUsState(kol({ region: 'tx-houston', region_label: 'Texas' }))).toBe('TX');
    expect(deriveKolUsState(kol({ region: 'il-chicago' }))).toBe('IL');
  });

  it('parses city, ST from role text', () => {
    expect(
      deriveKolUsState(kol({ slug: 'brufsky' }), {
        role: 'Co-Director - UPMC, Pittsburgh, PA.',
      }),
    ).toBe('PA');
  });

  it('parses state from institution and title when region missing', () => {
    expect(
      deriveKolUsState(
        kol({
          institution: 'Dana-Farber Cancer Institute, Boston, MA',
        }),
      ),
    ).toBe('MA');
  });

  it('resolves Washington University to Missouri, not Washington state', () => {
    expect(
      deriveKolUsState(
        kol({ institution: 'Washington University School of Medicine / Siteman Cancer Center' }),
      ),
    ).toBe('MO');
  });

  it('resolves Emory/Winship to Georgia ahead of a prior MSK mention in the bio', () => {
    expect(
      deriveKolUsState(
        kol({
          institution: 'Winship Cancer Institute, Emory University',
          bio: 'He joined Winship after nearly 15 years at Memorial Sloan Kettering Cancer Center.',
        }),
      ),
    ).toBe('GA');
  });

  it('uses intel.location from static enrichment', () => {
    expect(
      deriveKolUsState(kol({ slug: 'traina' }), {
        intel: { location: 'New York, NY' },
      }),
    ).toBe('NY');
  });
});

describe('mergePublicKolToEntry stateCode', () => {
  it('matches between list (no intel) and profile (NPI intel) payloads', () => {
    const base = kol({ slug: 'bardia', institution: 'UCLA Health / Jonsson Comprehensive Cancer Center' });
    const withNpiIntel = { ...base, intel: { location: 'Los Angeles, IL' } };
    expect(mergePublicKolToEntry(base).stateCode).toBe('CA');
    expect(mergePublicKolToEntry(withNpiIntel).stateCode).toBe('CA');
  });

  it('keeps only the NPI number from intel and uses the curated specialty', () => {
    const entry = mergePublicKolToEntry({
      ...kol({ slug: 'bardia', specialty: 'Hematology & Oncology' }),
      intel: {
        npi: '1639210107',
        specialty: 'Oncologist',
        affiliation: 'Somewhere Else',
        publications_approx: 17,
        open_payments: { total: 1, records: 1, years: '2023' },
      },
    });
    expect(entry.intel).toEqual({ npi: '1639210107' });
    expect(entry.specialty).toBe('Hematology & Oncology');
  });

  it('takes the role from Content Hub only, never the static file', () => {
    expect(mergePublicKolToEntry(kol({ slug: 'iyengar', title: null })).role).toBe('');
  });
});

describe('kolStaticEnrichment', () => {
  it('has verified education for every entry and nothing else', () => {
    for (const k of kolStaticEnrichment) {
      expect(Object.keys(k).sort()).toEqual(['education', 'id', 'name']);
      expect(k.education.trim()).not.toBe('');
    }
  });
});

describe('kolStateDisplayName', () => {
  it('returns full state name', () => {
    expect(
      kolStateDisplayName(kol({ region_label: 'New York' }), { stateCode: 'NY' }),
    ).toBe('New York');
  });
});

describe('kolInstitutionLabel', () => {
  it('prefers MediaHub institution', () => {
    expect(
      kolInstitutionLabel(
        kol({ institution: 'University of Illinois' }),
        { role: 'MSK' },
      ),
    ).toBe('University of Illinois');
  });
});
