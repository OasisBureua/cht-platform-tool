import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import ScrollToTop from './components/ScrollToTop';
import { Loader2 } from 'lucide-react';

// Layouts + guards: always needed immediately, keep static
import PublicLayout from './layouts/PublicLayout';
import Layout from './components/layout/Layout';
import AdminLayout from './layouts/AdminLayout';
import ProtectedRoute from './components/ProtectedRoute';
import HoldTestappPublicHome from './components/HoldTestappPublicHome';
import { APP_CATALOG_CONVERSATIONS_HUB } from './components/navigation/appNavItems';
import { isCompanionEnabled } from './config/app-urls';

// ── Public pages (lazy) ───────────────────────────────────────────────────────
const Home                  = lazy(() => import('./pages/public/Home'));
const HomeBento             = lazy(() => import('./pages/public/HomeBento'));
const ClipDetail            = lazy(() => import('./pages/public/ClipDetail'));
const PlaylistDetail        = lazy(() => import('./pages/public/PlaylistDetail'));
const About                 = lazy(() => import('./pages/public/About'));
const Contact               = lazy(() => import('./pages/public/Contact'));
const Join                  = lazy(() => import('./pages/public/Join'));
const VerifyEmail           = lazy(() => import('./pages/public/VerifyEmail'));
const Login                 = lazy(() => import('./pages/public/Login'));
const AdminLogin            = lazy(() => import('./pages/public/AdminLogin'));
const ForgotPassword        = lazy(() => import('./pages/public/ForgotPassword'));
const ResetPasswordConfirm  = lazy(() => import('./pages/public/ResetPasswordConfirm'));
const MfaSetup              = lazy(() => import('./pages/public/MfaSetup'));
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
const ZoomSessionPage       = lazy(() => import('./pages/ZoomSessionPage'));
const ProgramRegisterWizard = lazy(() => import('./pages/ProgramRegisterWizard'));
const LiveMultiRegister     = lazy(() => import('./pages/LiveMultiRegister'));
const Surveys               = lazy(() => import('./pages/Surveys'));
const SurveyDetail          = lazy(() => import('./pages/SurveyDetail'));
const WatchVideo            = lazy(() => import('./pages/WatchVideo'));
const Earnings              = lazy(() => import('./pages/Earnings'));
const Payments              = lazy(() => import('./pages/Payments'));
const Settings              = lazy(() => import('./pages/Settings'));
const Podcasts              = lazy(() => import('./pages/Podcasts'));
const PodcastShow           = lazy(() => import('./pages/PodcastShow'));
const PodcastEpisodeWatch   = lazy(() => import('./pages/PodcastEpisodeWatch'));
const CompanionChat         = lazy(() => import('./pages/CompanionChat'));
const KolNetwork            = lazy(() => import('./pages/KolNetwork'));
const PodcastNetwork        = lazy(() => import('./pages/public/PodcastNetwork'));
const PodcastNetworkShow    = lazy(() => import('./pages/public/PodcastNetworkShow'));

// ── Admin pages (lazy) ───────────────────────────────────────────────────────
const AdminDashboard        = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminPrograms         = lazy(() => import('./pages/admin/AdminPrograms'));
const AdminLiveLayout       = lazy(() => import('./pages/admin/AdminLiveLayout'));
const AdminZoomRecordingsLayout = lazy(() => import('./pages/admin/AdminZoomRecordingsLayout'));
const AdminZoomRecordingsList   = lazy(() => import('./pages/admin/AdminZoomRecordingsList'));
const AdminZoomRecordingDetail = lazy(() => import('./pages/admin/AdminZoomRecordingDetail'));
const AdminSurveys          = lazy(() => import('./pages/admin/AdminSurveys'));
const AdminSurveyResponses  = lazy(() => import('./pages/admin/AdminSurveyResponses'));
const AdminCreateSurvey     = lazy(() => import('./pages/admin/AdminCreateSurvey'));
const AdminEditSurvey       = lazy(() => import('./pages/admin/AdminEditSurvey'));
const AdminWebinarScheduler = lazy(() => import('./pages/admin/AdminWebinarScheduler'));
const AdminPayments         = lazy(() => import('./pages/admin/AdminPayments'));
const AdminHcpExplorer      = lazy(() => import('./pages/admin/AdminHcpExplorer'));
const AdminRxAnalytics      = lazy(() => import('./pages/admin/AdminRxAnalytics'));
const AdminAuditLog         = lazy(() => import('./pages/admin/AdminAuditLog'));
const AdminSettings         = lazy(() => import('./pages/admin/AdminSettings'));
const AdminUsers            = lazy(() => import('./pages/admin/AdminUsers'));
const AdminContent          = lazy(() => import('./pages/admin/AdminContent'));
const AdminProgramHub       = lazy(() => import('./pages/admin/AdminProgramHub'));
const AdminWebinarApprovals = lazy(() => import('./pages/admin/AdminWebinarApprovals'));
const AdminKolDirectory     = lazy(() => import('./pages/admin/kol-network/AdminKolDirectory'));
const AdminHcpIntel         = lazy(() => import('./pages/admin/kol-network/AdminHcpIntel'));
const AdminCampaignsLayout = lazy(() => import('./pages/admin/AdminCampaignsLayout'));
const AdminCampaignsDashboard = lazy(() => import('./pages/admin/AdminCampaignsDashboard'));
const AdminCampaignsFunnel = lazy(() => import('./pages/admin/AdminCampaignsFunnel'));
const AdminCampaignDetail = lazy(() => import('./pages/admin/AdminCampaignDetail'));

