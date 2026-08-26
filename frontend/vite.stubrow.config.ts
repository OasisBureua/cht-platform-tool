/* TEMPORARY visual-verification harness. Delete after screenshotting. */
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const yt = (id: string) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`

const PLAYLISTS = [
  { id: 'PL1', title: 'DESTINY-Breast09 and first-line HER2+ metastatic disease with Drs. Hope Rugo & Sara Hurvitz', thumbnailUrl: yt('dQw4w9WgXcQ'), videoNames: [], videoCount: 12 },
  { id: 'PL2', title: 'HER2-low and ultra-low: reading the new IHC thresholds with Drs. Bill Gradishar & Tiffany Traina', thumbnailUrl: yt('9bZkp7q19f0'), videoNames: [], videoCount: 7 },
  { id: 'PL3', title: 'Frontline TNBC and ADC advances with Drs. Joyce O’Shaughnessy, Kelly Lucci & Mothaffar Rimawi', thumbnailUrl: yt('kJQP7kiw5Fk'), videoNames: [], videoCount: 4 },
  { id: 'PL4', title: 'Endocrine resistance, ESR1 and the AKT pathway with Drs. Seth Wander & Komal Jhaveri', thumbnailUrl: '', videoNames: ['a','b','c','d','e'], videoCount: 5 },
  { id: 'PL5', title: 'Integrating T-DXd across HER2 expression with Drs. Paolo Tarantino & Erika Hamilton', thumbnailUrl: yt('RgKAFK5djSk'), videoNames: [], videoCount: 9 },
  { id: 'PL6', title: 'ASCO 2026: what changed in early-stage breast cancer with Drs. Rachel Siva & Carey Anders', thumbnailUrl: yt('OPf0YbXqDm0'), videoNames: [], videoCount: 18 },
  { id: 'PL7', title: 'CDK4/6 sequencing after progression with Drs. Neil Vidal, Pooja Advani & Tari King', thumbnailUrl: 'https://i.ytimg.com/vi/AAAAAAAAAAA/hqdefault.jpg', videoNames: [], videoCount: 3 },
  { id: 'PL8', title: 'Managing capivasertib in practice', thumbnailUrl: yt('fJ9rUzIMcZQ'), videoNames: [], videoCount: 1 },
  { id: 'PL9', title: 'Bispecifics and the next wave of immune engagers with Drs. Alex Mouabbi & Reshma Basho', thumbnailUrl: yt('CevxZvSJLk8'), videoNames: [], videoCount: 6 },
  { id: 'PL10', title: 'Trop-2 ADCs in metastatic disease with Drs. Mark Pegram & Seth Wander', thumbnailUrl: '', videoNames: [], videoCount: 11 },
  { id: 'PL11', title: 'Residual disease after neoadjuvant therapy with Drs. Nusayba Bagegni & Amy Lammers', thumbnailUrl: yt('JGwWNGJdvx8'), videoNames: [], videoCount: 2 },
  { id: 'PL12', title: 'Community oncology: building the multidisciplinary tumour board with Drs. Reddy & Elkhanany', thumbnailUrl: yt('hT_nvWreIhg'), videoNames: [], videoCount: 22 },
]

const CLIP_IDS = ['YQHsXMglC9A','09R8_2nJtjg','SlPhMPnQ58k','pRpeEdMmmQ0','uelHwf8o7_U','60ItHLz5WEA','e-ORhEE9VVg','7wtfhZwyrcc']
const CLIPS = CLIP_IDS.map((id, i) => ({
  id: `official:youtube:${id}`,
  title: ['Reading the DESTINY-Breast09 readout in a community setting','What HER2-ultralow actually changes on Monday','Sequencing ADCs after early progression','Toxicity management for T-DXd: the first 90 days','Endocrine therapy after CDK4/6: the real options','Biomarker testing gaps in the community','Talking risk with a newly diagnosed patient','When to refer for a clinical trial'][i],
  description: '', tags: [['biomarker:HER2+','biomarker:HER2-low','biomarker:TNBC','biomarker:HR+'][i % 4]], doctors: ['hope-rugo','sara-hurvitz'],
  thumbnail_url: yt(id), youtube_url: `https://www.youtube.com/watch?v=${id}`,
  duration_seconds: 420 + i * 61, is_short: false, posted_at: '2026-05-01T00:00:00Z',
  view_count: 100, like_count: 5, comment_count: 0,
}))

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'catalog-stub',
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          const url = req.url || ''
          const send = (body: unknown) => {
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify(body))
          }
          if (url.startsWith('/api/catalog/playlists-tags')) return send({ items: [], total: 0 })
          if (url.startsWith('/api/catalog/playlists')) return send(PLAYLISTS)
          if (url.startsWith('/api/catalog/clips')) return send({ items: CLIPS, total: CLIPS.length })
          if (url.startsWith('/api/catalog/tags')) return send({})
          if (url.startsWith('/api/catalog/wordpress/categories')) return send({ items: [], total: 0 })
          if (url.startsWith('/api/')) return send({ items: [], total: 0 })
          next()
        })
      },
    },
  ],
})
