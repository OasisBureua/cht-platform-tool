import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { User, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../api/dashboard';
import LoadingSpinner from '../components/ui/LoadingSpinner';

function getInitials(name: string, email?: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }
  if (name.length >= 1) return name.slice(0, 2).toUpperCase();
  if (email?.length) return email.slice(0, 2).toUpperCase();
  return 'U';
}

export default function Settings() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const userId = user?.userId ?? '';

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => dashboardApi.getProfile(userId),
    enabled: !!userId,
  });

  const { data: stats } = useQuery({
    queryKey: ['stats', userId],
    queryFn: () => dashboardApi.getStats(userId),
    enabled: !!userId,
  });

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (isLoading) return <LoadingSpinner />;

  const displayName = profile?.name || user?.name || user?.email || 'User';
  const initials = getInitials(displayName, profile?.email || user?.email);
  const memberSince = profile?.createdAt
    ? format(new Date(profile.createdAt), 'MMM yyyy')
    : '—';
  const totalEarnings = profile?.totalEarnings ?? 0;
  const completionRate = stats?.completionRate ?? 0;

  return (
    <div className="space-y-8 min-w-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Your Profile</h1>
        <p className="text-sm text-gray-600">Manage your professional information and social connections</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-gray-700" />
              <h2 className="text-lg font-bold text-gray-900">Profile Information</h2>
            </div>
            <p className="text-sm text-gray-600 mb-6">Your basic professional details</p>

            <div className="flex items-start gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-gray-700">{initials}</span>
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">{displayName}</p>
                {profile?.specialty ? (
                  <span className="text-sm text-gray-600">{profile.specialty}</span>
                ) : (
                  <span className="text-sm text-gray-500">—</span>
                )}
              </div>
            </div>

            <div className="flex gap-2 border-b border-gray-200 pb-4">
              {['General', 'Security', 'Notifications', 'Integrations'].map((tab, i) => (
                <button
                  key={tab}
                  className={`px-4 py-2 text-sm font-medium ${
                    i === 0 ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">First Name</label>
                <input
                  type="text"
                  value={profile?.firstName ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={profile?.lastName ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={profile?.email ?? user?.email ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Role</label>
                <input
                  type="text"
                  value={profile?.role ?? user?.role ?? ''}
                  readOnly
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Specialty</label>
                <input
                  type="text"
                  value={profile?.specialty ?? ''}
                  readOnly
                  placeholder="Not set"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Profile Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Total Earnings</span>
                <span className="rounded-full bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                  ${totalEarnings.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Member Since</span>
                <span className="text-sm font-semibold text-gray-900">{memberSince}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Activities Completed</span>
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                  {profile?.activitiesCompleted ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Profile Completion</span>
                <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800">
                  {completionRate}%
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link to="/app/earnings" className="flex w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50">
                View Earnings
              </Link>
              <Link to="/app/earnings" className="flex w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50">
                Payment Settings
              </Link>
              <button className="flex w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50">
                KOL Analytics
              </button>
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
