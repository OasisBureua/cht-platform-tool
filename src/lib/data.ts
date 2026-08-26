export type Format = "video" | "podcast" | "editorial";

export type Faculty = {
  slug: string;
  name: string;
  org: string;
  photo: string;
  role: string;
  bio: string;
  focus: string[];
};

export type DiseaseState = {
  slug: string;
  label: string;
  full: string;
  blurb: string;
  live: boolean;
};

export type Series = {
  slug: string;
  title: string;
  kicker: string;
  disease: string;
  faculty: string;
  episodes: number;
  isNew?: boolean;
  cover: string;
  summary: string;
};

export type Item = {
  slug: string;
  format: Format;
  title: string;
  dek: string;
  faculty: string[];
  disease: string;
  series?: string;
  show?: string;
  duration: string;
  published: string;
  thumb: string;
  chapters?: { time: string; label: string }[];
  body?: string[];
  tags: string[];
  views: string;
};

export type Show = {
  slug: string;
  title: string;
  tagline: string;
  episodes: number;
  cover: string;
  tint: "sky" | "cream" | "mist" | "page";
  about: string;
  host: string;
};

export const faculty: Faculty[] = [
  {
    slug: "joshua-elmore",
    name: "Dr. Joshua Elmore",
    org: "Community Health Media",
    photo: "/img/faculty-pegram.jpg",
    role: "Contributing editor",
    bio:
      "Writes CHM's evidence reviews, working through the trial record on a single question at a time rather than summarising a meeting.",
    focus: ["HER2+", "Early breast cancer", "Toxicity management"],
  },
  {
    slug: "mark-pegram",
    name: "Dr. Mark Pegram",
    org: "Stanford Medicine",
    role: "Professor of Medicine, Oncology",
    photo: "/img/faculty-pegram.jpg",
    bio: "Translational researcher whose work on HER2-directed therapy shaped first-line practice. Leads CHM sessions on sequencing and mechanism.",
    focus: ["HER2+ mBC", "ADCs", "Trial design"],
  },
  {
    slug: "carol-tweed",
    name: "Dr. Carol Tweed",
    org: "Maryland Oncology",
    role: "Medical Oncologist",
    photo: "/img/faculty-tweed.jpg",
    bio: "Community practice oncologist translating registrational data into clinic-ready decisions. Hosts The Evidence Room.",
    focus: ["Breast", "Community practice", "Maintenance"],
  },
  {
    slug: "amy-krie",
    name: "Dr. Amy Krie",
    org: "Avera Cancer",
    role: "Breast Medical Oncologist",
    photo: "/img/faculty-krie.jpg",
    bio: "Focused on toxicity management and keeping patients on therapy. Her ILD monitoring session is CHM's most-completed.",
    focus: ["T-DXd safety", "ILD", "Supportive care"],
  },
  {
    slug: "mabel-mardones",
    name: "Dr. Mabel Mardones",
    org: "Rocky Mountain",
    role: "Medical Oncologist",
    photo: "/img/faculty-mardones.jpg",
    bio: "Runs CHM's maintenance-therapy track. Known for framing evidence around what actually changes on Monday morning.",
    focus: ["Maintenance", "PATINA", "HER2CLIMB"],
  },
  {
    slug: "anne-odea",
    name: "Dr. Anne O’Dea",
    org: "KU Cancer Center",
    role: "Associate Professor, Medical Oncology",
    photo: "/img/faculty-odea.jpg",
    bio: "Clinical trialist with a teaching practice. Brings the trial-eligibility lens to every CHM case discussion.",
    focus: ["Early-stage", "Trial eligibility", "Neoadjuvant"],
  },
];

