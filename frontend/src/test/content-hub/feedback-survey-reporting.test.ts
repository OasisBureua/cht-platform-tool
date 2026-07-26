import { beforeEach, describe, expect, it } from 'vitest';
import {
  connectFeedbackSurvey,
  createCampaign,
  getAnalyticsReport,
  getCsvData,
} from '../../pages/admin/content-hub/lib/store';

describe('feedback survey reporting source', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('connects CHT feedback aggregates without a CSV upload', () => {
    const campaign = createCampaign({
      name: 'Program report',
      platforms: ['survey'],
    });
    const analytics = {
      totals: { totalResponses: 2 },
      questions: [
        {
          id: 'q1',
          prompt: 'Will this change your practice?',
          type: 'single_choice',
          kind: 'choice',
          multiSelect: false,
          totalAnswered: 2,
          options: [
            { label: 'Yes', count: 2, percentage: 100 },
            { label: 'No', count: 0, percentage: 0 },
          ],
        },
      ],
    };

    const connected = connectFeedbackSurvey(campaign.id, {
      surveyId: 'survey-1',
      programId: 'program-1',
      label: 'Program One — Feedback',
      totalResponses: 2,
      analytics,
    });

    expect(connected).toMatchObject({
      platform: 'survey',
      filename: 'Program One — Feedback',
      rowCount: 2,
    });
    expect(getCsvData(campaign.id)).toHaveLength(1);

    const report = getAnalyticsReport(campaign.id);
    const surveyKpi = report.sections.kpiTiles.find(
      (tile) => tile.label === 'Survey Responses',
    );
    expect(surveyKpi).toMatchObject({
      value: '2',
      source: 'cht survey',
      note: 'Program One — Feedback',
    });
    expect(report.sections.surveyData).toMatchObject({
      source: 'cht-feedback-survey',
      surveyId: 'survey-1',
      rowCount: 2,
      analytics,
    });
    expect(report.sections.keyHighlights).toContain(
      'Will this change your practice?: Yes was the leading response (100%).',
    );
  });
});
