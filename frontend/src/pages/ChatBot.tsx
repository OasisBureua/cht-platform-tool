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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">ChatBot</h1>
        <p className="text-sm text-gray-600">
          AI assistance for your healthcare content questions. Ask about treatment options, clinical
          evidence, and more.
        </p>
      </div>
      <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
        <iframe
          src={iframeSrc}
          title="CHM ChatBot"
          width="100%"
          height="600"
          frameBorder="0"
          className="min-h-[600px] w-full"
          sandbox="allow-scripts allow-same-origin allow-forms"
        />
      </div>
      {!resolvedToken && (
        <p className="text-sm text-amber-600">
          Anonymous mode: limited to 5 queries per 24 hours. Log in with Supabase for unlimited
          access.
        </p>
      )}
    </div>
  );
}