export const diseaseStates: DiseaseState[] = [
  { slug: "breast", label: "Breast", full: "Breast cancer", blurb: "HER2+, HR+/HER2-, TNBC. Sequencing, ADCs and toxicity management.", live: true },
  { slug: "lung", label: "Lung", full: "Thoracic oncology", blurb: "EGFR, ALK, KRAS and the perioperative immunotherapy question.", live: true },
  { slug: "gi", label: "GI", full: "Gastrointestinal", blurb: "Colorectal, gastric and hepatobiliary. Biomarker-first decisions.", live: true },
  { slug: "gu", label: "GU", full: "Genitourinary", blurb: "Prostate, bladder and renal. Doublets, triplets and sequencing.", live: true },
  { slug: "hematology", label: "Hematology", full: "Hematologic malignancy", blurb: "Myeloma, lymphoma and leukemia. Bispecifics and CAR-T logistics.", live: true },
  { slug: "gynecologic", label: "Gynecologic", full: "Gynecologic oncology", blurb: "Ovarian, endometrial and cervical. PARP, IO and ADC data.", live: true },
];

export const series: Series[] = [
  {
    slug: "beyond-cleopatra",
    title: "Beyond CLEOPATRA",
    kicker: "HER2+ mBC first line",
    disease: "breast",
    faculty: "mark-pegram",
    episodes: 6,
    isNew: true,
    cover: "/img/faculty-pegram.jpg",
    summary:
      "Six sessions on what replaces the CLEOPATRA standard, and on the patients for whom it still holds.",
  },
  {
    slug: "a-decade-of-change",
    title: "A Decade of Change",
    kicker: "CLEOPATRA to DB09",
    disease: "breast",
    faculty: "carol-tweed",
    episodes: 8,
    cover: "/img/faculty-tweed.jpg",
    summary:
      "Ten years of HER2 data, read as one arc. What each readout actually moved, and what it did not.",
  },
  {
    slug: "ild-safety-keys",
    title: "ILD & Safety Keys",
    kicker: "T-DXd monitoring",
    disease: "breast",
    faculty: "amy-krie",
    episodes: 5,
    isNew: true,
    cover: "/img/faculty-krie.jpg",
    summary:
      "Early detection, proactive monitoring and the dose decisions that keep patients on therapy.",
  },
  {
    slug: "maintenance-rethought",
    title: "Maintenance, Rethought",
    kicker: "PATINA & HER2CLIMB",
    disease: "breast",
    faculty: "mabel-mardones",
    episodes: 4,
    cover: "/img/faculty-mardones.jpg",
    summary:
      "Where maintenance strategy sits after PATINA, and how HER2CLIMB-05 reframes the question.",
  },
  {
    slug: "perioperative-io",
    title: "The Perioperative Question",
    kicker: "Resectable NSCLC",
    disease: "lung",
    faculty: "anne-odea",
    episodes: 5,
    isNew: true,
    cover: "/img/faculty-odea.jpg",
    summary: "Neoadjuvant, adjuvant or both. Reading CheckMate, KEYNOTE and AEGEAN side by side.",
  },
  {
    slug: "driver-mutations",
    title: "Driver by Driver",
    kicker: "EGFR, ALK, KRAS",
    disease: "lung",
    faculty: "mark-pegram",
    episodes: 7,
    cover: "/img/faculty-pegram.jpg",
    summary: "One session per driver. Testing, first line, resistance and what to do at progression.",
  },
  {
    slug: "biomarker-first-crc",
    title: "Biomarker-First CRC",
    kicker: "MSI, BRAF, HER2",
    disease: "gi",
    faculty: "carol-tweed",
    episodes: 6,
    cover: "/img/faculty-tweed.jpg",
    summary: "Why the order of testing changes the order of treatment in colorectal cancer.",
  },
  {
    slug: "gastric-adcs",
    title: "ADCs Move Upstream",
    kicker: "Gastric & GEJ",
    disease: "gi",
    faculty: "amy-krie",
    episodes: 4,
    cover: "/img/faculty-krie.jpg",
    summary: "HER2 in gastric cancer, and what the breast experience does and does not transfer.",
  },
  {
    slug: "prostate-triplets",
    title: "Doublet or Triplet",
    kicker: "mHSPC intensification",
    disease: "gu",
    faculty: "mabel-mardones",
    episodes: 5,
    cover: "/img/faculty-mardones.jpg",
    summary: "Intensification in hormone-sensitive disease, and picking the patients who need it.",
  },
  {
    slug: "bladder-perioperative",
    title: "Bladder, Rewritten",
    kicker: "EV-302 and after",
    disease: "gu",
    faculty: "anne-odea",
    episodes: 3,
    isNew: true,
    cover: "/img/faculty-odea.jpg",
    summary: "The fastest-moving standard in GU oncology, and how to sequence what comes next.",
  },
  {
    slug: "bispecifics-myeloma",
    title: "Bispecifics in Practice",
    kicker: "R/R myeloma",
    disease: "hematology",
    faculty: "mark-pegram",
    episodes: 6,
    cover: "/img/faculty-pegram.jpg",
    summary: "Step-up dosing, CRS management and the community-site logistics nobody publishes.",
  },
  {
    slug: "car-t-referral",
    title: "The Referral Window",
    kicker: "CAR-T timing",
    disease: "hematology",
    faculty: "carol-tweed",
    episodes: 4,
    cover: "/img/faculty-tweed.jpg",
    summary: "When to refer, what to send, and how to keep the patient eligible while they wait.",
  },
  {
    slug: "parp-maintenance",
    title: "After the PARP Era",
    kicker: "Ovarian maintenance",
    disease: "gynecologic",
    faculty: "amy-krie",
    episodes: 5,
    cover: "/img/faculty-krie.jpg",
    summary: "Where PARP inhibitors still earn their place, and where the field has moved past them.",
  },
  {
    slug: "endometrial-io",
    title: "Endometrial, Reclassified",
    kicker: "MMR-guided therapy",
    disease: "gynecologic",
    faculty: "mabel-mardones",
    episodes: 4,
    isNew: true,
    cover: "/img/faculty-mardones.jpg",
    summary: "Molecular classification changed the first-line question. Four sessions on the answer.",
  },
];

