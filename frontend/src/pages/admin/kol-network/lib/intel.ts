// TODO(kol-intel): swap demo data for CHT backend proxy of MediaHub intel endpoints; this interface is the seam.
//
// Type shapes below are copied 1:1 from MediaHub `frontend/src/lib/api.ts`
// (AIBrief / EngagementSignals / HCPSignal / NewsArticle / OpenPaymentsResponse /
// NIHGrantsResponse / RxVolumesByDrug / ShiftsResponse). When the CHT backend
// grows `/kol-network/:slug/*` intel proxies, only the function bodies in
// `intelApi` should change — every consumer types against these interfaces.
//
// Everything returned from this file is REPRESENTATIVE DEMO DATA. Sections
// rendered from it carry a <DemoBadge /> in the UI.

import type {
  KolListParams,
  PublicKol,
  PublicKolList,
  PublicKolPublicationList,
} from '../../../../api/kol-network';

// ─── Types (mirrors MediaHub @/lib/api) ─────────────────────────────────────

export type SignalType =
  | 'publication'
  | 'trial'
  | 'social_post'
  | 'video_upload'
  | 'webinar_attendance'
  | 'news_article'
  | 'clip_appearance';

export interface SignalDrug {
  drug_normalized: string;
  drug_source_term: string;
  source_field: 'mesh' | 'intervention' | 'title_extracted';
}

export interface HCPSignal {
  id: string;
  hcp_npi: string;
  signal_type: SignalType;
  observed_at: string;
  source: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  entities_json: Record<string, unknown> | null;
  drugs: SignalDrug[];
  created_at: string;
  /** For clip_appearance: the full shoot panel. */
  panel?: string[];
}

export interface AIBrief {
  hcp_npi: string;
  brief_markdown: string;
  model_used: string;
  input_signal_count: number;
  input_rx_count: number;
  generated_at: string;
  stale: boolean;
}

export interface EngagementSignals {
  webinars_attended: number;
  webinars_rsvp_only: number;
  questions_asked: number;
  surveys_submitted: number;
  first_attendance_at: string | null;
  last_attendance_at: string | null;
  qa_rate: number | null;
  survey_rate: number | null;
  days_since_last_engagement: number | null;
}

export interface NewsArticle {
  id: string;
  observed_at: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  source_name: string | null;
}

export interface OpenPaymentRecord {
  record_id: string;
  program_year: number;
  payment_type: string;
  payment_date: string | null;
  amount_usd: number | null;
  nature_of_payment: string | null;
  company_name: string | null;
  drug_name: string | null;
  drug_normalized: string | null;
}

export interface OpenPaymentsResponse {
  summary: {
    total_usd: number;
    record_count: number;
    year_range: [number, number] | null;
    by_company: { company: string; total_usd: number; count: number }[];
    by_drug: { drug: string; total_usd: number; count: number }[];
    by_nature: { nature: string; total_usd: number; count: number }[];
  };
  records: OpenPaymentRecord[];
}

export interface NIHGrant {
  appl_id: string;
  project_num: string | null;
  project_title: string | null;
  fiscal_year: number | null;
  award_amount: number | null;
  activity_code: string | null;
  agency_ic: string | null;
  agency_name: string | null;
  organization: string | null;
  is_active: boolean;
  project_end_date: string | null;
}

export interface NIHGrantsResponse {
  summary: {
    total_grants: number;
    active_grants: number;
    total_award_usd: number;
    top_agencies: { agency: string; total_usd: number; count: number }[];
    most_recent_year: number | null;
  };
  grants: NIHGrant[];
}

export interface RxVolumeYear {
  year: number;
  total_claims: number | null;
  total_beneficiaries: number | null;
  total_drug_cost: number | null;
}

export interface RxVolumesByDrug {
  drug_normalized: string;
  brand_name: string | null;
  drug_class: string | null;
  total_claims_all_years: number;
  total_drug_cost_all_years: number | null;
  years: RxVolumeYear[];
}

export interface DrugShift {
  drug_normalized: string;
  brand_name: string | null;
  drug_class: string | null;
  pre_claims: number;
  post_claims: number;
  delta: number;
  pct_lift: number | null;
  has_lift: boolean;
  pre_window_label: string;
  post_window_label: string;
}

export interface ShiftsResponse {
  anchor_source: 'first_attendance' | 'no_anchor';
  shifts: DrugShift[];
}

