/**
 * Content model mirroring the live CHM platform's information
 * architecture: therapeutic areas, biomarker playlists, the KOL
 * network and the live/webinar schedule.
 */

export type Area = {
  slug: string;
  label: string;
  blurb: string;
  playlists: number;
  clips: number;
  live: boolean;
};

export type Playlist = {
  slug: string;
  label: string;
  area: string;
  count: number;
  blurb: string;
  cover: string;
  faculty: string[];
};

export type Kol = {
  slug: string;
  name: string;
  title: string;
  state: string;
  institution: string;
  summary: string;
  photo?: string;
  isNew?: boolean;
};

export type Session = {
  slug: string;
  title: string;
  faculty: string;
  date: string;
  time: string;
  duration: string;
  status: "upcoming" | "past";
  area: string;
};

export const areas: Area[] = [
  {
    slug: "breast-cancer",
    label: "Breast Cancer",
    blurb: "HER2+, HR+/HER2-, and triple-negative. ADCs, endocrine sequencing and toxicity management.",
    playlists: 6,
    clips: 84,
    live: true,
  },
  {
    slug: "lung-cancer",
    label: "Lung Cancer",
    blurb: "Driver mutations, perioperative immunotherapy and what to test for at progression.",
    playlists: 3,
    clips: 31,
    live: true,
  },
  {
    slug: "weight-loss",
    label: "Weight Loss",
    blurb: "GLP-1 therapy, cardiometabolic risk and the counselling conversations around both.",
    playlists: 2,
    clips: 18,
    live: false,
  },
];

export const playlists: Playlist[] = [
  {
    slug: "her2",
    label: "HER2+",
    area: "breast-cancer",
    count: 12,
    blurb: "First-line sequencing, residual disease and the DESTINY-Breast readouts read side by side.",
    cover: "/img/thumb-cleopatra.jpg",
    faculty: ["Rena Callahan", "Aditya Bardia", "Mabel Mardones"],
  },
  {
    slug: "hr",
    label: "HR+",
    area: "breast-cancer",
    count: 12,
    blurb: "Endocrine sequencing after CDK4/6i, the PI3K/AKT pathway and proactive toxicity management.",
    cover: "/img/thumb-db09.jpg",
    faculty: ["Ursa Brown-Glaberman", "Karthik Giridhar", "Nusayba Bagegni"],
  },
  {
    slug: "residual-disease",
    label: "Residual disease",
    area: "breast-cancer",
    count: 8,
    blurb: "Who needs adjuvant therapy after neoadjuvant treatment, and how the decision gets made.",
    cover: "/img/thumb-patina.jpg",
    faculty: ["Abi Siva", "Carey Anders", "Joyce O’Shaughnessy"],
  },
  {
    slug: "ild-safety",
    label: "ILD & safety",
    area: "breast-cancer",
    count: 7,
    blurb: "Early detection, monitoring cadence and the dose decisions that keep patients on therapy.",
    cover: "/img/thumb-ild.jpg",
    faculty: ["Amy Krie", "Anne O’Dea"],
  },
];

/* Drawn from the live KOL directory: 39 profiles, faceted by
   state and institution. */
