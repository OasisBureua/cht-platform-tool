import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { paymentsApi } from '../../api/payments';
import { getApiErrorMessage } from '../../api/client';
import { Eye, EyeOff, Loader2, Building2, Mail } from 'lucide-react';
import { BillComMark } from '../branding/BillComMark';

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
  if (digits.length < 4) return `Too short: must be at least 4 digits (${digits.length}/4).`;
  if (digits.length > 17) return `Too long: must be at most 17 digits.`;
  return null;
}

export type PaymentMethodChoice = 'ACH' | 'CHECK';

export function BillVendorSetupForm(props: {
  userId: string;
  onSuccess: () => void;
  /** `update` = user already has a Bill.com vendor; submits PATCH via same API. */
  variant?: 'create' | 'update';
  /** When true, form is read-only and submit is blocked (e.g. profession/NPI missing). */
  locked?: boolean;
  initialMethod?: PaymentMethodChoice | null;
}) {
  const { userId, onSuccess, variant = 'create', locked = false, initialMethod = null } = props;
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodChoice | null>(
    initialMethod === 'ACH' || initialMethod === 'CHECK' ? initialMethod : null,
  );
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
    : accountDigits.length < 4 ? `${accountDigits.length} digit${accountDigits.length === 1 ? '' : 's'}: minimum 4`
    : accountDigits.length > 17 ? `${accountDigits.length} digits: maximum 17`
    : `${accountDigits.length} digit${accountDigits.length === 1 ? '' : 's'} ✓`;

  const mutation = useMutation({
    mutationFn: () => {
      if (!paymentMethod) throw new Error('Select ACH or Check.');
      const zipDigits = form.zipCode.replace(/\D/g, '');
      return paymentsApi.createConnectAccount(userId, {
        payeeName: form.payeeName.trim(),
        addressLine1: form.addressLine1.trim(),
        city: form.city.trim(),
        state: form.state.trim().toUpperCase().slice(0, 2),
        zipCode: zipDigits,
        paymentMethod,
        ...(paymentMethod === 'ACH'
          ? {
              nameOnAccount: form.nameOnAccount.trim(),
              accountNumber: form.accountNumber.trim(),
              routingNumber: form.routingNumber.replace(/\D/g, ''),
            }
          : {}),
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
      if (field === 'routingNumber') value = value.replace(/\D/g, '').slice(0, 9);
      if (field === 'accountNumber') value = value.replace(/\D/g, '').slice(0, 17);
      setForm((prev) => ({ ...prev, [field]: value }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (locked) return setError('Complete your profession and NPI under Settings first.');
    if (!paymentMethod) return setError('Select ACH or Check as your payment method.');
    if (!form.payeeName.trim()) return setError('Payee name is required.');
    if (!form.addressLine1.trim()) return setError('Address is required.');
    if (!form.city.trim()) return setError('City is required.');
    if (!form.state.trim()) return setError('State is required.');
    const zipDigits = form.zipCode.replace(/\D/g, '');
    if (zipDigits.length !== 5 && zipDigits.length !== 9) {
      return setError('Enter a valid ZIP code (5 or 9 digits).');
    }
    if (paymentMethod === 'ACH') {
      if (!form.nameOnAccount.trim()) return setError('Name on account is required.');
      if (routingDigits.length !== 9) return setError('Routing number must be exactly 9 digits.');
      if (!isValidRoutingNumber(routingDigits)) {
        return setError(
          'Invalid routing number: please double-check the 9-digit ABA number on your check.',
        );
      }
      const accountErr = validateAccountNumber(form.accountNumber);
      if (accountErr) return setError(accountErr);
    }
    mutation.mutate();
  }

  const field = (
    label: string,
    key: keyof typeof form,
    opts?: { placeholder?: string; maxLength?: number; type?: string },
  ) => (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-semibold text-muted-foreground">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={set(key)}
        placeholder={opts?.placeholder}
        maxLength={opts?.maxLength}
        className="rounded-card border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900"
        disabled={mutation.isPending || locked}
      />
    </div>
  );

  const isUpdate = variant === 'update';

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-card border border-border bg-card p-6 space-y-6 min-w-0 overflow-hidden"
    >
      {locked ? (
        <p className="rounded-[6px] border border-warning/25 bg-warning/10 px-3 py-2 text-sm text-amber-950">
          Complete your <strong>profession</strong> and <strong>NPI</strong> (when required) under Settings before you
          can save payment details.
        </p>
      ) : null}

      <div>
        <h2 className="text-base font-semibold text-foreground">
          {isUpdate ? 'Update payment details' : 'Set up your payment account'}
        </h2>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Choose how you want to receive honoraria, then enter payee and mailing details
          {paymentMethod === 'ACH' ? ' plus bank account for ACH' : ''}.
        </p>
      </div>

      <div
        className="rounded-card border border-brand-200 bg-brand-50/80 px-4 py-3 text-sm text-brand-950 leading-relaxed"
        role="note"
      >
        <p className="font-semibold text-brand-900">Official payee of record</p>
        <p className="mt-1 text-brand-950/90">
          The information you enter in this section establishes the <strong>official payee of record</strong> for
          honoraria and other payouts. Checks and ACH deposits are issued to this payee name and mailing address.
        </p>
        <p className="mt-2 text-brand-950/90">
          If payments should go to an organization (for example an <strong>LLC</strong> or other business entity) rather
          than you as an individual, enter the <strong>legal business name</strong> as the payee, use that entity&apos;s
          mailing address, and complete the W-9 with the entity&apos;s <strong>EIN</strong> and matching tax details.
          Do not use your personal name if the business is the intended payee.
        </p>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          Payment method
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label
            className={[
              'flex cursor-pointer items-start gap-3 rounded-card border px-4 py-3 transition-colors',
              paymentMethod === 'ACH'
                ? 'border-brand-600 bg-brand-50'
                : 'border-border bg-card hover:bg-muted',
              locked ? 'opacity-60 pointer-events-none' : '',
            ].join(' ')}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
              checked={paymentMethod === 'ACH'}
              onChange={() => setPaymentMethod('ACH')}
              disabled={mutation.isPending || locked}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Building2 className="h-4 w-4" aria-hidden />
                ACH (direct deposit)
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Deposit to your US bank account. Fastest for most payouts.
              </span>
            </span>
          </label>
          <label
            className={[
              'flex cursor-pointer items-start gap-3 rounded-card border px-4 py-3 transition-colors',
              paymentMethod === 'CHECK'
                ? 'border-brand-600 bg-brand-50'
                : 'border-border bg-card hover:bg-muted',
              locked ? 'opacity-60 pointer-events-none' : '',
            ].join(' ')}
          >
            <input
              type="checkbox"
              className="mt-1 h-4 w-4 rounded border-border text-brand-600 focus:ring-brand-500"
              checked={paymentMethod === 'CHECK'}
              onChange={() => setPaymentMethod('CHECK')}
              disabled={mutation.isPending || locked}
            />
            <span>
              <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Mail className="h-4 w-4" aria-hidden />
                Check (mail)
              </span>
              <span className="mt-0.5 block text-xs text-muted-foreground">
                Paper check mailed to the address below. You can track delivery status after payout.
              </span>
            </span>
          </label>
        </div>
      </fieldset>

      {paymentMethod === 'ACH' ? (
        <div className="rounded-[6px] border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 leading-relaxed flex flex-wrap items-center gap-x-1 gap-y-1">
          <strong className="text-slate-900 shrink-0">Security:</strong>
          <span>
            Bank credentials are transmitted securely and processed by{' '}
            <BillComMark size="xs" className="translate-y-px mx-0.5" />
            . CHM does not retain complete bank account numbers on its own servers; protect your login and only use
            trusted devices when entering financial information.
          </span>
        </div>
      ) : null}

      {paymentMethod === 'CHECK' ? (
        <div className="rounded-[6px] border border-warning/25 bg-warning/10 px-3 py-2.5 text-xs text-amber-950 leading-relaxed">
          <strong>Check delivery:</strong> Checks are mailed to the US address you enter below. Confirm it is current.
          Delivery status (mailed / in transit / delivered) appears on your Payments page and for admins after payout.
        </div>
      ) : null}

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payee information</legend>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-semibold text-muted-foreground">
            Payee name (legal name of the payee of record)
          </label>
          <input
            type="text"
            value={form.payeeName}
            onChange={set('payeeName')}
            placeholder="e.g., Jane Smith, MD or Smith Medical Consulting LLC"
            className="rounded-card border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900"
            disabled={mutation.isPending || locked}
          />
          <p className="text-xs text-muted-foreground">
            Use your personal legal name for individual payments, or the exact LLC / business legal name if the
            organization is the payee. This name appears on checks and tax reporting.
          </p>
        </div>
      </fieldset>

      <fieldset className="space-y-3">
        <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">US mailing address</legend>
        {field('Street address', 'addressLine1', { placeholder: '123 Main St' })}
        <div className="grid grid-cols-2 gap-3">
          {field('City', 'city', { placeholder: 'New York' })}
          {field('State', 'state', { placeholder: 'NY', maxLength: 2 })}
        </div>
        {field('ZIP code', 'zipCode', { placeholder: '10001', maxLength: 10 })}
      </fieldset>

      {paymentMethod === 'ACH' ? (
        <fieldset className="space-y-3">
          <legend className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex flex-wrap items-center gap-2">
            <BillComMark size="xs" />
            <span>Bank account (ACH)</span>
          </legend>
          {field('Name on account', 'nameOnAccount', { placeholder: 'Jane Smith' })}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Routing number</label>
            <input
              type="text"
              inputMode="numeric"
              value={form.routingNumber}
              onChange={set('routingNumber')}
              placeholder="9-digit ABA number"
              maxLength={9}
              className="rounded-card border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900"
              disabled={mutation.isPending || locked}
            />
            {routingHint && (
              <p
                className={`text-xs ${
                  routingHint.startsWith('✓')
                    ? 'text-success'
                    : routingHint.includes('Invalid')
                      ? 'text-destructive'
                      : 'text-muted-foreground'
                }`}
              >
                {routingHint}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-muted-foreground">Account number</label>
            <div className="relative">
              <input
                type={showAccount ? 'text' : 'password'}
                inputMode="numeric"
                value={form.accountNumber}
                onChange={set('accountNumber')}
                placeholder="Checking or savings (4–17 digits)"
                maxLength={17}
                className="w-full rounded-card border border-border px-3 py-2 pr-10 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-gray-900"
                disabled={mutation.isPending || locked}
              />
              <button
                type="button"
                onClick={() => setShowAccount((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-muted-foreground hover:text-foreground"
                aria-label={showAccount ? 'Hide account number' : 'Show account number'}
                tabIndex={-1}
              >
                {showAccount ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {accountHint && (
              <p className={`text-xs ${accountHint.includes('✓') ? 'text-success' : 'text-warning'}`}>
                {accountHint}
              </p>
            )}
            <p className="text-xs text-muted-foreground">4–17 digits. Numbers only: no spaces or dashes.</p>
          </div>
        </fieldset>
      ) : null}

      {error && <p className="text-sm text-destructive font-medium">{error}</p>}

      <button
        type="submit"
        disabled={mutation.isPending || locked || !paymentMethod}
        className="flex w-full items-center justify-center gap-2 rounded-card bg-gray-900 px-4 py-3 text-sm font-semibold text-white shadow-[inset_0_1px_0_0_rgba(255,255,255,0.08)] transition-[background-color,color,transform] duration-200 ease-[cubic-bezier(0.2,0,0,1)] hover:bg-gray-800 active:scale-[0.96] disabled:opacity-60"
      >
        {mutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        {mutation.isPending
          ? 'Saving…'
          : isUpdate
            ? 'Save updated payment details'
            : 'Save payment details'}
      </button>
    </form>
  );
}
