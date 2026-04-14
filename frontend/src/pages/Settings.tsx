import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { User, LogOut, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { W9Modal } from '../components/W9Modal';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../api/dashboard';
import { paymentsApi } from '../api/payments';
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
  const { user, logout, refreshProfile, isLoading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const userId = user?.userId ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  const { data: accountStatus, isLoading: loadingAccount } = useQuery({
    queryKey: ['payments-account-status', userId],
    queryFn: () => paymentsApi.getAccountStatus(userId),
    enabled: !!userId,
  });

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName ?? '');
      setLastName(profile.lastName ?? '');
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setSaveError(null);
    setSaving(true);
    try {
      const zip = zipCode.replace(/\D/g, '');
      if (zip && zip.length !== 0 && zip.length !== 5 && zip.length !== 9) {
        setSaveError('ZIP code must be 5 digits (or 9 for ZIP+4).');
        setSaving(false);
        return;
      }
      await dashboardApi.updateProfile(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        institution: institution.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim().toUpperCase().slice(0, 2) || undefined,
        zipCode: zip || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await refreshProfile();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (authLoading || isLoading) return <LoadingSpinner />;

  const displayName = profile?.name || user?.name || user?.email || 'User';
  const initials = getInitials(displayName, profile?.email || user?.email);
  const memberSince = profile?.createdAt
    ? format(new Date(profile.createdAt), 'MMM yyyy')
    : '-';
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
                  <span className="text-sm text-gray-500">-</span>
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
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2 flex items-center gap-3">
                <button
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
                {saveError && <span className="text-sm text-red-600">{saveError}</span>}
              </div>
              <div className="md:col-span-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-3">Practice Location</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Institution</label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder="Hospital, clinic, or practice"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g., New York"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
                    <input
                      type="text"
                      value={state}
                      onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                      placeholder="e.g., NY"
                      maxLength={2}
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">ZIP code</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
                      placeholder="e.g., 10001"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
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

          {/* Payment Settings */}
          <PaymentSettingsSection
            userId={userId}
            accountStatus={accountStatus}
            isLoading={loadingAccount}
            displayName={displayName}
            onSuccess={() => queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] })}
          />
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
              <Link to="/app/payments" className="flex w-full rounded-lg border border-gray-200 px-4 py-3 text-sm font-medium text-gray-900 hover:bg-gray-50">
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