// ─── Demo roster (directory fallback when the CHT backend is unreachable) ───
//
// The directory + intel pages render this seeded roster when kolNetworkApi
// errors (backend down, or a malformed non-API response on the port). Live
// behavior is unchanged whenever the API responds with a valid payload.
// NOTE: 'amara-osei' carries id 1003031212 — the NPI slot the reviewers use;
// MediaHub's source doesn't reveal the real doctor, so she is invented.

export const DEMO_KOLS: PublicKol[] = [
  {
    id: '1003031212',
    slug: 'amara-osei',
    name: 'Dr. Amara Osei',
    title: 'MD, MPH',
    specialty: 'Breast Medical Oncology',
    institution: 'Memorial Sloan Kettering Cancer Center',
    bio: 'Breast medical oncologist focused on ESR1-mutant, HR+/HER2- metastatic disease. Leads a ctDNA-guided therapy escalation program and co-chairs the precision-medicine tumor board.',
    photo_url: null,
    region: 'northeast',
    region_label: 'Northeast',
    shoot_count: 7,
    first_appeared_at: daysAgo(310),
    is_new: false,
  },
  {
    id: 'demo-kol-2',
    slug: 'daniel-reyes',
    name: 'Dr. Daniel Reyes',
    title: 'MD',
    specialty: 'Hematology / Lymphoma',
    institution: 'MD Anderson Cancer Center',
    bio: 'Lymphoma specialist with trial leadership across bispecific antibodies and CAR-T sequencing in relapsed/refractory DLBCL.',
    photo_url: null,
    region: 'south',
    region_label: 'South',
    shoot_count: 4,
    first_appeared_at: daysAgo(220),
    is_new: false,
  },
  {
    id: 'demo-kol-3',
    slug: 'priya-natarajan',
    name: 'Dr. Priya Natarajan',
    title: 'MD, PhD',
    specialty: 'Thoracic Medical Oncology',
    institution: 'Dana-Farber Cancer Institute',
    bio: 'Physician-scientist in EGFR- and KRAS-driven NSCLC; runs an early-phase program pairing targeted therapy with liquid-biopsy monitoring.',
    photo_url: null,
    region: 'northeast',
    region_label: 'Northeast',
    shoot_count: 2,
    first_appeared_at: daysAgo(120),
    is_new: false,
  },
  {
    id: 'demo-kol-4',
    slug: 'marcus-whitfield',
    name: 'Dr. Marcus Whitfield',
    title: 'MD',
    specialty: 'Genitourinary Oncology',
    institution: 'UCSF Helen Diller Family Comprehensive Cancer Center',
    bio: 'GU oncologist focused on metastatic prostate cancer; frequent community-practice educator on PSMA-targeted radioligand therapy.',
    photo_url: null,
    region: 'west',
    region_label: 'West',
    shoot_count: 5,
    first_appeared_at: daysAgo(400),
    is_new: false,
  },
  {
    id: 'demo-kol-5',
    slug: 'elena-kovac',
    name: 'Dr. Elena Kovac',
    title: 'DO',
    specialty: 'Community Medical Oncology',
    institution: 'Northwestern Medicine Regional Oncology',
    bio: 'Community oncologist bridging academic guidelines and real-world practice; new addition to the CHM KOL network.',
    photo_url: null,
    region: 'midwest',
    region_label: 'Midwest',
    shoot_count: 1,
    first_appeared_at: daysAgo(18),
    is_new: true,
  },
];

/** Client-side equivalent of kolNetworkApi.list over the seeded demo roster. */
export function demoKolList(params?: KolListParams): PublicKolList {
  const q = params?.q?.trim().toLowerCase() ?? '';
  let items = DEMO_KOLS;
  if (params?.region) items = items.filter((k) => k.region === params.region);
  if (params?.institution) items = items.filter((k) => k.institution === params.institution);
  if (params?.new_only) items = items.filter((k) => k.is_new);
  if (q) {
    items = items.filter((k) =>
      [k.name, k.specialty, k.institution, k.title]
        .filter(Boolean)
        .some((v) => (v as string).toLowerCase().includes(q)),
    );
  }
  // Facets always computed from the FULL roster (mirrors backend behavior).
  const regionCounts = new Map<string, { slug: string; label: string; kol_count: number }>();
  for (const k of DEMO_KOLS) {
    if (!k.region) continue;
    const cur = regionCounts.get(k.region) ?? {
      slug: k.region,
      label: k.region_label ?? k.region,
      kol_count: 0,
    };
    cur.kol_count += 1;
    regionCounts.set(k.region, cur);
  }
  const institutions = [...new Set(DEMO_KOLS.map((k) => k.institution).filter(Boolean))] as string[];
  return {
    items,
    total: items.length,
    regions: [...regionCounts.values()].sort((a, b) => a.label.localeCompare(b.label)),
    institutions: institutions.sort(),
  };
}

