import { useMemo, useState, type ReactNode } from 'react';
import { format, parseISO } from 'date-fns';
import { Link2, Loader2, Search, Unlink, Video } from 'lucide-react';
import {
  Button,
  ZoomAlert,
  ZoomEmptyState,
  ZoomLoadingState,
  ZoomSectionCard,
  ZoomStatusBadge,
} from '../../../../components/admin/zoom-recordings/ZoomRecordingsUi';
import { getApiErrorMessage } from '../../../../api/client';
import type { CampaignLinkProgram } from '../../../../api/reports';
import { useCampaignLinkPrograms, useSetProgramCampaign } from '../lib/reportHooks';
import { useToast } from './Toaster';

function when(iso: string | null): string {
  if (!iso) return 'No date';
  try {
    return format(parseISO(iso), 'MMM d, yyyy');
  } catch {
    return 'No date';
  }
}

function ProgramLine({
  program,
  action,
  note,
}: {
  program: CampaignLinkProgram;
  action: ReactNode;
  note?: ReactNode;
}) {
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
      <div className="flex min-w-0 items-start gap-3">
        <div className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-[8px] bg-muted/80 text-muted-foreground">
          <Video className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">{program.title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {when(program.startDate)}
            {' · '}
            {program.zoomSessionType === 'MEETING' ? 'Office hours' : 'Live webinar'}
            {program.chmProgramId ? (
              <span className="ml-1 font-mono">· {program.chmProgramId}</span>
            ) : null}
          </p>
          {note}
        </div>
      </div>
      <div className="shrink-0">{action}</div>
    </li>
  );
}

export default function CampaignProgramsPanel({
  campaignId,
  campaignName,
}: {
  campaignId: string;
  campaignName?: string;
}) {
  const { toast } = useToast();
  const { data: programs, isLoading, isError, error } = useCampaignLinkPrograms();
  const setLink = useSetProgramCampaign();
  const [query, setQuery] = useState('');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const linked = useMemo(
    () => (programs ?? []).filter((p) => p.campaignId === campaignId),
    [programs, campaignId],
  );

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (programs ?? [])
      .filter((p) => p.campaignId !== campaignId)
      .filter(
        (p) =>
          !q ||
          p.title.toLowerCase().includes(q) ||
          (p.chmProgramId ?? '').toLowerCase().includes(q),
      )
      .slice(0, 25);
  }, [programs, campaignId, query]);

  const change = (program: CampaignLinkProgram, next: string | null) => {
    setPendingId(program.id);
    setLink.mutate(
      { programId: program.id, campaignId: next },
      {
        onSuccess: () =>
          toast({
            title: next ? 'Program linked' : 'Program unlinked',
            description: program.title,
          }),
        onError: (err) =>
          toast({
            title: 'Could not update the link',
            description: getApiErrorMessage(err, 'Try again.'),
            variant: 'destructive',
          }),
        onSettled: () => setPendingId(null),
      },
    );
  };

  if (isLoading) return <ZoomLoadingState label="Loading programs…" />;
  if (isError) {
    return <ZoomAlert tone="error">{getApiErrorMessage(error, 'Could not load programs.')}</ZoomAlert>;
  }

  return (
    <div className="space-y-6">
      <ZoomSectionCard
        title="Linked programs"
        description={`Sessions, attendance, transcripts and surveys from these programs feed ${campaignName ? `"${campaignName}"` : 'this campaign'}'s reports.`}
      >
        {linked.length === 0 ? (
          <ZoomEmptyState
            icon={Link2}
            title="No programs linked"
            body="Link the Platform programs that belong to this campaign so their Zoom and survey data is included in reports."
          />
        ) : (
          <ul className="-mx-5 -mb-5 divide-y divide-border md:-mx-6 md:-mb-6">
            {linked.map((p) => (
              <ProgramLine
                key={p.id}
                program={p}
                action={
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => change(p, null)}
                    disabled={pendingId === p.id}
                  >
                    {pendingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Unlink className="h-3.5 w-3.5" />}
                    Unlink
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </ZoomSectionCard>

      <ZoomSectionCard title="Link a program" description="Search Platform programs by title or CHM Content ID.">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            aria-label="Search programs"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search programs…"
            className="h-11 w-full rounded-[6px] bg-card pl-9 pr-3 text-base text-foreground shadow-card outline-none placeholder:text-muted-foreground/70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring sm:text-sm"
          />
        </div>
        {candidates.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No matching programs.</p>
        ) : (
          <ul className="-mx-5 -mb-5 mt-4 divide-y divide-border md:-mx-6 md:-mb-6">
            {candidates.map((p) => (
              <ProgramLine
                key={p.id}
                program={p}
                note={
                  p.campaignId ? (
                    <ZoomStatusBadge tone="warning" className="mt-1.5">
                      Linked to campaign {p.campaignId}. Linking moves it here.
                    </ZoomStatusBadge>
                  ) : null
                }
                action={
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => change(p, campaignId)}
                    disabled={pendingId === p.id}
                  >
                    {pendingId === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Link2 className="h-3.5 w-3.5" />}
                    Link
                  </Button>
                }
              />
            ))}
          </ul>
        )}
      </ZoomSectionCard>
    </div>
  );
}
