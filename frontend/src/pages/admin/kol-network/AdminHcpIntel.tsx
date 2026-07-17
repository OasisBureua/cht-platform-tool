import { useRef, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  ArrowLeft,
  Beaker,
  BookOpen,
  CalendarCheck,
  DollarSign,
  ExternalLink,
  Loader2,
  Newspaper,
  Pill,
  RefreshCw,
  Sparkles,
  TrendingUp,
} from 'lucide-react';

import {
  kolNetworkApi,
  type PublicKol,
  type PublicKolPublication,
} from '../../../api/kol-network';
import {
  intelApi,
  demoKolProfile,
  demoKolPublications,
  type AIBrief,
  type DrugShift,
  type EngagementSignals,
  type HCPSignal,
  type NewsArticle,
  type NIHGrantsResponse,
  type OpenPaymentsResponse,
  type RxVolumesByDrug,
  type ShiftsResponse,
  type SignalType,
} from './lib/intel';
import { cn } from './components/cn';
import { Card, CardContent, CardHeader, CardTitle } from './components/Card';
import { Badge, DemoBadge } from './components/Badge';
import { Button, buttonVariants } from './components/Button';
import { InitialsAvatar } from './components/InitialsAvatar';
import { RxTrendChart } from './components/RxTrendChart';

// ─── helpers (ported from MediaHub hcps/[npi]/page.tsx) ─────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return 'Date TBD';
  const d = new Date(iso);
  if (d.getFullYear() < 2000) return 'Date TBD';
  const now = new Date();
  if (d.getTime() > now.getTime()) return now.toLocaleDateString();
  return d.toLocaleDateString();
}

function splitName(name: string): { first: string; last: string } {
  const clean = name.replace(/^dr\.?\s+/i, '').split(',')[0].trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: '', last: '' };
  return { first: parts[0], last: parts[parts.length - 1] };
}

/** "Memorial Sloan Kettering Cancer Center, Cornell" → "Memorial Sloan Kettering Cancer Center" */
function primaryHospital(institution: string | null | undefined): string {
  if (!institution) return '';
  return institution.split(/[,;|]/)[0].trim();
}

/** Targeted external-search links built live from KOL identity (not demo). */
function externalLinks(kol: PublicKol): { label: string; href: string }[] {
  const { first, last } = splitName(kol.name);
  if (!last) return [];
  const hosp = primaryHospital(kol.institution);
  const initials = first
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const pubmedTerm = initials ? `${last} ${initials}[Author]` : `${last}[Author]`;
  const fullName = [first, last].filter(Boolean).join(' ');
  const ctParts = [`"${fullName}"`];
  if (hosp) ctParts.push(`"${hosp}"`);
  const newsQuery = `("${fullName}" OR "Dr. ${last}")${hosp ? ` "${hosp}"` : ''} (oncology OR cancer OR hematology)`;
  return [
    { label: 'PubMed', href: `https://pubmed.ncbi.nlm.nih.gov/?term=${encodeURIComponent(pubmedTerm)}` },
    { label: 'CT.gov', href: `https://clinicaltrials.gov/search?term=${encodeURIComponent(ctParts.join(' AND '))}` },
    { label: 'Google News', href: `https://news.google.com/search?q=${encodeURIComponent(newsQuery)}` },
  ];
}

function signalIcon(t: SignalType) {
  switch (t) {
    case 'publication':
      return BookOpen;
    case 'trial':
      return Beaker;
    case 'news_article':
      return Newspaper;
    default:
      return BookOpen;
  }
}

const POSITIVE = 'text-primary-700 dark:text-primary-300';
const NEGATIVE = 'text-red-600 dark:text-red-400';

// ─── page ────────────────────────────────────────────────────────────────────

/**
 * Internal HCP intelligence detail — "Mix 1 · A + B" layout: identity band +
 * KPI tiles up top, the AI Intelligence Briefing as the editorial centerpiece
 * with the Rx attribution chart and signal feed beside it, publications and
 * trials/grants below, and the remaining detail (engagement, prescribing,
 * Open Payments, news) as stacked cards below the fold.
 *
 * Live data: KOL profile + publications (kolNetworkApi, proxied MediaHub
 * public directory). Everything else flows through the demo seam in
 * ./lib/intel.ts and is flagged with a DemoBadge.
 */
