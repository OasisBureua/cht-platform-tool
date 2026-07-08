// Wrapper for Content Hub app-chrome pages (Dashboard, wizard, Templates, Integrations,
// CampaignDetail, Upload). Centered content container inside the platform AdminLayout.
import type { ReactNode } from 'react';

export default function ChromeContainer({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-full bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl">{children}</div>
    </div>
  );
}
