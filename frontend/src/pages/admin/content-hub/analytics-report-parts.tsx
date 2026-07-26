import type { CSSProperties, ReactNode } from 'react';
import { LogoMark } from './components/Logo';
import type { GlossaryEntry, KpiTile } from './lib/types';

// SANS = the platform's shared display font (Chillax). SERIF = the report's editorial
// Georgia stack (matches the platform's `font-report` token). These are the intrinsic
// document fonts of the Analytics "white paper" and must not change with the theme.
export const SANS = 'Chillax, system-ui, sans-serif';
export const SERIF = 'Georgia, "Times New Roman", serif';

export const INK = {
  slate: '#485165',
  muted: '#79869a',
  faint: '#c8cdd6',
  fainter: '#d4d8e0',
  teal: '#3dc4c0',
  rule: '#e2e8f0',
  rowAlt: '#f8f9fc',
  rowBorder: '#e8eaef',
  orange: '#e7764f',
  orangeDark: '#c0603c',
  orangeBorder: '#f0c4a0',
  orangeBg: '#fff8f3',
};

/* Replicates the <style> block rendered by the original page (doc-page layout + print
   rules). `.ch-doc-scope.dark` guards are added so the platform's global `.dark` class
   on <html> cannot invert this intentionally-light document. */
export function DocStyles() {
  return (
    <style>{`
        .wp-root {
          background: #e8eaef;
          min-height: 100vh;
          color: ${INK.slate};
        }

        .doc-page {
          background: #ffffff;
          width: 816px;
          min-height: 1056px;
          margin: 0 auto 32px auto;
          padding: 56px 72px 48px 72px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 2px 12px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.05);
          box-sizing: border-box;
        }

        .doc-page-header { flex-shrink: 0; margin-bottom: 28px; }
        .doc-page-body { flex: 1; display: flex; flex-direction: column; }
        .doc-page-footer { flex-shrink: 0; margin-top: 28px; }

        @media print {
          @page { size: portrait; margin: 1in; }
          body { background: white !important; }
          .wp-root { background: transparent !important; }
          .no-print { display: none !important; }
          .doc-page {
            width: 100% !important;
            min-height: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            page-break-after: always !important;
            break-after: page !important;
            page-break-inside: avoid !important;
          }
          .doc-page-header, .doc-page-footer { display: block !important; }
        }
      `}</style>
  );
}

/* Logo mark + two-line "Community / Health Media" wordmark. */
export function Wordmark({ logoSize, fontSize }: { logoSize: number; fontSize: number }) {
  return (
    <div className="flex items-center gap-2">
      <LogoMark size={logoSize} color="#3dc4c0" />
      <div style={{ lineHeight: 1.1 }}>
        <div style={{ fontSize, fontWeight: 600, color: INK.slate, letterSpacing: '-0.01em', fontFamily: SANS }}>Community</div>
        <div style={{ fontSize, fontWeight: 600, color: INK.slate, letterSpacing: '-0.01em', fontFamily: SANS }}>Health Media</div>
      </div>
    </div>
  );
}

export function PageRunningHeader({ campaignName }: { campaignName: string }) {
  return (
    <div className="doc-page-header" style={{ marginBottom: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 10 }}>
        <Wordmark logoSize={17.6} fontSize={11} />
        <div style={{ textAlign: 'right', fontFamily: SANS }}>
          <div style={{ fontSize: 10, color: INK.slate, fontWeight: 600, letterSpacing: '0.02em' }}>{campaignName}</div>
          <div style={{ fontSize: 9, color: INK.muted, letterSpacing: '0.05em', textTransform: 'uppercase' }}>Analytics Report</div>
        </div>
      </div>
      <div style={{ height: 1.5, background: INK.teal, width: '100%' }} />
    </div>
  );
}

export function PageFooter({ page, today }: { page: number; today: string }) {
  return (
    <div className="doc-page-footer">
      <div style={{ height: 1, background: INK.rule, width: '100%', marginBottom: 8 }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontFamily: SANS }}>
        <div style={{ fontSize: 8, color: INK.faint }}>communityhealth.media</div>
        <div style={{ fontSize: 9, color: INK.muted }}>{page}</div>
        <div style={{ fontSize: 8, color: INK.faint, textAlign: 'right' }}>Confidential · {today}</div>
      </div>
    </div>
  );
}