export default function AdminHcpIntel() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const profileQuery = useQuery({
    queryKey: ['admin', 'kol-network', 'detail', id],
    // 'always' + no retry: fire even when react-query's onlineManager reports
    // offline, and reject on the FIRST failure — retries park the query in
    // 'paused' when the tab is unfocused/offline, so the error state (and the
    // demo fallback) would never engage.
    networkMode: 'always',
    retry: false,
    queryFn: async (): Promise<PublicKol | null> => {
      const k = await kolNetworkApi.get(id);
      // Guard against a non-API service answering on the port with a 200
      // whose body isn't a KOL payload — treat as an error so the demo
      // fallback triggers instead of rendering garbage.
      if (k !== null && (typeof k !== 'object' || typeof k.name !== 'string')) {
        throw new Error('Malformed /kol-network profile response (backend unreachable?)');
      }
      return k;
    },
  });

  // Fallback ONLY on error (backend unreachable / malformed response).
  // A valid 404 (null) still renders the "KOL not found" state below.
  const usingDemoProfile = profileQuery.isError;
  const kol = profileQuery.data ?? (usingDemoProfile ? demoKolProfile(id) : null);
  const isLoading = profileQuery.isLoading;
  const name = kol?.name ?? '';

  // Live — MediaHub public publications endpoint, proxied via CHT backend.
  // Skipped entirely when the profile already fell back to demo.
  const pubsQuery = useQuery({
    queryKey: ['admin', 'kol-network', 'detail', id, 'publications'],
    queryFn: async () => {
      const r = await kolNetworkApi.publications(id, { limit: 100 });
      if (!r || !Array.isArray(r.items)) {
        throw new Error('Malformed publications response (backend unreachable?)');
      }
      return r;
    },
    enabled: !!kol && !usingDemoProfile,
    networkMode: 'always',
    retry: false,
  });
  const pubsDemo = usingDemoProfile || pubsQuery.isError;
  const pubs = pubsDemo ? demoKolPublications(id) : pubsQuery.data;

  // Demo seam — see lib/intel.ts.
  const briefQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'brief'],
    queryFn: () => intelApi.getAIBrief(id, name),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const engagementQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'engagement'],
    queryFn: () => intelApi.getEngagement(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const timelineQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'timeline'],
    queryFn: () => intelApi.getEngagementTimeline(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const trialsQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'trials'],
    queryFn: () => intelApi.getTrialSignals(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const rxQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'rx'],
    queryFn: () => intelApi.getRxHistory(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const shiftsQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'shifts'],
    queryFn: () => intelApi.getShifts(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const rxTrendQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'rx-trend'],
    queryFn: () => intelApi.getRxTrend(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const paymentsQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'payments'],
    queryFn: () => intelApi.getOpenPayments(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const nihQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'nih'],
    queryFn: () => intelApi.getNihGrants(id),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });
  const newsQuery = useQuery({
    queryKey: ['admin', 'kol-intel', id, 'news'],
    queryFn: () => intelApi.getNews(id, name),
    enabled: !!kol,
    networkMode: 'always',
    retry: false,
  });

  const [briefRegenerating, setBriefRegenerating] = useState(false);
  async function regenerateBrief() {
    setBriefRegenerating(true);
    try {
      await intelApi.regenerateAIBrief(id, name);
      await briefQuery.refetch();
    } finally {
      setBriefRegenerating(false);
    }
  }

  // "Log outreach" toast stub — outreach logging isn't wired to a backend yet.
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<number | null>(null);
  function showToast(msg: string) {
    setToast(msg);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 3500);
  }

  if (isLoading) {
    return (
      <div className="flex min-h-[30vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Loading" />
      </div>
    );
  }
  if (!kol) {
    // Only reachable on a VALID 404 from the API — backend/network failures
    // fall back to the demo profile above so the page stays reviewable.
    return (
      <Card className="border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
        <CardContent className="flex items-center gap-3 p-4 pt-4 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-5 w-5 shrink-0" />
          KOL not found.
        </CardContent>
      </Card>
    );
  }

  const rx = rxQuery.data ?? [];
  const totalRxAllYears = rx.reduce((a, r) => a + r.total_claims_all_years, 0);
  const links = externalLinks(kol);
  const shifts = shiftsQuery.data ?? null;
  const payments = paymentsQuery.data ?? null;
  const timeline = timelineQuery.data ?? [];
  const news = newsQuery.data ?? [];

  // Headline attribution: strongest post-CHM lift from the shifts seam.
  const topLift = shifts?.shifts.find((s) => s.has_lift) ?? null;
  const liftLabel =
    topLift && topLift.pct_lift !== null
      ? `${topLift.pct_lift > 0 ? '+' : ''}${topLift.pct_lift.toFixed(0)}%`
      : '—';

  const paymentsTotal = payments?.summary.total_usd ?? null;
  const paymentsLabel =
    paymentsTotal === null
      ? '—'
      : paymentsTotal >= 1000
        ? `$${Math.round(paymentsTotal / 1000)}K`
        : `$${paymentsTotal.toLocaleString()}`;
  const paymentsNote = payments?.summary.year_range
    ? `${payments.summary.year_range[0]}–${payments.summary.year_range[1]} · disclosed`
    : 'CMS Sunshine Act';

  // Signal feed — freshest item per intel stream (webinar / Rx / pubs / news).
  const signals: { id: string; tone: 'teal' | 'orange'; meta: string; line: string }[] = [];
  const webinar = timeline.find((s) => s.signal_type === 'webinar_attendance');
  if (webinar) {
    signals.push({
      id: 'sig-webinar',
      tone: 'teal',
      meta: `${formatDate(webinar.observed_at)} · Webinar`,
      line: webinar.entities_json?.asked_question
        ? `Attended "${webinar.title}" · asked a question`
        : `Attended "${webinar.title}"`,
    });
  }
  if (topLift && topLift.pct_lift !== null) {
    signals.push({
      id: 'sig-rx',
      tone: 'orange',
      meta: 'Prescribing',
      line: `${topLift.drug_normalized} claims trending ↑ ${topLift.pct_lift.toFixed(0)}% YoY`,
    });
  }
  const firstPub = pubs?.items[0];
  if (firstPub) {
    signals.push({
      id: 'sig-pub',
      tone: 'teal',
      meta: `${formatDate(firstPub.published_at)} · Publication`,
      line: `${firstPub.is_first_author ? 'First-author: ' : ''}${firstPub.title}`,
    });
  }
  if (news[0]) {
    signals.push({
      id: 'sig-news',
      tone: 'teal',
      meta: `${formatDate(news[0].observed_at)} · News`,
      line: news[0].title ?? '(untitled)',
    });
  }

  return (
    <div className="space-y-4">
      {/* Back — browser history so the user returns to wherever they came from */}
      <button
        onClick={() => navigate(-1)}
        className="inline-flex items-center gap-1 rounded-lg text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <ArrowLeft className="h-3.5 w-3.5" /> Back
      </button>

      {/* 1 · Identity band */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-4 p-4 md:p-5">
          <InitialsAvatar name={kol.name} photoUrl={kol.photo_url} className="h-14 w-14 shrink-0 text-lg" />
          <div className="min-w-0 flex-1 basis-56">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <h1 className="text-lg font-bold tracking-tight text-foreground">{kol.name}</h1>
              {kol.title && <span className="text-xs text-muted-foreground">{kol.title}</span>}
              {kol.shoot_count > 0 && (
                <Badge
                  variant="teal"
                  className="text-[10px]"
                  title="Has appeared in CHM-produced content — actively engaged KOL."
                >
                  Engaged
                </Badge>
              )}
              {kol.is_new && (
                <Badge variant="orange" className="text-[10px]" title="Recently added to the KOL network.">
                  New
                </Badge>
              )}
              {usingDemoProfile && <DemoBadge />}
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {[kol.specialty, kol.institution, kol.region_label ?? kol.region]
                .filter(Boolean)
                .join(' · ')}
            </p>
            {kol.bio && (
              <p className="mt-0.5 line-clamp-1 text-xs italic text-muted-foreground/80" title={kol.bio}>
                {kol.bio}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {links.slice(0, 2).map((l) => (
              <a
                key={l.label}
                href={l.href}
                target="_blank"
                rel="noreferrer"
                className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'group')}
              >
                {l.label}
                <ExternalLink className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
            ))}
            <Button
              size="sm"
              onClick={() =>
                showToast(
                  `Outreach logging for ${kol.name} is a stub — it will create a CRM touchpoint once wired to the backend.`,
                )
              }
            >
              Log outreach
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2 · KPI stat tiles */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiTile
          eyebrow="Shoots"
          value={kol.shoot_count.toLocaleString()}
          note={usingDemoProfile ? 'MediaHub · demo' : 'MediaHub · live'}
        />
        <KpiTile
          eyebrow="Total Rx"
          value={rx.length > 0 ? totalRxAllYears.toLocaleString() : '—'}
          note="CMS Part D · demo"
        />
        <KpiTile
          accent
          eyebrow="Rx lift post-CHM"
          value={liftLabel}
          note={topLift?.drug_normalized ?? 'no anchored lift'}
        />
        <KpiTile eyebrow="Open Payments" value={paymentsLabel} note={paymentsNote} />
      </div>

      {/* 3 · Briefing centerpiece + attribution chart / signals */}
      <div className="grid items-stretch gap-4 lg:grid-cols-[1.4fr_1fr]">
        <div className="min-w-0">
          <BriefingCard
            brief={briefQuery.data ?? null}
            loading={briefQuery.isLoading}
            regenerating={briefRegenerating}
            onRegenerate={regenerateBrief}
          />
        </div>

        <div className="flex min-w-0 flex-col gap-4">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Eyebrow className="flex items-center gap-1.5">
                  <TrendingUp className="h-3.5 w-3.5" />
                  Rx · pre / post first CHM shoot
                </Eyebrow>
                <DemoBadge />
              </div>
              {rxTrendQuery.data && (
                <p className="text-[11px] text-muted-foreground">
                  {rxTrendQuery.data.drug} · monthly claims
                </p>
              )}
            </CardHeader>
            <CardContent className="pb-3">
              {rxTrendQuery.data ? (
                <RxTrendChart points={rxTrendQuery.data.points} />
              ) : (
                <div className="flex h-44 items-center justify-center">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-label="Loading" />
                </div>
              )}
            </CardContent>
          </Card>

          {/* basis-0 + min-h-0 let the briefing set the row height; signals scroll inside */}
          <Card className="flex min-h-0 flex-1 basis-0 flex-col overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <Eyebrow>Signals</Eyebrow>
                <DemoBadge />
              </div>
            </CardHeader>
            <CardContent className="min-h-0 flex-1 space-y-0.5 overflow-y-auto pb-3">
              {signals.length === 0 ? (
                <p className="py-3 text-center text-sm text-muted-foreground">No signals yet.</p>
              ) : (
                signals.map((s) => (
                  <div
                    key={s.id}
                    className="-mx-2 flex items-start gap-2.5 rounded-lg px-2.5 py-2 transition-colors duration-200 hover:bg-muted/60"
                  >
                    <span
                      className={cn(
                        'mt-1.5 h-2 w-2 shrink-0 rounded-full',
                        s.tone === 'orange' ? 'bg-accent' : 'bg-primary',
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-[11px] text-muted-foreground">{s.meta}</p>
                      <p className="truncate text-xs font-semibold text-foreground" title={s.line}>
                        {s.line}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* 4 · Publications (live) + Trials & Grants (demo) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <PublicationsCard
          loading={!pubsDemo && pubsQuery.isLoading}
          demo={pubsDemo}
          publications={pubs?.items ?? []}
          total={pubs?.total ?? 0}
        />
        <TrialsGrantsCard trials={trialsQuery.data ?? []} nih={nihQuery.data ?? null} />
      </div>

      {/* 5 · Below the fold — remaining detail as stacked cards */}
      <EngagementSection engagement={engagementQuery.data ?? null} timeline={timeline} />
      <PrescribingSection rx={rx} shifts={shifts} />
      <OpenPaymentsCard payments={payments} />
      <NewsSection news={news} moreHref={links[2]?.href} />

      {/* Toast stub for "Log outreach" */}
      {toast && (
        <div
          role="status"
          className="fixed bottom-4 right-4 z-50 w-[340px] rounded-xl border border-border bg-card p-4 shadow-card-hover"
        >
          <p className="text-sm font-semibold text-foreground">Log outreach</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{toast}</p>
        </div>
      )}
    </div>
  );
}

// ─── shared atoms ────────────────────────────────────────────────────────────

/** Small uppercase teal section label — the platform's card-header language. */
function Eyebrow({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <span
      className={cn('text-[10px] font-bold uppercase tracking-[0.14em] text-primary', className)}
    >
      {children}
    </span>
  );
}

/** KPI stat tile with the shared hover-lift. `accent` = soft orange gradient. */
function KpiTile({
  eyebrow,
  value,
  note,
  accent = false,
}: {
  eyebrow: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <Card
      variant="interactive"
      className={cn(
        accent &&
          'bg-gradient-to-br from-card to-accent-100/70 hover:border-accent/40 dark:to-accent-500/15',
      )}
    >
      <CardContent className="p-4">
        <p
          className={cn(
            'text-[10px] font-bold uppercase tracking-[0.14em]',
            accent ? 'text-accent-600 dark:text-accent-400' : 'text-primary',
          )}
        >
          {eyebrow}
        </p>
        <p
          className={cn(
            'mt-1 font-mono text-2xl font-bold tabular-nums',
            accent ? 'text-accent-600 dark:text-accent-300' : 'text-foreground',
          )}
        >
          {value}
        </p>
        <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{note}</p>
      </CardContent>
    </Card>
  );
}

function MiniKPI({ label, value }: { label: string; value: string | number }) {
  return (
    <Card>
      <CardContent className="p-3 pt-3">
        <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-foreground">
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
      </CardContent>
    </Card>
  );
}

function DrugChip({ drug, klass }: { drug: string; klass?: string | null }) {
  return (
    <Badge variant="outline" className="gap-1.5" title={klass ? `${drug} — ${klass}` : drug}>
      <Pill className="h-3 w-3" />
      {drug}
      {klass && (
        <span className="text-[10px] font-normal text-muted-foreground">· {klass}</span>
      )}
    </Badge>
  );
}

/**
 * Minimal markdown renderer — just enough for the AI brief's headers +
 * paragraphs + bold/italic (ported from MediaHub; avoids a markdown dep).
 * Headers render as muted eyebrows per the approved dossier layout.
 */
function MiniMarkdown({ text }: { text: string }) {
  const lines = text.split(/\r?\n/);
  const blocks: { type: 'h2' | 'p'; content: string }[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) {
      blocks.push({ type: 'p', content: para.join(' ') });
      para = [];
    }
  };
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (trimmed.startsWith('## ') || trimmed.startsWith('# ')) {
      flush();
      blocks.push({ type: 'h2', content: trimmed.replace(/^#+\s*/, '') });
      continue;
    }
    para.push(trimmed);
  }
  flush();

  const renderInline = (s: string): ReactNode[] => {
    const out: ReactNode[] = [];
    const re = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = re.exec(s)) !== null) {
      if (m.index > last) out.push(s.slice(last, m.index));
      const tok = m[0];
      if (tok.startsWith('**')) out.push(<strong key={i++}>{tok.slice(2, -2)}</strong>);
      else out.push(<em key={i++}>{tok.slice(1, -1)}</em>);
      last = m.index + tok.length;
    }
    if (last < s.length) out.push(s.slice(last));
    return out;
  };

  return (
    <div className="space-y-2 text-sm leading-relaxed">
      {blocks.map((b, i) =>
        b.type === 'h2' ? (
          <h3
            key={i}
            className="mt-4 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground first:mt-0"
          >
            {b.content}
          </h3>
        ) : (
          <p key={i}>{renderInline(b.content)}</p>
        ),
      )}
    </div>
  );
}

function PaginatedList<T>({
  items,
  pageSize,
  renderItem,
}: {
  items: T[];
  pageSize: number;
  renderItem: (item: T) => ReactNode;
}) {
  const [visible, setVisible] = useState(pageSize);
  const shown = items.slice(0, visible);
  const remaining = items.length - visible;
  return (
    <div className="space-y-2">
      {shown.map(renderItem)}
      <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
        <span>
          Showing {Math.min(visible, items.length)} of {items.length}
        </span>
        {remaining > 0 && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setVisible((v) => Math.min(v + pageSize, items.length))}
          >
            Show {Math.min(pageSize, remaining)} more
          </Button>
        )}
      </div>
    </div>
  );
}

// ─── Intelligence Briefing (editorial centerpiece) ──────────────────────────

function BriefingCard({
  brief,
  loading,
  regenerating,
  onRegenerate,
}: {
  brief: AIBrief | null;
  loading: boolean;
  regenerating: boolean;
  onRegenerate: () => void;
}) {
  return (
    <Card className="transition-all duration-200 hover:ring-1 hover:ring-primary/20">
      <CardHeader className="flex-row items-center justify-between space-y-0 gap-3 pb-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <Eyebrow className="flex items-center gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Intelligence Briefing
          </Eyebrow>
          {brief?.stale && <Badge variant="muted">Stale &gt;7d</Badge>}
          <DemoBadge />
        </div>
        <Button size="sm" variant="outline" disabled={regenerating} onClick={onRegenerate}>
          <RefreshCw className={cn('h-3.5 w-3.5', regenerating && 'animate-spin')} />
          Regenerate
        </Button>
      </CardHeader>
      <CardContent>
        {loading || !brief ? (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            Generating brief…
          </div>
        ) : (
          <>
            <MiniMarkdown text={brief.brief_markdown} />
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
              {new Date(brief.generated_at).toLocaleString()} · {brief.model_used}
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Publications (LIVE) ─────────────────────────────────────────────────────

function PublicationsCard({
  loading,
  demo,
  publications,
  total,
}: {
  loading: boolean;
  demo: boolean;
  publications: PublicKolPublication[];
  total: number;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="flex items-center gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Publications {total > 0 && `(${total})`}
          </Eyebrow>
          <span className="text-[11px] text-muted-foreground">
            {demo ? 'OpenAlex' : 'OpenAlex · live'}
          </span>
          {demo && <DemoBadge />}
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex min-h-[120px] items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Loading" />
          </div>
        ) : publications.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No OpenAlex-linked publications for this KOL yet.
          </p>
        ) : (
          <PaginatedList
            items={publications}
            pageSize={5}
            renderItem={(p) => {
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span>{formatDate(p.published_at)}</span>
                      {p.journal && (
                        <>
                          <span>·</span>
                          <span className="italic">{p.journal}</span>
                        </>
                      )}
                      {p.is_first_author && (
                        <Badge variant="teal" className="text-[10px]">
                          First author
                        </Badge>
                      )}
                      {p.is_last_author && (
                        <Badge variant="outline" className="text-[10px]">
                          Senior author
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
                      {p.title}
                    </p>
                  </div>
                  {p.url && (
                    <ExternalLink className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                  )}
                </>
              );
              const rowClass =
                'group -mx-2 flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-muted/50';
              return p.url ? (
                <a
                  key={`${p.title}-${p.published_at}`}
                  href={p.url}
                  target="_blank"
                  rel="noreferrer"
                  className={rowClass}
                >
                  {inner}
                </a>
              ) : (
                <div key={`${p.title}-${p.published_at}`} className={rowClass}>
                  {inner}
                </div>
              );
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

// ─── Trials & Grants (demo) ──────────────────────────────────────────────────

function TrialsGrantsCard({
  trials,
  nih,
}: {
  trials: HCPSignal[];
  nih: NIHGrantsResponse | null;
}) {
  const summary = nih?.summary;
  const hasGrants = !!summary && summary.total_grants > 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="flex items-center gap-1.5">
            <Beaker className="h-3.5 w-3.5" />
            Trials &amp; Grants
          </Eyebrow>
          <DemoBadge />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {trials.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            No registered trials matched to this HCP.
          </p>
        ) : (
          <div className="space-y-1">
            {trials.map((s) => {
              const Icon = signalIcon(s.signal_type);
              return (
                <a
                  key={s.id}
                  href={s.url ?? '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="group -mx-2 flex gap-3 rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-muted/50"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="uppercase">{s.signal_type}</span>
                      <span>·</span>
                      <span>{s.source}</span>
                      <span>·</span>
                      <span>{formatDate(s.observed_at)}</span>
                    </div>
                    <p className="text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
                      {s.title ?? '(untitled)'}
                    </p>
                    {s.drugs.length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {s.drugs.map((d) => (
                          <DrugChip key={`${s.id}-${d.drug_normalized}`} drug={d.drug_normalized} />
                        ))}
                      </div>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {hasGrants && summary && nih && (
          <div className="border-t border-border pt-3">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
              NIH grants · RePORTER (PI-name match)
            </p>
            <div className="grid grid-cols-3 gap-2">
              <MiniKPI label="Grants" value={summary.total_grants} />
              <MiniKPI label="Active" value={summary.active_grants} />
              <MiniKPI
                label="Lifetime award"
                value={`$${Math.round(summary.total_award_usd / 1000).toLocaleString()}K`}
              />
            </div>
            {summary.top_agencies.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {summary.top_agencies.slice(0, 5).map((a) => (
                  <Badge key={a.agency} variant="teal" className="gap-1.5 text-[10px]">
                    {a.agency}
                    <span className="font-mono tabular-nums opacity-80">
                      ${Math.round(a.total_usd).toLocaleString()}
                    </span>
                  </Badge>
                ))}
              </div>
            )}
            <div className="mt-2 space-y-1">
              {nih.grants.slice(0, 3).map((g) => (
                <a
                  key={g.appl_id}
                  href={`https://reporter.nih.gov/project-details/${g.appl_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group -mx-2 flex items-start justify-between gap-3 rounded-xl px-2.5 py-2 transition-colors duration-200 hover:bg-muted/50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
                      {g.project_title ?? g.project_num ?? g.appl_id}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {g.fiscal_year ?? '—'} · {g.activity_code ?? '—'} · {g.agency_ic ?? '—'}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-mono text-sm font-semibold tabular-nums">
                      {g.award_amount
                        ? `$${g.award_amount.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                        : '—'}
                    </p>
                    {g.is_active && (
                      <Badge variant="teal" className="mt-1 text-[9px]">
                        Active
                      </Badge>
                    )}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Engagement detail (below the fold) ─────────────────────────────────────

type EngagementPillFilter = 'all' | 'shoot' | 'webinar' | 'qa';

function EngagementSection({
  engagement,
  timeline,
}: {
  engagement: EngagementSignals | null;
  timeline: HCPSignal[];
}) {
  const [activePill, setActivePill] = useState<EngagementPillFilter>('all');

  const filtered = timeline.filter((s) => {
    if (activePill === 'all') return true;
    if (activePill === 'shoot') return s.signal_type === 'clip_appearance';
    if (activePill === 'webinar') return s.signal_type === 'webinar_attendance';
    if (activePill === 'qa') return Boolean(s.entities_json?.asked_question);
    return true;
  });

  const drugFreq = new Map<string, number>();
  timeline.forEach((s) =>
    s.drugs.forEach((d) =>
      drugFreq.set(d.drug_normalized, (drugFreq.get(d.drug_normalized) ?? 0) + 1),
    ),
  );
  const topDrugs = [...drugFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([d]) => d);

  if (timeline.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 pt-8 text-center">
          <CalendarCheck className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
          <p className="mb-1 text-sm font-medium">No CHM engagement recorded yet</p>
          <p className="text-xs text-muted-foreground">
            Engagement events surface here once this HCP attends a webinar, RSVPs, asks a
            question, or interacts with CHT-platform content.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="flex items-center gap-1.5">
            <CalendarCheck className="h-3.5 w-3.5" />
            Engagement detail
          </Eyebrow>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <EngagementPillButton
            label="All"
            count={timeline.length}
            active={activePill === 'all'}
            onClick={() => setActivePill('all')}
          />
          <EngagementPillButton
            label="CHM Shoots"
            count={timeline.filter((s) => s.signal_type === 'clip_appearance').length}
            active={activePill === 'shoot'}
            onClick={() => setActivePill('shoot')}
          />
          <EngagementPillButton
            label="Webinars"
            count={timeline.filter((s) => s.signal_type === 'webinar_attendance').length}
            active={activePill === 'webinar'}
            onClick={() => setActivePill('webinar')}
          />
          <EngagementPillButton
            label="Q&A"
            count={timeline.filter((s) => Boolean(s.entities_json?.asked_question)).length}
            active={activePill === 'qa'}
            onClick={() => setActivePill('qa')}
          />
          {/* Future CHT-event pills — greyed out until CHT engagement events land */}
          {['Videos', 'Emails', 'Surveys', 'Payments', 'Chat'].map((p) => (
            <span
              key={p}
              className="inline-flex items-center gap-1 rounded-pill border border-dashed border-border/60 px-2.5 py-0.5 text-[10px] text-muted-foreground/60"
              title="Coming when CHT engagement events are wired up"
            >
              {p} · soon
            </span>
          ))}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {engagement && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <MiniKPI label="Attended" value={engagement.webinars_attended} />
            <MiniKPI label="RSVP only" value={engagement.webinars_rsvp_only} />
            <MiniKPI label="Questions asked" value={engagement.questions_asked} />
            <MiniKPI
              label="Q&A rate"
              value={engagement.qa_rate === null ? '—' : `${Math.round(engagement.qa_rate * 100)}%`}
            />
          </div>
        )}
        {topDrugs.length > 0 && (
          <div>
            <p className="mb-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
              Top engagement drugs
            </p>
            <div className="flex flex-wrap gap-1">
              {topDrugs.map((d) => (
                <DrugChip key={d} drug={d} />
              ))}
            </div>
          </div>
        )}
        <div className="space-y-2">
          {filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No events match this filter.
            </p>
          ) : (
            filtered.map((s) => {
              const askedQuestion = Boolean(s.entities_json?.asked_question);
              const isClip = s.signal_type === 'clip_appearance';
              const clipTitle =
                isClip && s.panel && s.panel.length > 0
                  ? `${s.title} — ${s.panel.join(', ')}`
                  : s.title;
              return (
                <div
                  key={s.id}
                  className="rounded-xl border border-border p-3 transition-colors duration-200 hover:bg-muted/60"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-xs text-muted-foreground">
                        <CalendarCheck className="h-3 w-3" />
                        {!isClip && (
                          <>
                            <span>{formatDate(s.observed_at)}</span>
                            <span>·</span>
                          </>
                        )}
                        <span className="uppercase tracking-wide">
                          {s.signal_type === 'webinar_attendance'
                            ? 'webinar'
                            : isClip
                              ? 'CHM shoot'
                              : s.signal_type}
                        </span>
                      </p>
                      <p className="mt-0.5 text-sm font-medium">{clipTitle}</p>
                      {s.drugs.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {s.drugs.map((d) => (
                            <DrugChip key={`${s.id}-${d.drug_normalized}`} drug={d.drug_normalized} />
                          ))}
                        </div>
                      )}
                    </div>
                    {askedQuestion && <Badge className="shrink-0">Q&amp;A</Badge>}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function EngagementPillButton({
  label,
  count,
  active,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1 rounded-pill border px-2.5 py-0.5 text-[11px] transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-primary bg-primary text-primary-foreground'
          : 'border-border text-muted-foreground hover:bg-muted',
      )}
    >
      {label}
      <span className={cn('font-mono tabular-nums', active ? 'opacity-90' : 'opacity-60')}>
        {count}
      </span>
    </button>
  );
}

// ─── Prescribing detail (below the fold) ────────────────────────────────────

function PrescribingSection({
  rx,
  shifts,
}: {
  rx: RxVolumesByDrug[];
  shifts: ShiftsResponse | null;
}) {
  if (rx.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 pt-6 text-center text-sm text-muted-foreground">
          <p>No CMS Part D prescription data matched to this HCP.</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5" />
            Prescribing detail
          </Eyebrow>
          <DemoBadge />
        </div>
        <p className="mt-1 flex items-start gap-1.5 text-xs text-muted-foreground">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            <strong className="text-foreground">CMS Part D · annual.</strong> Year-over-year deltas
            only. Monthly granularity requires PurpleLab integration (not yet connected).
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-4 p-0 pb-2">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-border text-xs text-muted-foreground">
              <tr>
                <th className="p-3 pl-5 text-left font-semibold">#</th>
                <th className="p-3 text-left font-semibold">Drug</th>
                <th className="p-3 text-left font-semibold">Class</th>
                <th className="p-3 pr-5 text-right font-semibold">Claims</th>
              </tr>
            </thead>
            <tbody>
              {rx.slice(0, 15).map((d, i) => (
                <tr
                  key={d.drug_normalized}
                  className="border-b border-border transition-colors duration-200 last:border-0 hover:bg-muted/40"
                >
                  <td className="p-3 pl-5 font-mono tabular-nums text-muted-foreground">{i + 1}</td>
                  <td className="p-3 font-medium">
                    {d.drug_normalized}
                    {d.brand_name && d.brand_name.toLowerCase() !== d.drug_normalized && (
                      <span className="ml-1 text-xs text-muted-foreground">({d.brand_name})</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-muted-foreground">{d.drug_class ?? '—'}</td>
                  <td className="p-3 pr-5 text-right font-mono tabular-nums">
                    {d.total_claims_all_years.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {shifts && shifts.shifts.length > 0 && (
          <div>
            <p className="border-t border-border p-3 pl-5 text-xs text-muted-foreground">
              <strong className="text-foreground">Pre/post CHM attendance shifts.</strong>{' '}
              Year-over-year Rx delta anchored on first CHM webinar attendance. Directional signal
              only.
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="border-b border-border text-xs text-muted-foreground">
                  <tr>
                    <th className="p-3 pl-5 text-left font-semibold">Drug</th>
                    <th className="p-3 text-left font-semibold">Class</th>
                    <th className="p-3 text-right font-semibold">
                      Pre ({shifts.shifts[0]?.pre_window_label})
                    </th>
                    <th className="p-3 text-right font-semibold">
                      Post ({shifts.shifts[0]?.post_window_label})
                    </th>
                    <th className="p-3 text-right font-semibold">Δ</th>
                    <th className="p-3 pr-5 text-right font-semibold">% lift</th>
                  </tr>
                </thead>
                <tbody>
                  {shifts.shifts.map((s: DrugShift) => (
                    <tr
                      key={s.drug_normalized}
                      className="border-b border-border transition-colors duration-200 last:border-0 hover:bg-muted/40"
                    >
                      <td className="p-3 pl-5 font-medium">{s.drug_normalized}</td>
                      <td className="p-3 text-xs text-muted-foreground">{s.drug_class ?? '—'}</td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        {s.pre_claims.toLocaleString()}
                      </td>
                      <td className="p-3 text-right font-mono tabular-nums">
                        {s.post_claims.toLocaleString()}
                      </td>
                      <td
                        className={cn(
                          'p-3 text-right font-mono tabular-nums',
                          s.delta > 0 ? POSITIVE : s.delta < 0 ? NEGATIVE : '',
                        )}
                      >
                        {s.delta > 0 ? '+' : ''}
                        {s.delta}
                      </td>
                      <td className="p-3 pr-5 text-right font-mono tabular-nums">
                        {s.pct_lift === null ? (
                          '—'
                        ) : (
                          <span className={s.has_lift ? `font-medium ${POSITIVE}` : ''}>
                            {s.pct_lift > 0 ? '+' : ''}
                            {s.pct_lift.toFixed(0)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Open Payments (below the fold) ──────────────────────────────────────────

function OpenPaymentsCard({ payments }: { payments: OpenPaymentsResponse | null }) {
  const summary = payments?.summary;
  const hasData = !!summary && summary.record_count > 0;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="flex items-center gap-1.5">
            <DollarSign className="h-3.5 w-3.5" />
            Open Payments (CMS Sunshine Act)
          </Eyebrow>
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Disclosed pharma→physician payments: speaker fees, meals, consulting, research. Public
          federal data.
        </p>
      </CardHeader>
      <CardContent>
        {!hasData && (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No disclosed payments found for this HCP in recent years.
          </p>
        )}
        {hasData && summary && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <MiniKPI
                label="Total disclosed"
                value={`$${summary.total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              />
              <MiniKPI label="Records" value={summary.record_count} />
              <MiniKPI
                label="Years"
                value={summary.year_range ? `${summary.year_range[0]}–${summary.year_range[1]}` : '—'}
              />
            </div>

            {summary.by_company.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Top companies
                </p>
                <div className="space-y-1">
                  {summary.by_company.slice(0, 5).map((c) => (
                    <div
                      key={c.company}
                      className="flex items-center justify-between rounded-xl border border-border px-3 py-2 text-sm transition-colors duration-200 hover:bg-muted/40"
                    >
                      <span className="min-w-0 truncate pr-3">{c.company}</span>
                      <div className="flex shrink-0 items-center gap-3">
                        <span className="font-mono text-xs tabular-nums text-muted-foreground">
                          {c.count} records
                        </span>
                        <span className="font-mono font-semibold tabular-nums">
                          ${c.total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {summary.by_drug.filter((d) => d.drug !== '(not specified)').length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  Top drug contexts
                </p>
                <div className="flex flex-wrap gap-2">
                  {summary.by_drug
                    .filter((d) => d.drug !== '(not specified)')
                    .slice(0, 8)
                    .map((d) => (
                      <Badge key={d.drug} variant="outline" className="gap-1.5">
                        {d.drug}
                        <span className="font-mono tabular-nums text-muted-foreground">
                          ${d.total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                      </Badge>
                    ))}
                </div>
              </div>
            )}

            {summary.by_nature.length > 0 && (
              <div>
                <p className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">
                  By nature of payment
                </p>
                <div className="flex flex-wrap gap-2">
                  {summary.by_nature.slice(0, 6).map((n) => (
                    <Badge key={n.nature} variant="muted">
                      {n.nature} · $
                      {n.total_usd.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            <p className="border-t border-border pt-2 text-[10px] text-muted-foreground">
              Source: CMS Open Payments · openpaymentsdata.cms.gov · covers program years 2022–2024
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── News (below the fold) ───────────────────────────────────────────────────

function NewsSection({ news, moreHref }: { news: NewsArticle[]; moreHref?: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center gap-2">
          <Eyebrow className="flex items-center gap-1.5">
            <Newspaper className="h-3.5 w-3.5" />
            News &amp; media mentions {news.length > 0 && `(${news.length})`}
          </Eyebrow>
          <span className="text-[11px] text-muted-foreground">Google News</span>
          {moreHref && (
            <a
              href={moreHref}
              target="_blank"
              rel="noreferrer"
              className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'group ml-auto h-7 px-2.5 text-[11px]')}
            >
              Search Google News
              <ExternalLink className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </a>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {news.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            No news or media mentions yet.
          </p>
        ) : (
          <PaginatedList
            items={news}
            pageSize={10}
            renderItem={(n) => (
              <a
                key={n.id}
                href={n.url ?? '#'}
                target="_blank"
                rel="noreferrer"
                className="group -mx-2 block rounded-xl px-2.5 py-2.5 transition-colors duration-200 hover:bg-muted/50"
              >
                <p className="text-[11px] text-muted-foreground">
                  {formatDate(n.observed_at)}
                  {n.source_name && ` · ${n.source_name}`}
                </p>
                <p className="text-sm font-medium text-foreground transition-colors duration-200 group-hover:text-primary">
                  {n.title}
                </p>
              </a>
            )}
          />
        )}
      </CardContent>
    </Card>
  );
}