/** Profile fallback for the intel page. Unknown slugs get a synthesized entry. */
export function demoKolProfile(idOrSlug: string): PublicKol {
  const match = DEMO_KOLS.find((k) => k.slug === idOrSlug || k.id === idOrSlug);
  if (match) return match;
  return { ...DEMO_KOLS[0], id: idOrSlug, slug: idOrSlug };
}

/** Publications fallback (shape of kolNetworkApi.publications). */
export function demoKolPublications(_idOrSlug: string): PublicKolPublicationList {
  const items = [
    {
      title:
        'Elacestrant versus standard endocrine therapy in ESR1-mutant, HR+/HER2- metastatic breast cancer: extended follow-up',
      url: 'https://pubmed.ncbi.nlm.nih.gov/',
      journal: 'Journal of Clinical Oncology',
      published_at: daysAgo(40),
      is_first_author: true,
      is_last_author: false,
    },
    {
      title:
        'ctDNA dynamics as an early endpoint in HR+ metastatic disease: a prospective multicenter cohort',
      url: 'https://pubmed.ncbi.nlm.nih.gov/',
      journal: 'Nature Medicine',
      published_at: daysAgo(150),
      is_first_author: false,
      is_last_author: true,
    },
    {
      title: 'Sequencing CDK4/6 inhibitors after progression: real-world outcomes from a national registry',
      url: 'https://pubmed.ncbi.nlm.nih.gov/',
      journal: 'JAMA Oncology',
      published_at: daysAgo(260),
      is_first_author: false,
      is_last_author: false,
    },
    {
      title: 'Oral SERDs in the adjuvant setting: design of the ongoing phase III trial',
      url: 'https://pubmed.ncbi.nlm.nih.gov/',
      journal: 'The Lancet Oncology',
      published_at: daysAgo(380),
      is_first_author: false,
      is_last_author: true,
    },
    {
      title: 'Disparities in genomic testing uptake across community oncology practices',
      url: 'https://pubmed.ncbi.nlm.nih.gov/',
      journal: 'JCO Oncology Practice',
      published_at: daysAgo(500),
      is_first_author: true,
      is_last_author: false,
    },
  ];
  return { items, total: items.length };
}

// ─── Demo data ──────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
}

const DEMO_RX: RxVolumesByDrug[] = [
  {
    drug_normalized: 'elacestrant',
    brand_name: 'Orserdu',
    drug_class: 'SERD (selective estrogen receptor degrader)',
    total_claims_all_years: 412,
    total_drug_cost_all_years: 1_884_200,
    years: [
      { year: 2023, total_claims: 148, total_beneficiaries: 62, total_drug_cost: 668_400 },
      { year: 2024, total_claims: 264, total_beneficiaries: 101, total_drug_cost: 1_215_800 },
    ],
  },
  {
    drug_normalized: 'palbociclib',
    brand_name: 'Ibrance',
    drug_class: 'CDK4/6 inhibitor',
    total_claims_all_years: 386,
    total_drug_cost_all_years: 4_120_000,
    years: [
      { year: 2023, total_claims: 201, total_beneficiaries: 84, total_drug_cost: 2_144_000 },
      { year: 2024, total_claims: 185, total_beneficiaries: 78, total_drug_cost: 1_976_000 },
    ],
  },
  {
    drug_normalized: 'ribociclib',
    brand_name: 'Kisqali',
    drug_class: 'CDK4/6 inhibitor',
    total_claims_all_years: 259,
    total_drug_cost_all_years: 2_730_000,
    years: [
      { year: 2023, total_claims: 110, total_beneficiaries: 45, total_drug_cost: 1_160_000 },
      { year: 2024, total_claims: 149, total_beneficiaries: 61, total_drug_cost: 1_570_000 },
    ],
  },
  {
    drug_normalized: 'letrozole',
    brand_name: 'Femara',
    drug_class: 'Aromatase inhibitor',
    total_claims_all_years: 244,
    total_drug_cost_all_years: 31_500,
    years: [
      { year: 2023, total_claims: 126, total_beneficiaries: 58, total_drug_cost: 16_400 },
      { year: 2024, total_claims: 118, total_beneficiaries: 55, total_drug_cost: 15_100 },
    ],
  },
  {
    drug_normalized: 'fulvestrant',
    brand_name: 'Faslodex',
    drug_class: 'SERD (selective estrogen receptor degrader)',
    total_claims_all_years: 171,
    total_drug_cost_all_years: 512_000,
    years: [
      { year: 2023, total_claims: 96, total_beneficiaries: 40, total_drug_cost: 288_000 },
      { year: 2024, total_claims: 75, total_beneficiaries: 33, total_drug_cost: 224_000 },
    ],
  },
  {
    drug_normalized: 'anastrozole',
    brand_name: 'Arimidex',
    drug_class: 'Aromatase inhibitor',
    total_claims_all_years: 158,
    total_drug_cost_all_years: 18_900,
    years: [
      { year: 2023, total_claims: 82, total_beneficiaries: 39, total_drug_cost: 9_800 },
      { year: 2024, total_claims: 76, total_beneficiaries: 36, total_drug_cost: 9_100 },
    ],
  },
];

