import {
  assertNoIdentityFieldsInSurveyAnswers,
  stripIdentityFieldsFromSurveyAnswers,
} from './survey-answer-sanitizer';

describe('survey-answer-sanitizer', () => {
  it('rejects identity keys in answers', () => {
    expect(() =>
      assertNoIdentityFieldsInSurveyAnswers({ user_id: 'x', q1: 'a' }),
    ).toThrow('identity fields');
  });

  it('strips identity keys', () => {
    expect(
      stripIdentityFieldsFromSurveyAnswers({
        email: 'a@b.com',
        q6: 'choice',
      }),
    ).toEqual({ q6: 'choice' });
  });
});
