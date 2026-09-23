import { describe, it, expect } from 'vitest';
import { resolveKolDisplayBrief } from '../../utils/kol-directory-merge';

describe('resolveKolDisplayBrief', () => {
  it('prefers Content Hub bio over aiBrief when both are present', () => {
    const brief = resolveKolDisplayBrief({
      name: 'Dr. A',
      role: 'Oncologist',
      bio: 'Bio text',
      intel: { aiBrief: { whoTheyAre: 'AI summary', focus: 'TNBC' } },
    });
    // No `focus` when a real bio is present — the standalone Role field
    // already shows the full role text, so echoing roleLead(role) here
    // just duplicated it (verbatim, for roles with no natural short
    // first clause).
    expect(brief).toEqual({
      whoTheyAre: 'Bio text',
      isAiGenerated: false,
    });
  });

  it('uses Content Hub aiBrief when bio is empty', () => {
    const brief = resolveKolDisplayBrief({
      name: 'Dr. A',
      role: 'Oncologist',
      bio: '',
      intel: { aiBrief: { whoTheyAre: 'AI summary', focus: 'TNBC' } },
    });
    expect(brief).toEqual({
      whoTheyAre: 'AI summary',
      focus: 'TNBC',
      chmContext: undefined,
      isAiGenerated: true,
    });
  });

  it('shows only the bio (no focus echo) for KOLs without aiBrief', () => {
    const brief = resolveKolDisplayBrief({
      name: 'Dr. B',
      role: 'Medical Oncologist; Breast program lead.',
      bio: 'Expert in hormone-positive disease.',
    });
    expect(brief?.isAiGenerated).toBe(false);
    expect(brief?.whoTheyAre).toBe('Expert in hormone-positive disease.');
    expect(brief?.focus).toBeUndefined();
  });

  it('uses role when bio is empty', () => {
    const brief = resolveKolDisplayBrief({
      name: 'Dr. C',
      role: 'Chief of Oncology.',
      bio: '',
    });
    expect(brief?.whoTheyAre).toBe('Dr. C: Chief of Oncology');
  });
});
