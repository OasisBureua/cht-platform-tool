import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

const CHATBOT_WIDGET_URL = 'https://chmbot.communityhealth.media/widget';

export default function ChatBot() {
  const { accessToken, isAuthenticated, getAuthHeaders } = useAuth();
  const [resolvedToken, setResolvedToken] = useState<string | null>(accessToken);

  // Use accessToken from context, or fetch from backend when authenticated but token not in context
  useEffect(() => {
    if (accessToken) {
      setResolvedToken(accessToken);
      return;
    }
    if (!isAuthenticated) {
      setResolvedToken(null);
      return;
    }
    const apiUrl = import.meta.env.VITE_API_URL || '/api';
    getAuthHeaders().then((headers) => {
      if (!headers['Authorization'] && !headers['X-Dev-User-Id']) return;
      fetch(`${apiUrl.replace(/\/$/, '')}/auth/chatbot-token`, {
        headers: { 'Content-Type': 'application/json', ...headers },
      })
        .then((r) => r.json())
        .then((data) => setResolvedToken(data?.token ?? null))
        .catch(() => setResolvedToken(null));
    });
  }, [accessToken, isAuthenticated, getAuthHeaders]);

  const iframeSrc = resolvedToken
    ? `${CHATBOT_WIDGET_URL}?token=${encodeURIComponent(resolvedToken)}`
    : CHATBOT_WIDGET_URL;

  return (
    <div className="flex flex-col -mx-4 sm:-mx-6 lg:-mx-8 -mt-4 sm:-mt-6 lg:-mt-8 -mb-4 sm:-mb-6 lg:-mb-8 h-[calc(100vh-112px)] md:h-[calc(100vh-56px)] lg:h-[calc(100vh-64px)] min-h-0">
      {!resolvedToken && (
        <p className="px-4 sm:px-6 lg:px-8 pt-3 pb-1 text-sm text-amber-600 shrink-0">
          Anonymous mode: limited to 5 queries per 24 hours. Sign in with Google for unlimited access.
        </p>
      )}
      <div className="flex-1 min-h-0">
        <iframe
          src={iframeSrc}
          title="CHM ChatBot"
          width="100%"
          height="100%"
          frameBorder="0"
          className="w-full h-full border-0"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
    </div>
  );
}
