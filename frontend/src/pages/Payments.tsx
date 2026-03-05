import { useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import LoadingSpinner from '../components/ui/LoadingSpinner';
import { useAuth } from '../contexts/AuthContext';
import { paymentsApi } from '../api/payments';
import type { PaymentItem, PaymentStatus } from '../mocks/payments.mocks';
import { CheckCircle2, AlertCircle, Clock3 } from 'lucide-react';
import { format } from 'date-fns';

const BILL_BOOTLOADER_PROD = 'https://apps.bill.com/bootloader/index.js';
const BILL_BOOTLOADER_STAGE = 'https://widgets.stage.bdccdn.net/bootloader/index.js';
// Use staging in dev/non-prod, production otherwise
const BILL_BOOTLOADER = import.meta.env.PROD ? BILL_BOOTLOADER_PROD : BILL_BOOTLOADER_STAGE;

function formatMoney(value: number) {
  return `$${value.toFixed(2)}`;
}

function statusChip(status: PaymentStatus) {
  const base = 'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold';
  if (status === 'PAID') return `${base} border-green-200 bg-green-50 text-green-800`;
  if (status === 'PROCESSING') return `${base} border-blue-200 bg-blue-50 text-blue-800`;
  if (status === 'PENDING') return `${base} border-yellow-200 bg-yellow-50 text-yellow-800`;
  return `${base} border-red-200 bg-red-50 text-red-800`;
}

function statusIcon(status: PaymentStatus) {
  if (status === 'PAID') return <CheckCircle2 className="h-4 w-4" />;
  if (status === 'PROCESSING') return <Clock3 className="h-4 w-4" />;
  if (status === 'PENDING') return <AlertCircle className="h-4 w-4" />;
  return <AlertCircle className="h-4 w-4" />;
}

export default function Payments() {
  const { user } = useAuth();
  const userId = user?.userId ?? '';
  const queryClient = useQueryClient();

  const { data: accountStatus, isLoading: loadingAccount } = useQuery({
    queryKey: ['payments-account-status', userId],
    queryFn: () => paymentsApi.getAccountStatus(userId),
    enabled: !!userId,
  });

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['payments-summary', userId],
    queryFn: () => paymentsApi.getSummary(userId),
    enabled: !!userId,
  });

  const { data: history, isLoading: loadingHistory } = useQuery({
    queryKey: ['payments-history', userId],
    queryFn: () => paymentsApi.getHistory(userId),
    enabled: !!userId,
  });

  const totalThisMonth = (history || []).reduce((sum, i) => {
    const d = new Date(i.date);
    const now = new Date();
    if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && i.status === 'PAID') {
      return sum + i.amount;
    }
    return sum;
  }, 0);

  const needsBankInfo = !accountStatus?.hasAccount;

  if (loadingAccount || loadingSummary || loadingHistory) return <LoadingSpinner />;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Payments</h1>
        <p className="text-sm text-gray-600">
          Set up your bank details to receive payouts via ACH. Admins process payments via Bill.com.
        </p>
      </header>

      {/* Bill.com embedded vendor setup */}
      {needsBankInfo ? (
        <BillVendorSetup
          userId={userId}
          vendorId={accountStatus?.accountId}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ['payments-account-status', userId] });
            queryClient.invalidateQueries({ queryKey: ['payments-summary', userId] });
          }}
        />
      ) : (
        <div className="rounded-3xl border border-green-200 bg-green-50/50 p-4 flex items-center gap-3">
          <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
          <p className="text-sm font-medium text-green-800">Bank details on file. You can receive payouts.</p>
        </div>
      )}

      {/* Summary cards */}
      <section className="grid gap-6 md:grid-cols-3">
        <StatCard label="Total paid" value={formatMoney(summary?.availableBalance ?? 0)} sub="Lifetime earnings" />
        <StatCard label="Pending" value={formatMoney(summary?.pendingBalance ?? 0)} sub="Awaiting payout" />
        <StatCard label="This month" value={formatMoney(totalThisMonth)} sub="Paid this month" />
      </section>

      {/* Payout info */}
      <section className="rounded-3xl border border-gray-200 bg-white p-6">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">Payouts</p>
          <p className="text-sm text-gray-600">
            Last payout:{' '}
            <span className="font-semibold text-gray-900">
              {summary?.lastPayoutDate ? format(new Date(summary.lastPayoutDate), 'MMM d, yyyy') : '—'}
            </span>
            {' · '}
            Admins process payouts via Bill.com (ACH). W-9 must be on file.
          </p>
        </div>
      </section>

      {/* History */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-900">Payment history</h2>
          <span className="text-sm text-gray-600">{(history || []).length} items</span>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <div className="divide-y divide-gray-200">
            {(history || []).map((item) => (
              <HistoryRow key={item.id} item={item} />
            ))}
          </div>
          {(history || []).length === 0 && (
            <div className="p-10 text-center">
              <p className="font-semibold text-gray-900">No payments yet</p>
              <p className="mt-1 text-sm text-gray-600">Complete activities to start earning.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function BillVendorSetup({
  userId,
  vendorId,
  onSuccess,
}: {
  userId: string;
  vendorId?: string;
  onSuccess: () => void;
}) {
  const [status, setStatus] = useState<'loading' | 'ready' | 'success' | 'error'>('loading');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const bootloaderRef = useRef<{ destroy: (id: string) => void } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    async function mount() {
      try {
        // Fetch session credentials from our backend first
        const session = await paymentsApi.getBillElementSession();
        if (cancelled) return;

        // Dynamically import the Bill.com bootloader ES module
        // @vite-ignore tells Vite not to try to bundle this external URL
        const { init } = await import(/* @vite-ignore */ BILL_BOOTLOADER) as { init: (config: unknown) => unknown };
        if (cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bootloader = (init as any)({
          key: session.devKey,
          getSessionId: () => Promise.resolve(session.sessionId),
          getUserContext: () => ({ userId: session.userId, orgId: session.orgId }),
          onAuthFailed: () => Promise.resolve(),
          onEvent: (event: unknown) => console.log('[Bill.com]', event),
        });

        bootloaderRef.current = bootloader as { destroy: (id: string) => void };

        const inputs: Record<string, string> = {};
        if (vendorId) inputs.vendorId = vendorId;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (bootloader as any).register({
          id: 'bill-vendor-setup',
          name: 'vendorSetupApp',
          inputs,
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (bootloader as any).render('bill-vendor-setup', '#bill-element-container');
        if (cancelled) return;
        setStatus('ready');

        // Events are dispatched on window using the element id as the event name
        const handleEvent = async (e: Event) => {
          if (cancelled) return;
          const { name, payload } = (e as CustomEvent).detail || {};
          if (name === 'vendorSetupSuccess') {
            const newVendorId: string | undefined = payload?.vendorData?.id;
            if (newVendorId) {
              await paymentsApi.saveVendorId(userId, newVendorId).catch(() => {});
            }
            setStatus('success');
            onSuccess();
          }
          if (name === 'error') {
            setErrorMsg(payload?.message || 'An error occurred with payment setup');
            setStatus('error');
          }
        };

        window.addEventListener('bill-vendor-setup', handleEvent);
        return () => window.removeEventListener('bill-vendor-setup', handleEvent);
      } catch (err) {
        if (cancelled) return;
        setErrorMsg(err instanceof Error ? err.message : 'Failed to load payment setup');
        setStatus('error');
      }
    }

    mount();
    return () => {
      cancelled = true;
      bootloaderRef.current?.destroy('bill-vendor-setup');
    };
  }, [userId, vendorId, onSuccess]);

  if (status === 'success') {
    return (
      <div className="rounded-3xl border border-green-200 bg-green-50/50 p-6 flex items-center gap-3">
        <CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
        <div>
          <p className="font-semibold text-green-900">Bank details saved</p>
          <p className="text-sm text-green-700 mt-0.5">You're set up to receive payouts via Bill.com.</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="rounded-3xl border border-red-200 bg-red-50 p-6">
        <p className="font-semibold text-red-900">Could not load payment setup</p>
        <p className="text-sm text-red-700 mt-1">{errorMsg}</p>
        <p className="text-sm text-gray-600 mt-3">
          Please try refreshing the page or contact support if the issue persists.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-gray-200 bg-white overflow-hidden min-h-[400px]">
      {status === 'loading' && (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
        </div>
      )}
      <div id="bill-element-container" className={status === 'loading' ? 'hidden' : 'min-h-[400px]'} />
    </div>
  );
}


function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-3xl border border-gray-200 bg-white p-6">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-gray-900">{value}</p>
      <p className="mt-1 text-sm text-gray-600">{sub}</p>
    </div>
  );
}

function HistoryRow({ item }: { item: PaymentItem }) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div className="min-w-0">
        <p className="font-medium text-gray-900 truncate">{item.title}</p>
        <p className="text-sm text-gray-600 truncate">
          {format(new Date(item.date), 'MMM d, yyyy')} • {item.method || '—'}
        </p>
      </div>
      <div className="shrink-0 flex items-center gap-3">
        <span className="text-sm font-semibold text-gray-900">{formatMoney(item.amount)}</span>
        <span className={statusChip(item.status)}>
          {statusIcon(item.status)}
          {item.status}
        </span>
      </div>
    </div>
  );
}