export const kols: Kol[] = [
  { slug: "aditya-bardia", name: "Dr. Aditya Bardia", title: "Professor of Medicine", state: "California", institution: "UCLA Health", summary: "A trialist who led the development of Trodelvy and several endocrine resistance therapies.", isNew: true },
  { slug: "irene-kang", name: "Dr. Irene Kang", title: "Medical Director, Women's Health Medical Oncology", state: "California", institution: "UCSF", summary: "Specialises in molecular profiling and improving long-term survivorship and toxicity management." },
  { slug: "kelly-mccann", name: "Dr. Kelly McCann", title: "Assistant Clinical Professor, Hematology/Oncology", state: "California", institution: "UCLA Health", summary: "A physician-scientist in the Slamon Lab specialising in DNA repair pathways and PARP inhibitor research." },
  { slug: "mark-pegram", name: "Dr. Mark Pegram", title: "Associate Director of Clinical Research", state: "California", institution: "Stanford Medicine", summary: "A pioneer of HER2-targeted therapy whose work was instrumental in the approval of Herceptin.", photo: "/img/faculty-pegram.jpg" },
  { slug: "hope-rugo", name: "Dr. Hope Rugo", title: "Director, Women's Cancers Program", state: "California", institution: "Tufts University", summary: "A global authority on TNBC and clinical trial safety." },
  { slug: "mabel-mardones", name: "Dr. Mabel Mardones", title: "Breast Medical Oncologist Partner", state: "Colorado", institution: "Rocky Mountain Cancer Centers", summary: "Board-certified in medical oncology and hematology with sub-specialty expertise across breast cancer subtypes.", photo: "/img/faculty-mardones.jpg" },
  { slug: "ian-krop", name: "Dr. Ian Krop", title: "Chief Clinical Research Officer", state: "Connecticut", institution: "Yale School of Medicine", summary: "A trialist whose research led to the approval of most major HER2-targeted therapies of the last fifteen years." },
  { slug: "maryam-lustberg", name: "Dr. Maryam Lustberg", title: "Director, Center for Breast Cancer at Smilow", state: "Connecticut", institution: "Yale School of Medicine", summary: "An expert in supportive care and patient-reported outcomes, focused on reducing treatment toxicities." },
  { slug: "martin-dietrich", name: "Dr. Martin Dietrich", title: "Medical Oncologist", state: "Florida", institution: "Cancer Care Centers of Brevard", summary: "Dual doctorates in cancer biology and molecular genetics. A principal investigator across thoracic trials.", isNew: true },
  { slug: "vk-gadi", name: "Dr. VK Gadi", title: "Deputy Director, UI Cancer Center", state: "Illinois", institution: "University of Illinois", summary: "Translational researcher working on microchimerism and treatment response prediction." },
  { slug: "amy-krie", name: "Dr. Amy Krie", title: "Breast Medical Oncologist", state: "South Dakota", institution: "Avera Cancer Institute", summary: "Focused on toxicity management and keeping patients on therapy through the full course.", photo: "/img/faculty-krie.jpg" },
  { slug: "anne-odea", name: "Dr. Anne O’Dea", title: "Associate Professor, Medical Oncology", state: "Kansas", institution: "KU Cancer Center", summary: "A clinical trialist with a teaching practice, bringing the eligibility lens to every case discussion.", photo: "/img/faculty-odea.jpg" },
  { slug: "carol-tweed", name: "Dr. Carol Tweed", title: "Medical Oncologist", state: "Maryland", institution: "Maryland Oncology Hematology", summary: "A community practice oncologist translating registrational data into clinic-ready decisions.", photo: "/img/faculty-tweed.jpg" },
];

export const sessions: Session[] = [
  { slug: "db11-in-practice", title: "Implementing DESTINY-Breast11 in practice", faculty: "Drs. Callahan & Bardia", date: "2026-09-04", time: "4:00 PM ET", duration: "45 min", status: "upcoming", area: "breast-cancer" },
  { slug: "akt-pathway-2l", title: "Managing the AKT pathway in second-line mBC", faculty: "Drs. Brown-Glaberman & Giridhar", date: "2026-09-11", time: "12:00 PM ET", duration: "1h", status: "upcoming", area: "breast-cancer" },
  { slug: "perioperative-nsclc", title: "Perioperative immunotherapy in resectable NSCLC", faculty: "Dr. Martin Dietrich", date: "2026-09-18", time: "3:00 PM ET", duration: "45 min", status: "upcoming", area: "lung-cancer" },
  { slug: "residual-disease-panel", title: "Who needs adjuvant T-DXd after residual disease", faculty: "Drs. Siva & Anders", date: "2026-08-21", time: "4:25 PM ET", duration: "1h", status: "past", area: "breast-cancer" },
  { slug: "biomarker-testing", title: "Biomarker testing in HR+ mBC", faculty: "Drs. Brown-Glaberman & Giridhar", date: "2026-08-14", time: "11:00 AM ET", duration: "1h", status: "past", area: "breast-cancer" },
  { slug: "dato-vs-sacituzumab", title: "Datopotamab deruxtecan vs sacituzumab govitecan", faculty: "Drs. Gradishar & Traina", date: "2026-07-30", time: "4:00 PM ET", duration: "45 min", status: "past", area: "breast-cancer" },
];

export const audiences = [
  { label: "HCPs", blurb: "Beyond conferences and CME, where they actually consume content." },
  { label: "Patients", blurb: "Pre- or active treatment, searching for credible information." },
  { label: "Caregivers", blurb: "Making decisions, seeking guidance, needing support." },
];

export const capabilities = [
  { title: "AI-powered content automation", body: "One recording becomes long-form video, an audio cut, a written explainer and a set of short clips, without a second production day." },
  { title: "Multi-audience reach", body: "The same clinical conversation, versioned for HCPs, patients and caregivers, each on the surface they already use." },
  { title: "Entertainment-grade distribution", body: "Published where attention already is, not parked behind a portal login nobody returns to." },
  { title: "First-party HCP intelligence", body: "Who watched, how far they got, and which specialty they practise in. Consented and first-party." },
  { title: "Real engagement analytics", body: "Completion rate and post-test pass rate, reported monthly. Not impressions." },
];

