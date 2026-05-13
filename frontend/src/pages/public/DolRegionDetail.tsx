import { useEffect } from 'react';
import { Link, useParams, Navigate, useLocation } from 'react-router-dom';
import { dolNetwork, getRegionBySlug } from '../../data/dol-network';
import { ChevronLeft } from 'lucide-react';

export default function DolRegionDetail() {
  const { regionSlug } = useParams<{ regionSlug: string }>();
  const location = useLocation();
  const region = regionSlug ? getRegionBySlug(regionSlug) : null;

  useEffect(() => {
    const id = location.hash.replace(/^#/, '');
    if (!id) return;
    const t = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
    return () => cancelAnimationFrame(t);
  }, [location.hash, region?.id]);

  if (!region) {
    return <Navigate to="/kol-network" replace />;
  }

  return (
    <div className="bg-white">
      {/* Hero */}
      <section>
        <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6 sm:py-8">
          <Link
            to="/kol-network"
            className="inline-flex items-center gap-1 text-sm font-medium text-gray-600 hover:text-gray-900 mb-4"
          >
            <ChevronLeft className="h-4 w-4" />
            All regions
          </Link>
          <div className="max-w-3xl space-y-2">
            <h1 className="text-4xl md:text-5xl font-semibold tracking-tight text-gray-900 leading-tight">
              Digital Opinion Leader (DOL) Network
            </h1>
            <p className="text-sm md:text-base text-gray-600 leading-relaxed">
              Oncology & Breast Cancer Specialists
            </p>
          </div>
        </div>
      </section>

      {/* Region */}
      <section className="py-6 sm:py-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 space-y-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-semibold text-gray-900">
              {region.title}
            </h2>
            {region.subtitle && (
              <p className="mt-1 text-base text-gray-600">{region.subtitle}</p>
            )}
          </div>
          <div className="space-y-6">
            {region.entries.map((entry) => (
              <div
                key={entry.id}
                id={entry.id}
                className="rounded-2xl border border-gray-200 bg-white p-5 sm:p-6 space-y-3 scroll-mt-24"
              >
                <div className="flex items-start justify-between gap-4">
                  <h3 className="text-lg font-semibold text-gray-900">
                    {entry.name}
                    {entry.isNew && (
                      <span className="ml-2 text-xs font-medium text-gray-500">★ NEW</span>
                    )}
                  </h3>
                  <Link
                    to={`/kol-network/profile/${entry.id}`}
                    className="shrink-0 text-sm font-semibold text-brand-700 hover:text-brand-900"
                  >
                    View profile →
                  </Link>
                </div>
                <p className="text-sm font-medium text-gray-700">
                  <span className="text-gray-500">Role:</span> {entry.role}
                </p>
                <p className="text-sm text-gray-600 leading-relaxed">
                  <span className="text-gray-500">Bio:</span> {entry.bio}
                </p>
                <p className="text-sm text-gray-600">
                  <span className="text-gray-500">Education:</span> {entry.education}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Region nav */}
      <section className="border-t border-gray-200 py-6">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
            Other regions
          </h3>
          <div className="flex flex-wrap gap-2">
            {dolNetwork
              .filter((r) => r.id !== region.id)
              .map((r) => (
                <Link
                  key={r.id}
                  to={`/kol-network/${r.id}`}
                  className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300"
                >
                  {r.title}
                </Link>
              ))}
          </div>
        </div>
      </section>

      <div className="border-t border-gray-200 py-6">
        <p className="text-center text-xs text-gray-500">
          Community Health Technologies - Confidential KOL Network Document | ★ = Newly Added
        </p>
      </div>
    </div>
  );
}
