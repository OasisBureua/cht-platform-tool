/**
 * Response types for admin KOL intel deep-dive endpoints.
 *
 * These mirror Content Hub's `schemas/admin_kol_intel.py`
 * (EngagementSignalsOut, AdminKOLPublicationList, OpenPaymentsOut, TrialsOut,
 * NewsOut) 1:1 so the CHT admin controller can pass responses through
 * unchanged.
 */

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

export interface AdminKolPublication {
  id: string;
  title: string;
  url: string | null;
  journal: string | null;
  published_at: string;
  is_first_author: boolean;
  is_last_author: boolean;
}

export interface AdminKolPublicationList {
  items: AdminKolPublication[];
  total: number;
}

export interface OpenPaymentsSummary {
  total_records: number;
  total_amount_usd: number;
  year_range: string | null;
  top_company: string | null;
  top_company_amount_usd: number;
}

export interface OpenPaymentsRecord {
  record_id: string;
  program_year: number;
  payment_type: string;
  payment_date: string | null;
  amount_usd: number;
  nature_of_payment: string | null;
  company_name: string | null;
  drug_name: string | null;
  drug_normalized: string | null;
}

export interface OpenPayments {
  summary: OpenPaymentsSummary;
  records: OpenPaymentsRecord[];
}

export interface TrialSignal {
  id: string;
  observed_at: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  source: string;
  entities: Record<string, unknown> | null;
}

export interface Trials {
  items: TrialSignal[];
  total: number;
}

export interface NewsArticle {
  id: string;
  observed_at: string;
  title: string | null;
  url: string | null;
  summary: string | null;
  source: string;
  source_name: string | null;
}

export interface News {
  items: NewsArticle[];
  total: number;
}

export type PublicationsQuery = { limit?: number; offset?: number };
export type OpenPaymentsQuery = { limit?: number };
export type TrialsQuery = { limit?: number; offset?: number };
export type NewsQuery = { limit?: number; offset?: number };
