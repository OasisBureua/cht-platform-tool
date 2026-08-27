import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import type {
  CampaignDashboardRow,
  CampaignTranscriptStat,
  CampaignVideoStat,
  HubSpotSocialPost,
} from '../../../api/admin';
import { formatCount, formatDate } from './campaignDashboardFormat';

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
    <div className="rounded-card border border-border bg-muted/80 px-3 py-3">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={[
          'mt-1 break-all text-sm font-semibold text-foreground',
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
    <div className="rounded-card border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
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
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.label}
                  className={[
                    'px-4 py-3 font-semibold text-muted-foreground',
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
        <tr key={post.id} className="hover:bg-muted/80">
          <td className="px-4 py-3">
            <p className="font-medium text-foreground">{post.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
              {post.id}
            </p>
          </td>
          <td className="px-4 py-3 text-muted-foreground">
            {post.network ?? '—'}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {formatCount(post.linkedinClicks)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {formatCount(post.facebookClicks)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {formatCount(post.twitterClicks)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
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
        <tr key={video.id} className="hover:bg-muted/80">
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
              <p className="font-medium text-foreground">{video.title}</p>
            )}
          </td>
          <td className="px-4 py-3 capitalize text-muted-foreground">
            {video.platform ?? '—'}
          </td>
          <td className="px-4 py-3 text-muted-foreground">
            {formatDate(video.postedAt)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {formatDuration(video.durationSeconds)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
            {formatCount(video.views)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {formatCount(video.likes)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
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
        <tr className="hover:bg-muted/80">
          <td className="px-4 py-3">
            <p className="font-medium text-foreground">{survey.title}</p>
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
          <td className="px-4 py-3 text-muted-foreground">{survey.type}</td>
          <td className="px-4 py-3 text-muted-foreground">
            {survey.programTitle ?? '—'}
          </td>
          <td className="px-4 py-3 text-right tabular-nums font-semibold text-foreground">
            {formatCount(survey.totalResponses)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {formatCount(survey.uniqueRespondents)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {formatCount(survey.jotformSubmissionCount)}
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
            {survey.completionRate != null
              ? `${Math.round(survey.completionRate)}%`
              : '—'}
          </td>
          <td className="px-4 py-3 text-muted-foreground">
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
              className="hover:bg-muted/80"
            >
              <td className="px-4 py-3 font-medium text-foreground">
                {question.prompt}
              </td>
              <td className="px-4 py-3 capitalize text-muted-foreground">
                {question.kind}
              </td>
              <td className="px-4 py-3 text-muted-foreground">
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
        <tr key={item.id} className="hover:bg-muted/80">
          <td className="px-4 py-3 font-medium text-foreground">
            {item.title}
          </td>
          <td className="px-4 py-3 text-muted-foreground">
            {item.shootName ?? item.shootId ?? '—'}
          </td>
          <td className="px-4 py-3 text-muted-foreground">
            {item.doctors.length ? item.doctors.join(', ') : '—'}
          </td>
          <td className="px-4 py-3">
            <span
              className={[
                'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                item.available
                  ? 'bg-green-100 text-success dark:bg-green-950/40 dark:text-green-300'
                  : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
              ].join(' ')}
            >
              {item.available ? 'Available' : 'Missing'}
            </span>
          </td>
          <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
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
          <tr key={platform} className="hover:bg-muted/80">
            <td className="px-4 py-3 font-medium capitalize text-foreground">
              {platform}
            </td>
            <td className="px-4 py-3">
              <span
                className={[
                  'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                  ok
                    ? 'bg-green-100 text-success dark:bg-green-950/40 dark:text-green-300'
                    : 'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
                ].join(' ')}
              >
                {status}
              </span>
            </td>
            <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">
              {snapshot?.rowCount != null ? formatCount(snapshot.rowCount) : '—'}
            </td>
            <td className="px-4 py-3 text-muted-foreground">
              {snapshot?.syncedAt ? formatDate(snapshot.syncedAt) : '—'}
            </td>
          </tr>
        );
      })}
    </SectionTable>
  );
}
