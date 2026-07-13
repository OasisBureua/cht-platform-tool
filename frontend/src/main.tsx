import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import App from './App.tsx';
import './index.css';

// After a deploy, an old tab can request a deleted hashed chunk. Reload once to pick up new index.html.
const CHUNK_RELOAD_KEY = 'cht:chunk-reload';
function isChunkLoadError(reason: unknown): boolean {
  if (!reason) return false;
  const msg =
    reason instanceof Error
      ? `${reason.name} ${reason.message}`
      : String(reason);
  return /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|Importing a module script failed/i.test(
    msg,
  );
}
window.addEventListener('unhandledrejection', (event) => {
  if (!isChunkLoadError(event.reason)) return;
  if (sessionStorage.getItem(CHUNK_RELOAD_KEY) === '1') return;
  sessionStorage.setItem(CHUNK_RELOAD_KEY, '1');
  window.location.reload();
});
window.addEventListener('load', () => {
  sessionStorage.removeItem(CHUNK_RELOAD_KEY);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>
);
