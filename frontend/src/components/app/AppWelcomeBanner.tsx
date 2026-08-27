import { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';

const STORAGE_KEY = 'cht_app_welcome_seen';

export default function AppWelcomeBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const seen = sessionStorage.getItem(STORAGE_KEY);
    if (!seen) setVisible(true);
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-card border border-border bg-muted p-4 flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="h-5 w-5 text-success mt-0.5" />
        <div>
          <p className="text-sm font-semibold text-foreground">
            You’re now in the participant experience
          </p>
          <p className="text-sm text-muted-foreground">
            Register for Live sessions, explore conversations, complete surveys, and earn CME
            credits and honoraria.
          </p>
        </div>
      </div>

      <button
        onClick={() => {
          sessionStorage.setItem(STORAGE_KEY, 'true');
          setVisible(false);
        }}
        className="text-sm font-semibold text-muted-foreground hover:text-foreground"
      >
        Dismiss
      </button>
    </div>
  );
}
