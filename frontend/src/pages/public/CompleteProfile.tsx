import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../api/dashboard';
import {
  professionRequiresNpi,
  professionOptionsForSelect,
  specialtyToSelectValue,
} from '../../data/profession-options';
import {
  US_STATE_SELECT_OPTIONS,
  normalizeUsStateCode,
  normalizeUsZip5,
} from '../../data/us-states';

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, refreshProfile } = useAuth();
  const [profession, setProfession] = useState('');
  /** Original DB specialty: keeps legacy-only options visible until user saves */
  const [persistedSpecialtyHint, setPersistedSpecialtyHint] = useState<string | null>(null);
  const [npiNumber, setNpiNumber] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" replace />;
  }

  if (isAuthenticated && user?.profileComplete) {
    return <Navigate to="/app/home" replace />;
  }

  const userId = user?.userId ?? '';

  useEffect(() => {
    if (!userId) return;
    dashboardApi
      .getProfile(userId)
      .then((p) => {
        const rawSpec = (p.specialty ?? '').trim();
        setPersistedSpecialtyHint(rawSpec || null);
        setProfession(specialtyToSelectValue(rawSpec));
        if (p.npiNumber) setNpiNumber(p.npiNumber.replace(/\D/g, '').slice(0, 10));
        if (p.institution) setInstitution(p.institution);
        if (p.city) setCity(p.city);
        if (p.state) setState(normalizeUsStateCode(p.state) ?? '');
        if (p.zipCode) setZipCode(p.zipCode.replace(/\D/g, '').slice(0, 5));
      })
      .catch(() => {});
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const npi = npiNumber.replace(/\D/g, '');
    if (!profession) {
      setError('Please select your profession.');
      return;
    }
    const needsNpi = professionRequiresNpi(profession);
    if (needsNpi && npi.length !== 10) {
      setError('NPI number must be 10 digits.');
      return;
    }
    const stateCode = normalizeUsStateCode(state);
    if (!stateCode) {
      setError('State is required.');
      return;
    }
    const zip = normalizeUsZip5(zipCode);
    if (!zip) {
      setError('ZIP code must be exactly 5 digits.');
      return;
    }
    setSaving(true);
    try {
      await dashboardApi.updateProfile(userId, {
        specialty: profession,
        npiNumber: needsNpi ? (npi || undefined) : '',
        institution: institution.trim() || undefined,
        city: city.trim() || undefined,
        state: stateCode,
        zipCode: zip,
      });
      await refreshProfile();
      navigate('/app/home', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !userId) {
    return (
      <div className="min-h-[calc(100vh-64px)] flex items-center justify-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-border border-t-gray-900" />
      </div>
    );
  }

  const professionSelectOptions = professionOptionsForSelect(persistedSpecialtyHint, profession);

  return (
    <div className="bg-card min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 md:py-16">
      <div className="w-full max-w-md rounded-card border border-border bg-card p-6 md:p-8">
        <h1 className="text-xl font-semibold text-foreground">Complete your profile</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Add your <strong>profession</strong> and <strong>NPI</strong> (when required for your profession) so you can
          receive payments. You already have app access; without this on file, <strong>earnings and payouts may be held</strong>.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-[6px] bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
          )}

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">Profession</label>
            <select
              value={profession}
              onChange={(e) => {
                const v = e.target.value;
                setProfession(v);
                if (!professionRequiresNpi(v)) setNpiNumber('');
              }}
              required
              className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              {professionSelectOptions.map((opt) => (
                <option key={opt.value || 'empty'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {profession && !professionRequiresNpi(profession) ? (
            <div className="rounded-[6px] border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900" role="note">
              <strong>Note:</strong> NPI number is not required for your role. Honorarium programs and payment eligibility
              are designed for licensed healthcare professionals. You can still access all educational content and register
              for events.
            </div>
          ) : null}

          {profession && professionRequiresNpi(profession) ? (
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">NPI number</label>
              <input
                type="text"
                value={npiNumber}
                onChange={(e) => setNpiNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit National Provider Identifier"
                required
                maxLength={10}
                className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          ) : null}

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              Institution <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Hospital, clinic, or practice name"
              className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-foreground mb-1">
              City <span className="font-normal text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York"
              className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">State</label>
              <select
                value={state}
                onChange={(e) => setState(e.target.value)}
                required
                className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gray-200"
              >
                {US_STATE_SELECT_OPTIONS.map((opt) => (
                  <option key={opt.value || 'empty'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1">ZIP code</label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, '').slice(0, 5))}
                placeholder="10001"
                required
                maxLength={5}
                inputMode="numeric"
                className="w-full rounded-card border border-border bg-card px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-[6px] bg-brand-600 px-7 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Continue to platform'}
          </button>
        </form>
      </div>
    </div>
  );
}
