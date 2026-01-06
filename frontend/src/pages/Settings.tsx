import { useState } from 'react';
import { KeyRound, Bell, Link2, User } from 'lucide-react';

type Tab = 'general' | 'security' | 'notifications' | 'integrations';

export default function Settings() {
  const [tab, setTab] = useState<Tab>('general');

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-gray-600">Manage your account, profile, and preferences</p>
      </header>

      {/* Tabs */}
      <div className="bg-white border border-gray-200 rounded-xl p-2">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <TabButton active={tab === 'general'} onClick={() => setTab('general')}>
            General
          </TabButton>
          <TabButton active={tab === 'security'} onClick={() => setTab('security')}>
            Security
          </TabButton>
          <TabButton active={tab === 'notifications'} onClick={() => setTab('notifications')}>
            Notifications
          </TabButton>
          <TabButton active={tab === 'integrations'} onClick={() => setTab('integrations')}>
            Integrations
          </TabButton>
        </div>
      </div>

      {/* Content */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6">
          {tab === 'general' && <GeneralPanel />}
          {tab === 'security' && <SecurityPanel />}
          {tab === 'notifications' && <NotificationsPanel />}
          {tab === 'integrations' && <IntegrationsPanel />}
        </div>

        {/* Quick actions */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Quick Actions</h2>

          <QuickAction
            icon={<User className="h-4 w-4" />}
            title="Update profile"
            subtitle="Edit your personal information"
          />

          <QuickAction
            icon={<KeyRound className="h-4 w-4" />}
            title="Change password"
            subtitle="Improve your account security"
          />

          <QuickAction
            icon={<Bell className="h-4 w-4" />}
            title="Notification settings"
            subtitle="Choose how you receive updates"
          />

          <QuickAction
            icon={<Link2 className="h-4 w-4" />}
            title="Manage integrations"
            subtitle="Connect supported services"
          />
        </div>
      </section>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-lg px-3 py-2 text-sm font-semibold border',
        active
          ? 'bg-gray-900 text-white border-gray-900'
          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function QuickAction({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <button className="w-full text-left rounded-xl border border-gray-200 bg-white p-4 hover:bg-gray-50">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 text-gray-700">{icon}</div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-sm text-gray-600">{subtitle}</p>
        </div>
      </div>
    </button>
  );
}

function GeneralPanel() {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">General</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Field label="First name" value="—" />
        <Field label="Last name" value="—" />
        <Field label="Email" value="—" />
        <Field label="Specialty" value="—" />
      </div>

      <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
        Save changes
      </button>
    </div>
  );
}

function SecurityPanel() {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Security</h2>
      <p className="text-sm text-gray-600">
        Password and authentication controls will go here once Auth is connected.
      </p>

      <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50">
        Change password
      </button>
    </div>
  );
}

function NotificationsPanel() {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Notifications</h2>
      <p className="text-sm text-gray-600">
        Choose when and how we notify you about new activities and payments.
      </p>

      <div className="space-y-3">
        <ToggleRow label="New opportunities" />
        <ToggleRow label="Payment updates" />
        <ToggleRow label="Program reminders" />
      </div>

      <button className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-black">
        Save preferences
      </button>
    </div>
  );
}

function IntegrationsPanel() {
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-gray-900">Integrations</h2>
      <p className="text-sm text-gray-600">
        Connected integrations will appear here.
      </p>

      <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <p className="text-sm font-semibold text-gray-900">No integrations connected</p>
        <p className="mt-1 text-sm text-gray-600">Connect services when available.</p>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-gray-600">{label}</p>
      <div className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900">
        {value}
      </div>
    </div>
  );
}

function ToggleRow({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-200 p-4">
      <p className="text-sm font-semibold text-gray-900">{label}</p>
      <button className="rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50">
        Off
      </button>
    </div>
  );
}
