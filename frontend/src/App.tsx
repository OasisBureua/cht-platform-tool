import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Public layout + pages
import PublicLayout from './layouts/PublicLayout';
import Home from './pages/public/Home';
import Catalog from './pages/public/Catalog';
import PublicWatch from './pages/public/PublicWatch';
import About from './pages/public/About';
import Contact from './pages/public/Contact';
import Join from './pages/public/Join';
import Login from './pages/public/Login';
import Privacy from './pages/public/Privacy';

// App layout (existing)
import Layout from './components/layout/Layout';

// App pages
import Webinars from './pages/Webinars';
import WebinarDetail from './pages/WebinarDetail';
import Surveys from './pages/Surveys';
import SurveyDetail from './pages/SurveyDetail';
import Watch from './pages/Watch';
import WatchVideo from './pages/WatchVideo';
import Earnings from './pages/Earnings';
import Settings from './pages/Settings';
import Payments from './pages/Payments';

// =======================
// ADMIN ROUTES
// =======================
import AdminLayout from './layouts/AdminLayout';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminPrograms from './pages/admin/AdminPrograms';
import AdminSurveys from './pages/admin/AdminSurveys';
import AdminPayments from './pages/admin/AdminPayments';
import AdminUsers from './pages/admin/AdminUsers';

// optional legacy page
import Dashboard from './pages/Dashboard';

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
        <Routes>
          {/* =======================
              PUBLIC ROUTES
              ======================= */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/catalog" element={<Catalog />} />
            <Route path="/watch/:videoId" element={<PublicWatch />} />

            {/* Public placeholders (so nav doesn't 404 yet) */}
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/join" element={<Join />} />
            <Route path="/login" element={<Login />} />
            <Route path="/privacy" element={<Privacy />} />

          </Route>

          {/* =======================
              APP ROUTES (NOW UNDER /app)
              ======================= */}
          <Route path="/app" element={<Layout />}>
            <Route index element={<Navigate to="/app/webinars" replace />} />

            {/* Webinars */}
            <Route path="webinars" element={<Webinars />} />
            <Route path="webinars/:id" element={<WebinarDetail />} />

            {/* Surveys */}
            <Route path="surveys" element={<Surveys />} />
            <Route path="surveys/:id" element={<SurveyDetail />} />

            {/* Watch (app experience) */}
            <Route path="watch" element={<Watch />} />
            <Route path="watch/:videoId" element={<WatchVideo />} />

            {/* Earnings + Settings + Payments */}
            <Route path="earnings" element={<Earnings />} />
            <Route path="settings" element={<Settings />} />
            <Route path="payments" element={<Payments />} />

            {/* Optional legacy */}
            <Route path="home" element={<Dashboard />} />

            {/* Catch-all within /app */}
            <Route path="*" element={<Navigate to="/app/webinars" replace />} />
          </Route>

          {/* =======================
              BACK-COMPAT REDIRECTS
              ======================= */}
          <Route path="/webinars" element={<Navigate to="/app/webinars" replace />} />
          <Route path="/webinars/:id" element={<WebinarRedirect />} />

          <Route path="/surveys" element={<Navigate to="/app/surveys" replace />} />
          <Route path="/surveys/:id" element={<SurveyRedirect />} />

          <Route path="/watch" element={<Navigate to="/app/watch" replace />} />
          <Route path="/watch/:videoId" element={<WatchRedirect />} />

          <Route path="/earnings" element={<Navigate to="/app/earnings" replace />} />
          <Route path="/payments" element={<Navigate to="/app/payments" replace />} />
          <Route path="/settings" element={<Navigate to="/app/settings" replace />} />

          {/* Old legacy paths you mentioned */}
          <Route path="/programs" element={<Navigate to="/app/webinars" replace />} />
          
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="programs" element={<AdminPrograms />} />
            <Route path="surveys" element={<AdminSurveys />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;

function WebinarRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/app/webinars/${id}` : '/app/webinars'} replace />;
}

function SurveyRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/app/surveys/${id}` : '/app/surveys'} replace />;
}

function WatchRedirect() {
  const { videoId } = useParams<{ videoId: string }>();
  return <Navigate to={videoId ? `/app/watch/${videoId}` : '/app/watch'} replace />;
}