const chapters = [
  { time: "00:00", label: "The case" },
  { time: "03:12", label: "What the registrational data says" },
  { time: "08:40", label: "Where the guidelines lag" },
  { time: "13:05", label: "Toxicity and dose decisions" },
  { time: "17:20", label: "What we would do Monday" },
];

export const items: Item[] = [
  {
    slug: "first-line-sequencing-her2",
    format: "video",
    title: "First-line sequencing in HER2+ mBC",
    dek: "Two oncologists work a first-line case from diagnosis to the first scan, disagreeing in public about what the data supports.",
    faculty: ["mark-pegram", "carol-tweed"],
    disease: "breast",
    series: "beyond-cleopatra",
    duration: "18:40",
    published: "2026-08-19",
    thumb: "/img/thumb-cleopatra.jpg",
    chapters,
    tags: ["HER2+", "First line", "Sequencing"],
    views: "41.2K",
  },
  {
    slug: "evidence-behind-maintenance",
    format: "podcast",
    title: "The evidence behind maintenance",
    dek: "PATINA read carefully, plus the maintenance questions the trial was never designed to answer.",
    faculty: ["carol-tweed", "mabel-mardones"],
    disease: "breast",
    show: "the-evidence-room",
    duration: "32:05",
    published: "2026-08-17",
    thumb: "/img/thumb-patina.jpg",
    chapters,
    tags: ["Maintenance", "PATINA", "HR+"],
    views: "28.9K",
  },
  {
    slug: "neratinib-revisited",
    format: "editorial",
    title: "Neratinib revisited: is it time to reconsider an underused therapy?",
    dek:
      "Recurrence remains a clinically important challenge in high-risk HER2-positive early breast cancer. What the extended adjuvant data still supports.",
    faculty: ["joshua-elmore"],
    disease: "breast",
    duration: "7 MIN",
    published: "2026-08-22",
    thumb: "/img/thumb-cleopatra.jpg",
    tags: ["HER2+", "Toxicity", "Maintenance"],
    views: "14.2K",
    body: [
      "Despite significant progress in HER2-targeted treatment, recurrence remains a concern in high-risk HER2-positive early breast cancer. Trastuzumab-based therapy improved long-term survival, but some patients, particularly those with hormone receptor-positive disease, still recur after standard adjuvant treatment.",
      "Neratinib, an oral irreversible pan-HER tyrosine kinase inhibitor, was designed for that gap. ExteNET showed that one year of extended adjuvant neratinib after trastuzumab significantly improved invasive disease-free survival, with the greatest benefit in hormone receptor-positive patients, and it was approved in 2017 as the first oral HER2-directed therapy for extended adjuvant treatment.",
      "Why it became the forgotten therapy. Adoption stayed low, and the reason was diarrhea rather than efficacy. In ExteNET, where antidiarrheal prophylaxis was not mandated, grade 3 diarrhea occurred in roughly 40% of patients and accounted for 16.8% of discontinuations. Nearly a third of patients required a dose reduction. As the HER2 landscape expanded, attention moved on. The reputation was set by the early tolerability experience, not by the durability of the benefit.",
      "The turning point. Investigators asked whether the diarrhea could be prevented rather than whether the drug worked. CONTROL tested prophylaxis in 563 patients, and a two-week dose escalation with as-needed loperamide brought grade 3 or higher diarrhea from 40% down to 13%, and diarrhea-related discontinuation from 17% to 3%. Most episodes appeared in the first month, and quality-of-life declines were modest and transient. The escalation schedule is now in the FDA label and the NCCN recommendations.",
      "Who it is actually for. The benefit concentrates in hormone receptor-positive disease. Patients starting within one year of finishing trastuzumab showed a 5-year absolute iDFS improvement of 5.1%, while those starting later derived little. Among hormone receptor-positive patients with residual disease after neoadjuvant therapy, the improvements reached 7.4% in 5-year iDFS and 9.1% in 8-year overall survival. Baseline risk is what separates two otherwise eligible patients.",
      "What is still unanswered. ExteNET predates widespread pertuzumab and antibody-drug conjugate use, so there is little prospective data on the incremental benefit after a contemporary regimen. Both NCCN and ASCO acknowledge this. CONTROL at least suggests prior pertuzumab exposure does not worsen tolerability.",
      "The drug did not change over the past decade. What changed is the understanding of how, and in whom, to use it. The practical question is no longer whether a patient can tolerate neratinib, but whether their residual recurrence risk justifies extended HER2 blockade, and whether the first month is managed well enough that they stay on it long enough to benefit.",
    ],
  },
  {
    slug: "what-db11-changes",
    format: "editorial",
    title: "What DB11 changes first-line",
    dek: "A six-minute read on DESTINY-Breast11 and the first-line decisions it actually moves.",
    faculty: ["amy-krie"],
    disease: "breast",
    duration: "6 MIN",
    published: "2026-08-15",
    thumb: "/img/thumb-db09.jpg",
    tags: ["DESTINY-Breast11", "T-DXd", "Neoadjuvant"],
    views: "19.4K",
    body: [
      "DESTINY-Breast11 is the first readout that puts trastuzumab deruxtecan into the neoadjuvant setting at scale, and the temptation is to read it as a straightforward win. It is not that simple, and the difference matters for the patient in front of you next week.",
      "The pathologic complete response advantage is real and it is large. What the trial does not tell you is whether that advantage survives contact with a community practice that cannot run pulmonary function testing on the same schedule as the protocol sites.",
      "Three questions decide whether this changes your first-line approach. First: can you monitor for interstitial lung disease at the cadence the label implies. Second: is your patient’s tumor burden high enough that the pCR delta translates into an event-free survival delta. Third: what does progression look like after an ADC in the neoadjuvant setting, given that you have now spent the drug.",
      "The honest position is that DB11 changes the conversation for high-burden disease and leaves the rest of first-line where it was. That is a smaller claim than the headline, and it is the claim the data supports.",
      "We recorded a full session on this with Dr. Krie and Dr. Mardones. The disagreement between them on question three is the most useful eighteen minutes of the week.",
    ],
  },
  {
    slug: "destiny-breast11-explained",
    format: "video",
    title: "DESTINY-Breast11 explained",
    dek: "The trial design, the endpoints and the three subgroups that carry the result.",
    faculty: ["amy-krie", "mabel-mardones"],
    disease: "breast",
    series: "beyond-cleopatra",
    duration: "22:10",
    published: "2026-08-14",
    thumb: "/img/thumb-db09.jpg",
    chapters,
    tags: ["DESTINY-Breast11", "Trial design"],
    views: "36.7K",
  },
  {
    slug: "ild-monitoring-in-practice",
    format: "podcast",
    title: "ILD monitoring in practice",
    dek: "Early detection, proactive monitoring, and the keys to T-DXd safety in a community setting.",
    faculty: ["amy-krie", "anne-odea"],
    disease: "breast",
    show: "office-hours",
    duration: "34:02",
    published: "2026-08-12",
    thumb: "/img/thumb-ild.jpg",
    chapters,
    tags: ["ILD", "T-DXd", "Safety"],
    views: "52.1K",
  },
  {
    slug: "sequencing-after-progression",
    format: "editorial",
    title: "Sequencing after progression",
    dek: "What to reach for once the ADC has been spent, and how to keep options open.",
    faculty: ["mark-pegram"],
    disease: "breast",
    duration: "7 MIN",
    published: "2026-08-10",
    thumb: "/img/thumb-patina.jpg",
    tags: ["Progression", "Sequencing", "ADC"],
    views: "15.8K",
    body: [
      "Progression after an antibody-drug conjugate is the fastest-growing decision point in metastatic breast cancer, and it is the one with the least evidence behind it.",
      "The mechanistic argument for switching payload class is clean. The clinical evidence that it matters is thinner than the argument, and the trials that would settle it are still enrolling.",
      "In the meantime, the practical rule most CHM faculty converge on is this: preserve at least one line with a different payload and a different target, and do not spend two ADCs back to back unless the disease biology gives you a reason.",
      "That rule is a heuristic, not a guideline. It exists because the guideline has not caught up, and because patients keep progressing on a schedule that does not wait for the next readout.",
    ],
  },
  {
    slug: "live-case-dose-reduction",
    format: "video",
    title: "Live case: dose reduction",
    dek: "A grade 2 event at cycle four. Two faculty decide, in real time, whether to hold, reduce or stop.",
    faculty: ["mark-pegram", "carol-tweed"],
    disease: "breast",
    series: "ild-safety-keys",
    duration: "19:45",
    published: "2026-08-08",
    thumb: "/img/thumb-cleopatra.jpg",
    chapters,
    tags: ["Dose reduction", "Toxicity", "Live case"],
    views: "31.5K",
  },
  {
    slug: "perioperative-io-nsclc",
    format: "video",
    title: "Perioperative IO in resectable NSCLC",
    dek: "Neoadjuvant, adjuvant or both. Three trials read side by side, with the eligibility differences called out.",
    faculty: ["anne-odea", "mark-pegram"],
    disease: "lung",
    series: "perioperative-io",
    duration: "26:15",
    published: "2026-08-18",
    thumb: "/img/thumb-ild.jpg",
    chapters,
    tags: ["NSCLC", "Immunotherapy", "Perioperative"],
    views: "44.3K",
  },
  {
    slug: "egfr-resistance-map",
    format: "podcast",
    title: "Mapping EGFR resistance",
    dek: "What to test for at progression, and what the answer changes.",
    faculty: ["mark-pegram"],
    disease: "lung",
    show: "the-evidence-room",
    duration: "29:48",
    published: "2026-08-11",
    thumb: "/img/thumb-db09.jpg",
    chapters,
    tags: ["EGFR", "Resistance", "NSCLC"],
    views: "22.6K",
  },
  {
    slug: "kras-g12c-second-line",
    format: "editorial",
    title: "KRAS G12C in the second line",
    dek: "Two approvals, one patient population, and the sequencing question nobody has answered.",
    faculty: ["anne-odea"],
    disease: "lung",
    duration: "5 MIN",
    published: "2026-08-05",
    thumb: "/img/thumb-cleopatra.jpg",
    tags: ["KRAS", "NSCLC", "Second line"],
    views: "11.9K",
    body: [
      "KRAS G12C went from undruggable to crowded in under four years, which is a good problem and still a problem.",
      "Both approved inhibitors landed on similar populations with similar response rates and similar hepatotoxicity profiles. The differences that matter in practice are dosing schedule, drug-drug interactions and what your pharmacy can actually get.",
      "The sequencing question is open because nobody has run the trial. Until they do, the field is choosing on tolerability and access, which is a reasonable basis for a decision and a poor basis for a guideline.",
    ],
  },
  {
    slug: "msi-first-crc",
    format: "video",
    title: "Testing before treating in CRC",
    dek: "Why the order of biomarker testing determines the order of therapy in colorectal cancer.",
    faculty: ["carol-tweed"],
    disease: "gi",
    series: "biomarker-first-crc",
    duration: "21:30",
    published: "2026-08-16",
    thumb: "/img/thumb-patina.jpg",
    chapters,
    tags: ["CRC", "MSI", "Biomarkers"],
    views: "27.4K",
  },
  {
    slug: "her2-gastric-transfer",
    format: "podcast",
    title: "Does the breast experience transfer?",
    dek: "HER2 in gastric cancer, and the assumptions that do not survive the move.",
    faculty: ["amy-krie", "carol-tweed"],
    disease: "gi",
    show: "second-opinion",
    duration: "27:12",
    published: "2026-08-09",
    thumb: "/img/thumb-ild.jpg",
    chapters,
    tags: ["Gastric", "HER2", "ADC"],
    views: "18.2K",
  },
  {
    slug: "mhspc-intensification",
    format: "video",
    title: "Doublet or triplet in mHSPC",
    dek: "Volume, timing and comorbidity. Picking the patients who need the third agent.",
    faculty: ["mabel-mardones"],
    disease: "gu",
    series: "prostate-triplets",
    duration: "24:05",
    published: "2026-08-13",
    thumb: "/img/thumb-cleopatra.jpg",
    chapters,
    tags: ["Prostate", "mHSPC", "Intensification"],
    views: "33.1K",
  },
  {
    slug: "ev302-and-after",
    format: "editorial",
    title: "EV-302 and what comes after",
    dek: "The fastest-moving standard in GU, and the sequencing problem it created.",
    faculty: ["anne-odea"],
    disease: "gu",
    duration: "6 MIN",
    published: "2026-08-06",
    thumb: "/img/thumb-db09.jpg",
    tags: ["Bladder", "EV-302", "Sequencing"],
    views: "14.7K",
    body: [
      "EV-302 did not adjust the bladder cancer standard. It replaced it, and it did so fast enough that most second-line algorithms are now written against a first line that no longer exists.",
      "That is the practical problem. If enfortumab vedotin plus pembrolizumab is your first line, then platinum is your second line, and the trials that established second-line options were run in platinum-exposed patients.",
      "Nobody has run the study that tells you what to do at progression. Faculty are choosing on mechanism and on what the patient can tolerate, and saying so out loud is more useful than pretending otherwise.",
    ],
  },
  {
    slug: "bispecific-step-up",
    format: "video",
    title: "Step-up dosing without a transplant bed",
    dek: "Running bispecifics in a community site: CRS monitoring, staffing and the first 72 hours.",
    faculty: ["mark-pegram", "anne-odea"],
    disease: "hematology",
    series: "bispecifics-myeloma",
    duration: "28:50",
    published: "2026-08-20",
    thumb: "/img/thumb-ild.jpg",
    chapters,
    tags: ["Myeloma", "Bispecifics", "CRS"],
    views: "39.6K",
  },
  {
    slug: "car-t-referral-window",
    format: "podcast",
    title: "The referral window",
    dek: "When to refer for CAR-T, what to send, and how to keep the patient eligible.",
    faculty: ["carol-tweed"],
    disease: "hematology",
    show: "on-practice",
    duration: "25:33",
    published: "2026-08-07",
    thumb: "/img/thumb-patina.jpg",
    chapters,
    tags: ["CAR-T", "Referral", "Lymphoma"],
    views: "20.8K",
  },
  {
    slug: "parp-still-earns",
    format: "video",
    title: "Where PARP still earns its place",
    dek: "Maintenance in ovarian cancer after the field moved on, and the patients it still serves.",
    faculty: ["amy-krie"],
    disease: "gynecologic",
    series: "parp-maintenance",
    duration: "23:18",
    published: "2026-08-21",
    thumb: "/img/thumb-db09.jpg",
    chapters,
    tags: ["Ovarian", "PARP", "Maintenance"],
    views: "25.0K",
  },
  {
    slug: "endometrial-molecular",
    format: "editorial",
    title: "Endometrial cancer, reclassified",
    dek: "Molecular classification changed the first-line question before it changed the guideline.",
    faculty: ["mabel-mardones"],
    disease: "gynecologic",
    duration: "8 MIN",
    published: "2026-08-04",
    thumb: "/img/thumb-cleopatra.jpg",
    tags: ["Endometrial", "MMR", "Immunotherapy"],
    views: "13.3K",
    body: [
      "Endometrial cancer spent decades classified by histology and is now classified by molecular subtype, and the treatment implications arrived faster than the pathology reports did.",
      "Mismatch repair status is the branch point. Everything downstream, including whether immunotherapy belongs in the first line, depends on getting that result before the first decision rather than after it.",
      "The operational problem is that MMR testing is ordered late in a majority of community cases. The clinical problem is that late is the same as never when the first-line decision has already been made.",
    ],
  },
];

