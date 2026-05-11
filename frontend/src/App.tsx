import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScrollToTop from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';

// Layouts + guards — always needed immediately, keep static
import PublicLayout from './layouts/PublicLayout';
import Layout from './components/layout/Layout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import { APP_CATALOG_CONVERSATIONS_HUB } from './components/navigation/appNavItems';

// ── Public pages (lazy) ───────────────────────────────────────────────────────
const Home                  = lazy(() => import('./pages/public/Home'));
const ClipDetail            = lazy(() => import('./pages/public/ClipDetail'));
const PlaylistDetail        = lazy(() => import('./pages/public/PlaylistDetail'));
const About                 = lazy(() => import('./pages/public/About'));
const Contact               = lazy(() => import('./pages/public/Contact'));
const Join                  = lazy(() => import('./pages/public/Join'));
const Login                 = lazy(() => import('./pages/public/Login'));
const AdminLogin            = lazy(() => import('./pages/public/AdminLogin'));
const ForgotPassword        = lazy(() => import('./pages/public/ForgotPassword'));
const AuthCallback          = lazy(() => import('./pages/public/AuthCallback'));
const CompleteProfile       = lazy(() => import('./pages/public/CompleteProfile'));
const Privacy               = lazy(() => import('./pages/public/Privacy'));
const Terms                 = lazy(() => import('./pages/public/Terms'));
const DiseaseDetail         = lazy(() => import('./pages/public/DiseaseDetail'));
const VideosPage            = lazy(() => import('./pages/public/VideosPage'));
const Search                = lazy(() => import('./pages/public/Search'));
const ForHCPs               = lazy(() => import('./pages/public/ForHCPs'));
const PublicWebinars        = lazy(() => import('./pages/public/PublicWebinars'));
const PublicWebinarDetail   = lazy(() => import('./pages/public/PublicWebinarDetail'));
const PublicOfficeHours     = lazy(() => import('./pages/public/PublicOfficeHours'));
const PublicOfficeHoursDetail = lazy(() => import('./pages/public/PublicOfficeHoursDetail'));
const PublicSurveys         = lazy(() => import('./pages/public/PublicSurveys'));
const WhatWeDo              = lazy(() => import('./pages/public/WhatWeDo'));
const Services              = lazy(() => import('./pages/public/Services'));
const Portfolios            = lazy(() => import('./pages/public/Portfolios'));
const DolNetwork            = lazy(() => import('./pages/public/DolNetwork'));
const DolRegionDetail       = lazy(() => import('./pages/public/DolRegionDetail'));
const KolProfilePage        = lazy(() => import('./pages/public/KolProfilePage'));

// ── App pages (lazy) ─────────────────────────────────────────────────────────
const Dashboard             = lazy(() => import('./pages/Dashboard'));
const ExploreOpportunities  = lazy(() => import('./pages/ExploreOpportunities'));
const Webinars              = lazy(() => import('./pages/Webinars'));
const WebinarDetail         = lazy(() => import('./pages/WebinarDetail'));
const OfficeHours           = lazy(() => import('./pages/OfficeHours'));
const OfficeHoursDetail     = lazy(() => import('./pages/OfficeHoursDetail'));
const ProgramRegisterWizard = lazy(() => import('./pages/ProgramRegisterWizard'));
const Surveys               = lazy(() => import('./pages/Surveys'));
const SurveyDetail          = lazy(() => import('./pages/SurveyDetail'));
const WatchVideo            = lazy(() => import('./pages/WatchVideo'));
const Earnings              = lazy(() => import('./pages/Earnings'));
const Payments              = lazy(() => import('./pages/Payments'));
const Settings              = lazy(() => import('./pages/Settings'));
const ChatBot               = lazy(() => import('./pages/ChatBot'));
const Podcasts              = lazy(() => import('./pages/Podcasts'));
const PodcastShow           = lazy(() => import('./pages/PodcastShow'));
const ChmDocs               = lazy(() => import('./pages/ChmDocs'));
const DiseaseAreas          = lazy(() => import('./pages/DiseaseAreas'));

