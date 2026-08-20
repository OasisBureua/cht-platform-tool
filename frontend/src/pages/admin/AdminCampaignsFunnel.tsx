import { useState } from 'react';
import {
  Building2,
  ChevronRight,
  Filter,
  MousePointerClick,
  Search,
  Users,
} from 'lucide-react';

const STAGES = [
  {
    key: 'aware',
    label: 'Aware',
    source: 'HubSpot sessions, emails, or social',
  },
  {
    key: 'engaged',
    label: 'Engaged',
    source: 'HubSpot clicks or landing page views',
  },
  {
    key: 'captured',
    label: 'Captured',
    source: 'HubSpot form submit or new contact',
  },
  {
    key: 'registered',
    label: 'Registered',
    source: 'CHT webinar / office hours approved',
  },
  {
    key: 'attended',
    label: 'Attended',
    source: 'CHT Zoom attendance verified',
  },
  {
    key: 'converted',
    label: 'Converted',
    source: 'CHT post-event survey completed',
  },
] as const;

const selectClassName =
  'mt-1.5 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700 shadow-sm disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200 dark:disabled:bg-zinc-800/80 dark:disabled:text-zinc-500';

/**
 * Funnel UI/UX preview only — no APIs or real counts.
 */
export default function AdminCampaignsFunnel() {
  const [selectedStageKey, setSelectedStageKey] = useState<string | null>(null);
  const selectedStage = STAGES.find((s) => s.key === selectedStageKey) ?? null;

  return (
    <div className="space-y-8 md:space-y-10">
      <div className="rounded-xl border border-brand-200/80 bg-gradient-to-br from-brand-50/90 to-white px-4 py-3 text-sm dark:border-brand-900/50 dark:from-brand-950/40 dark:to-zinc-900">
        <p className="font-semibold text-gray-900 dark:text-zinc-100">
          UI preview for client review
        </p>
        <p className="mt-1 text-gray-600 dark:text-zinc-400">
          Navigation and layout only. Counts, filters, and people lists will connect in a later
          build — placeholders below are intentional.
        </p>
      </div>

      {/* 1. Overview */}
      <section className="space-y-2">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              Funnel overview
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-zinc-400">
              See how people move from HubSpot awareness into CHT registration, attendance, and
              survey completion — and where they drop off.
            </p>
          </div>
        </div>
        <p className="rounded-lg border border-gray-200 bg-gray-50/80 px-3 py-2 text-xs text-gray-600 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400">
          <span className="font-semibold text-gray-800 dark:text-zinc-200">Converted</span> in
          this view means attended and completed the post-event survey — not a HubSpot deal.
        </p>
      </section>

      {/* Filters */}
      <section
        className="rounded-2xl border border-gray-200 bg-white p-4 shadow-[0_12px_44px_-28px_rgba(0,0,0,0.12)] dark:border-zinc-700 dark:bg-zinc-800/80 sm:p-5"
        aria-label="Funnel filters"
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 pb-3 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Filter
              className="h-4 w-4 text-gray-500 dark:text-zinc-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">
              Report filters
            </h3>
          </div>
          <p className="text-xs text-gray-500 dark:text-zinc-400">
            Controls enabled when data is wired
          </p>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Date range
            <select disabled className={selectClassName} defaultValue="30">
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
              <option value="custom">Custom range…</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Campaign
            <select disabled className={selectClassName} defaultValue="">
              <option value="">All campaigns</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Client
            <select disabled className={selectClassName} defaultValue="">
              <option value="">All clients</option>
            </select>
          </label>
          <label className="block text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
            Program
            <select disabled className={selectClassName} defaultValue="">
              <option value="">All programs</option>
            </select>
          </label>
        </div>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-lg bg-gray-900 px-3 py-2 text-sm font-semibold text-white opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
          >
            Apply filters
          </button>
          <button
            type="button"
            disabled
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 opacity-50 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-200"
          >
            Reset
          </button>
        </div>
      </section>

      {/* 2. Stages */}
      <section className="space-y-3" aria-label="Funnel stages">
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
            Funnel stages
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
            Progression left to right. Drop-off % is versus the previous stage. Select a stage to
            open its people list (coming next).
          </p>
        </div>

        <div className="overflow-x-auto pb-1">
          <ol className="flex min-w-[64rem] items-stretch gap-0 xl:min-w-0 xl:w-full">
            {STAGES.map((stage, index) => (
              <li key={stage.key} className="flex min-w-0 flex-1 items-stretch">
                <button
                  type="button"
                  onClick={() => setSelectedStageKey(stage.key)}
                  aria-pressed={selectedStageKey === stage.key}
                  className={[
                    'group flex w-full min-w-[9.5rem] flex-col rounded-2xl border bg-white p-4 text-left shadow-[0_12px_44px_-28px_rgba(0,0,0,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 dark:bg-zinc-800/80',
                    selectedStageKey === stage.key
                      ? 'border-brand-400 ring-2 ring-brand-500/30 dark:border-brand-600'
                      : 'border-gray-200 hover:border-brand-300 hover:ring-2 hover:ring-brand-500/30 dark:border-zinc-700 dark:hover:border-brand-700',
                  ].join(' ')}
                  aria-label={`${stage.label}: view people in this stage (coming soon)`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
                      Stage {index + 1}
                    </span>
                    <MousePointerClick
                      className="h-3.5 w-3.5 shrink-0 text-gray-300 transition group-hover:text-brand-600 dark:text-zinc-600 dark:group-hover:text-brand-400"
                      aria-hidden
                    />
                  </div>
                  <p className="mt-1 text-sm font-semibold text-gray-900 dark:text-zinc-100">
                    {stage.label}
                  </p>
                  <p className="mt-3 text-3xl font-bold tabular-nums text-gray-300 dark:text-zinc-600">
                    —
                  </p>
                  <p className="mt-1 text-xs text-gray-500 dark:text-zinc-400">
                    {index === 0 ? 'Baseline stage' : 'Drop-off from prior —'}
                  </p>
                  <p className="mt-3 flex-1 text-[11px] leading-snug text-gray-500 dark:text-zinc-400">
                    {stage.source}
                  </p>
                  <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-brand-700 group-hover:underline dark:text-brand-400">
                    View people
                    <ChevronRight className="h-3.5 w-3.5" aria-hidden />
                  </span>
                </button>

                {index < STAGES.length - 1 ? (
                  <div
                    className="flex w-10 shrink-0 flex-col items-center justify-center px-0.5 sm:w-12"
                    aria-hidden
                  >
                    <span className="rounded-full border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-gray-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-500">
                      —%
                    </span>
                    <ChevronRight className="mt-1 h-4 w-4 text-gray-300 dark:text-zinc-600" />
                    <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wide text-gray-400 dark:text-zinc-500">
                      Drop
                    </span>
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* 3. Client rollup */}
      <section className="space-y-3" aria-label="Client rollup">
        <div className="flex items-start gap-2">
          <Building2
            className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-zinc-400"
            strokeWidth={1.75}
            aria-hidden
          />
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">
              Client rollup
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
              Group funnel activity by Content Hub sponsor when campaigns are linked. Unlinked
              campaigns still appear in the funnel above with an explicit note.
            </p>
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-zinc-700 dark:bg-zinc-800/80">
          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-zinc-700">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-zinc-400">
              Client / sponsor → funnel → HCPs
            </p>
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:bg-zinc-700 dark:text-zinc-300">
              Coming soon
            </span>
          </div>
          <table className="min-w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:bg-zinc-900/50 dark:text-zinc-400">
              <tr>
                <th className="px-4 py-2.5 font-semibold">Client / sponsor</th>
                <th className="px-4 py-2.5 font-semibold">Campaigns</th>
                <th className="px-4 py-2.5 font-semibold">In funnel</th>
                <th className="px-4 py-2.5 font-semibold">Converted</th>
                <th className="px-4 py-2.5 font-semibold">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-700">
              {[0, 1, 2].map((row) => (
                <tr key={row} className="text-gray-400 dark:text-zinc-500">
                  <td className="px-4 py-3">
                    <div className="h-3.5 w-36 max-w-full rounded bg-gray-100 dark:bg-zinc-700" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 w-8 rounded bg-gray-100 dark:bg-zinc-700" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 w-10 rounded bg-gray-100 dark:bg-zinc-700" />
                  </td>
                  <td className="px-4 py-3">
                    <div className="h-3.5 w-10 rounded bg-gray-100 dark:bg-zinc-700" />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ChevronRight className="ml-auto h-4 w-4 opacity-40" aria-hidden />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-gray-100 px-4 py-3 text-xs text-gray-500 dark:border-zinc-700 dark:text-zinc-400">
            Rows will list sponsors with linked Content Hub campaigns. Click through will show
            that client&apos;s funnel slice and HCPs.
          </p>
        </div>
      </section>

      {/* 4. People + HCP drill-down */}
      <section className="grid gap-4 lg:grid-cols-2" aria-label="People and HCP drill-down">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800/80">
          <div className="flex items-start gap-2">
            <Users
              className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-zinc-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                Stage → people
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                After you select a stage above, this panel will list people in that stage (name,
                email, NPI when available).
              </p>
            </div>
          </div>
          <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-10 text-center dark:border-zinc-600 dark:bg-zinc-900/40">
            <MousePointerClick
              className="h-8 w-8 text-gray-300 dark:text-zinc-600"
              aria-hidden
            />
            {selectedStage ? (
              <>
                <p className="mt-3 text-sm font-medium text-gray-800 dark:text-zinc-200">
                  {selectedStage.label}
                </p>
                <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-zinc-400">
                  People in this stage will list here (name, email, NPI). Data not wired yet.
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-sm font-medium text-gray-700 dark:text-zinc-300">
                  Select a funnel stage
                </p>
                <p className="mt-1 max-w-xs text-xs text-gray-500 dark:text-zinc-400">
                  Click a stage card above. List data is not loaded yet.
                </p>
              </>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-zinc-700 dark:bg-zinc-800/80">
          <div className="flex items-start gap-2">
            <Search
              className="mt-0.5 h-5 w-5 shrink-0 text-gray-500 dark:text-zinc-400"
              strokeWidth={1.75}
              aria-hidden
            />
            <div>
              <h2 className="text-base font-semibold text-gray-900 dark:text-zinc-100">
                HCP drill-down
              </h2>
              <p className="mt-1 text-sm text-gray-600 dark:text-zinc-400">
                Match HubSpot contact to CHT user (email, then NPI). Show last campaign and last
                CHT activity (register / attend / survey).
              </p>
            </div>
          </div>
          <div className="mt-4 space-y-3 rounded-xl border border-gray-100 bg-gray-50/80 p-4 dark:border-zinc-700 dark:bg-zinc-900/40">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 rounded-full bg-gray-200 dark:bg-zinc-700" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-3 w-40 max-w-full rounded bg-gray-200 dark:bg-zinc-700" />
                <div className="h-2.5 w-56 max-w-full rounded bg-gray-100 dark:bg-zinc-700/80" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 pt-1">
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Last campaign
                </p>
                <p className="mt-1 text-sm text-gray-300 dark:text-zinc-600">—</p>
              </div>
              <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 dark:border-zinc-600 dark:bg-zinc-800">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                  Last CHT activity
                </p>
                <p className="mt-1 text-sm text-gray-300 dark:text-zinc-600">—</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400">
              Opens from a person in the stage list. Matching logic comes with the backend work.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
