import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  connectFeedbackSurvey,
  createCampaign,
} from '../../pages/admin/content-hub/lib/store';

const get = vi.fn();
const post = vi.fn();
const patch = vi.fn();
const del = vi.fn();

vi.mock('../../api/client', () => ({
  default: {
    get: (...args: unknown[]) => get(...args),
    post: (...args: unknown[]) => post(...args),
    patch: (...args: unknown[]) => patch(...args),
    delete: (...args: unknown[]) => del(...args),
  },
  getApiErrorMessage: (err: unknown, fallback: string) =>
    err instanceof Error ? err.message : fallback,
}));

describe('feedback survey reporting source', () => {
  beforeEach(() => {
    get.mockReset();
    post.mockReset();
    patch.mockReset();
    del.mockReset();
  });

  it('connects CHT feedback aggregates via Hub campaign patch + survey upload', async () => {
    const campaign = {
      id: 42,
      name: 'Program report',
      platforms: ['survey'],
    };

    post
      .mockResolvedValueOnce({ data: campaign }) // createCampaign
      .mockResolvedValueOnce({
        data: {
          id: 7,
          campaignId: 42,
          platform: 'survey',
          filename: 'Program One: Feedback',
          rowCount: 2,
          uploadedAt: '2026-07-27T00:00:00.000Z',
        },
      }); // uploadCsv inside connectFeedbackSurvey

    patch.mockResolvedValueOnce({
      data: {
        ...campaign,
        surveySourceId: 'survey-1',
        surveySourceProgramId: 'program-1',
        surveySourceLabel: 'Program One: Feedback',
      },
    });

    const created = await createCampaign({
      name: 'Program report',
      platforms: ['survey'],
    });
    expect(created.id).toBe(42);
    expect(post).toHaveBeenCalledWith('/admin/content-hub/campaigns', {
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

    const connected = await connectFeedbackSurvey(created.id, {
      surveyId: 'survey-1',
      programId: 'program-1',
      label: 'Program One: Feedback',
      totalResponses: 2,
      analytics,
    });

    expect(patch).toHaveBeenCalledWith('/admin/content-hub/campaigns/42', {
      surveySourceId: 'survey-1',
      surveySourceProgramId: 'program-1',
      surveySourceLabel: 'Program One: Feedback',
    });

    expect(post).toHaveBeenCalledWith(
      '/admin/content-hub/campaigns/42/uploads',
      expect.objectContaining({
        platform: 'survey',
        filename: 'Program One: Feedback',
        content: expect.stringContaining('response_index,survey_id,program_id,label'),
      }),
    );

    const uploadBody = post.mock.calls[1][1] as { content: string };
    expect(uploadBody.content.trim().split('\n')).toHaveLength(3); // header + 2 rows

    expect(connected).toMatchObject({
      platform: 'survey',
      filename: 'Program One: Feedback',
      rowCount: 2,
    });
  });
});
