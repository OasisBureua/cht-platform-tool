import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../contexts/AuthContext';
import { webinarsApi } from '../../api/webinars';
import { ChevronLeft, Calendar, Clock, LogIn, UserPlus } from 'lucide-react';
import LoadingSpinner from '../../components/ui/LoadingSpinner';

function formatDate(iso?: string) {
  if (!iso) return null;
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function formatDuration(mins?: number) {
  if (!mins) return null;
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export default function PublicWebinarDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const { data: webinar, isLoading, isError } = useQuery({
    queryKey: ['webinar', id],
    queryFn: () => webinarsApi.getById(id!),
    enabled: !!id,
    retry: false,
  });

  const isProgram = webinar?.source === 'program' && webinar?.id && !webinar.id.startsWith('zoom-');

  if (isLoading) return <LoadingSpinner />;

  if (isError || !webinar) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center px-6">
        <div className="text-center">
          <h2 className="text-xl font-bold text-foreground">Session not found</h2>
          <p className="mt-2 text-sm text-muted-foreground">That link may be invalid or expired.</p>
          <Link
            to="/live"
            className="mt-6 inline-flex items-center gap-2 rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            Back to Live
          </Link>
        </div>
      </div>
    );
  }

  if (isAuthenticated && user && isProgram) {
    navigate(`/app/live/${webinar.id}`, { replace: true });
    return <LoadingSpinner />;
  }

  const showLoginPrompt = !isAuthenticated || !user;

  return (
    <div className="bg-card min-h-screen">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 py-8 sm:py-10 space-y-8">
        <Link
          to="/live"
          className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to Live
        </Link>

        <div className="rounded-card border border-border overflow-hidden bg-card">
          {webinar.imageUrl && (
            <div className="aspect-video bg-muted">
              <img
                src={webinar.imageUrl}
                alt=""
                className="h-full w-full object-cover"
                loading="eager"
                referrerPolicy="no-referrer"
              />
            </div>
          )}
          <div className="p-6 md:p-8 space-y-6">
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{webinar.title}</h1>

            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground tabular-nums">
              {webinar.startTime && (
                <span className="inline-flex items-center gap-1.5">
                  <Calendar className="h-4 w-4" />
                  {formatDate(webinar.startTime)}
                </span>
              )}
              {webinar.duration && (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-4 w-4" />
                  {formatDuration(webinar.duration)}
                </span>
              )}
            </div>

            <p className="text-muted-foreground leading-relaxed">{webinar.description}</p>

            {showLoginPrompt ? (
              <div className="pt-4 border-t border-border">
                <p className="text-sm font-semibold text-foreground mb-3">Sign in to join this webinar</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Create an account or sign in to register, get reminders, and access the live session.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    to="/login"
                    state={{ from: { pathname: isProgram ? `/app/live/${webinar.id}/register` : `/live/${id}` } }}
                    className="inline-flex items-center gap-2 rounded-[6px] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                  >
                    <LogIn className="h-4 w-4" />
                    Sign in
                  </Link>
                  <Link
                    to="/join"
                    state={{ from: { pathname: isProgram ? `/app/live/${webinar.id}/register` : `/live/${id}` } }}
                    className="inline-flex items-center gap-2 rounded-[6px] border border-border bg-card px-4 py-2.5 text-sm font-semibold text-foreground hover:bg-muted"
                  >
                    <UserPlus className="h-4 w-4" />
                    Create account
                  </Link>
                </div>
              </div>
            ) : webinar.joinUrl ? (
              <div className="pt-4 border-t border-border">
                <a
                  href={webinar.joinUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-[6px] bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                  Join Session
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