export const shows: Show[] = [
  {
    slug: "office-hours",
    title: "Office Hours",
    tagline: "Live case Q&A",
    episodes: 24,
    cover: "/img/cells-blue.jpg",
    tint: "sky",
    host: "amy-krie",
    about:
      "An open line. Clinicians send the case they are stuck on, and two faculty work it live without knowing the answer in advance.",
  },
  {
    slug: "the-evidence-room",
    title: "The Evidence Room",
    tagline: "Trial deep dives",
    episodes: 31,
    cover: "/img/cells-blue.jpg",
    tint: "cream",
    host: "carol-tweed",
    about:
      "One trial per episode, read the way a discussant reads it: design first, endpoints second, headline last.",
  },
  {
    slug: "on-practice",
    title: "On Practice",
    tagline: "What changed this month",
    episodes: 18,
    cover: "/img/cells-blue.jpg",
    tint: "mist",
    host: "mabel-mardones",
    about:
      "A monthly pass over approvals, label changes and guideline updates, filtered down to what alters a clinic decision.",
  },
  {
    slug: "second-opinion",
    title: "Second Opinion",
    tagline: "Two experts, one question",
    episodes: 12,
    cover: "/img/cells-blue.jpg",
    tint: "sky",
    host: "mark-pegram",
    about:
      "Two faculty who disagree, one question, no synthesis at the end. The disagreement is the content.",
  },
];

