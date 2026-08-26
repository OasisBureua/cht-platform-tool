import {
  normalizePublicKolAiBrief,
  parseBriefSections,
} from './kol-ai-brief';

const PEGRAM_BLOB =
  "## Who they are Mark Pegram is a hematology and oncology specialist affiliated with the Stanford Women's Cancer Center in Palo Alto, California, positioning him within one of the leading academic cancer programs on the West Coast. ## What they focus on Given his affiliation with Stanford Women's Cancer Center, Pegram's clinical work likely centers on gynecologic and breast malignancies, though no recent publications, trials, or prescribing data are available to confirm specific research themes or drug interests at this time. ## CHM context Pegram has minimal CHM engagement to date, having attended one webinar with a corresponding RSVP but no questions asked, suggesting early-stage or passive familiarity with the platform.";

describe('kol-ai-brief', () => {
  describe('parseBriefSections', () => {
    it('splits inline markdown section headers into structured fields', () => {
      const parsed = parseBriefSections(PEGRAM_BLOB);
      expect(parsed.who_they_are).toMatch(/^Mark Pegram is a hematology/);
      expect(parsed.who_they_are).not.toContain('##');
      expect(parsed.what_they_focus_on).toMatch(/^Given his affiliation/);
      expect(parsed.what_they_focus_on).not.toContain('What they focus on');
      expect(parsed.chm_context).toMatch(/^Pegram has minimal CHM engagement/);
      expect(parsed.chm_context).not.toContain('##');
    });

    it('returns plain text as who_they_are when no headers present', () => {
      expect(parseBriefSections('Simple one-paragraph summary.')).toEqual({
        who_they_are: 'Simple one-paragraph summary.',
      });
    });
  });

  describe('normalizePublicKolAiBrief', () => {
    it('parses legacy combined who_they_are blobs', () => {
      const normalized = normalizePublicKolAiBrief({ who_they_are: PEGRAM_BLOB });
      expect(normalized?.who_they_are).toContain('Mark Pegram');
      expect(normalized?.what_they_focus_on).toContain('gynecologic and breast');
      expect(normalized?.chm_context).toContain('minimal CHM engagement');
    });

    it('preserves Content Hub structured briefs', () => {
      const normalized = normalizePublicKolAiBrief({
        who_they_are: 'Leads TNBC program at MSK.',
        what_they_focus_on: 'ADC sequencing',
        chm_context: 'Early platform engagement.',
      });
      expect(normalized).toEqual({
        who_they_are: 'Leads TNBC program at MSK.',
        what_they_focus_on: 'ADC sequencing',
        chm_context: 'Early platform engagement.',
      });
    });
  });
});
