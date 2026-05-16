import { useState } from 'react';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { validateTaxId } from '../utils/w9Validation';
import { getApiErrorMessage } from '../api/client';

export function W9Modal({
  isOpen,
  onClose,
  onSubmit,
  displayName,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: { taxId: string; taxIdType: 'SSN' | 'EIN'; companyName?: string }) => Promise<void>;
  displayName: string;
}) {
  const [taxIdType, setTaxIdType] = useState<'SSN' | 'EIN'>('SSN');
  const [taxId, setTaxId] = useState('');
  const [showTaxId, setShowTaxId] = useState(false);
  const [companyName, setCompanyName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const digits = taxId.replace(/\D/g, '');
    const validation = validateTaxId(digits, taxIdType);
    if (!validation.valid) {
      setError(validation.error || 'Invalid tax ID');
      return;
    }
    const sanitizedCompany = companyName.trim().slice(0, 200) || undefined;
    setSubmitting(true);
    try {
      await onSubmit({
        taxId: digits,
        taxIdType,
        companyName: sanitizedCompany,
      });
      onClose();
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to submit W-9'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-gray-900">W-9 Tax Form</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Complete this form so we can process your payouts. Your information is sent securely to Bill.com.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">Tax ID type</label>
              <select
                value={taxIdType}
                onChange={(e) => setTaxIdType(e.target.value as 'SSN' | 'EIN')}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                disabled={submitting}
              >
                <option value="SSN">Social Security Number (SSN)</option>
                <option value="EIN">Employer Identification Number (EIN)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                {taxIdType === 'SSN' ? 'SSN (9 digits)' : 'EIN (9 digits)'}
              </label>
              <p className="text-xs text-gray-500 mb-1">
                {taxIdType === 'SSN'
                  ? 'Format: XXX-XX-XXXX. Must be a valid SSN per IRS rules.'
                  : 'Format: XX-XXXXXXX. Must be a valid EIN per IRS rules.'}
              </p>
              <div className="relative">
                <input
                  type={showTaxId ? 'text' : 'password'}
                  inputMode="numeric"
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value.replace(/\D/g, '').slice(0, 9))}
                  placeholder={taxIdType === 'SSN' ? 'XXX-XX-XXXX' : 'XX-XXXXXXX'}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 pr-10 text-sm"
                  maxLength={9}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowTaxId((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700"
                  aria-label={showTaxId ? 'Hide tax ID' : 'Show tax ID'}
                  tabIndex={-1}
                >
                  {showTaxId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {taxId.length > 0 && taxId.length < 9 && (
                <p className="text-xs text-amber-700 mt-1">{taxId.length}/9 digits entered</p>
              )}
              {taxId.length === 9 && (
                <p className="text-xs text-green-700 mt-1">✓ 9 digits entered</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">
                Business name <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder={displayName}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                disabled={submitting}
              />
            </div>

            <p className="text-xs text-gray-500">
              By submitting, you certify under penalty of perjury that the information is correct and that you are not
              subject to backup withholding.
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {submitting ? 'Submitting…' : 'Submit W-9'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
