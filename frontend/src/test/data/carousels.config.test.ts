import { describe, it, expect } from 'vitest';
import {
  ALL_CAROUSELS,
  ANON_CAROUSELS,
  HCP_CAROUSELS,
  getCarousel,
  type CarouselConfig,
  type SortBy,
} from '../../data/carousels.config';

const VALID_SORT_BY: ReadonlyArray<SortBy> = [
  'recent',
  'posted',
  'recorded_at',
  'views',
  'likes',
];

describe('carousels.config', () => {
  describe('ALL_CAROUSELS shape', () => {
    it('contains every row from ANON_CAROUSELS and HCP_CAROUSELS', () => {
      const total = ANON_CAROUSELS.length + HCP_CAROUSELS.length;
      expect(Object.keys(ALL_CAROUSELS)).toHaveLength(total);
    });

    it('has no duplicate ids across anon + hcp', () => {
      const allRows = [...ANON_CAROUSELS, ...HCP_CAROUSELS];
      const ids = allRows.map((c) => c.id);
      const unique = new Set(ids);
      expect(unique.size).toBe(ids.length);
    });
  });

  describe('id naming convention (interface prefix)', () => {
    it('every anon carousel id starts with "anon-"', () => {
      for (const c of ANON_CAROUSELS) {
        expect(c.id.startsWith('anon-')).toBe(true);
      }
    });

    it('every hcp carousel id starts with "hcp-"', () => {
      for (const c of HCP_CAROUSELS) {
        expect(c.id.startsWith('hcp-')).toBe(true);
      }
    });
  });

  describe('getCarousel()', () => {
    it('returns the matching row for every id in ALL_CAROUSELS', () => {
      for (const [id, expected] of Object.entries(ALL_CAROUSELS)) {
        expect(getCarousel(id)).toBe(expected);
      }
    });

    it('returns undefined for an unknown id', () => {
      expect(getCarousel('nonexistent')).toBeUndefined();
      expect(getCarousel('')).toBeUndefined();
      expect(getCarousel('anon-does-not-exist')).toBeUndefined();
    });
  });

  describe('HER2+ rows', () => {
    it('every row labeled HER2+ has tag containing "biomarker:HER2+"', () => {
      const her2Rows = [...ANON_CAROUSELS, ...HCP_CAROUSELS].filter(
        (c) => c.id.endsWith('-her2'),
      );
      expect(her2Rows.length).toBeGreaterThan(0);
      for (const row of her2Rows) {
        expect(row.tag).toBeDefined();
        expect(row.tag).toContain('biomarker:HER2+');
      }
    });
  });

  describe('hcp-home-recently-added variety protection', () => {
    it('has dedup_by="shoot" and per_shoot_cap=1', () => {
      const row = getCarousel('hcp-home-recently-added');
      expect(row).toBeDefined();
      expect(row?.dedup_by).toBe('shoot');
      expect(row?.per_shoot_cap).toBe(1);
    });
  });

  describe('limits', () => {
    it('every carousel has a limit > 0', () => {
      for (const c of Object.values(ALL_CAROUSELS)) {
        expect(c.limit).toBeGreaterThan(0);
      }
    });
  });

  describe('sort_by', () => {
    it('every carousel sort_by is one of the valid SortBy values', () => {
      for (const c of Object.values(ALL_CAROUSELS)) {
        expect(VALID_SORT_BY).toContain(c.sort_by);
      }
    });
  });

  describe('tag presence for biomarker rows', () => {
    const isBiomarkerLabeled = (c: CarouselConfig): boolean => {
      const haystack = `${c.id} ${c.label}`.toLowerCase();
      return (
        haystack.includes('her2') ||
        haystack.includes('hr+') ||
        haystack.includes('tnbc') ||
        haystack.includes('triple negative') ||
        haystack.includes('high risk') ||
        haystack.includes('high-risk') ||
        haystack.includes('cdk4') ||
        haystack.includes('endocrine') ||
        haystack.includes('conversations')
      );
    };

    it('every biomarker-labeled carousel has a non-empty tag', () => {
      const biomarkerRows = Object.values(ALL_CAROUSELS).filter(
        isBiomarkerLabeled,
      );
      expect(biomarkerRows.length).toBeGreaterThan(0);
      for (const row of biomarkerRows) {
        expect(row.tag, `${row.id} should have a tag set`).toBeDefined();
        expect(row.tag?.length ?? 0).toBeGreaterThan(0);
        expect(row.tag).toContain('biomarker:');
      }
    });

    it('non-biomarker carousels that omit tag are explicitly featured/recency surfaces', () => {
      const tagless = Object.values(ALL_CAROUSELS).filter((c) => !c.tag);
      const allowedTaglessIds = new Set([
        'anon-home-featured',
        'hcp-home-recently-added',
      ]);
      for (const row of tagless) {
        expect(
          allowedTaglessIds.has(row.id),
          `${row.id} has no tag but isn't an allowed featured/recency surface`,
        ).toBe(true);
      }
    });
  });
});
