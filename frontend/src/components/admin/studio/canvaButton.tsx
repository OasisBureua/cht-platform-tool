import { useState } from 'react';
import { Send } from 'lucide-react';
import type { StudioLayers } from './engine';
import { canvaError, sendToCanva, type SendStep } from './canva';

const STEP: Record<SendStep, string> = {
  connecting: 'Connecting to Canva…',
  building: 'Preparing slides…',
  sending: 'Uploading…',
  importing: 'Canva is importing…',
};

/**
 * Footer button for the Deck and Social studios: sends every slide to the
 * admin's Canva as an editable design and opens it in a new tab.
 */
export function SendToCanva({ layers, title }: { layers: (() => StudioLayers[]) | null; title: string }) {
  const [step, setStep] = useState<SendStep | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (!layers || step) return;
    setError(null);
    setSent(null);
    setStep('building');
    /* opened on the click so the browser allows it; it takes Canva's sign-in if needed, then the design */
    const tab = window.open('', '_blank');
    if (tab) {
      tab.opener = null;
      tab.document.title = 'Sending to Canva';
      tab.document.body.innerHTML = '<p style="font:16px/1.5 system-ui,sans-serif;color:#22303C;padding:40px">Sending to Canva…</p>';
    }
    try {
      const { editUrl } = await sendToCanva({ layers, title, tab, onStep: setStep });
      if (tab && !tab.closed) tab.location.href = editUrl;
      else window.open(editUrl, '_blank', 'noopener');
      setSent(editUrl);
    } catch (e) {
      if (tab && !tab.closed) tab.close();
      setError(canvaError(e));
    } finally {
      setStep(null);
    }
  };

  return (
    <>
      <button
        type="button"
        disabled={!layers || !!step}
        onClick={() => void send()}
        aria-busy={!!step}
        className="inline-flex h-9 items-center gap-1.5 rounded-[8px] bg-surface-2 px-3 text-body-s text-text disabled:opacity-40"
      >
        <Send className="size-4" aria-hidden /> {step ? STEP[step] : 'Send to Canva'}
      </button>
      <span role="status" aria-live="polite" className="order-last basis-full text-end text-body-s empty:hidden">
        {error ? (
          <span className="text-destructive">{error}</span>
        ) : sent ? (
          <span className="text-dim">
            Sent to Canva.{' '}
            <a href={sent} target="_blank" rel="noreferrer" className="text-anchor underline underline-offset-2">
              Open the design
            </a>
          </span>
        ) : null}
      </span>
    </>
  );
}
