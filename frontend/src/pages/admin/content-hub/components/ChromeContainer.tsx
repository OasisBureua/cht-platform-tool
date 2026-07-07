// Wrapper for Content Hub app-chrome pages (Dashboard, wizard, Templates, Integrations,
// CampaignDetail, Upload). Renders the local ContentHubHeader + a centered content
// container. Replaces the report generator's AppShell. Responds to the platform theme.
import type { ReactNode } from 'react';
import ContentHubHeader from './ContentHubHeader';

export default function ChromeContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-background text-foreground">
      <ContentHubHeader />
      <div className="mx-auto w-full max-w-6xl p-6">{children}</div>
    </div>
  );
}