// ── Admin pages (lazy) ───────────────────────────────────────────────────────
const AdminDashboard        = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminPrograms         = lazy(() => import('./pages/admin/AdminPrograms'));
const AdminSurveys          = lazy(() => import('./pages/admin/AdminSurveys'));
const AdminCreateSurvey     = lazy(() => import('./pages/admin/AdminCreateSurvey'));
const AdminEditSurvey       = lazy(() => import('./pages/admin/AdminEditSurvey'));
const AdminWebinarScheduler = lazy(() => import('./pages/admin/AdminWebinarScheduler'));
const AdminPayments         = lazy(() => import('./pages/admin/AdminPayments'));
const AdminHcpExplorer      = lazy(() => import('./pages/admin/AdminHcpExplorer'));
const AdminRxAnalytics      = lazy(() => import('./pages/admin/AdminRxAnalytics'));
const AdminSettings         = lazy(() => import('./pages/admin/AdminSettings'));
const AdminUsers            = lazy(() => import('./pages/admin/AdminUsers'));
const AdminProgramHub       = lazy(() => import('./pages/admin/AdminProgramHub'));
const AdminWebinarApprovals = lazy(() => import('./pages/admin/AdminWebinarApprovals'));

// ── Shared page-level loading fallback ───────────────────────────────────────
function PageLoader() {
  return (
    <div className="flex min-h-[30vh] items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-gray-400" aria-label="Loading…" />
    </div>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* =======================
                PUBLIC ROUTES
                ======================= */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<Navigate to="/home" replace />} />
              <Route path="/home" element={<Home />} />
              <Route path="/catalog/clip/:id" element={<ClipDetail />} />
              <Route path="/catalog/playlist/:playlistId" element={<PlaylistDetail />} />
              <Route path="/catalog/:diseaseSlug" element={<DiseaseDetail />} />
              <Route path="/catalog" element={<VideosPage />} />

              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/portfolios" element={<Portfolios />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/join" element={<Join />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/callback" element={<AuthCallback />} />
              <Route path="/complete-profile" element={<CompleteProfile />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/terms" element={<Terms />} />


              <Route path="/search" element={<Search />} />
              <Route path="/watch/:videoId" element={<WatchVideoRedirect />} />
              <Route path="/watch" element={<Navigate to="/catalog" replace />} />
              <Route path="/live" element={<PublicWebinars />} />
              <Route path="/live/:id" element={<PublicWebinarDetail />} />
              <Route path="/webinars" element={<Navigate to="/live" replace />} />
              <Route path="/webinars/:id" element={<PublicWebinarDetail />} />
              <Route path="/chm-office-hours/:id" element={<PublicOfficeHoursDetail />} />
              <Route path="/chm-office-hours" element={<PublicOfficeHours />} />
              <Route path="/office-hours/:id" element={<Navigate to="/chm-office-hours/:id" replace />} />
              <Route path="/office-hours" element={<Navigate to="/chm-office-hours" replace />} />
              <Route path="/surveys" element={<PublicSurveys />} />
              <Route path="/for-hcps" element={<ForHCPs />} />
              <Route path="/what-we-do" element={<WhatWeDo />} />
              <Route path="/chm-docs" element={<Navigate to="/home" replace />} />
              <Route path="/kol-network" element={<DolNetwork />} />
              <Route path="/kol-network/profile/:kolId" element={<KolProfilePage />} />
              <Route path="/kol-network/:regionSlug" element={<DolRegionDetail />} />
            </Route>

            {/* =======================
                APP ROUTES (UNDER /app)
                ======================= */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/app/home" replace />} />

              <Route path="home" element={<Dashboard />} />
              <Route path="search" element={<ExploreOpportunities />} />

              <Route path="live" element={<Webinars />} />
              <Route path="live/:id/register" element={<ProgramRegisterWizard />} />
              <Route path="live/:id" element={<WebinarDetail />} />
              <Route path="webinars" element={<Navigate to="/app/live" replace />} />
              <Route path="webinars/:id/register" element={<ProgramRegisterWizard />} />
              <Route path="webinars/:id" element={<WebinarDetail />} />

              <Route path="chm-office-hours" element={<OfficeHours />} />
              <Route path="chm-office-hours/:id/register" element={<ProgramRegisterWizard />} />
              <Route path="chm-office-hours/:id" element={<OfficeHoursDetail />} />
              <Route path="office-hours" element={<Navigate to="/app/chm-office-hours" replace />} />
              <Route path="office-hours/:id/register" element={<ProgramRegisterWizard />} />
              <Route path="office-hours/:id" element={<OfficeHoursDetail />} />

              <Route path="chm-docs" element={<Navigate to="/app/home" replace />} />
              <Route path="disease-areas" element={<Navigate to="/app/home" replace />} />

              <Route path="surveys" element={<Surveys />} />
              <Route path="surveys/:id" element={<SurveyDetail />} />

              <Route path="podcasts" element={<Podcasts />} />

              <Route path="watch/:videoId" element={<WatchVideo />} />
              <Route path="watch" element={<Navigate to={APP_CATALOG_CONVERSATIONS_HUB} replace />} />

              <Route path="clip/:id" element={<ClipDetail />} />

              <Route path="catalog/browse" element={<Navigate to="/app/search" replace />} />
              <Route path="catalog/playlist/:playlistId" element={<PlaylistDetail />} />
              <Route path="catalog/:diseaseSlug" element={<DiseaseDetail />} />
              <Route path="catalog" element={<VideosPage />} />

              <Route path="earnings" element={<Earnings />} />
              <Route path="chatbot" element={<ChatBot />} />
              <Route path="settings" element={<Settings />} />
              <Route path="payments" element={<Payments />} />

              <Route path="*" element={<Navigate to="/app/home" replace />} />
            </Route>

            {/* =======================
                BACK-COMPAT REDIRECTS
                ======================= */}
            <Route path="/surveys/:id" element={<SurveyRedirect />} />
            <Route path="/earnings" element={<Navigate to="/app/earnings" replace />} />
            <Route path="/payments" element={<Navigate to="/app/payments" replace />} />
            <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
            <Route path="/programs" element={<Navigate to="/app/webinars" replace />} />

            {/* =======================
                ADMIN ROUTES
                ======================= */}
            <Route
              path="/admin"
              element={
                <ProtectedRoute requireAdmin>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminDashboard />} />
              <Route path="programs" element={<AdminPrograms />} />
              <Route path="programs/:programId/hub" element={<AdminProgramHub />} />
              <Route path="webinar-approvals" element={<AdminWebinarApprovals />} />
              <Route path="office-hours" element={<AdminPrograms />} />
              <Route path="surveys" element={<AdminSurveys />} />
              <Route path="surveys/:id/edit" element={<AdminEditSurvey />} />
              <Route path="create-survey" element={<AdminCreateSurvey />} />
              <Route path="webinar-scheduler" element={<AdminWebinarScheduler defaultZoomSessionType="WEBINAR" />} />
              <Route
                path="office-hours-scheduler"
                element={<AdminWebinarScheduler defaultZoomSessionType="MEETING" lockSessionType />}
              />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="hcp-explorer" element={<AdminHcpExplorer />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="rx-analytics" element={<AdminRxAnalytics />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

function SurveyRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/app/surveys/${id}` : '/app/surveys'} replace />;
}

function WatchVideoRedirect() {
  const { videoId } = useParams<{ videoId: string }>();
  return <Navigate to={videoId ? `/catalog/clip/${videoId}` : '/catalog'} replace />;
}
