import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { User, LogOut, Shield, Users, DollarSign, Bell, ExternalLink } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../api/dashboard';

function getInitials(name: string, email?: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  if (name.length >= 1) return name.slice(0, 2).toUpperCase();
  if (email?.length) return email.slice(0, 2).toUpperCase();
  return 'A';
}

export default function AdminSettings() {
  const { user, logout, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.userId ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => dashboardApi.getProfile(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? '');
      setLastName(profile.lastName ?? '');
    }
  }, [profile]);

  const handleSave = async () => {
    setSaveError(null);
    setSaving(true);
    setSaved(false);
    try {
      await dashboardApi.updateProfile(userId, { firstName: firstName.trim(), lastName: lastName.trim() });
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await refreshProfile();
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const displayName = profile?.name || user?.name || user?.email || 'Admin';
  const initials = getInitials(displayName, profile?.email || user?.email);

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600">Manage your account and platform-wide configuration.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* Left column */}
        <div className="lg:col-span-2 space-y-6">

          {/* Profile */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Your Profile</h2>
            </div>

            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-white">{initials}</span>
              </div>
              <div>
                <p className="font-semibold text-gray-900">{displayName}</p>
                <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
                  <Shield className="h-3 w-3" /> Admin
                </span>
              </div>
            </div>

            {isLoading ? (
              <div className="h-24 animate-pulse rounded-lg bg-gray-100" />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none focus:ring-1 focus:ring-gray-900"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <input
                    value={profile?.email ?? user?.email ?? ''}
                    readOnly
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                  <input
                    value="ADMIN"
                    readOnly
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-gray-50 text-gray-500"
                  />
                </div>
                <div className="sm:col-span-2 flex items-center gap-3">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50 transition-colors"
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                  {saved && <span className="text-sm text-green-600 font-medium">Saved ✓</span>}
                  {saveError && <span className="text-sm text-red-600">{saveError}</span>}
                </div>
              </div>
            )}
          </section>

          {/* Platform Controls */}
          <section className="rounded-2xl border border-gray-200 bg-white p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-gray-500" />
              <h2 className="text-base font-semibold text-gray-900">Platform Controls</h2>
            </div>
            <div className="divide-y divide-gray-100">
              <ControlRow
                icon={<Users className="h-4 w-4" />}
                label="User Management"
                description="View, promote, or suspend platform users"
                href="/admin/users"
              />
              <ControlRow
                icon={<DollarSign className="h-4 w-4" />}
                label="Payments & Payouts"
                description="Manage pending payments and payout history"
                href="/admin/payments"
              />
              <ControlRow
                icon={<Bell className="h-4 w-4" />}
                label="API Docs"
                description="Internal Swagger documentation for all endpoints"
                href="/api/docs"
                external
              />
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <section className="rounded-2xl border border-gray-200 bg-white p-5 space-y-3">
            <h3 className="text-sm font-semibold text-gray-900">Quick Actions</h3>
            <div className="space-y-2">
              <ActionButton label="Manage Users" href="/admin/users" />
              <ActionButton label="View Payments" href="/admin/payments" />
              <ActionButton label="Programs" href="/admin/programs" />
              <ActionButton label="Webinar Scheduler" href="/admin/webinar-scheduler" />
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                <LogOut className="h-4 w-4" /> Sign Out
              </button>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Account Info</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Role</span>
                <span className="font-medium text-gray-900">Admin</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email</span>
                <span className="font-medium text-gray-900 truncate max-w-[140px]">{profile?.email ?? user?.email ?? '—'}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function ControlRow({
  icon,
  label,
  description,
  href,
  external,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  href: string;
  external?: boolean;
}) {
  const Tag = external ? 'a' : 'a';
  return (
    <Tag
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
      className="flex items-center justify-between gap-4 py-3 group"
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 text-gray-400 group-hover:text-gray-700 transition-colors">{icon}</span>
        <div>
          <p className="text-sm font-medium text-gray-900">{label}</p>
          <p className="text-xs text-gray-500">{description}</p>
        </div>
      </div>
      <ExternalLink className="h-4 w-4 text-gray-300 group-hover:text-gray-500 shrink-0 transition-colors" />
    </Tag>
  );
}

function ActionButton({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      className="flex w-full rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-900 hover:bg-gray-50 transition-colors"
    >
      {label}
    </a>
  );
}
