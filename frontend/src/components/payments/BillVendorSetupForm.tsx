import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { paymentsApi } from '../../api/payments';
import { getApiErrorMessage } from '../../api/client';
import { Eye, EyeOff, Loader2 } from 'lucide-react';

/** ABA routing number checksum: 3(d1+d4+d7) + 7(d2+d5+d8) + (d3+d6+d9) ≡ 0 mod 10 */
function isValidRoutingNumber(digits: string): boolean {
  if (!/^\d{9}$/.test(digits)) return false;
  const d = digits.split('').map(Number);
  const sum = 3 * (d[0] + d[3] + d[6]) + 7 * (d[1] + d[4] + d[7]) + (d[2] + d[5] + d[8]);
  return sum % 10 === 0;
}

/** US bank account numbers: 4–17 digits */
function validateAccountNumber(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 0) return 'Account number is required.';
  if (digits.length < 4) return `Too short — must be at least 4 digits (${digits.length}/4).`;
  if (digits.length > 17) return `Too long — must be at most 17 digits.`;
  return null;
}

export function BillVendorSetupForm(props: {
  userId: string;
  onSuccess: () => void;
  /** `update` = user already has a Bill.com vendor; submits PATCH via same API. */
  variant?: 'create' | 'update';
  /** When true, form is read-only and submit is blocked (e.g. profession/NPI missing). */
  locked?: boolean;
}) {
  const { userId, onSuccess, variant = 'create', locked = false } = props;
  const [form, setForm] = useState({
    payeeName: '',
    addressLine1: '',
    city: '',
    state: '',
    zipCode: '',
    nameOnAccount: '',
    accountNumber: '',
    routingNumber: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [showAccount, setShowAccount] = useState(false);

  const routingDigits = form.routingNumber.replace(/\D/g, '');
  const accountDigits = form.accountNumber.replace(/\D/g, '');

  const routingHint =
    routingDigits.length === 0 ? null
    : routingDigits.length < 9 ? `${routingDigits.length}/9 digits`
    : !isValidRoutingNumber(routingDigits) ? 'Invalid routing number (checksum failed)'
    : '✓ Valid';

  const accountHint =
    accountDigits.length === 0 ? null
    : accountDigits.length < 4 ? `${accountDigits.length} digit${accountDigits.length === 1 ? '' : 's'} — minimum 4`
    : accountDigits.length > 17 ? `${accountDigits.length} digits — maximum 17`
    : `${accountDigits.length} digit${accountDigits.length === 1 ? '' : 's'} ✓`;

  const mutation = useMutation({
    mutationFn: () => {
      const zipDigits = form.zipCode.replace(/\D/g, '');
      return paymentsApi.createConnectAccount(userId, {
        payeeName: form.payeeName.trim(),
        addressLine1: form.addressLine1.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        zipCode: zipDigits,
        nameOnAccount: form.nameOnAccount.trim(),
        accountNumber: form.accountNumber.trim(),
        routingNumber: form.routingNumber.replace(/\D/g, ''),
      });
    },
    onSuccess: () => onSuccess(),
    onError: (err: unknown) => {
      setError(getApiErrorMessage(err, 'Failed to save payment details.'));
    },
  });

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => {
      let value = e.target.value;
      // Strip non-digits for numeric banking fields
      if (field === 'routingNumber') value = value.replace(/\D/g, '').slice(0, 9);
      if (field === 'accountNumber') value = value.replace(/\D/g, '').slice(0, 17);
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (locked) return setError('Complete your profession and NPI under Settings first.');
    if (!form.payeeName.trim()) return setError('Payee name is required.');
    if (!form.addressLine1.trim()) return setError('Address is required.');
    if (!form.city.trim()) return setError('City is required.');
    if (!form.state.trim()) return setError('State is required.');
    const zipDigits = form.zipCode.replace(/\D/g, '');
    if (zipDigits.length !== 5 && zipDigits.length !== 9) return setError('Enter a valid ZIP code (5 or 9 digits).');
    if (!form.nameOnAccount.trim()) return setError('Name on account is required.');
    if (routingDigits.length !== 9) return setError('Routing number must be exactly 9 digits.');
    if (!isValidRoutingNumber(routingDigits)) return setError('Invalid routing number — please double-check the 9-digit ABA number on your check.');
    const accountErr = validateAccountNumber(form.accountNumber);
    if (accountErr) return setError(accountErr);
    mutation.mutate();
  }

  const field = (
    label: string,
    key: keyof typeof form,
    opts?: { placeholder?: string; maxLength?: number; type?: string },
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-gray-700">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={set(key)}
        placeholder={opts?.placeholder}
        maxLength={opts?.maxLength}
        className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
        disabled={mutation.isPending || locked}
      />
    </div>
  );

  const isUpdate = variant === 'update';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-gray-200 bg-white p-6 space-y-6 min-w-0 overflow-hidden"
    >
      {locked ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          Complete your <strong>profession</strong> and <strong>NPI</strong> (when required) under Settings before you
          can save payment details.
        </p>
      ) : null}
      <div>
        <h2 className="text-base font-semibold text-gray-900">
          {isUpdate ? 'Update payment details' : 'Set up your payment account'}
        </h2>
        <p className="mt-0.5 text-sm text-gray-600">
          {isUpdate
            ? 'Re-enter your payee name, mailing address, and bank account. This replaces what is stored in your Bill.com vendor profile (W-9 sync from Bill.com is unchanged).'
            : 'Enter your US bank details for your Bill.com vendor profile (ACH payouts from Bill.com).'}
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Payee information</legend>
        {field('Payee name (as it appears on checks)', 'payeeName', { placeholder: 'Dr. Jane Smith' })}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">US address</legend>
        {field('Street address', 'addressLine1', { placeholder: '123 Main St' })}
        <div className="grid grid-cols-2 gap-3">
          {field('City', 'city', { placeholder: 'New York' })}
          {field('State', 'state', { placeholder: 'NY', maxLength: 2 })}
        </div>
        {field('ZIP code', 'zipCode', { placeholder: '10001', maxLength: 10 })}
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bill.com — bank account (ACH)</legend>
        {field('Name on account', 'nameOnAccount', { placeholder: 'Jane Smith' })}

        {/* Routing number with live hint */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Routing number</label>
          <input
            type="text"
            inputMode="numeric"
            value={form.routingNumber}
            onChange={set('routingNumber')}
            placeholder="9-digit ABA number"
            maxLength={9}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
            disabled={mutation.isPending || locked}
          />
          {routingHint && (
            <p className={`text-xs ${routingHint.startsWith('✓') ? 'text-green-700' : routingHint.includes('Invalid') ? 'text-red-600' : 'text-gray-500'}`}>
              {routingHint}
            </p>
          )}
        </div>

        {/* Account number with show/hide toggle and live hint */}
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-gray-700">Account number</label>
          <div className="relative">
            <input
              type={showAccount ? 'text' : 'password'}
              inputMode="numeric"
              value={form.accountNumber}
              onChange={set('accountNumber')}
              placeholder="Checking or savings (4–17 digits)"
              maxLength={17}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 pr-10 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-gray-900"
              disabled={mutation.isPending || locked}
            />
            <button
              type="button"
              onClick={() => setShowAccount((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-700"
              aria-label={showAccount ? 'Hide account number' : 'Show account number'}
              tabIndex={-1}
            >
              {showAccount ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {accountHint && (
            <p className={`text-xs ${accountHint.includes('✓') ? 'text-green-700' : 'text-amber-700'}`}>
              {accountHint}
            </p>
          )}
          <p className="text-xs text-gray-400">4–17 digits. Numbers only — no spaces or dashes.</p>
        </div>
      </fieldset>

      {error && <p className="text-sm text-red-600 font-medium">{error}</p>}

      <button
        type="submit"
        disabled={mutation.isPending || locked}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-800 active:scale-[0.96] disabled:opacity-60"
      >
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mutation.isPending ? 'Saving…' : isUpdate ? 'Save updated payment details' : 'Save payment details'}
      </button>
    </form>
  );
}
