export type DolEntry = {
  id: string;
  name: string;
  role: string;
  bio: string;
  education: string;
  isNew?: boolean;
};

export type DolRegion = {
  id: string;
  emoji: string;
  title: string;
  subtitle?: string;
  entries: DolEntry[];
};

export const dolNetwork: DolRegion[] = [
  {
    id: 'ny-northeast',
    emoji: '🗽',
    title: 'New York & Northeast',
    subtitle: 'Memorial Sloan Kettering (MSK)',
    entries: [
      {
        id: 'traina',
        name: 'Dr. Tiffany Traina',
        role: 'Vice Chair of Oncology Care; Section Head, Triple-Negative Breast Cancer (TNBC).',
        bio: 'A global authority on TNBC who leads early-phase trials for novel therapeutics and antibody-drug conjugates.',
        education: 'Cornell Medical College (MD); Memorial Sloan Kettering (Residency & Fellowship).',
      },
      {
        id: 'jhaveri',
        name: 'Dr. Komal Jhaveri',
        role: 'Section Head, Endocrine Therapy Research; Clinical Director, Early Drug Development.',
        bio: 'Expert in PI3K/Akt/mTOR pathways, focusing on drug resistance in hormone-receptor-positive cancers.',
        education: 'University of Mumbai (MD); Mount Sinai (Residency); Memorial Sloan Kettering (Fellowship).',
      },
      {
        id: 'iyengar',
        name: 'Dr. Neil Iyengar',
        role: 'Medical Oncologist; Associate Professor, Memorial Sloan Kettering.',
        bio: "A pioneer in 'Metabolic Oncology,' researching how metabolic health and exercise biology influence tumor growth.",
        education: 'University of Illinois (MD); University of Chicago (Residency); Memorial Sloan Kettering (Fellowship).',
      },
      {
        id: 'modi',
        name: 'Dr. Shanu Modi',
        role: 'Medical Oncologist; Lead Investigator, DESTINY-Breast Trials.',
        bio: "Foundational figure in the discovery and approval of Enhertu; her work established 'HER2-low' as a new treatable category.",
        education: 'University of Toronto (MD); Princess Margaret (Residency); Memorial Sloan Kettering (Fellowship).',
      },
      {
        id: 'robson',
        name: 'Dr. Mark Robson',
        role: 'Chief, Breast Medicine Service; Professor of Medicine, Weill Cornell Medical College — Memorial Sloan Kettering Cancer Center, New York, NY.',
        bio: 'A world authority on hereditary breast cancer and BRCA mutations; pioneered PARP inhibitor trials in BRCA-mutated patients and is a global leader integrating genetic testing into clinical oncology management.',
        education: 'Washington and Lee University (BSc); University of Virginia School of Medicine (MD); Walter Reed Army Medical Center (Residency & Fellowship).',
        isNew: true,
      },
    ],
  },
  {
    id: 'east-coast',
    emoji: '🏛',
    title: 'East Coast Academic Centers',
    entries: [
      {
        id: 'brufsky',
        name: 'Dr. Adam Brufsky',
        role: 'Co-Director, Comprehensive Breast Cancer Center; Associate Chief, Division of Hematology/Oncology — UPMC, Pittsburgh, PA.',
        bio: 'A prolific researcher with over 30 active trials, specializing in bone health and metastatic HR-positive disease.',
        education: 'University of Connecticut (MD/PhD); Brigham and Women\'s (Residency); Dana-Farber (Fellowship).',
      },
      {
        id: 'makhlin',
        name: 'Dr. Igor Makhlin',
        role: 'Medical Oncologist; Assistant Professor of Clinical Medicine (Hematology-Oncology) — Penn Medicine / Abramson Cancer Center, Philadelphia, PA.',
        bio: 'A hematology/oncology specialist treating adult patients, with clinical and academic responsibilities at the Rena Rowan Breast Center and Perelman Center for Advanced Medicine.',
        education: 'Geisinger Commonwealth School of Medicine; Residency & Fellowship: University of Pennsylvania Health System.',
      },
    ],
  },
  {
    id: 'new-england',
    emoji: '🏛',
    title: 'New England — Dana-Farber / Harvard',
    entries: [
      {
        id: 'tarantino',
        name: 'Dr. Paolo Tarantino',
        role: 'Physician-Researcher, Division of Breast Oncology — Dana-Farber Cancer Institute, Boston, MA.',
        bio: "A rising star internationally recognized for defining 'HER2-low' and 'ultralow' biology and antibody-drug conjugate sequencing.",
        education: 'University of Milan (MD); European Institute of Oncology (Residency); Dana-Farber (Fellowship).',
      },
      {
        id: 'garrido-castro',
        name: 'Dr. Ana Garrido-Castro',
        role: 'Director, Triple-Negative Breast Cancer Research; Assistant Professor, Harvard — Dana-Farber Cancer Institute, Boston, MA.',
        bio: 'Focuses on immunotherapy and biomarker discovery to predict response in aggressive breast cancer subtypes.',
        education: 'University of Santiago (MD); Vall d\'Hebron (Residency); Dana-Farber (Fellowship).',
      },
    ],
  },
  {
    id: 'yale',
    emoji: '🏛',
    title: 'Yale',
    entries: [
      {
        id: 'lustberg',
        name: 'Dr. Maryam Lustberg',
        role: 'Director, Center for Breast Cancer at Smilow; Chief, Breast Medical Oncology — Yale School of Medicine, New Haven, CT.',
        bio: 'A world expert in supportive care and patient-reported outcomes, focusing on reducing treatment toxicities.',
        education: 'University of Maryland (MD); Ohio State (Residency & Fellowship).',
      },
      {
        id: 'krop',
        name: 'Dr. Ian Krop',
        role: 'Chief Clinical Research Officer; Director, Clinical Trials Office — Yale School of Medicine, New Haven, CT.',
        bio: 'A legendary trialist whose research led to the approval of virtually every major HER2-targeted therapy in the last 15 years.',
        education: 'Johns Hopkins (MD/PhD); Johns Hopkins Hospital (Residency); Dana-Farber (Fellowship).',
      },
    ],
  },
  {
    id: 'midwest-chicago',
    emoji: '🌾',
    title: 'Midwest — Northwestern, Rush & Chicago Area',
    entries: [
      {
        id: 'gradishar',
        name: 'Dr. Bill Gradishar',
        role: 'Chief of Hematology/Oncology; Director, Maggie Daley Center for Women\'s Cancer Care; Chair, NCCN Breast Cancer Guidelines Panel — Northwestern Medicine, Chicago, IL.',
        bio: "A titan in the field who defines the global 'standard of care' as the lead architect of the NCCN clinical guidelines.",
        education: 'Northwestern University (MD); Northwestern Memorial Hospital (Residency & Fellowship).',
      },
      {
        id: 'rao',
        name: 'Dr. Ruta Rao',
        role: 'Medical Director, Rush University Cancer Center; Director, Coleman Breast Clinic — Rush University, Chicago, IL.',
        bio: 'Specializes in metastatic disease and health equity, focusing on breast cancer outcomes in diverse urban populations.',
        education: 'University of Illinois (MD); Rush University Medical Center (Residency & Fellowship).',
      },
      {
        id: 'gadi',
        name: 'Dr. VK Gadi',
        role: 'Deputy Director, University of Illinois Cancer Center; Professor of Medicine (Hematology/Oncology); Director of Medical Oncology, UI Health — Chicago, IL.',
        bio: 'A physician-scientist and nationally recognized breast cancer expert leading precision oncology and early-phase clinical trials in Chicago.',
        education: 'University of Alabama at Birmingham (MD, PhD); University of Washington (Residency); Fred Hutchinson Cancer Center (Fellowship).',
      },
    ],
  },
  {
    id: 'midwest-indiana',
    emoji: '🌾',
    title: 'Indiana, Ohio & Upper Midwest',
    entries: [
      {
        id: 'ballinger',
        name: 'Dr. Tarah Ballinger',
        role: 'Associate Professor of Clinical Medicine; Vera Bradley Foundation Scholar — Indiana University, Indianapolis, IN.',
        bio: "Focuses on the 'lifestyle-oncology' link, specifically how physical fitness and body composition impact long-term survivorship.",
        education: 'Indiana University (MD); Indiana University (Residency & Fellowship).',
      },
      {
        id: 'birhiray',
        name: 'Dr. Ruemu Birhiray',
        role: 'Partner & Founder, Research Program — Hematology Oncology of Indiana (American Oncology Network); Professor of Clinical Medicine, Marian University College of Osteopathic Medicine; Attending Physician, Ascension St. Vincent\'s Hospital, Indianapolis, IN.',
        bio: 'A board-certified hematologist-oncologist and pioneering community-based researcher with expertise in breast cancer, bone marrow transplantation, lymphomas, and immunotherapy. Founder of Indy Hematology Review and Indy Hematology Education.',
        education: 'University of Benin, Nigeria (MD); Columbus Hospital / Northwestern University Affiliate (Residency); Johns Hopkins University & National Cancer Institute (Fellowships).',
        isNew: true,
      },
      {
        id: 'kruse',
        name: 'Dr. Megan Kruse',
        role: 'Director of Breast Medical Oncology — Cleveland Clinic, Cleveland, OH.',
        bio: 'A leading expert in Invasive Lobular Carcinoma (ILC) and the integration of ctDNA for personalized treatment monitoring.',
        education: 'Case Western Reserve University (MD); Cleveland Clinic (Residency & Fellowship).',
      },
    ],
  },
  {
    id: 'kansas',
    emoji: '🌾',
    title: 'Kansas & Great Plains',
    entries: [
      {
        id: 'odea',
        name: 'Dr. Anne O\'Dea',
        role: 'Medical Director, Breast Cancer Survivorship Program — University of Kansas, Kansas City, KS.',
        bio: 'A prominent regional voice dedicated to clinical trial enrollment and improving the quality of life for cancer survivors.',
        education: 'University of Kansas (MD); KU Medical Center (Residency & Fellowship).',
      },
      {
        id: 'krie',
        name: 'Dr. Amy Krie',
        role: 'Oncology/Hematology Specialist; Director of Clinical Research — Avera Cancer Institute, Sioux Falls, SD.',
        bio: 'A key community KOL bringing advanced precision medicine and genomic trials to patients across the Dakotas.',
        education: 'University of Iowa (MD); OHSU (Residency); University of Iowa (Fellowship).',
      },
    ],
  },
  {
    id: 'missouri',
    emoji: '🌾',
    title: 'Missouri & St. Louis Area',
    entries: [
      {
        id: 'bagegni',
        name: 'Dr. Nusayba Bagegni',
        role: 'Associate Professor of Medicine; Associate Medical Director of Clinical Research, Division of Oncology; Breast Cancer Clinical Trials Portfolio Leader — Washington University School of Medicine / Siteman Cancer Center, Barnes-Jewish Hospital, St. Louis, MO.',
        bio: 'A 2024 NCI Early Career Cancer Clinical Investigator Award recipient (one of 10 nationally) specializing in aggressive breast cancer subtypes, breast cancer in younger women, metastatic disease, and developmental therapeutics. A principal investigator on multiple national trials.',
        education: 'University of Iowa Roy J. and Lucille A. Carver College of Medicine (MD); Washington University / Barnes-Jewish Hospital (Residency & Fellowship).',
        isNew: true,
      },
    ],
  },
  {
    id: 'tennessee',
    emoji: '🎵',
    title: 'South & Southeast — Tennessee',
    entries: [
      {
        id: 'hamilton',
        name: 'Dr. Erika Hamilton',
        role: 'Medical Oncologist; Director, Breast & Gynecologic Cancer Research — Sarah Cannon Research Institute, Nashville, TN.',
        bio: 'Specializes in breast and gynecologic cancer care and research. Joined SCRI in 2013 and has led their Breast and Gynecologic Cancer Research Program since.',
        education: 'MD: University of North Carolina at Chapel Hill; Residency: Internal Medicine, UNC; Fellowship: Hematology/Oncology, Duke University.',
      },
      {
        id: 'vidal',
        name: 'Dr. Greg Vidal',
        role: 'Medical Oncologist / Hematologist; Associate Professor, University of Tennessee Health Science Center — West Cancer Center & Regional One Health, Memphis, TN.',
        bio: 'A board-certified medical oncologist and hematologist specializing in breast cancer who conducts clinical research and drug development trials, lecturing nationally and internationally.',
        education: 'MD, PhD: Tulane University School of Medicine; Residency: Stanford Hospital & Clinics; Fellowship: Hematology/Oncology, Stanford Hospital & Clinics.',
      },
    ],
  },
  {
    id: 'texas',
    emoji: '⭐',
    title: 'Texas — MD Anderson & Houston Area',
    entries: [
      {
        id: 'mouabbi',
        name: 'Dr. Jason Mouabbi',
        role: 'Assistant Professor, Breast Medical Oncology — MD Anderson Cancer Center, Houston, TX.',
        bio: 'A highly specialized researcher dedicated almost exclusively to Invasive Lobular Carcinoma (ILC) and ctDNA surveillance.',
        education: 'St. George\'s University (MD); Ascension St. John (Residency & Fellowship); MD Anderson (Clinical Faculty).',
      },
      {
        id: 'oshaughnessy',
        name: 'Dr. Joyce O\'Shaughnessy',
        role: 'Celebrating Chair, Breast Cancer Research for The US Oncology Network — Texas Oncology, Dallas, TX.',
        bio: 'One of the world\'s most recognized oncology educators; an expert in high-risk triple-negative breast cancer (TNBC).',
        education: 'Yale University (MD); Mass General (Residency); National Cancer Institute (Fellowship).',
      },
      {
        id: 'rimawi',
        name: 'Dr. Mothaffar Rimawi',
        role: 'Executive Medical Director, Dan L Duncan Comprehensive Cancer Center — Baylor College of Medicine, Houston, TX.',
        bio: 'Focuses on treatment de-escalation and the molecular mechanisms of resistance in HER2-positive breast cancer.',
        education: 'University of Jordan (MD); UT Medical Branch (Residency); Baylor (Fellowship).',
      },
      {
        id: 'moscol',
        name: 'Dr. Giancarlo Moscol',
        role: 'Assistant Professor, Department of Breast Medical Oncology — MD Anderson Cancer Center (The Woodlands), TX.',
        bio: 'Focuses on personalized medical oncology and high-satisfaction clinical care.',
        education: 'San Marcos University (MD); Thomas Jefferson University (Residency); UT Southwestern (Fellowship).',
      },
      {
        id: 'mcarthur',
        name: 'Dr. Heather McArthur',
        role: 'Clinical Director of Breast Cancer; Komen Distinguished Chair — UT Southwestern Medical Center, Dallas, TX.',
        bio: 'An international leader in the integration of immunotherapy and novel agents for aggressive breast cancer subtypes.',
        education: 'University of Toronto (MD); University of Calgary (Residency); MSK (Advanced Research Fellowship).',
      },
      {
        id: 'cairo',
        name: 'Dr. Michelina Cairo',
        role: 'Oncology/Hematology Specialist — Memorial Hermann, Houston, TX.',
        bio: 'A board-certified oncologist with extensive clinical experience since 2005. She focuses on breast cancer care and actively participates in clinical trials, emphasizing shared decision-making and detailed patient education.',
        education: 'Yale University (BS); Georgetown University School of Medicine (MD); Fellowship: Oncology/Hematology, Baylor College of Medicine.',
      },
    ],
  },
  {
    id: 'colorado',
    emoji: '⛰️',
    title: 'Mountain West — Colorado',
    entries: [
      {
        id: 'mardones',
        name: 'Dr. Mabel Mardones',
        role: 'Breast Medical Oncologist Partner; Executive Committee Member for Breast Cancer Research; Co-chair of Pathways for Breast Cancer — Rocky Mountain Cancer Centers (US Oncology Network), Denver & Lone Tree, CO.',
        bio: 'A board-certified medical oncologist and hematologist with advanced sub-specialty expertise in all breast cancer subtypes, including HR-positive, HER2-positive, metastatic, inflammatory, and TNBC. Fluent Spanish speaker with a passionate focus on young women and precision/evidence-based medicine.',
        education: 'Southwestern Adventist University (BS); Loma Linda University School of Medicine (MD); University of Utah Hospital (Residency); Baylor University Medical Center (Fellowship, Hematology & Medical Oncology).',
      },
    ],
  },
  {
    id: 'florida',
    emoji: '🌴',
    title: 'Florida — Central Florida',
    entries: [
      {
        id: 'dietrich',
        name: 'Dr. Martin Dietrich',
        role: 'Medical Oncologist; Assistant Professor of Internal Medicine, University of Central Florida College of Medicine — Cancer Care Centers of Brevard / US Oncology Network, Rockledge, FL.',
        bio: 'A board-certified internist and medical oncologist with dual doctorates in cancer biology and molecular genetics. A principal investigator of precision medicine-based trials focusing on lung cancer, breast cancer, liquid biopsies, and novel anti-cancer agents. Fellow of the American College of Physicians (FACP).',
        education: 'Ruprecht Karl University (MD); German Cancer Research Center, Heidelberg (PhD, Cancer Biology); University of Texas Southwestern (PhD, Molecular Genetics; Residency & T32 NCI Fellowship).',
      },
    ],
  },
  {
    id: 'california',
    emoji: '🌊',
    title: 'West Coast — California (Los Angeles & Bay Area)',
    entries: [
      {
        id: 'bardia',
        name: 'Dr. Aditya Bardia',
        role: 'Professor of Medicine; Director, Breast Oncology Program — UCLA Health, Los Angeles, CA.',
        bio: 'A world-renowned trialist who led the development of Trodelvy and several pioneering endocrine resistance therapies.',
        education: 'AIIMS (MD); Mayo Clinic (Residency); Johns Hopkins (Fellowship).',
      },
      {
        id: 'mccann',
        name: 'Dr. Kelly McCann',
        role: 'Assistant Clinical Professor, Division of Hematology/Oncology — UCLA Health, Los Angeles, CA.',
        bio: 'A physician-scientist in the Slamon Lab specializing in DNA repair pathways and PARP inhibitor research.',
        education: 'Stanford University (MD/PhD); OHSU (Residency); UCLA (Fellowship).',
      },
      {
        id: 'pegram',
        name: 'Dr. Mark Pegram',
        role: 'Associate Director of Clinical Research; Associate Dean, Stanford Cancer Institute — Stanford Medicine, Palo Alto, CA.',
        bio: 'A foundational pioneer of HER2-targeted therapy whose work was instrumental in the approval of Herceptin.',
        education: 'UNC Chapel Hill (MD); UT Southwestern (Residency); UCLA (Fellowship).',
      },
      {
        id: 'kang',
        name: 'Dr. Irene Kang',
        role: 'Medical Director, Women\'s Health Medical Oncology (Orange County) — City of Hope, Duarte / Orange County, CA.',
        bio: 'Specializes in molecular profiling and improving long-term survivorship and toxicity management.',
        education: 'UCSF (MD); Santa Clara Valley (Residency); USC (Fellowship).',
      },
      {
        id: 'rugo',
        name: 'Dr. Hope Rugo',
        role: 'Director, Women\'s Cancers Program; Division Chief, Breast Medical Oncology — City of Hope, Duarte, CA (transitioned 2025).',
        bio: 'A global authority on TNBC and clinical trial safety.',
        education: 'Tufts University (BS); University of Pennsylvania (MD); UCSF (Residency & Fellowship).',
      },
    ],
  },
  {
    id: 'pacific-northwest',
    emoji: '🌊',
    title: 'Pacific Northwest — Oregon & Washington',
    entries: [
      {
        id: 'conlin',
        name: 'Dr. Alison Conlin',
        role: 'Director, Providence Breast Cancer Program — Providence Cancer Institute, Portland, OR.',
        bio: 'A recognized leader in clinical trials, specifically those focusing on metastatic disease and brain metastases.',
        education: 'Loyola University (MD); Boston University (Residency); Memorial Sloan Kettering (Fellowship).',
      },
      {
        id: 'yan',
        name: 'Dr. Fengting Yan',
        role: 'Medical Oncologist, True Family Women\'s Cancer Center — Swedish Cancer Institute, Seattle, WA.',
        bio: 'Focuses on translational research in women\'s health and early-phase clinical trials for breast and gynecologic cancers.',
        education: 'Xi\'an Medical (MD); Ohio State (Residency); Fred Hutch/UW (Fellowship).',
      },
    ],
  },
];
