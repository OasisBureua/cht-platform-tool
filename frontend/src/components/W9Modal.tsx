import { useState } from 'react';
import { X, Loader2, Eye, EyeOff } from 'lucide-react';
import { validateTaxId } from '../utils/w9Validation';
import { getApiErrorMessage } from '../api/client';
import { BillComMark } from './branding/BillComMark';

export function W9Modal({
  isOpen,
  onClose,
  onSubmit,
  displayName: _displayName,
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
        className="bg-card rounded-card shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-foreground">W-9 Tax Form</h2>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-[6px] hover:bg-muted text-muted-foreground"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <p className="text-sm text-muted-foreground mb-4 inline-flex flex-wrap items-center gap-x-1.5 gap-y-1">
            Complete this form so we can process your payouts. Your information is sent securely to{' '}
            <BillComMark size="sm" className="translate-y-px" />.
          </p>
          <div className="rounded-[6px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 leading-relaxed mb-4">
            <strong className="text-slate-900">Security:</strong> Community Health Media does not store full payment card
            data. Tax and banking details are handled by{' '}
            <BillComMark size="xs" className="inline translate-y-px mx-0.5" /> using industry-standard safeguards. Only
            provide information through official CHM screens or your vendor portal, never share passwords or full account
            numbers by email.
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-1">Tax ID type</label>
              <select
                value={taxIdType}
                onChange={(e) => setTaxIdType(e.target.value as 'SSN' | 'EIN')}
                className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                disabled={submitting}
              >
                <option value="SSN">Social Security Number (SSN)</option>
                <option value="EIN">Employer Identification Number (EIN)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-1">
                {taxIdType === 'SSN' ? 'SSN (9 digits)' : 'EIN (9 digits)'}
              </label>
              <p className="text-xs text-muted-foreground mb-1">
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
                  className="w-full rounded-[6px] border border-border px-3 py-2 pr-10 text-sm"
                  maxLength={9}
                  disabled={submitting}
                />
                <button
                  type="button"
                  onClick={() => setShowTaxId((v) => !v)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                  aria-label={showTaxId ? 'Hide tax ID' : 'Show tax ID'}
                  tabIndex={-1}
                >
                  {showTaxId ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {taxId.length > 0 && taxId.length < 9 && (
                <p className="text-xs text-warning mt-1">{taxId.length}/9 digits entered</p>
              )}
              {taxId.length === 9 && (
                <p className="text-xs text-success mt-1">✓ 9 digits entered</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-semibold text-muted-foreground mb-1">
                Business / LLC name{' '}
                <span className="text-muted-foreground font-normal">(if payee is an organization)</span>
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Legal entity name matching your EIN (e.g., Smith Medical Consulting LLC)"
                className="w-full rounded-[6px] border border-border px-3 py-2 text-sm"
                disabled={submitting}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                If payouts go to an LLC or other business, enter that entity&apos;s legal name here and select EIN as
                the tax ID type so W-9 details match the payee of record on your payment setup.
              </p>
            </div>

            <p className="text-xs text-muted-foreground">
              By submitting, you certify under penalty of perjury that the information is correct and that you are not
              subject to backup withholding.
            </p>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-[6px] border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-[6px] bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60 flex items-center justify-center gap-2"
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