function PaymentSettingsSection({
  userId,
  accountStatus,
  isLoading,
  displayName,
  onSuccess,
}: {
  userId: string;
  accountStatus?: {
    hasAccount: boolean;
    w9Submitted?: boolean;
    w9SubmittedAt?: string;
    totalEarnings?: number;
    payoutsEnabled?: boolean;
  };
  isLoading: boolean;
  displayName: string;
  onSuccess: () => void;
}) {
  const [payeeName, setPayeeName] = useState('');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [nameOnAccount, setNameOnAccount] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [w9ModalOpen, setW9ModalOpen] = useState(false);

  const connectMutation = useMutation({
    mutationFn: () =>
      paymentsApi.createConnectAccount(userId, {
        payeeName: payeeName.trim(),
        addressLine1: addressLine1.trim(),
        city: city.trim(),
        state: state.trim().toUpperCase().slice(0, 2),
        zipCode: zipCode.trim().replace(/\D/g, ''),
        nameOnAccount: nameOnAccount.trim(),
        accountNumber: accountNumber.trim(),
        routingNumber: routingNumber.trim(),
      }),
    onSuccess: () => {
      setError(null);
      setPayeeName('');
      setAddressLine1('');
      setCity('');
      setState('');
      setZipCode('');
      setNameOnAccount('');
      setAccountNumber('');
      setRoutingNumber('');
      onSuccess();
    },
    onError: (err: Error) => {
      setError(err.message || 'Failed to add bank account');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!payeeName.trim() || !addressLine1.trim() || !city.trim() || !state.trim() || !zipCode.trim()) {
      setError('Payee name and full address are required');
      return;
    }
    if (!/^\d{5}(-\d{4})?$/.test(zipCode.trim().replace(/\D/g, ''))) {
      setError('ZIP code must be 5 or 9 digits');
      return;
    }
    if (!nameOnAccount.trim() || !accountNumber.trim() || !routingNumber.trim()) {
      setError('All bank fields are required');
      return;
    }
    if (routingNumber.replace(/\D/g, '').length !== 9) {
      setError('Routing number must be 9 digits');
      return;
    }
    connectMutation.mutate();
  };

  if (isLoading) {
    return (
      <div id="payment-settings" className="bg-white rounded-2xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-gray-700" />
          <h2 className="text-lg font-bold text-gray-900">Payment Settings</h2>
        </div>
        <div className="py-8 flex justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  const hasAccount = accountStatus?.hasAccount ?? false;
  const w9Submitted = accountStatus?.w9Submitted ?? false;
  const needsW9 = hasAccount && !w9Submitted;

  // Auto-open W-9 modal when user has bank account but hasn't submitted W-9
  useEffect(() => {
    if (needsW9 && !isLoading) {
      setW9ModalOpen(true);
    }
  }, [needsW9, isLoading]);

  return (
    <div id="payment-settings" className="bg-white rounded-2xl border border-gray-200 p-6 min-w-0 overflow-hidden">
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-gray-700 shrink-0" />
        <h2 className="text-lg font-bold text-gray-900 truncate">Payment Settings</h2>
      </div>
      <p className="text-sm text-gray-600 mb-6">
        Add your bank details to receive payouts via Bill.com (ACH or check). Complete the embedded W-9 form before admins can pay you.
      </p>

      {hasAccount ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-lg border border-green-200 bg-green-50 px-4 py-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
            <div>
              <p className="font-medium text-green-900">Bank account connected</p>
              <p className="text-sm text-green-700">Admins will process payouts via Bill.com (ACH or check)</p>
            </div>
          </div>

          {!w9Submitted ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">W-9 required</p>
                  <p className="text-sm text-amber-800 mt-1">
                    Complete the W-9 form to receive payouts.
                  </p>
                  <button
                    type="button"
                    onClick={() => setW9ModalOpen(true)}
                    className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-amber-900 hover:underline"
                  >
                    Complete W-9
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <span>W-9 on file{accountStatus?.w9SubmittedAt ? ` (${format(new Date(accountStatus.w9SubmittedAt), 'MMM d, yyyy')})` : ''}</span>
              </div>
              <button
                type="button"
                onClick={() => setW9ModalOpen(true)}
                className="text-sm font-semibold text-gray-700 hover:text-gray-900 hover:underline"
              >
                Update W-9
              </button>
            </div>
          )}
          <W9Modal
            isOpen={w9ModalOpen}
            onClose={() => setW9ModalOpen(false)}
            onSubmit={async (data) => {
              await paymentsApi.submitW9(userId, data);
              onSuccess();
            }}
            displayName={displayName}
          />
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 min-w-0">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Payee name (as on tax forms)</label>
            <input
              type="text"
              value={payeeName}
              onChange={(e) => setPayeeName(e.target.value)}
              placeholder={displayName}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Street address</label>
            <input
              type="text"
              value={addressLine1}
              onChange={(e) => setAddressLine1(e.target.value)}
              placeholder="123 Main St"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="New York"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">State</label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="NY"
                maxLength={2}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ZIP code</label>
            <input
              type="text"
              value={zipCode}
              onChange={(e) => setZipCode(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
              placeholder="10001"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Name on bank account</label>
            <input
              type="text"
              value={nameOnAccount}
              onChange={(e) => setNameOnAccount(e.target.value)}
              placeholder="As it appears on your bank statement"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Account number</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, ''))}
                placeholder="Bank account number"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Routing number (9 digits)</label>
              <input
                type="text"
                value={routingNumber}
                onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                placeholder="e.g. 074000010"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                required
              />
            </div>
          </div>
          {error && (
            <p className="text-sm text-red-600">{error}</p>
          )}
          <button
            type="submit"
            disabled={connectMutation.isPending}
            className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-black disabled:opacity-50"
          >
            {connectMutation.isPending ? 'Saving...' : 'Add bank account'}
          </button>
        </form>
      )}
    </div>
  );
}