const DEMO_SHIFTS: ShiftsResponse = {
  anchor_source: 'first_attendance',
  shifts: [
    {
      drug_normalized: 'elacestrant',
      brand_name: 'Orserdu',
      drug_class: 'SERD (selective estrogen receptor degrader)',
      pre_claims: 148,
      post_claims: 264,
      delta: 116,
      pct_lift: 78,
      has_lift: true,
      pre_window_label: '2023',
      post_window_label: '2024',
    },
    {
      drug_normalized: 'ribociclib',
      brand_name: 'Kisqali',
      drug_class: 'CDK4/6 inhibitor',
      pre_claims: 110,
      post_claims: 149,
      delta: 39,
      pct_lift: 35,
      has_lift: true,
      pre_window_label: '2023',
      post_window_label: '2024',
    },
    {
      drug_normalized: 'palbociclib',
      brand_name: 'Ibrance',
      drug_class: 'CDK4/6 inhibitor',
      pre_claims: 201,
      post_claims: 185,
      delta: -16,
      pct_lift: -8,
      has_lift: false,
      pre_window_label: '2023',
      post_window_label: '2024',
    },
  ],
};

const DEMO_ENGAGEMENT: EngagementSignals = {
  webinars_attended: 6,
  webinars_rsvp_only: 2,
  questions_asked: 3,
  surveys_submitted: 1,
  first_attendance_at: daysAgo(310),
  last_attendance_at: daysAgo(12),
  qa_rate: 0.5,
  survey_rate: 0.17,
  days_since_last_engagement: 12,
};

function demoTimeline(slug: string): HCPSignal[] {
  const drug = (d: string, term = d): SignalDrug => ({
    drug_normalized: d,
    drug_source_term: term,
    source_field: 'title_extracted',
  });
  return [
    {
      id: `${slug}-eng-1`,
      hcp_npi: slug,
      signal_type: 'webinar_attendance',
      observed_at: daysAgo(12),
      source: 'chm_events',
      title: 'ESR1 Mutations in HR+/HER2- Metastatic Breast Cancer: Sequencing After CDK4/6',
      url: null,
      summary: null,
      entities_json: { asked_question: true },
      drugs: [drug('elacestrant'), drug('fulvestrant')],
      created_at: daysAgo(12),
    },
    {
      id: `${slug}-eng-2`,
      hcp_npi: slug,
      signal_type: 'clip_appearance',
      observed_at: daysAgo(45),
      source: 'chm_content',
      title: 'CHM Oncology Roundtable',
      url: null,
      summary: null,
      entities_json: {},
      drugs: [drug('ribociclib')],
      created_at: daysAgo(45),
      panel: ['Dr. A. Rivera', 'Dr. S. Cheng'],
    },
    {
      id: `${slug}-eng-3`,
      hcp_npi: slug,
      signal_type: 'webinar_attendance',
      observed_at: daysAgo(88),
      source: 'chm_events',
      title: 'Adjuvant CDK4/6 Inhibition: NATALEE and monarchE in Practice',
      url: null,
      summary: null,
      entities_json: { asked_question: false },
      drugs: [drug('ribociclib'), drug('abemaciclib')],
      created_at: daysAgo(88),
    },
    {
      id: `${slug}-eng-4`,
      hcp_npi: slug,
      signal_type: 'webinar_attendance',
      observed_at: daysAgo(170),
      source: 'chm_events',
      title: 'Oral SERDs Beyond Elacestrant: What the Pipeline Means for Community Practice',
      url: null,
      summary: null,
      entities_json: { asked_question: true },
      drugs: [drug('elacestrant')],
      created_at: daysAgo(170),
    },
  ];
}

