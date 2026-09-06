import { serviceWorker } from '../../features/pwa/service-worker';
export const GET = () =>
  new Response(serviceWorker, {
    headers: {
      'Content-Type': 'text/javascript; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Service-Worker-Allowed': '/',
    },
  });
