import { describe, it, expect } from 'vitest';
import type { PublicKol } from '../../api/kol-network';
import { deriveKolUsState, kolInstitutionLabel, kolStateDisplayName } from '../../utils/kol-state';

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

  it('uses intel.location from static enrichment', () => {
    expect(
      deriveKolUsState(kol({ slug: 'traina' }), {
        intel: { location: 'New York, NY' },
      }),
    ).toBe('NY');
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
