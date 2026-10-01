/** Optional MediaHub / NPPES-style enrichment (mock today; replace with API later). */
export type KolIntel = {
  npi?: string;
  /** MediaHub catalogue doctor slug: use when KOL `id` does not match the catalog doctors list */
  catalogDoctorSlug?: string;
  /** Twitter-style handle, e.g. @NameInstitution */
  handle?: string;
  specialty?: string;
  location?: string;
  phone?: string;
  email?: string;
  affiliation?: string;
  rosterOnly?: boolean;
  bannerImageUrl?: string;
  linkedInUrl?: string;
  twitterUrl?: string;
  webUrl?: string;
  openPayments?: { total: number; records: number; years: string };
  publicationsApprox?: number;
  awards?: string[];
  researchHighlights?: string;
  aiBrief?: { whoTheyAre?: string; focus?: string; chmContext?: string };
};

export type DolEntry = {
  id: string;
  name: string;
  role: string;
  bio: string;
  education: string;
  /** Curated specialty from Content Hub. */
  specialty?: string;
  /** US state code (e.g. NY) when known */
  stateCode?: string;
  /** Primary institution for directory cards */
  institution?: string;
  isNew?: boolean;
  /** ISO date when the entry was added; used to auto-expire the "New" badge after 7 days */
  addedAt?: string;
  /** Content Hub headshot; undefined renders initials. */
  photoUrl?: string;
  /** From MediaHub kol_group_member count (videos this KOL appears in) */
  shootCount?: number;
  /** SCRUM-70: curator-marked as featured: pinned to the top of DolNetwork. */
  featured?: boolean;
  /** SCRUM-70: manual sort weight; lower first, null last. */
  displayOrder?: number | null;
  intel?: KolIntel;
};

export type DolRegion = {
  id: string;
  title: string;
  subtitle?: string;
  entries: DolEntry[];
};

/** Education is not stored in Content Hub, so it lives here. Every entry was
 * checked against the doctor's institutional profile (2026-09-23). */
export type KolStaticEntry = Pick<DolEntry, 'id' | 'name' | 'education'>;