export const areaBySlug = (slug: string) => areas.find((a) => a.slug === slug);
export const playlistsByArea = (slug: string) => playlists.filter((p) => p.area === slug);
export const kolStates = () => [...new Set(kols.map((k) => k.state))].sort();
export const kolInstitutions = () => [...new Set(kols.map((k) => k.institution))].sort();
export const upcoming = () => sessions.filter((s) => s.status === "upcoming");
export const past = () => sessions.filter((s) => s.status === "past");

export const prettyDay = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });

/* ── consolidated from the marketing site ────────────────── */

export type Show = {
  slug: string;
  title: string;
  tagline: string;
  hosts: string;
  episodes: number;
  tone: string;      // CSS custom-property colour for the show
  cover: string;
  spanish?: boolean;
};

export type Article = {
  slug: string;
  title: string;
  dek: string;
  kicker: string;
  read: string;
  date: string;
};

export type Biomarker = { slug: string; label: string; count: number };

export const shows: Show[] = [
  {
    slug: "breast-friends",
    title: "The Breast Friends Podcast",
    tagline: "Breaking the status quo in breast cancer care",
    hosts: "With Dr. Hope Rugo and guests",
    episodes: 6,
    tone: "var(--color-breast)",
    cover: "/img/cells-warm.jpg",
  },
  {
    slug: "cancer-unfiltered",
    title: "Cancer Unfiltered",
    tagline: "Shifting paradigms, argued in public",
    hosts: "Drs. Komal Jhaveri & Neil Iyengar",
    episodes: 4,
    tone: "var(--color-signature)",
    cover: "/img/cells-blue.jpg",
  },
  {
    slug: "big-c-energy",
    title: "Big C Energy",
    tagline: "Cancer, from the people who lived it",
    hosts: "Patient and public voices",
    episodes: 4,
    tone: "var(--color-cta)",
    cover: "/img/thumb-patina.jpg",
  },
  {
    slug: "tetalks",
    title: "TeTalks",
    tagline: "Oncología en español",
    hosts: "Dras. Marcela Mazo Canola y Ana Sandoval León",
    episodes: 2,
    tone: "var(--color-lung)",
    cover: "/img/thumb-db09.jpg",
    spanish: true,
  },
];

export const articles: Article[] = [
  {
    slug: "neratinib-revisited",
    kicker: "Perspective",
    title: "Neratinib revisited: time to reconsider an underused therapy?",
    dek: "Recurrence remains a clinically important challenge in high-risk HER2-positive early breast cancer. What the extended adjuvant data still supports.",
    read: "7 min",
    date: "2026-08-22",
  },
  {
    slug: "gedatolisib-approval",
    kicker: "Regulatory",
    title: "FDA approves gedatolisib for HR+/HER2- PIK3CA wild-type advanced breast cancer",
    dek: "Approved in combination with fulvestrant. What the label covers, and which patients it actually changes the plan for.",
    read: "5 min",
    date: "2026-08-19",
  },
  {
    slug: "trodelvy-1l-tnbc",
    kicker: "Regulatory",
    title: "Trodelvy gains first-line approval in metastatic triple-negative breast cancer",
    dek: "Expanding options in a setting that has had few. Where it sits against the current first-line standard.",
    read: "6 min",
    date: "2026-08-15",
  },
  {
    slug: "orserdu-combination",
    kicker: "Data",
    title: "New combination data in ESR1-mutated metastatic breast cancer",
    dek: "Hormone receptor-positive treatment is increasingly a combination question. What the latest readout adds.",
    read: "6 min",
    date: "2026-08-11",
  },
];

export const biomarkers: Biomarker[] = [
  { slug: "her2", label: "HER2+", count: 12 },
  { slug: "hr", label: "HR+", count: 12 },
  { slug: "her2-low", label: "HER2-Low / Ultra-Low", count: 9 },
  { slug: "triple-negative", label: "Triple Negative", count: 11 },
  { slug: "high-risk", label: "High Risk", count: 7 },
];

/* Disease states per the design brief: six at launch. */
export const diseaseAreas = [
  { slug: "breast", label: "Breast", tone: "var(--color-breast)", live: true },
  { slug: "lung", label: "Lung", tone: "var(--color-lung)", live: true },
  { slug: "gi", label: "GI", tone: "var(--color-gi)", live: true },
  { slug: "gu", label: "GU", tone: "var(--color-gu)", live: true },
  { slug: "hematology", label: "Hematology", tone: "var(--color-heme)", live: false },
  { slug: "gynecologic", label: "Gynecologic", tone: "var(--color-gyn)", live: false },
];

export const podcastPlatforms = [
  "Apple Podcasts", "Spotify", "Amazon Music", "iHeartRadio", "Castbox", "Goodpods", "Pocket Casts",
];

export const showBySlug = (slug: string) => shows.find((s) => s.slug === slug);
