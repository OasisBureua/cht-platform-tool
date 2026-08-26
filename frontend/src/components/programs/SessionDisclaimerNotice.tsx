import { AlertTriangle } from 'lucide-react';

export default function SessionDisclaimerNotice({ text }: { text: string }) {
  return (
    <div
      role="note"
      className="rounded-xl border-2 border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950 shadow-sm"
    >
      <div className="flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600 mt-0.5" aria-hidden />
        <div className="min-w-0 space-y-1">
          <p className="font-semibold text-amber-950">Disclaimer</p>
          <p className="whitespace-pre-wrap leading-relaxed">{text}</p>
        </div>
      </div>
    </div>
  );
}
