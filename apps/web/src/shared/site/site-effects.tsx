'use client';

import { useEffect } from 'react';

export function SiteEffects() {
  useEffect(() => {
    const controller = new AbortController();
    // Keep the existing visitor endpoint and service-worker behavior.
    void fetch('/api/visitors/count', { cache: 'no-store', signal: controller.signal }).catch(
      () => {},
    );
    const register = () => {
      if ('serviceWorker' in navigator && window.isSecureContext) {
        void navigator.serviceWorker.register('/sw.js').catch(() => {});
      }
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
    return () => {
      controller.abort();
      window.removeEventListener('load', register);
    };
  }, []);
  return null;
}
