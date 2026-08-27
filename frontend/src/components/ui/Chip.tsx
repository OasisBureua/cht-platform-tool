import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '../../lib/cn';

/**
 * Taxonomy labels. Colour is by kind, not per tag, so the scheme holds
 * as the vocabulary grows: where the disease sits, what is being given,
 * in which setting.
 *
 * A bright fill always takes the fixed dark label, because the fill is
 * bright in both appearances while the text colour would otherwise flip
 * to white and disappear.
 */
export type ChipKind = 'site' | 'agent' | 'setting' | 'neutral';

const FILL: Record<ChipKind, string> = {
  site: 'bg-cerebral-pink text-cerebral-on-bright',
  agent: 'bg-cerebral-cyan text-cerebral-on-bright',
  setting: 'bg-cerebral-purple text-cerebral-on-bright',
  neutral: 'bg-muted text-muted-foreground',
};

export function Chip({
  children,
  kind = 'neutral',
  to,
  className,
}: {
  children: ReactNode;
  kind?: ChipKind;
  to?: string;
  className?: string;
}) {
  const classes = cn(
    'inline-flex h-7 items-center rounded-[6px] px-2.5 text-xs font-medium',
    FILL[kind],
    to &&
      'shadow-card transition-[filter,scale] duration-150 hover:brightness-[0.94] motion-safe:active:scale-[0.96] ' +
        'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
    className,
  );
  return to ? (
    <Link to={to} className={classes}>
      {children}
    </Link>
  ) : (
    <span className={classes}>{children}</span>
  );
}

const SITE = new Set(['Ovarian','Bladder','CRC','NSCLC','Gastric','Endometrial','Prostate','Myeloma','Lymphoma','mHSPC']);
const AGENT = new Set(['PARP','T-DXd','HER2','HER2+','HR+','EGFR','KRAS','MSI','MMR','ADC','CAR-T','Bispecifics']);

/** Classifies a raw tag string so callers do not each invent a mapping. */
export function chipKind(tag: string): ChipKind {
  if (SITE.has(tag)) return 'site';
  if (AGENT.has(tag)) return 'agent';
  return 'setting';
}