export function SectionHeading({ num, title, subtitle }: { num: string; title: string; subtitle?: string }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, fontFamily: SANS }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: INK.teal, letterSpacing: '0.05em', minWidth: 28 }}>{num}</span>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: INK.slate, margin: 0, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{title}</h2>
      </div>
      {subtitle && (
        <div style={{ fontSize: 11, color: INK.muted, marginTop: 3, marginLeft: 38, fontFamily: SERIF, fontStyle: 'italic' }}>{subtitle}</div>
      )}
      <div style={{ height: 1, background: INK.rule, marginTop: 10 }} />
    </div>
  );
}

const thStyle: CSSProperties = {
  textAlign: 'left',
  padding: '7px 10px',
  color: '#ffffff',
  fontWeight: 600,
  fontSize: 10,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  borderBottom: `2px solid ${INK.teal}`,
};

function tdStyle(bold: boolean): CSSProperties {
  return {
    padding: '6px 10px',
    color: INK.slate,
    borderBottom: `1px solid ${INK.rowBorder}`,
    verticalAlign: 'top',
    fontWeight: bold ? 600 : 400,
  };
}

export function DocTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, fontFamily: SANS }}>
      <thead>
        <tr style={{ background: INK.slate }}>
          {headers.map((h) => (
            <th key={h} style={thStyle}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}

function KpiValueCell({ value }: { value: string }) {
  return (
    <td style={tdStyle(false)}>
      <strong style={{ color: value === '-' ? INK.faint : INK.slate }}>{value}</strong>
    </td>
  );
}

function KpiSourceCell({ source }: { source: string }) {
  return (
    <td style={tdStyle(false)}>
      <span style={{ fontSize: 10, color: INK.muted, textTransform: 'capitalize' }}>{source}</span>
    </td>
  );
}

export function KpiTable({ tiles, withNotes, footnote }: { tiles: KpiTile[]; withNotes?: boolean; footnote: string }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <DocTable headers={withNotes ? ['Metric', 'Value', 'Platform / Source', 'Notes'] : ['Metric', 'Value', 'Source']}>
        {tiles.map((tile, i) => (
          <tr key={tile.label} style={{ background: i % 2 === 0 ? '#ffffff' : INK.rowAlt }}>
            <td style={tdStyle(true)}>{tile.label}</td>
            <KpiValueCell value={tile.value} />
            <KpiSourceCell source={tile.source} />
            {withNotes && (
              <td style={tdStyle(false)}>
                <span style={{ fontSize: 10, color: INK.muted, fontStyle: 'italic' }}>{tile.note}</span>
              </td>
            )}
          </tr>
        ))}
      </DocTable>
      <div style={{ fontSize: 9, color: INK.muted, marginTop: 5, fontStyle: 'italic', fontFamily: SERIF }}>{footnote}</div>
    </div>
  );
}

const CHIP_COLORS: Record<string, string> = {
  All: '#79869a',
  Meta: '#1877f2',
  LinkedIn: '#0077b5',
  YouTube: '#ff0000',
  HubSpot: '#ff7a59',
  Livestream: '#3dc4c0',
  Survey: '#2e7d32',
};

export function PlatformChip({ platform }: { platform: string }) {
  return (
    <span
      style={{
        fontSize: 9,
        fontWeight: 700,
        padding: '2px 7px',
        background: CHIP_COLORS[platform] ?? '#79869a',
        color: '#ffffff',
        borderRadius: 2,
        display: 'inline-block',
      }}
    >
      {platform}
    </span>
  );
}

export function GlossaryTable({ entries }: { entries: GlossaryEntry[] }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <DocTable headers={['Term', 'Definition', 'Platform']}>
        {entries.map((entry, i) => (
          <tr key={entry.term} style={{ background: i % 2 === 0 ? '#ffffff' : INK.rowAlt }}>
            <td style={tdStyle(true)}>
              <strong>{entry.term}</strong>
            </td>
            <td style={tdStyle(false)}>
              <span style={{ fontSize: 11, fontFamily: SERIF }}>{entry.definition}</span>
            </td>
            <td style={tdStyle(false)}>
              <PlatformChip platform={entry.platform} />
            </td>
          </tr>
        ))}
      </DocTable>
    </div>
  );
}

export function NumberedList({ items, markerColor }: { items: string[]; markerColor: string }) {
  return (
    <ol style={{ margin: 0, padding: 0, listStyle: 'none' }}>
      {items.map((item, i) => (
        <li key={i} style={{ display: 'flex', gap: 10, marginBottom: 14, fontSize: 11, color: INK.slate, lineHeight: 1.65, fontFamily: SERIF }}>
          <span style={{ fontSize: 10, fontWeight: 700, color: markerColor, minWidth: 18, flexShrink: 0, paddingTop: 1, fontFamily: SANS }}>{i + 1}.</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}
