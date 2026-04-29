import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScrollToTop from './components/ScrollToTop';

// Public layout + pages
import PublicLayout from './layouts/PublicLayout';
import Home from './pages/public/Home';
import ClipDetail from './pages/public/ClipDetail';
import PlaylistDetail from './pages/public/PlaylistDetail';
import About from './pages/public/About';
import Contact from './pages/public/Contact';
import Join from './pages/public/Join';
import Login from './pages/public/Login';
import AdminLogin from './pages/public/AdminLogin';
import ForgotPassword from './pages/public/ForgotPassword';
import AuthCallback from './pages/public/AuthCallback';
import CompleteProfile from './pages/public/CompleteProfile';
import Privacy from './pages/public/Privacy';
import DiseaseDetail from './pages/public/DiseaseDetail';
import VideosPage from './pages/public/VideosPage';
import Search from './pages/public/Search';
import ForHCPs from './pages/public/ForHCPs';
import PublicWebinars from './pages/public/PublicWebinars';
import PublicWebinarDetail from './pages/public/PublicWebinarDetail';
import PublicOfficeHours from './pages/public/PublicOfficeHours';
import PublicOfficeHoursDetail from './pages/public/PublicOfficeHoursDetail';
import PublicSurveys from './pages/public/PublicSurveys';
import WhatWeDo from './pages/public/WhatWeDo';
import Services from './pages/public/Services';
import Portfolios from './pages/public/Portfolios';
import Terms from './pages/public/Terms';

// App layout (existing)
import Layout from './components/layout/Layout';

// App pages
import ExploreOpportunities from './pages/ExploreOpportunities';
import Webinars from './pages/Webinars';
import WebinarDetail from './pages/WebinarDetail';
import OfficeHours from './pages/OfficeHours';
import OfficeHoursDetail from './pages/OfficeHoursDetail';
import ProgramRegisterWizard from './pages/ProgramRegisterWizard';
import Surveys from './pages/Surveys';
import SurveyDetail from './pages/SurveyDetail';
import Watch from './pages/Watch';
import WatchVideo from './pages/WatchVideo';
import Earnings from './pages/Earnings';
import Payments from './pages/Payments';
import Settings from './pages/Settings';
import ChatBot from './pages/ChatBot';
// =======================
// ADMIN ROUTES
// =======================
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPrograms from './pages/admin/AdminPrograms';
import AdminSurveys from './pages/admin/AdminSurveys';
import AdminCreateSurvey from './pages/admin/AdminCreateSurvey';
import AdminEditSurvey from './pages/admin/AdminEditSurvey';
import AdminWebinarScheduler from './pages/admin/AdminWebinarScheduler';
import AdminPayments from './pages/admin/AdminPayments';
import AdminHcpExplorer from './pages/admin/AdminHcpExplorer';
import AdminRxAnalytics from './pages/admin/AdminRxAnalytics';
import AdminSettings from './pages/admin/AdminSettings';
import AdminUsers from './pages/admin/AdminUsers';
import AdminProgramHub from './pages/admin/AdminProgramHub';
import AdminWebinarApprovals from './pages/admin/AdminWebinarApprovals';

// optional legacy page
import Dashboard from './pages/Dashboard';
import ProtectedRoute from './components/ProtectedRoute';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ScrollToTop />
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
            {/* KOL / CHM Docs directory hidden; bookmarked URLs go home */}
            <Route path="/kol-network" element={<Navigate to="/home" replace />} />
            <Route path="/kol-network/:regionSlug" element={<Navigate to="/home" replace />} />
          </Route>

          {/* =======================
              APP ROUTES (NOW UNDER /app)
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

            {/* Home + Search */}
            <Route path="home" element={<Dashboard />} />
            <Route path="search" element={<ExploreOpportunities />} />

            {/* Live (formerly Webinars) */}
            <Route path="live" element={<Webinars />} />
            <Route path="live/:id/register" element={<ProgramRegisterWizard />} />
            <Route path="live/:id" element={<WebinarDetail />} />
            <Route path="webinars" element={<Navigate to="/app/live" replace />} />
            <Route path="webinars/:id/register" element={<ProgramRegisterWizard />} />
            <Route path="webinars/:id" element={<WebinarDetail />} />

            {/* CHM Office Hours */}
            <Route path="chm-office-hours" element={<OfficeHours />} />
            <Route path="chm-office-hours/:id/register" element={<ProgramRegisterWizard />} />
            <Route path="chm-office-hours/:id" element={<OfficeHoursDetail />} />
            <Route path="office-hours" element={<Navigate to="/app/chm-office-hours" replace />} />
            <Route path="office-hours/:id/register" element={<ProgramRegisterWizard />} />
            <Route path="office-hours/:id" element={<OfficeHoursDetail />} />

            {/* CHM Docs; direct URLs redirect home */}
            <Route path="chm-docs" element={<Navigate to="/app/home" replace />} />

            {/* Disease Areas: hidden from nav; bookmarked URLs redirect home */}
            <Route path="disease-areas" element={<Navigate to="/app/home" replace />} />

            {/* Surveys */}
            <Route path="surveys" element={<Surveys />} />
            <Route path="surveys/:id" element={<SurveyDetail />} />

            {/* Podcasts page hidden; bookmarked URLs go home */}
            <Route path="podcasts" element={<Navigate to="/app/home" replace />} />

            <Route path="watch/:videoId" element={<WatchVideo />} />
            <Route path="watch" element={<Navigate to="/app/catalog" replace />} />

            {/* Clip detail (MediaHub clips - stays in app) */}
            <Route path="clip/:id" element={<ClipDetail />} />

            {/* Catalog (playlists + clips; stays in app) */}
            <Route path="catalog/playlist/:playlistId" element={<PlaylistDetail />} />
            <Route path="catalog/:diseaseSlug" element={<DiseaseDetail />} />
            <Route path="catalog" element={<VideosPage />} />

            {/* Earnings + ChatBot + Settings (Payments: Settings → Payment Settings) */}
            <Route path="earnings" element={<Earnings />} />
            <Route path="chatbot" element={<ChatBot />} />
            <Route path="settings" element={<Settings />} />
            <Route path="payments" element={<Payments />} />

            {/* Catch-all within /app */}
            <Route path="*" element={<Navigate to="/app/home" replace />} />
          </Route>

          {/* =======================
              BACK-COMPAT REDIRECTS
              ======================= */}
          <Route path="/surveys/:id" element={<SurveyRedirect />} />


          <Route path="/earnings" element={<Navigate to="/app/earnings" replace />} />
          <Route path="/payments" element={<Navigate to="/app/payments" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* Old legacy paths you mentioned */}
          <Route path="/programs" element={<Navigate to="/app/webinars" replace />} />
          
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