// ── Content Hub (admin report generator, lazy) ───────────────────────────────
const ContentHubLayout          = lazy(() => import('./pages/admin/content-hub/components/ContentHubLayout'));
const ContentHubDashboard       = lazy(() => import('./pages/admin/content-hub/Dashboard'));
const ContentHubNewReport       = lazy(() => import('./pages/admin/content-hub/NewReport'));
const ContentHubTemplates       = lazy(() => import('./pages/admin/content-hub/Templates'));
const ContentHubIntegrations    = lazy(() => import('./pages/admin/content-hub/Integrations'));
const ContentHubCampaignDetail  = lazy(() => import('./pages/admin/content-hub/CampaignDetail'));
const ContentHubUploadData      = lazy(() => import('./pages/admin/content-hub/UploadData'));
const ContentHubAnalyticsReport = lazy(() => import('./pages/admin/content-hub/AnalyticsReport'));
const ContentHubExecutiveReport = lazy(() => import('./pages/admin/content-hub/ExecutiveReport'));

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
      refetchOnWindowFocus: true,
      // One retry for flaky network; never retry 429 (retries worsen Nest rate limits).
      retry: (failureCount, error) => {
        if (isAxiosError(error) && error.response?.status === 429) return false;
        return failureCount < 1;
      },
      staleTime: 60 * 1000,
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
              {/* Homepage at `/`; `/home` kept as a legacy alias. */}
              <Route
                path="/"
                element={
                  <HoldTestappPublicHome>
                    <HomeBento />
                  </HoldTestappPublicHome>
                }
              />
              <Route path="/home" element={<Navigate to="/" replace />} />
              {/* Order B, kept for comparison. Not linked from the nav. */}
              <Route
                path="/home-tame"
                element={
                  <HoldTestappPublicHome>
                    <Home />
                  </HoldTestappPublicHome>
                }
              />
              <Route path="/catalog/clip/:id" element={<ClipDetail />} />
              <Route path="/catalog/playlist/:playlistId" element={<PlaylistDetail />} />
              <Route path="/catalog/playlist/series/:playlistId" element={<PlaylistDetail />} />
              <Route path="/catalog/:diseaseSlug" element={<DiseaseDetail />} />
              <Route path="/catalog" element={<VideosPage />} />

              <Route path="/about" element={<About />} />
              <Route path="/services" element={<Services />} />
              <Route path="/portfolios" element={<Portfolios />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/join" element={<Join />} />
              <Route path="/verify-email" element={<VerifyEmail />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password/confirm" element={<ResetPasswordConfirm />} />
              <Route path="/mfa/setup" element={<MfaSetup />} />
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
              <Route path="/webinars/:id" element={<LegacyWebinarDetailRedirect />} />
              <Route path="/office-hours" element={<PublicOfficeHours />} />
              <Route path="/office-hours/:id" element={<PublicOfficeHoursDetail />} />
              {/* Legacy branded Office Hours paths */}
              <Route path="/chm-office-hours" element={<Navigate to="/office-hours" replace />} />
              <Route path="/chm-office-hours/:id" element={<LegacyOfficeHoursDetailRedirect />} />
              <Route path="/surveys" element={<PublicSurveys />} />
              <Route path="/for-hcps" element={<ForHCPs />} />
              {/* Merged into /about: one page for who we are and what we run. */}
              <Route path="/what-we-do" element={<Navigate to="/about" replace />} />
              <Route path="/chm-docs" element={<Navigate to="/" replace />} />
              {/* Clean public URLs: /kols, /kols/:slug, /kols/states/:code */}
              <Route path="/kols" element={<DolNetwork />} />
              <Route path="/kols/states/:regionSlug" element={<DolRegionDetail />} />
              <Route path="/kols/:kolId" element={<KolProfilePage />} />
              <Route path="/podcast-network" element={<PodcastNetwork />} />
              <Route path="/podcast-network/:showId" element={<PodcastNetworkShow />} />
              {/* Legacy KOL paths */}
              <Route path="/kol-network" element={<Navigate to="/kols" replace />} />
              <Route path="/kol-network/profile/:kolId" element={<LegacyKolProfileRedirect />} />
              <Route path="/kol-network/:regionSlug" element={<LegacyKolRegionRedirect />} />
            </Route>

            {/* =======================
                APP ROUTES (UNDER /app)
                Session pages sit outside Layout so Welcome chrome never shows.
                ======================= */}
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <Outlet />
                </ProtectedRoute>
              }
            >
              {/* Full-screen Zoom — declared before Layout so they outrank live/:id */}
              <Route path="live/:id/session" element={<ZoomSessionPage sessionKind="WEBINAR" />} />
              <Route path="webinars/:id/session" element={<ZoomSessionPage sessionKind="WEBINAR" />} />
              <Route
                path="office-hours/:id/session"
                element={<ZoomSessionPage sessionKind="MEETING" />}
              />
              <Route
                path="chm-office-hours/:id/session"
                element={<ZoomSessionPage sessionKind="MEETING" />}
              />

              <Route element={<Layout />}>
                <Route index element={<Navigate to="/app/home" replace />} />

                <Route path="home" element={<Dashboard />} />
                <Route path="search" element={<ExploreOpportunities />} />

                <Route path="live" element={<Webinars />} />
                <Route path="live/register-multiple" element={<LiveMultiRegister />} />
                <Route path="live/:id/register" element={<ProgramRegisterWizard />} />
                <Route path="live/:id" element={<WebinarDetail />} />
                <Route path="webinars" element={<Navigate to="/app/live" replace />} />
                <Route path="webinars/:id/register" element={<LegacyAppWebinarRegisterRedirect />} />
                <Route path="webinars/:id" element={<LegacyAppWebinarDetailRedirect />} />

                <Route path="office-hours" element={<OfficeHours />} />
                <Route path="office-hours/:id/register" element={<ProgramRegisterWizard />} />
                <Route path="office-hours/:id" element={<OfficeHoursDetail />} />
                {/* Legacy branded Office Hours paths */}
                <Route path="chm-office-hours" element={<Navigate to="/app/office-hours" replace />} />
                <Route
                  path="chm-office-hours/:id/register"
                  element={<LegacyAppOfficeHoursRegisterRedirect />}
                />
                <Route path="chm-office-hours/:id" element={<LegacyAppOfficeHoursDetailRedirect />} />

                <Route path="chm-docs" element={<Navigate to="/app/home" replace />} />
                <Route path="disease-areas" element={<Navigate to="/app/home" replace />} />

                <Route path="surveys" element={<Surveys />} />
                <Route path="surveys/:id" element={<SurveyDetail />} />

                <Route path="podcast-network" element={<Podcasts />} />
                <Route path="podcast-network/:showId/watch/:episodeId" element={<PodcastEpisodeWatch />} />
                <Route path="podcast-network/:showId" element={<PodcastShow />} />
                {/* Legacy in-app podcast paths */}
                <Route path="podcasts" element={<Navigate to="/app/podcast-network" replace />} />
                <Route
                  path="podcasts/:showId/watch/:episodeId"
                  element={<LegacyAppPodcastWatchRedirect />}
                />
                <Route path="podcasts/:showId" element={<LegacyAppPodcastShowRedirect />} />

                <Route path="watch/:videoId" element={<WatchVideo />} />
                <Route path="watch" element={<Navigate to={APP_CATALOG_CONVERSATIONS_HUB} replace />} />

                <Route path="clip/:id" element={<ClipDetail />} />
                {/* Legacy in-app links used /app/catalog/clip/:id, keep working */}
                <Route path="catalog/clip/:id" element={<ClipDetail />} />

                <Route path="catalog/browse" element={<Navigate to="/app/search" replace />} />
                <Route path="catalog/playlist/:playlistId" element={<PlaylistDetail />} />
                <Route path="catalog/playlist/series/:playlistId" element={<PlaylistDetail />} />
                <Route path="catalog/:diseaseSlug" element={<DiseaseDetail />} />
                <Route path="catalog" element={<VideosPage />} />

                <Route path="kols" element={<KolNetwork />} />
                <Route path="kols/states/:regionSlug" element={<DolRegionDetail />} />
                <Route path="kols/:kolId" element={<KolProfilePage />} />
                {/* Legacy in-app KOL paths */}
                <Route path="kol-network" element={<Navigate to="/app/kols" replace />} />
                <Route path="kol-network/profile/:kolId" element={<LegacyAppKolProfileRedirect />} />
                <Route path="kol-network/:regionSlug" element={<LegacyAppKolRegionRedirect />} />

                <Route path="earnings" element={<Earnings />} />
                {isCompanionEnabled() ? (
                  <Route path="chatbot" element={<CompanionChat />} />
                ) : (
                  <Route path="chatbot" element={<Navigate to="/app/home" replace />} />
                )}
                <Route path="settings" element={<Settings />} />
                <Route path="payments" element={<Payments />} />

                <Route path="*" element={<Navigate to="/app/home" replace />} />
              </Route>
            </Route>

            {/* =======================
                BACK-COMPAT REDIRECTS
                ======================= */}
            <Route path="/surveys/:id" element={<SurveyRedirect />} />
            <Route path="/earnings" element={<Navigate to="/app/earnings" replace />} />
            <Route path="/payments" element={<Navigate to="/app/payments" replace />} />
            <Route path="/settings" element={<Navigate to="/app/settings" replace />} />
            <Route path="/programs" element={<Navigate to="/app/live" replace />} />

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
              <Route path="programs" element={<AdminLiveLayout />}>
                <Route index element={<AdminPrograms />} />
                <Route path="zoom-recordings" element={<AdminZoomRecordingsLayout />}>
                  <Route index element={<AdminZoomRecordingsList filter="all" />} />
                  <Route path="zoom-only" element={<AdminZoomRecordingsList filter="unlinked" />} />
                  <Route path="linked" element={<AdminZoomRecordingsList filter="linked" />} />
                </Route>
                <Route path="zoom-recordings/:sessionId" element={<AdminZoomRecordingDetail />} />
              </Route>
              <Route path="programs/:programId" element={<AdminProgramHubRedirect />} />
              <Route path="programs/:programId/hub" element={<AdminProgramHub />} />
              <Route path="webinar-approvals" element={<AdminWebinarApprovals />} />
              <Route path="office-hours" element={<AdminPrograms />} />
              <Route path="surveys" element={<AdminSurveys />} />
              <Route path="surveys/:id/responses" element={<AdminSurveyResponses />} />
              <Route path="surveys/:id/edit" element={<AdminEditSurvey />} />
              <Route path="create-survey" element={<AdminCreateSurvey />} />
              <Route path="webinar-scheduler" element={<AdminWebinarScheduler defaultZoomSessionType="WEBINAR" />} />
              <Route path="webinars/schedule" element={<Navigate to="/admin/webinar-scheduler" replace />} />
              <Route
                path="office-hours-scheduler"
                element={<AdminWebinarScheduler defaultZoomSessionType="MEETING" lockSessionType />}
              />
              <Route path="office-hours/schedule" element={<Navigate to="/admin/office-hours-scheduler" replace />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="settings" element={<AdminSettings />} />
              <Route path="hcp-explorer" element={<AdminHcpExplorer />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="content" element={<AdminContent />} />
              <Route path="rx-analytics" element={<AdminRxAnalytics />} />
              <Route path="audit-log" element={<AdminAuditLog />} />

              {/* KOL Network: internal HCP intelligence (ported from MediaHub) */}
              <Route path="kol-network" element={<AdminKolDirectory />} />
              <Route path="kol-network/hcps/:id" element={<AdminHcpIntel />} />


              <Route path="campaigns-dashboard" element={<AdminCampaignsLayout />}>
                <Route index element={<AdminCampaignsDashboard />} />
                <Route path="funnel" element={<AdminCampaignsFunnel />} />
              </Route>
              <Route path="campaigns-dashboard/:campaignId" element={<AdminCampaignDetail />} />

              {/* Content Hub: ported report generator (self-contained, localStorage data layer) */}
              <Route path="content-hub" element={<ContentHubLayout />}>
                <Route index element={<ContentHubDashboard />} />
                <Route path="new" element={<ContentHubNewReport />} />
                <Route path="templates" element={<ContentHubTemplates />} />
                <Route path="integrations" element={<ContentHubIntegrations />} />
                <Route path="campaigns/:id" element={<ContentHubCampaignDetail />} />
                <Route path="campaigns/:id/upload" element={<ContentHubUploadData />} />
                <Route path="campaigns/:id/report" element={<ContentHubAnalyticsReport />} />
                <Route path="campaigns/:id/executive-report" element={<ContentHubExecutiveReport />} />
              </Route>
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

function AdminProgramHubRedirect() {
  const { programId } = useParams<{ programId: string }>();
  if (!programId) return <Navigate to="/admin/programs" replace />;
  return <Navigate to={`/admin/programs/${programId}/hub`} replace />;
}

function WatchVideoRedirect() {
  const { videoId } = useParams<{ videoId: string }>();
  return <Navigate to={videoId ? `/catalog/clip/${videoId}` : '/catalog'} replace />;
}

function LegacyKolProfileRedirect() {
  const { kolId } = useParams<{ kolId: string }>();
  return <Navigate to={kolId ? `/kols/${encodeURIComponent(kolId)}` : '/kols'} replace />;
}

function LegacyKolRegionRedirect() {
  const { regionSlug } = useParams<{ regionSlug: string }>();
  return (
    <Navigate
      to={regionSlug ? `/kols/states/${encodeURIComponent(regionSlug)}` : '/kols'}
      replace
    />
  );
}

function LegacyAppKolProfileRedirect() {
  const { kolId } = useParams<{ kolId: string }>();
  return <Navigate to={kolId ? `/app/kols/${encodeURIComponent(kolId)}` : '/app/kols'} replace />;
}

function LegacyAppKolRegionRedirect() {
  const { regionSlug } = useParams<{ regionSlug: string }>();
  return (
    <Navigate
      to={regionSlug ? `/app/kols/states/${encodeURIComponent(regionSlug)}` : '/app/kols'}
      replace
    />
  );
}

function LegacyWebinarDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/live/${encodeURIComponent(id)}` : '/live'} replace />;
}

function LegacyOfficeHoursDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate to={id ? `/office-hours/${encodeURIComponent(id)}` : '/office-hours'} replace />
  );
}

function LegacyAppWebinarDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  return <Navigate to={id ? `/app/live/${encodeURIComponent(id)}` : '/app/live'} replace />;
}

function LegacyAppWebinarRegisterRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate
      to={id ? `/app/live/${encodeURIComponent(id)}/register` : '/app/live'}
      replace
    />
  );
}

function LegacyAppOfficeHoursDetailRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate
      to={id ? `/app/office-hours/${encodeURIComponent(id)}` : '/app/office-hours'}
      replace
    />
  );
}

function LegacyAppOfficeHoursRegisterRedirect() {
  const { id } = useParams<{ id: string }>();
  return (
    <Navigate
      to={id ? `/app/office-hours/${encodeURIComponent(id)}/register` : '/app/office-hours'}
      replace
    />
  );
}

function LegacyAppPodcastShowRedirect() {
  const { showId } = useParams<{ showId: string }>();
  return (
    <Navigate
      to={showId ? `/app/podcast-network/${encodeURIComponent(showId)}` : '/app/podcast-network'}
      replace
    />
  );
}

function LegacyAppPodcastWatchRedirect() {
  const { showId, episodeId } = useParams<{ showId: string; episodeId: string }>();
  if (!showId || !episodeId) {
    return <Navigate to="/app/podcast-network" replace />;
  }
  return (
    <Navigate
      to={`/app/podcast-network/${encodeURIComponent(showId)}/watch/${encodeURIComponent(episodeId)}`}
      replace
    />
  );
}
