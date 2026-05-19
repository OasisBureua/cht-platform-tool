import { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

const CHATBOT_WIDGET_URL = 'https://chmbot.communityhealth.media/widget';

export default function ChatBubble() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {open && (
        <div className="fixed bottom-20 right-4 z-[70] w-[370px] h-[520px] max-w-[calc(100vw-2rem)] max-h-[calc(100vh-8rem)] rounded-2xl shadow-2xl border border-gray-200 bg-white overflow-hidden flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-gray-50">
            <span className="text-sm font-semibold text-gray-900">CHM Assistant</span>
            <button onClick={() => setOpen(false)} className="p-1 rounded-lg hover:bg-gray-200 text-gray-600" aria-label="Close chat">
              <X className="h-4 w-4" />
            </button>
          </div>
          <iframe
            src={CHATBOT_WIDGET_URL}
            title="CHM ChatBot"
            className="flex-1 w-full border-0"
            // Sandbox permissions needed by the chatbot widget:
            // - allow-popups + allow-popups-to-escape-sandbox: "Watch on CHM"
            //   external links and PDF/video open actions. Without these,
            //   window.open() and target="_blank" silently fail.
            // - allow-modals: delete-conversation confirmation dialog.
            //   Without this, window.confirm() is suppressed and the
            //   conversation never gets deleted.
            // - allow-top-navigation-by-user-activation: lets the widget
            //   navigate the parent CHT tab to a referenced CHM video on
            //   click, which is more intuitive than opening a new tab.
            // - allow-downloads: PDF reference cards let the user download
            //   the source PDF; without this the download is silently
            //   blocked.
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-top-navigation-by-user-activation allow-downloads"
          />
        </div>
      )}

      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-4 right-4 z-[70] flex h-14 w-14 items-center justify-center rounded-full bg-orange-600 text-white shadow-[0_6px_20px_-6px_rgba(234,88,12,0.55)] transition-[transform,background-color,box-shadow] hover:bg-orange-700 active:scale-95 dark:bg-orange-600 dark:hover:bg-orange-500"
        aria-label={open ? 'Close chat' : 'Open chat assistant'}
      >
        {open ? <X className="h-6 w-6" /> : <MessageCircle className="h-6 w-6" />}
      </button>
    </>
  );
}
