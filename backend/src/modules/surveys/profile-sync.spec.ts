import {
  buildProfilePrefill,
  extractProfileMappings,
  extractProfileUpdatesFromAnswers,
  inferSyncTargetFromQuestion,
} from './profile-sync';
import { defaultWebinarIntakeQuestions } from './native-survey-templates';

const profile = {
  firstName: 'Ada',
  lastName: 'Lovelace',
  specialty: 'Oncology',
  npiNumber: '1234567890',
  institution: 'CHT Health',
  city: 'Boston',
  state: 'MA',
  zipCode: '02108',
};

describe('profile-sync', () => {
  describe('inferSyncTargetFromQuestion', () => {
    it('maps webinar intake ids', () => {
      expect(inferSyncTargetFromQuestion({ id: 'npi' })).toBe('npiNumber');
      expect(inferSyncTargetFromQuestion({ id: 'organization' })).toBe(
        'institution',
      );
      expect(inferSyncTargetFromQuestion({ id: 'city' })).toBe('city');
      expect(inferSyncTargetFromQuestion({ id: 'state' })).toBe('state');
      expect(inferSyncTargetFromQuestion({ id: 'postal_code' })).toBe(
        'zipCode',
      );
    });

    it('does not map street / phone / website', () => {
      expect(
        inferSyncTargetFromQuestion({
          id: 'address_street',
          prompt: 'Company address: street',
        }),
      ).toBeNull();
      expect(
        inferSyncTargetFromQuestion({ id: 'phone', prompt: 'Phone number' }),
      ).toBeNull();
      expect(
        inferSyncTargetFromQuestion({
          id: 'company_website',
          prompt: 'Company website',
        }),
      ).toBeNull();
    });
  });

  describe('default webinar intake', () => {
    it('prefills address and org fields from profile without relying on tags alone', () => {
      const questions = defaultWebinarIntakeQuestions();
      const mappings = extractProfileMappings(questions);
      const fields = mappings.map((m) => m.field).sort();
      expect(fields).toEqual(
        ['city', 'institution', 'npiNumber', 'state', 'zipCode'].sort(),
      );

      const prefill = buildProfilePrefill(questions, profile);
      expect(prefill).toEqual({
        npi: '1234567890',
        organization: 'CHT Health',
        city: 'Boston',
        state: 'MA',
        postal_code: '02108',
      });
    });

    it('still prefills when syncToProfile tags are stripped (existing surveys)', () => {
      const questions = {
        version: 1,
        sections: [
          {
            id: 'intake',
            title: 'Registration details',
            questions: [
              { id: 'npi', type: 'text', prompt: 'NPI number' },
              { id: 'organization', type: 'text', prompt: 'Organization' },
              { id: 'city', type: 'text', prompt: 'City' },
              { id: 'state', type: 'text', prompt: 'State / Province' },
              { id: 'postal_code', type: 'text', prompt: 'Postal / Zip code' },
              {
                id: 'address_street',
                type: 'text',
                prompt: 'Company address: street',
              },
            ],
          },
        ],
      };
      expect(buildProfilePrefill(questions, profile)).toEqual({
        npi: '1234567890',
        organization: 'CHT Health',
        city: 'Boston',
        state: 'MA',
        postal_code: '02108',
      });
    });

    it('writes city/state/zip back to profile on submit', () => {
      const questions = defaultWebinarIntakeQuestions();
      const updates = extractProfileUpdatesFromAnswers(questions, {
        organization: 'New Org',
        city: 'Cambridge',
        state: 'MA',
        postal_code: '02139',
        npi: '0987654321',
      });
      expect(updates).toEqual({
        institution: 'New Org',
        city: 'Cambridge',
        state: 'MA',
        zipCode: '02139',
        npiNumber: '0987654321',
      });
    });
  });
});
