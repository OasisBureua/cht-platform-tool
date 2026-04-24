export interface DiseaseArea {
  slug: string;
  title: string;
  description: string;
  image: string;
  active: boolean;
  searchTags: string[];
}

const DISEASE_AREAS: DiseaseArea[] = [
  {
    slug: 'breast-cancer',
    title: 'Breast Cancer',
    description: 'Expert-led education, conversations, and LIVE sessions focused on breast oncology.',
    image: '/images/iStock-1869998948-a6d5f1f2-fc95-4c9b-a1b6-b579bd7b6758.png',
    active: true,
    searchTags: ['breast', 'HER2', 'TNBC', 'HR+', 'mammary', 'oncology', 'mastectomy'],
  },
  {
    slug: 'lung-cancer',
    title: 'Lung Cancer',
    description: 'Thoracic oncology content launching soon - clinical insights and treatment paradigms.',
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