export const kolStaticEnrichment: KolStaticEntry[] = [
  { id: 'bagegni', name: 'Dr. Nusayba Bagegni', education: 'University of Iowa Roy J. and Lucille A. Carver College of Medicine (MD); Washington University / Barnes-Jewish Hospital (Residency & Fellowship).' },
  { id: 'ballinger', name: 'Dr. Tarah Ballinger', education: 'Indiana University (MD); Vanderbilt University (Residency); Indiana University School of Medicine (Fellowship).' },
  { id: 'bardia', name: 'Dr. Aditya Bardia', education: 'AIIMS, New Delhi (MBBS); Mayo Clinic (Residency); Johns Hopkins (Fellowship).' },
  { id: 'birhiray', name: 'Dr. Ruemu Birhiray', education: 'University of Benin, Nigeria (MD); Columbus Hospital / Northwestern University Affiliate (Residency); Johns Hopkins University & National Cancer Institute (Fellowships).' },
  { id: 'brufsky', name: 'Dr. Adam Brufsky', education: 'University of Connecticut (MD/PhD); Brigham and Women\'s (Residency); Dana-Farber (Fellowship).' },
  { id: 'cairo', name: 'Dr. Michelina Cairo', education: 'Yale University (BS); Georgetown University School of Medicine (MD); Baylor College of Medicine (Residency & Fellowship).' },
  { id: 'callahan', name: 'Dr. Rena Callahan', education: 'Yale University (BS); University of Pennsylvania School of Medicine (MD); UCLA (Residency & Fellowship).' },
  { id: 'conlin', name: 'Dr. Alison Conlin', education: 'SUNY College of Medicine (MD); NewYork-Presbyterian Hospital, Columbia/Cornell (Residency); Memorial Sloan Kettering (Fellowship).' },
  { id: 'dietrich', name: 'Dr. Martin Dietrich', education: 'Ruprecht Karl University (MD); German Cancer Research Center, Heidelberg (PhD, Cancer Biology); University of Texas Southwestern (PhD, Molecular Genetics; Residency & T32 NCI Fellowship).' },
  { id: 'gadi', name: 'Dr. VK Gadi', education: 'University of Alabama at Birmingham (MD); University of Washington (Residency); University of Washington / Fred Hutchinson Cancer Center (Fellowship).' },
  { id: 'garrido-castro', name: 'Dr. Ana Garrido-Castro', education: 'Universidad Autónoma de Madrid (MD); Hospital Universitario Vall d\'Hebron (Residency); Dana-Farber (Fellowship).' },
  { id: 'gradishar', name: 'Dr. William Gradishar', education: 'University of Illinois at Chicago College of Medicine (MD); Michael Reese Hospital and Medical Center (Residency); University of Chicago (Fellowship).' },
  { id: 'hamilton', name: 'Dr. Erika Hamilton', education: 'University of North Carolina at Chapel Hill (MD); UNC (Residency, Internal Medicine); Duke University (Fellowship, Hematology/Oncology).' },
  { id: 'iyengar', name: 'Dr. Neil Iyengar', education: 'University of Illinois at Chicago (MD); University of Chicago Medical Center (Residency); Memorial Sloan Kettering (Fellowship).' },
  { id: 'jhaveri', name: 'Dr. Komal Jhaveri', education: 'University of Mumbai (MD); St. Luke\'s-Roosevelt Hospital Center / Columbia University (Residency); Memorial Sloan Kettering (Fellowship).' },
  { id: 'kang', name: 'Dr. Irene Kang', education: 'UCSF (MD); Santa Clara Valley (Residency); USC (Fellowship).' },
  { id: 'krie', name: 'Dr. Amy Krie', education: 'University of Iowa (MD); OHSU (Residency); University of Iowa (Fellowship).' },
  { id: 'krop', name: 'Dr. Ian Krop', education: 'Johns Hopkins (MD/PhD); Johns Hopkins Hospital (Residency); Dana-Farber (Fellowship).' },
  { id: 'kruse', name: 'Dr. Megan Kruse', education: 'Case Western Reserve University (MD); University of Pittsburgh Medical Center (Residency); Cleveland Clinic (Fellowship).' },
  { id: 'lustberg', name: 'Dr. Maryam Lustberg', education: 'University of Maryland (MD); University of Maryland (Residency); The Ohio State University (Fellowship).' },
  { id: 'makhlin', name: 'Dr. Igor Makhlin', education: 'Geisinger Commonwealth School of Medicine (MD); Johns Hopkins Hospital (Residency); University of Pennsylvania Health System (Fellowship).' },
  { id: 'mardones', name: 'Dr. Mabel Mardones', education: 'Southwestern Adventist University (BS); Loma Linda University School of Medicine (MD); University of Utah Hospital (Residency); Baylor University Medical Center (Fellowship, Hematology & Medical Oncology).' },
  { id: 'mcarthur', name: 'Dr. Heather McArthur', education: 'University of Toronto (MD); University of Calgary (Residency); BC Cancer, Vancouver (Fellowship); Memorial Sloan Kettering (Advanced Clinical Research Fellowship).' },
  { id: 'mccann', name: 'Dr. Kelly McCann', education: 'Stanford University (MD/PhD); OHSU (Residency); UCLA (Fellowship).' },
  { id: 'modi', name: 'Dr. Shanu Modi', education: 'University of Alberta (MD); University of Alberta (Residency); Cross Cancer Institute (Medical Oncology Residency); Memorial Sloan Kettering (Fellowship).' },
  { id: 'moscol', name: 'Dr. Giancarlo Moscol', education: 'San Marcos University, Lima (MD); Albert Einstein Healthcare Network, Philadelphia (Residency); UT Southwestern (Fellowship).' },
  { id: 'mouabbi', name: 'Dr. Jason Mouabbi', education: 'St. George\'s University (MD); Ascension St. John Hospital, Detroit (Residency & Fellowship); Baylor College of Medicine (Clinical Instructorship, Breast Cancer).' },
  { id: 'odea', name: 'Dr. Anne O\'Dea', education: 'University of Kansas (MD); KU Medical Center (Residency & Fellowship).' },
  { id: 'oshaughnessy', name: 'Dr. Joyce O\'Shaughnessy', education: 'Yale University (MD); Mass General (Residency); National Cancer Institute (Fellowship).' },
  { id: 'pegram', name: 'Dr. Mark Pegram', education: 'UNC Chapel Hill (MD); UT Southwestern (Residency); UCLA (Fellowship).' },
  { id: 'rao', name: 'Dr. Ruta Rao', education: 'University of Wisconsin School of Medicine and Public Health (MD); University of Illinois College of Medicine at Chicago (Residency); Rush University Medical Center (Fellowship).' },
  { id: 'rimawi', name: 'Dr. Mothaffar Rimawi', education: 'University of Jordan (MD); Baylor College of Medicine (Residency & Fellowship).' },
  { id: 'robson', name: 'Dr. Mark Robson', education: 'Washington and Lee University (BSc); University of Virginia School of Medicine (MD); Walter Reed Army Medical Center (Residency & Fellowship).' },
  { id: 'rugo', name: 'Dr. Hope Rugo', education: 'Tufts University (BS); University of Pennsylvania (MD); UCSF (Residency & Fellowship).' },
  { id: 'tarantino', name: 'Dr. Paolo Tarantino', education: 'University of Naples Federico II (MD); European Institute of Oncology / University of Milan (Residency); Dana-Farber (Fellowship).' },
  { id: 'traina', name: 'Dr. Tiffany Traina', education: 'Weill Cornell Medical College (MD); NewYork-Presbyterian/Weill Cornell (Residency); Memorial Sloan Kettering (Fellowship).' },
  { id: 'tweed', name: 'Dr. Carol Tweed', education: 'Duke University (BS); Washington University in St. Louis (MD); University of Pennsylvania (Residency & Fellowship).' },
  { id: 'vidal', name: 'Dr. Gregory Vidal', education: 'Tulane University School of Medicine (MD, PhD); Stanford Hospital & Clinics (Residency); Stanford Hospital & Clinics (Fellowship, Hematology/Oncology).' },
  { id: 'yan', name: 'Dr. Fengting Yan', education: 'Xi\'an Medical University (MD); Ohio State (Residency); University of Washington / Fred Hutch (Fellowship).' },
];
