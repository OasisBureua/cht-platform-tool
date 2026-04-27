import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { paymentsApi } from '../../api/payments';
import { getApiErrorMessage } from '../../api/client';
import { Loader2 } from 'lucide-react';

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
    return (e: React.ChangeEvent<HTMLInputElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
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
    if (!/^\d{9}$/.test(form.routingNumber.replace(/\D/g, ''))) return setError('Routing number must be 9 digits.');
    if (form.accountNumber.trim().length < 4) return setError('Account number is required.');
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
        {field('Routing number', 'routingNumber', { placeholder: '9-digit ABA number', maxLength: 9 })}
        {field('Account number', 'accountNumber', { placeholder: 'Checking or savings', type: 'password' })}
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