function demoTrials(slug: string): HCPSignal[] {
  return [
    {
      id: `${slug}-trial-1`,
      hcp_npi: slug,
      signal_type: 'trial',
      observed_at: daysAgo(30),
      source: 'clinicaltrials',
      title:
        'Phase II Study of Elacestrant Plus Abemaciclib in ESR1-Mutant HR+ Metastatic Breast Cancer',
      url: 'https://clinicaltrials.gov/',
      summary: null,
      entities_json: null,
      drugs: [
        {
          drug_normalized: 'elacestrant',
          drug_source_term: 'elacestrant',
          source_field: 'intervention',
        },
      ],
      created_at: daysAgo(30),
    },
    {
      id: `${slug}-trial-2`,
      hcp_npi: slug,
      signal_type: 'trial',
      observed_at: daysAgo(140),
      source: 'clinicaltrials',
      title: 'Circulating Tumor DNA-Guided Therapy Escalation in Early HR+ Breast Cancer',
      url: 'https://clinicaltrials.gov/',
      summary: null,
      entities_json: null,
      drugs: [],
      created_at: daysAgo(140),
    },
  ];
}

const DEMO_NIH: NIHGrantsResponse = {
  summary: {
    total_grants: 3,
    active_grants: 1,
    total_award_usd: 2_814_602,
    top_agencies: [
      { agency: 'NCI', total_usd: 2_402_310, count: 2 },
      { agency: 'NIGMS', total_usd: 412_292, count: 1 },
    ],
    most_recent_year: 2025,
  },
  grants: [
    {
      appl_id: '10894215',
      project_num: 'R01CA278442',
      project_title:
        'Mechanisms of Endocrine Resistance in ESR1-Mutant Breast Cancer',
      fiscal_year: 2025,
      award_amount: 1_487_210,
      activity_code: 'R01',
      agency_ic: 'NCI',
      agency_name: 'National Cancer Institute',
      organization: 'Demo University Medical Center',
      is_active: true,
      project_end_date: '2028-06-30',
    },
    {
      appl_id: '10412877',
      project_num: 'R21CA254108',
      project_title: 'ctDNA Dynamics as an Early Endpoint in HR+ Metastatic Disease',
      fiscal_year: 2023,
      award_amount: 915_100,
      activity_code: 'R21',
      agency_ic: 'NCI',
      agency_name: 'National Cancer Institute',
      organization: 'Demo University Medical Center',
      is_active: false,
      project_end_date: '2024-08-31',
    },
    {
      appl_id: '10098453',
      project_num: 'T32GM007281',
      project_title: 'Clinical Pharmacology Training Program',
      fiscal_year: 2021,
      award_amount: 412_292,
      activity_code: 'T32',
      agency_ic: 'NIGMS',
      agency_name: 'National Institute of General Medical Sciences',
      organization: 'Demo University Medical Center',
      is_active: false,
      project_end_date: '2022-06-30',
    },
  ],
};

const DEMO_PAYMENTS: OpenPaymentsResponse = {
  summary: {
    total_usd: 148_720,
    record_count: 94,
    year_range: [2022, 2024],
    by_company: [
      { company: 'Stemline Therapeutics, Inc.', total_usd: 61_240, count: 22 },
      { company: 'Novartis Pharmaceuticals Corporation', total_usd: 38_410, count: 25 },
      { company: 'Pfizer Inc.', total_usd: 24_980, count: 19 },
      { company: 'AstraZeneca Pharmaceuticals LP', total_usd: 15_670, count: 16 },
      { company: 'Eli Lilly and Company', total_usd: 8_420, count: 12 },
    ],
    by_drug: [
      { drug: 'Orserdu', total_usd: 58_900, count: 20 },
      { drug: 'Kisqali', total_usd: 33_100, count: 21 },
      { drug: 'Ibrance', total_usd: 21_400, count: 15 },
      { drug: 'Verzenio', total_usd: 7_950, count: 9 },
      { drug: '(not specified)', total_usd: 27_370, count: 29 },
    ],
    by_nature: [
      { nature: 'Consulting Fee', total_usd: 74_500, count: 14 },
      { nature: 'Compensation for services (speaker)', total_usd: 52_300, count: 11 },
      { nature: 'Travel and Lodging', total_usd: 12_840, count: 21 },
      { nature: 'Food and Beverage', total_usd: 9_080, count: 48 },
    ],
  },
  records: [],
};

