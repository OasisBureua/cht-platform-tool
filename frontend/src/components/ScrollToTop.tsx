import { useLayoutEffect } from 'react';
import { useLocation } from 'react-router-dom';

function scrollViewportToTop() {
  window.scrollTo(0, 0);
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
}

/**
 * Scrolls to top on route changes (layout phase so the first paint matches).
 * Uses manual scroll restoration once so the browser does not resurrect an old viewport offset after SPA navigations (e.g. back to homepage).
 */
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    if ('scrollRestoration' in window.history && window.history.scrollRestoration !== 'manual') {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useLayoutEffect(() => {
    scrollViewportToTop();
  }, [pathname]);

  return null;
}
