import { describe, it, expect } from 'vitest';
import { resolveKolDisplayBrief } from '../../utils/kol-directory-merge';

describe('resolveKolDisplayBrief', () => {
  it('prefers Content Hub aiBrief when present', () => {
    const brief = resolveKolDisplayBrief({
      name: 'Dr. A',
      role: 'Oncologist',
      bio: 'Bio text',
      intel: { aiBrief: { whoTheyAre: 'AI summary', focus: 'TNBC' } },
    });
    expect(brief).toEqual({
      whoTheyAre: 'AI summary',
      focus: 'TNBC',
      chmContext: undefined,
      isAiGenerated: true,
    });
  });

  it('falls back to bio and role lead for KOLs without aiBrief', () => {
    const brief = resolveKolDisplayBrief({
      name: 'Dr. B',
      role: 'Medical Oncologist; Breast program lead.',
      bio: 'Expert in hormone-positive disease.',
    });
    expect(brief?.isAiGenerated).toBe(false);
    expect(brief?.whoTheyAre).toBe('Expert in hormone-positive disease.');
    expect(brief?.focus).toBe('Medical Oncologist');
  });

  it('uses role when bio is empty', () => {
    const brief = resolveKolDisplayBrief({
      name: 'Dr. C',
      role: 'Chief of Oncology.',
      bio: '',
    });
    expect(brief?.whoTheyAre).toBe('Dr. C — Chief of Oncology');
  });
});