function demoNews(name: string): NewsArticle[] {
  return [
    {
      id: 'news-1',
      observed_at: daysAgo(6),
      title: `${name} discusses ESR1-mutation testing gaps in community oncology`,
      url: 'https://news.google.com/',
      summary: null,
      source_name: 'OncLive',
    },
    {
      id: 'news-2',
      observed_at: daysAgo(21),
      title: 'SABCS 2025: Oral SERD combinations headline late-breaking abstracts',
      url: 'https://news.google.com/',
      summary: null,
      source_name: 'Targeted Oncology',
    },
    {
      id: 'news-3',
      observed_at: daysAgo(54),
      title: `Institution spotlight: precision-medicine tumor board expands, ${name} named co-chair`,
      url: 'https://news.google.com/',
      summary: null,
      source_name: 'Healio',
    },
    {
      id: 'news-4',
      observed_at: daysAgo(97),
      title: 'CDK4/6 sequencing debate continues after post-MONARCH data readout',
      url: 'https://news.google.com/',
      summary: null,
      source_name: 'Medscape',
    },
  ];
}

function demoBrief(slug: string, name: string): AIBrief {
  return {
    hcp_npi: slug,
    brief_markdown: [
      '## Who they are',
      `**${name}** is a breast-cancer-focused medical oncologist with an active research footprint in **ESR1-mutant, HR+/HER2- disease**. Publication and trial activity clusters around oral SERDs and CDK4/6 sequencing, with NIH funding (R01, NCI) anchoring the lab side.`,
      '',
      '## Why they matter to CHM',
      'High engagement signal: repeat webinar attendance with an above-average *Q&A rate*, plus a CHM shoot appearance. Prescribing profile (CMS Part D) shows a **+78% year-over-year lift in elacestrant claims** following first CHM attendance — a strong attribution story for pharma partners in the SERD category.',
      '',
      '## Suggested engagement angle',
      'Invite to panel on **post-CDK4/6 sequencing**; their trial work and Orserdu consulting history (Open Payments) make them credible to both academic and community audiences. Avoid overlapping topics with their existing speaker-bureau commitments.',
    ].join('\n'),
    model_used: 'claude-sonnet (demo)',
    input_signal_count: 42,
    input_rx_count: 6,
    generated_at: new Date().toISOString(),
    stale: false,
  };
}

// ─── Client seam ────────────────────────────────────────────────────────────
//
// Same call surface the page will keep when these become real HTTP calls.
// Each function is async so swapping in axios later is a body-only change.

export const intelApi = {
  getAIBrief: async (slug: string, name: string): Promise<AIBrief> => demoBrief(slug, name),

  regenerateAIBrief: async (slug: string, name: string): Promise<AIBrief> => {
    // Simulate generation latency so the Regenerate spinner is visible.
    await new Promise((r) => setTimeout(r, 900));
    return demoBrief(slug, name);
  },

  getEngagement: async (_slug: string): Promise<EngagementSignals> => DEMO_ENGAGEMENT,

  getEngagementTimeline: async (slug: string): Promise<HCPSignal[]> => demoTimeline(slug),

  getTrialSignals: async (slug: string): Promise<HCPSignal[]> => demoTrials(slug),

  getRxHistory: async (_slug: string): Promise<RxVolumesByDrug[]> => DEMO_RX,

  getShifts: async (_slug: string): Promise<ShiftsResponse> => DEMO_SHIFTS,

  getOpenPayments: async (_slug: string): Promise<OpenPaymentsResponse> => DEMO_PAYMENTS,

  getNihGrants: async (_slug: string): Promise<NIHGrantsResponse> => DEMO_NIH,

  getNews: async (_slug: string, name: string): Promise<NewsArticle[]> => demoNews(name),
};