export const collections = [
  { slug: "most-watched", label: "Most watched" },
  { slug: "recently-added", label: "Recently added" },
  { slug: "editors-picks", label: "Editor’s picks" },
  { slug: "conference-coverage", label: "Conference coverage" },
  { slug: "clinical-controversies", label: "Clinical controversies" },
];

/* ---------- lookups ---------- */

export const facultyBySlug = (slug: string) => faculty.find((f) => f.slug === slug);
export const diseaseBySlug = (slug: string) => diseaseStates.find((d) => d.slug === slug);
export const seriesBySlug = (slug: string) => series.find((s) => s.slug === slug);
export const showBySlug = (slug: string) => shows.find((s) => s.slug === slug);
export const itemBySlug = (slug: string) => items.find((i) => i.slug === slug);

export const itemsByFormat = (format: Format) => items.filter((i) => i.format === format);
export const itemsByDisease = (slug: string) => items.filter((i) => i.disease === slug);
export const itemsByShow = (slug: string) => items.filter((i) => i.show === slug);
export const itemsBySeries = (slug: string) => items.filter((i) => i.series === slug);
export const itemsByFaculty = (slug: string) => items.filter((i) => i.faculty.includes(slug));
export const seriesByDisease = (slug: string) => series.filter((s) => s.disease === slug);
export const seriesByFaculty = (slug: string) => series.filter((s) => s.faculty === slug);

