import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ScrollToTop from './components/ScrollToTop';

// Public layout + pages
import PublicLayout from './layouts/PublicLayout';
import Home from './pages/public/Home';
import Catalog from './pages/public/Catalog';
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
import Search from './pages/public/Search';
import ForHCPs from './pages/public/ForHCPs';
import PublicWebinars from './pages/public/PublicWebinars';
import PublicWebinarDetail from './pages/public/PublicWebinarDetail';
import PublicSurveys from './pages/public/PublicSurveys';
import WhatWeDo from './pages/public/WhatWeDo';
import Services from './pages/public/Services';
import Portfolios from './pages/public/Portfolios';
import DolNetwork from './pages/public/DolNetwork';
import Terms from './pages/public/Terms';

// App layout (existing)
import Layout from './components/layout/Layout';

// App pages
import ExploreOpportunities from './pages/ExploreOpportunities';
import Webinars from './pages/Webinars';
import WebinarDetail from './pages/WebinarDetail';
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
import AdminWebinarScheduler from './pages/admin/AdminWebinarScheduler';
import AdminPayments from './pages/admin/AdminPayments';
import AdminHcpExplorer from './pages/admin/AdminHcpExplorer';
import AdminRxAnalytics from './pages/admin/AdminRxAnalytics';
import AdminSettings from './pages/admin/AdminSettings';
import AdminUsers from './pages/admin/AdminUsers';

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
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/catalog/clip/:id" element={<ClipDetail />} />
            <Route path="/catalog/playlist/:playlistId" element={<PlaylistDetail />} />
            <Route path="/catalog/:diseaseSlug" element={<DiseaseDetail />} />

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
            <Route path="/watch" element={<Navigate to="/catalog" replace />} />
            <Route path="/watch/:videoId" element={<WatchVideoRedirect />} />
            <Route path="/webinars" element={<PublicWebinars />} />
            <Route path="/webinars/:id" element={<PublicWebinarDetail />} />
            <Route path="/surveys" element={<PublicSurveys />} />
            <Route path="/for-hcps" element={<ForHCPs />} />
            <Route path="/what-we-do" element={<WhatWeDo />} />
            <Route path="/kol-network" element={<DolNetwork />} />
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

            {/* Webinars */}
            <Route path="webinars" element={<Webinars />} />
            <Route path="webinars/:id" element={<WebinarDetail />} />

            {/* Surveys */}
            <Route path="surveys" element={<Surveys />} />
            <Route path="surveys/:id" element={<SurveyDetail />} />

            {/* Watch redirects to catalog */}
            <Route path="watch" element={<Navigate to="/app/catalog" replace />} />
            <Route path="watch/:videoId" element={<WatchVideo />} />

            {/* Clip detail (MediaHub clips - stays in app) */}
            <Route path="clip/:id" element={<ClipDetail />} />

            {/* Catalog (YouTube playlists - same as public, stays in app) */}
            <Route path="catalog" element={<Catalog />} />
            <Route path="catalog/playlist/:playlistId" element={<PlaylistDetail />} />
            <Route path="catalog/:diseaseSlug" element={<DiseaseDetail />} />

            {/* Earnings + ChatBot + Settings (Payments moved to admin) */}
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
            <Route path="surveys" element={<AdminSurveys />} />
            <Route path="create-survey" element={<AdminCreateSurvey />} />
            <Route path="webinar-scheduler" element={<AdminWebinarScheduler />} />
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
