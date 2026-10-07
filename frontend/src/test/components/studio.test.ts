import { describe, expect, it } from 'vitest';
import { creditFor, FACULTY, nameFromStem } from '../../components/admin/studio/faculty';

describe('studio faculty', () => {
  it('names faculty from their cut-out files', () => {
    expect(nameFromStem('joyce-o-shaughnessy')).toBe('Joyce O’Shaughnessy');
    expect(nameFromStem('vk-gadi')).toBe('VK Gadi');
    expect(FACULTY.find((f) => f.stem === 'komal-jhaveri')).toMatchObject({ name: 'Komal Jhaveri', url: '/images/kol-cutouts/komal-jhaveri.webp' });
  });

  it('writes the credit that matches the faces', () => {
    expect(creditFor([])).toBe('');
    expect(creditFor(['Komal Jhaveri'])).toBe('Dr. Komal Jhaveri');
    expect(creditFor(['Komal Jhaveri', 'Aditya Bardia'])).toBe('Drs. Komal Jhaveri & Aditya Bardia');
    expect(creditFor(['A B', 'C D', 'E F'])).toBe('Drs. A B, C D & E F');
  });
});
