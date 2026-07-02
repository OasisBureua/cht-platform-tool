import { describe, it, expect } from 'vitest';
import {
  normalizeKolAiBrief,
  parseCombinedAiBrief,
} from '../../utils/kol-ai-brief-parser';

const PEGRAM_BLOB =
  "## Who they are Mark Pegram is a hematology and oncology specialist affiliated with the Stanford Women's Cancer Center in Palo Alto, California, positioning him within one of the leading academic cancer programs on the West Coast. ## What they focus on Given his affiliation with Stanford Women's Cancer Center, Pegram's clinical work likely centers on gynecologic and breast malignancies, though no recent publications, trials, or prescribing data are available to confirm specific research themes or drug interests at this time. ## CHM context Pegram has minimal CHM engagement to date, having attended one webinar with a corresponding RSVP but no questions asked, suggesting early-stage or passive familiarity with the platform.";

describe('parseCombinedAiBrief', () => {
  it('splits inline markdown section headers into structured fields', () => {
    const parsed = parseCombinedAiBrief(PEGRAM_BLOB);
    expect(parsed.whoTheyAre).toMatch(/^Mark Pegram is a hematology/);
    expect(parsed.whoTheyAre).not.toContain('##');
    expect(parsed.focus).toMatch(/^Given his affiliation/);
    expect(parsed.focus).not.toContain('What they focus on');
    expect(parsed.chmContext).toMatch(/^Pegram has minimal CHM engagement/);
    expect(parsed.chmContext).not.toContain('##');
  });

  it('returns plain text as whoTheyAre when no headers present', () => {
    expect(parseCombinedAiBrief('Simple one-paragraph summary.')).toEqual({
      whoTheyAre: 'Simple one-paragraph summary.',
    });
  });
});

describe('normalizeKolAiBrief', () => {
  it('parses combined whoTheyAre from Content Hub', () => {
    const normalized = normalizeKolAiBrief({ whoTheyAre: PEGRAM_BLOB });
    expect(normalized?.whoTheyAre).toContain('Mark Pegram');
    expect(normalized?.focus).toContain('gynecologic and breast');
    expect(normalized?.chmContext).toContain('minimal CHM engagement');
  });

  it('preserves already-structured briefs', () => {
    const normalized = normalizeKolAiBrief({
      whoTheyAre: 'Leads TNBC program at MSK.',
      focus: 'ADC sequencing',
      chmContext: 'Early platform engagement.',
    });
    expect(normalized).toEqual({
      whoTheyAre: 'Leads TNBC program at MSK.',
      focus: 'ADC sequencing',
      chmContext: 'Early platform engagement.',
    });
  });
});
