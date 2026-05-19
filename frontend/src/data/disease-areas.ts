export interface DiseaseArea {
  slug: string;
  title: string;
  description: string;
  image: string;
  active: boolean;
  /**
   * Legacy free-text tokens used by older client-side regex filtering.
   * Kept for backward compatibility with code that may still consume them.
   * Prefer `clipTags` (namespaced MediaHub tags) for any new code path —
   * the backend can filter exactly on those.
   */
  searchTags: string[];
  /**
   * Namespaced MediaHub tag strings (e.g. `biomarker:HER2+`) passed
   * verbatim to GET /api/catalog/clips?tag=...
   *
   * Contract:
   *   - AND across different namespaces
   *   - OR within the same namespace
   *
   * Mirrors the carousel contract in `carousels.config.ts`
   * (see `anon-breast-conversations`). Source of truth for the
   * disease-detail Conversations row.
   */
  clipTags?: string[];
}

const DISEASE_AREAS: DiseaseArea[] = [
  {
    slug: 'breast-cancer',
    title: 'Breast Cancer',
    description: 'Expert-led education, conversations, and Live sessions focused on breast oncology.',
    image: '/images/podcasts/breast-friends/cover.png',
    active: true,
    searchTags: ['breast', 'HER2', 'TNBC', 'HR+', 'mammary', 'oncology', 'mastectomy'],
    clipTags: [
      'biomarker:HER2+',
      'biomarker:HER2-low',
      'biomarker:HER2-ultralow',
      'biomarker:HR+',
      'biomarker:TNBC',
      'biomarker:High-Risk / CNS',
    ],
  },
  {
    slug: 'lung-cancer',
    title: 'Lung Cancer',
    description: 'Thoracic oncology content launching soon — clinical insights and treatment paradigms.',
    image: '/images/iStock-1917170353-5564763c-6ced-49b2-93ff-6a2261700399.png',
    active: false,
    searchTags: ['lung', 'NSCLC', 'SCLC', 'thoracic', 'pulmonary'],
  },
  {
    slug: 'weight-loss',
    title: 'Weight Loss',
    description: 'Metabolic health and GLP-1 therapy conversations for clinicians and patients.',
    image: '/images/iStock-1938555104-3986b580-5ef8-4aae-989f-05a2edd0bc12.png',
    active: false,
    searchTags: ['weight', 'obesity', 'GLP-1', 'metabolic', 'semaglutide'],
  },
];

export default DISEASE_AREAS;
