import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type {
  CampaignDashboardRow,
  CampaignTranscriptStat,
  CampaignVideoStat,
  HubSpotSocialPost,
} from '../../../api/admin';

export function formatCount(value: number | null | undefined): string {
  if (value == null) return '—';
  return value.toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
}

function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds < 0) return '—';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  if (mins >= 60) {
    const hours = Math.floor(mins / 60);
    const rem = mins % 60;
    return `${hours}h ${rem}m`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function InfoTile({
  label,
  value,
  icon,
  mono,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3 dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-zinc-400">
        {icon}
        {label}
      </div>
      <p
        className={[
          'mt-1 break-all text-sm font-semibold text-gray-900 dark:text-zinc-100',
          mono ? 'font-mono text-xs' : '',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

function EmptyTableState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
      {message}
    </div>
  );
}

function SectionTable({
  columns,
  children,
}: {
  columns: Array<{ label: string; align?: 'left' | 'right' }>;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/50">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-zinc-700">
          <thead className="bg-gray-50 dark:bg-zinc-900/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.label}
                  className={[
                    'px-4 py-3 font-semibold text-gray-600 dark:text-zinc-300',
                    col.align === 'right' ? 'text-right' : 'text-left',
                  ].join(' ')}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
            {children}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function SocialPostsTable({ posts }: { posts: HubSpotSocialPost[] }) {
  if (!posts.length) {
    return (
      <EmptyTableState message="No HubSpot social posts are associated with this campaign yet. Attach SOCIAL_BROADCAST assets in HubSpot to populate this table." />
    );
  }

  return (
    <SectionTable
      columns={[
        { label: 'Post' },
        { label: 'Network' },
        { label: 'LinkedIn', align: 'right' },
        { label: 'Facebook', align: 'right' },
        { label: 'X', align: 'right' },
        { label: 'Total clicks', align: 'right' },
      ]}
    >
      {posts.map((post) => (
        <tr key={post.id} className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/40">
          <td className="px-4 py-3">
            <p className="font-medium text-gray-900 dark:text-zinc-100">{post.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-gray-400 dark:text-zinc-500">
              {post.id}
            </p>
          </td>
          <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
            {post.network ?? '—'}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(post.linkedinClicks)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(post.facebookClicks)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(post.twitterClicks)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-zinc-100">
            {formatCount(post.totalClicks)}
          </td>
        </tr>
      ))}
    </SectionTable>
  );
}

export function VideosTable({ videos }: { videos: CampaignVideoStat[] }) {
  if (!videos.length) {
    return (
      <EmptyTableState message="No videos are linked to this campaign yet. Stats will appear here once catalog clips are associated." />
    );
  }

  return (
    <SectionTable
      columns={[
        { label: 'Video' },
        { label: 'Platform' },
        { label: 'Posted' },
        { label: 'Duration', align: 'right' },
        { label: 'Views', align: 'right' },
        { label: 'Likes', align: 'right' },
        { label: 'Comments', align: 'right' },
      ]}
    >
      {videos.map((video) => (
        <tr key={video.id} className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/40">
          <td className="px-4 py-3">
            {video.url ? (
              <a
                href={video.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                {video.title}
              </a>
            ) : (
              <p className="font-medium text-gray-900 dark:text-zinc-100">{video.title}</p>
            )}
          </td>
          <td className="px-4 py-3 capitalize text-gray-700 dark:text-zinc-300">
            {video.platform ?? '—'}
          </td>
          <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
            {formatDate(video.postedAt)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatDuration(video.durationSeconds)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-zinc-100">
            {formatCount(video.views)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(video.likes)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(video.comments)}
          </td>
        </tr>
      ))}
    </SectionTable>
  );
}

export function SurveysTable({ campaign }: { campaign: CampaignDashboardRow }) {
  const survey = campaign.survey;
  if (!survey) {
    return (
      <EmptyTableState message="No Jotform/CHT survey is linked to this campaign. Connect a feedback survey in Content Hub, or match the campaign name to a program that has a survey." />
    );
  }

  return (
    <div className="space-y-4">
      <SectionTable
        columns={[
          { label: 'Survey' },
          { label: 'Type' },
          { label: 'Program' },
          { label: 'CHT responses', align: 'right' },
          { label: 'Unique', align: 'right' },
          { label: 'Jotform', align: 'right' },
          { label: 'Completion', align: 'right' },
          { label: 'Last response' },
        ]}
      >
        <tr className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/40">
          <td className="px-4 py-3">
            <p className="font-medium text-gray-900 dark:text-zinc-100">{survey.title}</p>
            <div className="mt-1 flex flex-wrap gap-3">
              <Link
                to={`/admin/surveys/${survey.surveyId}/responses`}
                className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
              >
                Full responses
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
              {survey.jotformFormUrl ? (
                <a
                  href={survey.jotformFormUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium text-brand-700 hover:underline dark:text-brand-300"
                >
                  Open Jotform
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null}
            </div>
          </td>
          <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">{survey.type}</td>
          <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
            {survey.programTitle ?? '—'}
          </td>
          <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-900 dark:text-zinc-100">
            {formatCount(survey.totalResponses)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(survey.uniqueRespondents)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(survey.jotformSubmissionCount)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {survey.completionRate != null
              ? `${Math.round(survey.completionRate)}%`
              : '—'}
          </td>
          <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
            {formatDate(survey.lastResponseAt)}
          </td>
        </tr>
      </SectionTable>

      {survey.questions.length > 0 ? (
        <SectionTable
          columns={[
            { label: 'Question' },
            { label: 'Type' },
            { label: 'Summary' },
          ]}
        >
          {survey.questions.map((question) => (
            <tr
              key={question.prompt}
              className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/40"
            >
              <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
                {question.prompt}
              </td>
              <td className="px-4 py-3 capitalize text-gray-700 dark:text-zinc-300">
                {question.kind}
              </td>
              <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
                {question.summary}
              </td>
            </tr>
          ))}
        </SectionTable>
      ) : null}
    </div>
  );
}

export function TranscriptsTable({
  transcripts,
}: {
  transcripts: CampaignTranscriptStat[];
}) {
  if (!transcripts.length) {
    return (
      <EmptyTableState message="No transcript stats for this campaign yet. They will appear here when linked videos have transcripts." />
    );
  }

  return (
    <SectionTable
      columns={[
        { label: 'Title' },
        { label: 'Shoot' },
        { label: 'Doctors' },
        { label: 'Status' },
        { label: 'Words', align: 'right' },
      ]}
    >
      {transcripts.map((item) => (
        <tr key={item.id} className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/40">
          <td className="px-4 py-3 font-medium text-gray-900 dark:text-zinc-100">
            {item.title}
          </td>
          <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
            {item.shootName ?? item.shootId ?? '—'}
          </td>
          <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
            {item.doctors.length ? item.doctors.join(', ') : '—'}
          </td>
          <td className="px-4 py-3">
            <span
              className={[
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                item.available
                  ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
              ].join(' ')}
            >
              {item.available ? 'Available' : 'Missing'}
            </span>
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
            {formatCount(item.wordCount)}
          </td>
        </tr>
      ))}
    </SectionTable>
  );
}

export function PlatformsTable({ campaign }: { campaign: CampaignDashboardRow }) {
  const platforms = campaign.contentHubPlatforms.length
    ? campaign.contentHubPlatforms
    : campaign.contentHubPlatformSnapshots.map((s) => s.platform);

  if (!platforms.length) {
    return (
      <EmptyTableState message="No Content Hub platforms are configured on this campaign." />
    );
  }

  return (
    <SectionTable
      columns={[
        { label: 'Platform' },
        { label: 'Status' },
        { label: 'Rows', align: 'right' },
        { label: 'Synced' },
      ]}
    >
      {platforms.map((platform) => {
        const snapshot = campaign.contentHubPlatformSnapshots.find(
          (s) => s.platform === platform,
        );
        const status = snapshot?.status ?? 'missing';
        const ok = status === 'available';
        return (
          <tr key={platform} className="hover:bg-gray-50/80 dark:hover:bg-zinc-900/40">
            <td className="px-4 py-3 font-medium capitalize text-gray-900 dark:text-zinc-100">
              {platform}
            </td>
            <td className="px-4 py-3">
              <span
                className={[
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  ok
                    ? 'bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
                ].join(' ')}
              >
                {status}
              </span>
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-zinc-300">
              {snapshot?.rowCount != null ? formatCount(snapshot.rowCount) : '—'}
            </td>
            <td className="px-4 py-3 text-gray-700 dark:text-zinc-300">
              {snapshot?.syncedAt ? formatDate(snapshot.syncedAt) : '—'}
            </td>
          </tr>
        );
      })}
    </SectionTable>
  );
}
