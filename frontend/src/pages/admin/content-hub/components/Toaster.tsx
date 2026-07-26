// Scoped toast system for Content Hub: ported from the report generator's Toaster,
// restyled to platform tokens (bg-card / border-border / text-foreground). Kept local
// so it never conflicts with any platform-wide toaster added later.
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface Toast {
  id: number;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive';
}

interface ToastContextValue {
  toast: (t: Omit<Toast, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue>({ toast: () => {} });

export function useToast() {
  return useContext(ToastContext);
}

let nextId = 1;

export function ContentHubToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = useCallback((t: Omit<Toast, 'id'>) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-label="Notifications"
        role="region"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 no-print"
      >
        <ol className="m-0 flex list-none flex-col gap-2 p-0">
          {toasts.map((t) => (
            <li
              key={t.id}
              className={[
                'w-[356px] rounded-xl border p-4 shadow-lg',
                t.variant === 'destructive'
                  ? 'border-accent/40 bg-accent/10 text-foreground'
                  : 'border-border bg-card text-foreground',
              ].join(' ')}
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-sm font-semibold">{t.title}</div>
                  {t.description && (
                    <div className="mt-1 text-xs text-muted-foreground">{t.description}</div>
                  )}
                </div>
                <button
                  aria-label="Dismiss notification"
                  onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </ToastContext.Provider>
  );
}
