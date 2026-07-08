import { Link, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, LayoutTemplate, Pencil, Printer, RefreshCw, Sparkles } from 'lucide-react';
import { LogoMark } from './components/Logo';
import { useToast } from './components/Toaster';
import { useAnalyticsReport, useGenerateInsights, qk } from './lib/hooks';
import { formatLongDate } from './lib/utils';
import {
  DocStyles,
  GlossaryTable,
  INK,
  KpiTable,
  NumberedList,
  PageFooter,
  PageRunningHeader,
  SANS,
  SERIF,
  SectionHeading,
  Wordmark,
} from './analytics-report-parts';

const GHOST_BUTTON_BASE =
  'inline-flex items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 border border-transparent min-h-8 rounded-md px-3';

function coverRow(label: string, value: string) {
  return (
    <tr key={label}>
      <td style={{ padding: '5px 0px', color: INK.muted, fontWeight: 600, fontSize: 10, letterSpacing: '0.06em', textTransform: 'uppercase', width: '36%', verticalAlign: 'top' }}>
        {label}
      </td>
      <td style={{ padding: '5px 0px', color: INK.slate, fontSize: 12, verticalAlign: 'top' }}>{value}</td>
    </tr>
  );
}

export default function AnalyticsReport() {
  const { id = '' } = useParams<{ id: string }>();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: report, isLoading } = useAnalyticsReport(id);
  const generateInsights = useGenerateInsights(id);

  const runGenerate = () =>
    generateInsights.mutate(undefined, {
      onSuccess: () => toast({ title: 'Insights generated', description: 'AI insights have been added to the report.' }),
      onError: (err: Error) => toast({ title: 'Could not generate insights', description: err.message, variant: 'destructive' }),
    });

  if (isLoading || !report) {
    return (
      <div className="wp-root" style={{ background: '#e8eaef', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SANS }}>
        <div style={{ fontSize: 13, color: INK.muted }}>Generating report...</div>
      </div>
    );
  }

  const { campaign, sections } = report;
  const today = formatLongDate(new Date().toISOString());
  const year = new Date().getFullYear();

  const periodEnd = new Date(`${campaign.reportingPeriodEnd}T00:00:00`);
  const periodEndingLabel = isNaN(periodEnd.getTime())
    ? campaign.reportingPeriodEnd
    : periodEnd.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    // `color-scheme: light` + explicit light bg keeps the document light even under the
    // platform's global `.dark` class. This is an intentional "white paper" artifact.
    <div className="wp-root" style={{ fontFamily: SANS, colorScheme: 'light' }}>
      <DocStyles />

      {/* ===== Toolbar (no-print) ===== */}
      <div
        className="no-print"
        style={{
          position: 'sticky', top: 0, zIndex: 50, background: 'rgb(72, 81, 101)', color: 'rgb(255, 255, 255)',
          padding: '8px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)', boxShadow: 'rgba(0, 0, 0, 0.25) 0px 1px 6px', fontFamily: SANS,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/admin/content-hub">
            <button
              className="transition-colors hover:bg-white/10"
              aria-label="Back to Content Hub"
              style={{ color: 'rgba(255, 255, 255, 0.45)', cursor: 'pointer', padding: '2px 6px', borderRadius: 4, background: 'transparent', border: 'none', display: 'flex', alignItems: 'center' }}
            >
              <ArrowLeft style={{ width: 16, height: 16 }} />
            </button>
          </Link>
          <div style={{ height: 16, width: 1, background: 'rgba(255, 255, 255, 0.2)' }} />
          <LogoMark size={20} color="#3dc4c0" />
          <span style={{ fontWeight: 600, fontSize: 13, color: 'rgb(255, 255, 255)', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {campaign.name}
          </span>
          <span className="hidden sm:block" style={{ color: 'rgba(255, 255, 255, 0.35)', fontSize: 11 }}>
            — Analytics Report (White Paper)
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className={`${GHOST_BUTTON_BASE} h-7 text-xs text-white/40 hover:bg-white/10 hover:text-white`}
            onClick={() => queryClient.invalidateQueries({ queryKey: qk.report(id) })}
          >
            <RefreshCw className="mr-1 h-3 w-3" />
            Regenerate
          </button>
          <button
            className={`${GHOST_BUTTON_BASE} h-7 text-xs text-[#ff9e40]/70 hover:bg-white/10 hover:text-[#ff9e40]`}
            disabled={generateInsights.isPending}
            onClick={runGenerate}
          >
            <Sparkles className="mr-1 h-3 w-3" />
            Regenerate Insights
          </button>
          <button className={`${GHOST_BUTTON_BASE} h-7 text-xs text-white/50 hover:bg-white/10 hover:text-white`}>
            <Pencil className="mr-1 h-3 w-3" />
            Edit Report
          </button>
          <button className={`${GHOST_BUTTON_BASE} h-7 text-xs text-white/40 hover:bg-white/10 hover:text-white`}>
            <LayoutTemplate className="mr-1 h-3 w-3" />
            Template
          </button>
          <button
            className="ml-1 inline-flex h-7 min-h-8 items-center justify-center gap-2 whitespace-nowrap rounded-md border border-transparent bg-[#e7764f] px-3 text-xs font-medium text-white transition-colors hover:bg-[#c0603c] [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0"
            onClick={() => window.print()}
          >
            <Printer className="mr-1 h-3 w-3" />
            Export
          </button>
        </div>
      </div>

      <div style={{ padding: '32px 0px 48px' }}>
        {/* ===== COVER ===== */}
        <section id="s-cover" className="doc-page report-page" style={{ breakAfter: 'page' }}>
          <div style={{ marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
              <Wordmark logoSize={20.8} fontSize={13} />
              <div style={{ fontSize: 9, color: INK.faint, letterSpacing: '0.05em', textTransform: 'uppercase', fontFamily: SANS }}>Confidential</div>
            </div>
            <div style={{ height: 2, background: INK.teal }} />
          </div>
          <div style={{ flex: '1 1 0%', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', textAlign: 'center', padding: '60px 0px 40px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: INK.teal, letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 20, fontFamily: SANS }}>
              Analytics Report · {year}
            </div>
            <h1 style={{ fontSize: 30, fontWeight: 700, color: INK.slate, lineHeight: 1.2, letterSpacing: '-0.02em', margin: '0px 0px 12px', maxWidth: 480, fontFamily: SANS }}>
              {campaign.name}
            </h1>
            <p style={{ fontSize: 14, color: INK.muted, fontStyle: 'italic', margin: '0px 0px 8px', fontFamily: SERIF }}>{campaign.programName}</p>
            <p style={{ fontSize: 12, color: INK.muted, margin: 0, fontFamily: SERIF }}>
              {campaign.diseaseState} — {campaign.treatmentTopic}
            </p>
          </div>
          <div style={{ borderTop: `1px solid ${INK.rule}`, borderBottom: `1px solid ${INK.rule}`, padding: '20px 0px', marginBottom: 32 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: SANS }}>
              <tbody>
                {coverRow('Prepared for', campaign.clientSponsor)}
                {coverRow('Reporting Period', `${campaign.reportingPeriodStart} – ${campaign.reportingPeriodEnd}`)}
                {coverRow('Physician Speakers', campaign.physicianSpeakers)}
                {coverRow('Program', campaign.programName)}
                {coverRow('Prepared by', 'Community Health Media')}
                {coverRow('Date Issued', today)}
              </tbody>
            </table>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 9, color: INK.faint, letterSpacing: '0.05em', fontStyle: 'italic', fontFamily: SERIF }}>Medicine Moves Through Shared Knowledge.</div>
            <div style={{ fontSize: 9, color: INK.fainter, marginTop: 4, fontFamily: SANS }}>Confidential and for Internal Use Only · communityhealth.media</div>
          </div>
        </section>

        {/* ===== §1 EXECUTIVE SUMMARY ===== */}
        <section id="s-summary" className="doc-page report-page" style={{ breakAfter: 'page' }}>
          <PageRunningHeader campaignName={campaign.name} />
          <div className="doc-page-body" style={{ flex: '1 1 0%' }}>
            <SectionHeading num="1." title="Executive Summary" subtitle={campaign.programName} />
            <p style={{ fontSize: 12, color: INK.slate, lineHeight: 1.7, marginBottom: 20, fontFamily: SERIF }}>{sections.executiveSummary}</p>
            <div style={{ fontSize: 11, fontWeight: 700, color: INK.slate, marginBottom: 8, fontFamily: SANS, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Key Performance Indicators
            </div>
            <KpiTable tiles={sections.kpiTiles.slice(0, 8)} footnote="Source data as of the most recently uploaded platform exports." />
            {sections.dataGaps.length > 0 && (
              <div style={{ background: INK.orangeBg, borderWidth: '1px 1px 1px 3px', borderStyle: 'solid', borderColor: `${INK.orangeBorder} ${INK.orangeBorder} ${INK.orangeBorder} ${INK.orange}`, padding: '12px 16px', marginTop: 'auto' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: INK.orangeDark, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 8, fontFamily: SANS }}>
                  Data Gaps — Upload Required
                </div>
                <ul style={{ margin: 0, padding: 0, listStyle: 'none' }}>
                  {sections.dataGaps.map((gap, i) => (
                    <li key={i} style={{ fontSize: 11, color: INK.muted, marginBottom: 4, paddingLeft: 12, position: 'relative', fontFamily: SERIF }}>
                      <span style={{ position: 'absolute', left: 0, color: INK.orange, fontWeight: 700 }}>·</span>
                      {gap}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <PageFooter page={1} today={today} />
        </section>

        {/* ===== §2 CAMPAIGN PERFORMANCE OVERVIEW ===== */}
        <section id="s-impact" className="doc-page report-page" style={{ breakAfter: 'page' }}>
          <PageRunningHeader campaignName={campaign.name} />
          <div className="doc-page-body" style={{ flex: '1 1 0%' }}>
            <SectionHeading num="2." title="Campaign Performance Overview" subtitle={`${campaign.reportingPeriodStart} – ${campaign.reportingPeriodEnd} · All platforms combined`} />
            <p style={{ fontSize: 12, color: INK.slate, lineHeight: 1.7, marginBottom: 18, fontFamily: SERIF }}>
              The following table summarizes aggregate performance metrics across all active distribution channels for the campaign period. Individual platform breakdowns appear in subsequent sections.
            </p>
            <KpiTable tiles={sections.kpiTiles} withNotes footnote="Aggregated across all uploaded platform data. Values reflect totals or weighted averages as applicable." />
          </div>
          <PageFooter page={2} today={today} />
        </section>

        {/* ===== §3 KEY HIGHLIGHTS & STRATEGIC RECOMMENDATIONS ===== */}
        <section id="s-insights" className="doc-page report-page" style={{ breakAfter: 'page' }}>
          <PageRunningHeader campaignName={campaign.name} />
          <div className="doc-page-body" style={{ flex: '1 1 0%' }}>
            <SectionHeading num="3." title="Key Highlights & Strategic Recommendations" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: INK.teal, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontFamily: SANS }}>Key Highlights</div>
                {sections.keyHighlights.length === 0 ? (
                  <p style={{ fontSize: 11, color: INK.muted, fontStyle: 'italic', fontFamily: SERIF }}>Upload platform CSV data to generate key highlights.</p>
                ) : (
                  <NumberedList items={sections.keyHighlights} markerColor={INK.teal} />
                )}
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: INK.orange, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12, fontFamily: SANS }}>Strategic Recommendations</div>
                <NumberedList items={sections.recommendations} markerColor={INK.orange} />
              </div>
            </div>
          </div>
          <PageFooter page={3} today={today} />
        </section>

        {/* ===== §4 AI-GENERATED INSIGHTS ===== */}
        <section id="s-ai-insights" className="doc-page report-page" style={{ breakAfter: 'page' }}>
          <PageRunningHeader campaignName={campaign.name} />
          <div className="doc-page-body" style={{ flex: '1 1 0%' }}>
            <SectionHeading num="4." title="AI-Generated Insights" />
            {sections.aiInsights ? (
              <div>
                {sections.aiInsights.split(/\n{2,}/).map((para, i) => (
                  <p key={i} style={{ fontSize: 12, color: INK.slate, lineHeight: 1.7, marginBottom: 14, fontFamily: SERIF, whiteSpace: 'pre-wrap' }}>{para}</p>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '48px 0px', color: INK.muted }}>
                <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>✦</div>
                <p style={{ fontSize: 13, fontWeight: 600, color: INK.slate, marginBottom: 8, fontFamily: SANS }}>AI Insights Not Yet Generated</p>
                <p style={{ fontSize: 11, color: INK.muted, maxWidth: 400, margin: '0px auto', lineHeight: 1.7, fontFamily: SERIF }}>
                  Click "Regenerate Insights" in the toolbar above to generate AI-written commentary from your live campaign data — including an executive summary, standout observations, and strategic recommendations.
                </p>
              </div>
            )}
          </div>
          <PageFooter page={4} today={today} />
        </section>

        {/* ===== APPENDIX A — METRICS GLOSSARY ===== */}
        <section id="s-glossary" className="doc-page report-page" style={{ breakAfter: 'page' }}>
          <PageRunningHeader campaignName={campaign.name} />
          <div className="doc-page-body" style={{ flex: '1 1 0%' }}>
            <SectionHeading num="Appendix A." title="Metrics Glossary" />
            <p style={{ fontSize: 12, color: INK.slate, lineHeight: 1.7, marginBottom: 18, fontFamily: SERIF }}>
              Definitions of all metrics referenced in this report, organized alphabetically by platform.
            </p>
            <GlossaryTable entries={sections.glossary} />
          </div>
          <PageFooter page={5} today={today} />
        </section>

        {/* ===== BACK COVER ===== */}
        <section id="s-back" className="doc-page report-page" style={{ breakAfter: 'page', justifyContent: 'space-between' }}>
          <div>
            <div style={{ height: 2, background: INK.teal, marginBottom: 32 }} />
            <Wordmark logoSize={22.4} fontSize={14} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 11, color: INK.muted, fontStyle: 'italic', marginBottom: 8, fontFamily: SERIF }}>Medicine Moves Through Shared Knowledge.</div>
            <div style={{ fontSize: 11, color: INK.faint, marginBottom: 4, fontFamily: SANS }}>Prepared for {campaign.clientSponsor}</div>
            <div style={{ fontSize: 10, color: INK.faint, fontFamily: SANS }}>Reporting period ending {periodEndingLabel}</div>
          </div>
          <div>
            <div style={{ height: 1, background: INK.rule, marginBottom: 16 }} />
            <div style={{ fontSize: 9, color: INK.faint, textAlign: 'center', lineHeight: 1.6, fontFamily: SANS }}>
              Confidential and for Internal Use Only
              <br />
              This report is prepared exclusively for the client/sponsor named herein and may not be shared, reproduced, or distributed without written consent from Community Health Media.
              <br />
              communityhealth.media · {today}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