export const byNewest = <T extends { published: string }>(list: T[]) =>
  [...list].sort((a, b) => b.published.localeCompare(a.published));

export const facultyNames = (slugs: string[]) =>
  slugs.map((s) => facultyBySlug(s)?.name).filter(Boolean).join(", ");

export const formatLabel: Record<Format, string> = {
  video: "Video",
  podcast: "Podcast",
  editorial: "Editorial",
};

export const formatHref = (item: Item) =>
  item.format === "editorial" ? `/editorial/${item.slug}` : `/watch/${item.slug}`;

export const prettyDate = (iso: string) =>
  new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

export function search(q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return { items: [], series: [], faculty: [], shows: [] };
  const hit = (s: string) => s.toLowerCase().includes(needle);
  return {
    items: items.filter(
      (i) => hit(i.title) || hit(i.dek) || i.tags.some(hit) || hit(i.disease)
    ),
    series: series.filter((s) => hit(s.title) || hit(s.kicker) || hit(s.summary)),
    faculty: faculty.filter((f) => hit(f.name) || hit(f.org) || f.focus.some(hit)),
    shows: shows.filter((s) => hit(s.title) || hit(s.tagline)),
  };
}

/* ── tag taxonomy ─────────────────────────────────────────
   Tags carry three different kinds of meaning, so they get
   three colours rather than one per tag: where the disease
   sits, what is being given, and in which setting. Colour by
   kind stays legible as the tag list grows. */
export type TagKind = "site" | "agent" | "setting";

const SITE = new Set([
  "Ovarian", "Bladder", "CRC", "NSCLC", "Gastric", "Endometrial",
  "Prostate", "Myeloma", "Lymphoma", "mHSPC",
]);

const AGENT = new Set([
  "PARP", "T-DXd", "HER2", "HER2+", "HR+", "EGFR", "KRAS", "MSI", "MMR",
  "ADC", "CAR-T", "Bispecifics", "DESTINY-Breast11", "PATINA", "EV-302",
]);

export function tagKind(tag: string): TagKind {
  if (SITE.has(tag)) return "site";
  if (AGENT.has(tag)) return "agent";
  return "setting";
}

/** Fill and label for a tag chip, in the appearance-safe pairing:
    a bright fill always takes the fixed dark label. */
export function tagTone(tag: string): { fill: string; label: string } {
  const kind = tagKind(tag);
  const fill =
    kind === "site"
      ? "var(--color-pink)"
      : kind === "agent"
        ? "var(--color-cyan)"
        : "var(--color-purple)";
  return { fill, label: "var(--color-on-bright)" };
}
