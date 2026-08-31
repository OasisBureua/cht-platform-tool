import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { User, LogOut, CreditCard, CheckCircle2, AlertCircle } from 'lucide-react';
import { W9Modal } from '../components/W9Modal';
import { useAuth } from '../contexts/AuthContext';
import { dashboardApi } from '../api/dashboard';
import { paymentsApi } from '../api/payments';
import { getApiErrorMessage } from '../api/client';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import {
  specialtyToSelectValue,
  professionRequiresNpi,
  professionOptionsForSelect,
  settingsLocationPreset,
} from '../data/profession-options';
import {
  US_STATE_SELECT_OPTIONS,
  normalizeUsStateCode,
  normalizeUsZip5,
} from '../data/us-states';
import { BillVendorSetupForm } from '../components/payments/BillVendorSetupForm';
import { BillComMark } from '../components/branding/BillComMark';
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
  const location = useLocation();
  const queryClient = useQueryClient();
  const userId = user?.userId ?? '';

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [npiNumber, setNpiNumber] = useState('');
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveOk, setSaveOk] = useState(false);
  const [saving, setSaving] = useState(false);
  const [settingsTab, setSettingsTab] = useState<'general' | 'security' | 'payment'>(() => {
    const s = (location.state as { settingsTab?: 'general' | 'security' | 'payment' } | null)?.settingsTab;
    return s === 'payment' || s === 'security' || s === 'general' ? s : 'general';
  });

  useEffect(() => {
    const s = (location.state as { settingsTab?: 'general' | 'security' | 'payment' } | null)?.settingsTab;
    if (s === 'payment' || s === 'security' || s === 'general') setSettingsTab(s);
  }, [location.state]);

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
      setSpecialty(specialtyToSelectValue(profile.specialty ?? ''));
      setNpiNumber((profile.npiNumber ?? '').replace(/\D/g, '').slice(0, 10));
      setInstitution(profile.institution ?? '');
      setCity(profile.city ?? '');
      setState(normalizeUsStateCode(profile.state) ?? '');
      setZipCode((profile.zipCode ?? '').replace(/\D/g, '').slice(0, 5));
    }
  }, [profile]);

  const handleSaveProfile = async () => {
    setSaveError(null);
    setSaveOk(false);
    setSaving(true);
    try {
      if (!specialty.trim()) {
        setSaveError('Please select your profession.');
        setSaving(false);
        return;
      }
      const npi = npiNumber.replace(/\D/g, '');
      const needsNpi = professionRequiresNpi(specialty.trim());
      if (needsNpi && npi.length !== 10) {
        setSaveError('NPI number must be 10 digits (required for licensed healthcare professionals).');
        setSaving(false);
        return;
      }
      const stateCode = normalizeUsStateCode(state);
      if (!stateCode) {
        setSaveError('State is required.');
        setSaving(false);
        return;
      }
      const zip = normalizeUsZip5(zipCode);
      if (!zip) {
        setSaveError('ZIP code must be exactly 5 digits.');
        setSaving(false);
        return;
      }
      await dashboardApi.updateProfile(userId, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        specialty: specialty.trim(),
        npiNumber: needsNpi ? npi : '',
        institution: institution.trim() || undefined,
        city: city.trim() || undefined,
        state: stateCode,
        zipCode: zip,
      });
      await queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      await refreshProfile();
      setSaveOk(true);
      window.setTimeout(() => setSaveOk(false), 3000);
    } catch (err) {
      setSaveError(getApiErrorMessage(err, 'Failed to save profile.'));
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

  const locationPreset = settingsLocationPreset(specialty);
  const locationSectionHeading =
    locationPreset === 'studentResearcher'
      ? 'Institution Location'
      : locationPreset === 'industry'
        ? 'Company Location'
        : 'Practice Location';
  const institutionFieldLabel = locationPreset === 'industry' ? 'Company' : 'Institution';
  const institutionPlaceholder =
    locationPreset === 'industry'
      ? 'Company name'
      : locationPreset === 'studentResearcher'
        ? 'School, university, or research institution'
        : 'Hospital, clinic, or practice';
  const tuckEmailInsideLocation =
    locationPreset === 'studentResearcher' || locationPreset === 'industry';

  return (
    <div className="space-y-8 min-w-0">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Your Profile</h1>
        <p className="text-sm text-muted-foreground">Manage your professional information and social connections</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Information */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-card border border-gray-100/90 bg-card p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
            <div className="flex items-center gap-2 mb-4">
              <User className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-bold text-foreground">Profile Information</h2>
            </div>
            <p className="text-sm text-muted-foreground mb-6">Your basic professional details</p>

            <div className="flex items-start gap-4 mb-6">
              <div className="h-16 w-16 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                <span className="text-xl font-bold text-gray-700">{initials}</span>
              </div>
              <div>
                <p className="text-lg font-bold text-foreground">{displayName}</p>
                {specialty ? (
                  <span className="text-sm text-muted-foreground">{specialty}</span>
                ) : (
                  <span className="text-sm text-muted-foreground">Profession not set</span>
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-1 border-b border-border pb-4" role="tablist" aria-label="Settings sections">
              {(
                [
                  { id: 'general' as const, label: 'General' },
                  { id: 'security' as const, label: 'Security' },
                  { id: 'payment' as const, label: 'Payment settings' },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={settingsTab === tab.id}
                  onClick={() => setSettingsTab(tab.id)}
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                    settingsTab === tab.id
                      ? 'text-blue-600 border-b-2 border-blue-600 -mb-px'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {settingsTab === 'general' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Enter first name"
                  className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-muted-foreground mb-1">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Enter last name"
                  className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-semibold text-muted-foreground mb-1">Profession</label>
                <select
                  value={specialty}
                  onChange={(e) => {
                    const v = e.target.value;
                    setSpecialty(v);
                    if (!professionRequiresNpi(v)) setNpiNumber('');
                  }}
                  className="w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm text-foreground"
                >
                  {professionOptionsForSelect(profile?.specialty, specialty).map((opt) => (
                    <option key={opt.value || 'empty'} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <p className="mt-0.5 text-xs text-muted-foreground">Used as your professional role for eligibility and payments</p>
              </div>
              {specialty && !professionRequiresNpi(specialty) ? (
                <div className="md:col-span-2 rounded-[6px] border border-blue-200 bg-blue-50 px-3 py-2.5 text-sm text-blue-900" role="note">
                  <strong>Note:</strong> NPI number is not required for your role. Honorarium programs are designed for licensed healthcare professionals. You can still access all content and sessions.
                </div>
              ) : null}
              {specialty && professionRequiresNpi(specialty) ? (
                <div className="md:col-span-2">
                  <label className="block text-sm font-semibold text-muted-foreground mb-1">NPI number</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    value={npiNumber}
                    onChange={(e) => setNpiNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                    placeholder="10-digit National Provider Identifier"
                    maxLength={10}
                    className="w-full rounded-[6px] border border-border bg-card px-3 py-2 text-sm"
                  />
                </div>
              ) : null}
              <div className="md:col-span-2 pt-2 border-t border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">
                  {locationSectionHeading}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className={tuckEmailInsideLocation ? 'md:col-span-2' : undefined}>
                    <label className="block text-sm font-semibold text-muted-foreground mb-1">{institutionFieldLabel}</label>
                    <input
                      type="text"
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      placeholder={institutionPlaceholder}
                      className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-1">
                      City <span className="font-normal text-muted-foreground">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="e.g., New York"
                      className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-1">State</label>
                    <select
                      value={state}
                      onChange={(e) => setState(e.target.value)}
                      required
                      className="w-full rounded-[6px] border border-border px-3 py-2 text-sm bg-card"
                    >
                      {US_STATE_SELECT_OPTIONS.map((opt) => (
                        <option key={opt.value || 'empty'} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-muted-foreground mb-1">ZIP code</label>
                    <input
                      type="text"
                      value={zipCode}
                      onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                      placeholder="e.g., 10001"
                      required
                      maxLength={5}
                      inputMode="numeric"
                      className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                    />
                  </div>
                  {tuckEmailInsideLocation ? (
                    <div className="md:col-span-2">
                      <label className="block text-sm font-semibold text-muted-foreground mb-1">Email</label>
                      <input
                        type="email"
                        value={profile?.email ?? user?.email ?? ''}
                        readOnly
                        className="w-full rounded-[6px] border border-border px-3 py-2 text-sm bg-muted"
                      />
                    </div>
                  ) : null}
                </div>
              </div>
              {!tuckEmailInsideLocation ? (
                <div>
                  <label className="block text-sm font-semibold text-muted-foreground mb-1">Email</label>
                  <input
                    type="email"
                    value={profile?.email ?? user?.email ?? ''}
                    readOnly
                    className="w-full rounded-[6px] border border-border px-3 py-2 text-sm bg-muted"
                  />
                </div>
              ) : null}
              <div className="md:col-span-2 flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSaveProfile}
                  disabled={saving}
                  className="rounded-[6px] bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save Profile'}
                </button>
                {saveOk && <span className="text-sm font-medium text-success">Saved</span>}
                {saveError && <span className="text-sm text-destructive">{saveError}</span>}
              </div>
            </div>
            ) : settingsTab === 'security' ? (
              <div className="mt-6 space-y-4 text-sm text-muted-foreground">
                <div>
                  <p>
                    To change your password, sign out and use <strong>Forgot password</strong> on the login page, or
                    contact your administrator.
                  </p>
                  <Link
                    to="/forgot-password"
                    className="mt-2 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                  >
                    Open password reset
                  </Link>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="font-medium text-foreground">Multi-factor authentication</p>
                  <p className="mt-1">
                    {user?.mfaEnabled
                      ? 'Multi-factor authentication is enabled on your account.'
                      : user?.mfaFeature?.enabled
                        ? 'Add an authenticator app for an extra sign-in step.'
                        : 'SMS multi-factor authentication is not required yet. You can sign in with your password as usual.'}
                  </p>
                  {!user?.mfaEnabled && user?.mfaFeature?.enabled && (
                    <Link
                      to="/mfa/setup"
                      className="mt-2 inline-flex text-sm font-semibold text-blue-600 hover:text-blue-800 hover:underline"
                    >
                      Set up MFA
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-6">
                <PaymentSettingsSection
                  userId={userId}
                  accountStatus={accountStatus}
                  isLoading={loadingAccount}
                  displayName={displayName}
                  profileCity={profile?.city}
                  profileState={profile?.state}
                  profileZip={profile?.zipCode}
                  profileComplete={user?.profileComplete}
                  embedded
                  onSuccess={() => {
                    void queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
                    void queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
                    void queryClient.invalidateQueries({ queryKey: ['payments-history', userId] });
                    void queryClient.invalidateQueries({ queryKey: ['earnings', userId] });
                  }}
                />
              </div>
            )}
          </div>
        </div>

        {/* Right sidebar */}
        <div className="space-y-6">
          <div className="rounded-card border border-gray-100/90 bg-card p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-bold text-foreground mb-4">Profile Stats</h2>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Total Earnings</span>
                <span className="rounded-[6px] bg-blue-100 px-3 py-1 text-sm font-semibold text-blue-800">
                  ${totalEarnings.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Member Since</span>
                <span className="text-sm font-semibold text-foreground">{memberSince}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Activities Completed</span>
                <span className="rounded-[6px] bg-green-100 px-3 py-1 text-sm font-semibold text-success">
                  {profile?.activitiesCompleted ?? 0}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Profile Completion</span>
                <span className="rounded-[6px] bg-green-100 px-3 py-1 text-sm font-semibold text-success">
                  {completionRate}%
                </span>
              </div>
            </div>
          </div>

          <div className="rounded-card border border-gray-100/90 bg-card p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]">
            <h2 className="text-lg font-bold text-foreground mb-4">Quick Actions</h2>
            <div className="space-y-2">
              <Link to="/app/earnings" className="flex w-full rounded-[6px] border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted">
                View Earnings
              </Link>
              <Link
                to="/app/settings"
                state={{ settingsTab: 'payment' as const }}
                className="flex w-full rounded-[6px] border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
              >
                Payment settings
              </Link>
              {user?.role === 'KOL' ? (
                <button
                  type="button"
                  className="flex w-full rounded-[6px] border border-border px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
                >
                  KOL Analytics
                </button>
              ) : null}
              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-[6px] border border-border px-4 py-3 text-sm font-medium text-destructive hover:bg-destructive/10"
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
  profileCity: _profileCity,
  profileState: _profileState,
  profileZip: _profileZip,
  profileComplete,
  embedded = false,
  onSuccess,
}: {
  userId: string;
  accountStatus?: {
    hasAccount: boolean;
    w9Submitted?: boolean;
    w9SubmittedAt?: string;
    totalEarnings?: number;
    payoutsEnabled?: boolean;
    preferredPaymentMethod?: 'ACH' | 'CHECK' | null;
    bankAccountLast4?: string | null;
  };
  isLoading: boolean;
  displayName: string;
  profileCity?: string;
  profileState?: string;
  profileZip?: string;
  profileComplete?: boolean;
  /** When true, no outer card chrome (used inside Settings tabs). */
  embedded?: boolean;
  onSuccess: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [w9ModalOpen, setW9ModalOpen] = useState(false);
  const [syncMessage, setSyncMessage] = useState<{ ok?: string; err?: string }>({});
  const [editingPaymentDetails, setEditingPaymentDetails] = useState(false);
  const profileIncomplete = profileComplete === false;

  const syncMutation = useMutation({
    mutationFn: () => paymentsApi.syncAccountStatus(userId),
    onMutate: () => setSyncMessage({}),
    onSuccess: () => {
      setSyncMessage({ ok: 'Vendor status refreshed.' });
      window.setTimeout(() => setSyncMessage({}), 4000);
      onSuccess();
    },
    onError: (err: unknown) => {
      setSyncMessage({ err: getApiErrorMessage(err, 'Could not refresh vendor status.') });
    },
  });

  const cardShell = embedded
    ? 'min-w-0'
    : 'min-w-0 overflow-hidden rounded-card border border-gray-100/90 bg-card p-6 shadow-[0_1px_0_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.06)]';

  const hasAccount = accountStatus?.hasAccount ?? false;
  const w9Submitted = accountStatus?.w9Submitted ?? false;
  const needsW9 = hasAccount && !w9Submitted;
  const preferredMethod = accountStatus?.preferredPaymentMethod;

  useEffect(() => {
    if (needsW9 && !isLoading) {
      setW9ModalOpen(true);
    }
  }, [needsW9, isLoading]);

  if (isLoading) {
    return (
      <div id="payment-settings" className={cardShell}>
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-lg font-bold text-foreground inline-flex flex-wrap items-center gap-2">
            <BillComMark size="md" /> payouts
          </h2>
        </div>
        <div className="py-8 flex justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  return (
    <div id="payment-settings" className={cardShell}>
      <div className="flex items-center gap-2 mb-4">
        <CreditCard className="h-5 w-5 text-muted-foreground shrink-0" />
        <h2 className="text-lg font-bold text-foreground inline-flex flex-wrap items-center gap-2 min-w-0">
          <BillComMark size="md" /> payouts
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1 align-middle">
          <BillComMark size="md" className="translate-y-px shrink-0" />
          <span>
            is how you get paid. Choose <strong>ACH</strong> or <strong>Check</strong>, then enter the{' '}
            <strong>official payee of record</strong> (your name or LLC / business entity). Complete your{' '}
            <BillComMark size="xs" className="translate-y-px" /> vendor profile and W-9 before admins can issue payouts.
          </span>
        </span>
      </p>

      {profileIncomplete ? (
        <div className="rounded-[6px] border border-warning/25 bg-warning/10 px-4 py-3 text-sm text-amber-950 mb-4">
          <p className="font-semibold">Complete your profile first</p>
          <p className="mt-1 text-amber-900/90">
            Add your profession and NPI (when required) in the <strong>Profile</strong> tab before saving payment details
            or submitting a W-9.
          </p>
        </div>
      ) : null}

      {hasAccount ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-[6px] border border-success/25 bg-success/10 px-4 py-3">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
              <div>
                <p className="font-medium text-green-900 inline-flex flex-wrap items-center gap-2">
                  <BillComMark size="sm" /> vendor connected
                </p>
                <p className="text-sm text-success">
                  Preferred method:{' '}
                  <strong>
                    {preferredMethod === 'CHECK'
                      ? 'Check (mail)'
                      : preferredMethod === 'ACH'
                        ? `ACH${accountStatus?.bankAccountLast4 ? ` · ••••${accountStatus.bankAccountLast4}` : ''}`
                        : 'Not set — edit payment details'}
                  </strong>
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                disabled={profileIncomplete || syncMutation.isPending}
                onClick={() => setEditingPaymentDetails((v) => !v)}
                className="rounded-[6px] border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-900 hover:bg-green-100 disabled:opacity-50"
              >
                {editingPaymentDetails ? 'Close editor' : 'Edit payment details'}
              </button>
              <button
                type="button"
                disabled={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
                className="shrink-0 rounded-[6px] border border-green-300 bg-white px-3 py-2 text-sm font-semibold text-green-900 hover:bg-green-100 disabled:opacity-50"
              >
                {syncMutation.isPending ? 'Syncing…' : 'Refresh vendor status'}
              </button>
            </div>
          </div>
          {editingPaymentDetails && !profileIncomplete ? (
            <BillVendorSetupForm
              userId={userId}
              variant="update"
              locked={profileIncomplete}
              initialMethod={preferredMethod === 'ACH' || preferredMethod === 'CHECK' ? preferredMethod : null}
              onSuccess={() => {
                setEditingPaymentDetails(false);
                onSuccess();
              }}
            />
          ) : null}
          {syncMessage.ok && <p className="text-sm text-success">{syncMessage.ok}</p>}
          {syncMessage.err && <p className="text-sm text-red-600 bg-destructive/10 rounded-[6px] px-3 py-2">{syncMessage.err}</p>}

          {!w9Submitted ? (
            <div className="rounded-[6px] border border-warning/25 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-900">W-9 required</p>
                  <p className="text-sm text-warning mt-1 flex flex-wrap items-center gap-x-1 gap-y-1">
                    Complete the W-9 in <BillComMark size="xs" className="translate-y-px" /> so admins can issue payouts.
                  </p>
                  <button
                    type="button"
                    disabled={profileIncomplete}
                    onClick={() => setW9ModalOpen(true)}
                    className="inline-flex items-center gap-2 mt-3 text-sm font-medium text-amber-900 hover:underline disabled:opacity-50"
                  >
                    Complete W-9
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-success" />
                <span>
                  W-9 on file
                  {accountStatus?.w9SubmittedAt
                    ? ` (${format(new Date(accountStatus.w9SubmittedAt), 'MMM d, yyyy')})`
                    : ''}
                </span>
              </div>
              <button
                type="button"
                disabled={profileIncomplete}
                onClick={() => setW9ModalOpen(true)}
                className="text-sm font-semibold text-muted-foreground hover:text-foreground hover:underline disabled:opacity-50"
              >
                Update W-9
              </button>
            </div>
          )}
          <W9Modal
            isOpen={w9ModalOpen}
            onClose={() => setW9ModalOpen(false)}
            onSubmit={async (data) => {
              if (profileIncomplete) return;
              await paymentsApi.submitW9(userId, data);
              onSuccess();
            }}
            displayName={displayName}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <BillVendorSetupForm
            userId={userId}
            variant="create"
            locked={profileIncomplete}
            onSuccess={() => {
              setError(null);
              onSuccess();
            }}
          />
        </div>
      )}
    </div>
  );
}
