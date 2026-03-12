import { useState, useEffect } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dashboardApi } from '../../api/dashboard';

const PROFESSION_OPTIONS = [
  { value: '', label: 'Select your profession' },
  { value: 'Physician', label: 'Physician (MD/DO)' },
  { value: 'Nurse Practitioner', label: 'Nurse Practitioner (NP)' },
  { value: 'Physician Assistant', label: 'Physician Assistant (PA)' },
  { value: 'Pharmacist', label: 'Pharmacist' },
  { value: 'Nurse', label: 'Nurse (RN/LPN)' },
  { value: 'Pharmaceuticals', label: 'Pharmaceuticals' },
  { value: 'Other HCP', label: 'Other Healthcare Professional' },
];

export default function CompleteProfile() {
  const navigate = useNavigate();
  const { user, isAuthenticated, isLoading, refreshProfile } = useAuth();
  const [profession, setProfession] = useState('');
  const [npiNumber, setNpiNumber] = useState('');
  const [institution, setInstitution] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Redirect if not authenticated
  if (!isAuthenticated && !isLoading) {
    return <Navigate to="/login" replace />;
  }

  // Redirect if profile already complete
  if (isAuthenticated && user?.profileComplete) {
    return <Navigate to="/app/home" replace />;
  }

  const userId = user?.userId ?? '';

  // Pre-fill from profile if available
  useEffect(() => {
    if (!userId) return;
    dashboardApi.getProfile(userId).then((p) => {
      if (p.specialty) setProfession(p.specialty);
      if (p.npiNumber) setNpiNumber(p.npiNumber);
      if (p.institution) setInstitution(p.institution);
      if (p.city) setCity(p.city);
      if (p.state) setState(p.state);
      if (p.zipCode) setZipCode(p.zipCode);
    }).catch(() => {});
  }, [userId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const npi = npiNumber.replace(/\D/g, '');
    if (!profession) {
      setError('Please select your profession.');
      return;
    }
    const isPharmaceuticals = profession === 'Pharmaceuticals';
    if (!isPharmaceuticals && npi.length !== 10) {
      setError('NPI number must be 10 digits.');
      return;
    }
    const zip = zipCode.replace(/\D/g, '');
    if (zip.length !== 0 && zip.length !== 5 && zip.length !== 9) {
      setError('ZIP code must be 5 digits (or 9 for ZIP+4).');
      return;
    }
    setSaving(true);
    try {
      await dashboardApi.updateProfile(userId, {
        specialty: profession,
        npiNumber: isPharmaceuticals ? undefined : (npi || undefined),
        institution: institution.trim() || undefined,
        city: city.trim() || undefined,
        state: state.trim().toUpperCase().slice(0, 2) || undefined,
        zipCode: zip || undefined,
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
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900" />
      </div>
    );
  }

  return (
    <div className="bg-white min-h-[calc(100vh-64px)] flex items-center justify-center px-4 sm:px-6 py-8 sm:py-12 md:py-16">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 md:p-8">
        <h1 className="text-xl font-semibold text-gray-900">
          Complete your profile
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          A few details are needed before you can access the platform.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          {error && (
            <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Professional info */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Profession</label>
            <select
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              required
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-200"
            >
              {PROFESSION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">
              NPI number {profession === 'Pharmaceuticals' && <span className="font-normal text-gray-500">(optional)</span>}
            </label>
            <input
              type="text"
              value={npiNumber}
              onChange={(e) => setNpiNumber(e.target.value.replace(/\D/g, '').slice(0, 10))}
              placeholder={profession === 'Pharmaceuticals' ? 'Not required for Pharmaceuticals' : '10-digit National Provider Identifier'}
              required={profession !== 'Pharmaceuticals'}
              maxLength={10}
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">Institution <span className="font-normal text-gray-500">(optional)</span></label>
            <input
              type="text"
              value={institution}
              onChange={(e) => setInstitution(e.target.value)}
              placeholder="Hospital, clinic, or practice name"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          {/* Location */}
          <div>
            <label className="block text-sm font-semibold text-gray-900 mb-1">City <span className="font-normal text-gray-500">(optional)</span></label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="New York"
              className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">State <span className="font-normal text-gray-500">(optional)</span></label>
              <input
                type="text"
                value={state}
                onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
                placeholder="NY"
                maxLength={2}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">ZIP code <span className="font-normal text-gray-500">(optional)</span></label>
              <input
                type="text"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/[^\d-]/g, '').slice(0, 10))}
                placeholder="10001"
                maxLength={10}
                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-full bg-gray-900 px-7 py-3 text-sm font-semibold text-white hover:bg-black disabled:opacity-70"
          >
            {saving ? 'Saving...' : 'Continue to platform'}
          </button>
        </form>
      </div>
    </div>
  );
}
