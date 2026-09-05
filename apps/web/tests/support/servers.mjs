import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { fixtureResponse, coverSvg } from './fixture-data.mjs';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const web = fileURLToPath(new URL('../../', import.meta.url));
const env = {
  ...process.env,
  API_BASE_INTERNAL: 'http://127.0.0.1:4301',
  LEGACY_WEB_ORIGIN: 'http://127.0.0.1:4311',
  NEXT_BUILD_DIR: '.next-parity',
  NEXT_TELEMETRY_DISABLED: '1',
  ASTRO_TELEMETRY_DISABLED: '1',
};
const fixture = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://127.0.0.1:4301');
  if (url.pathname === '/ready') {
    const checks = await Promise.allSettled(
      [4311, 3111].map((port) =>
        fetch(`http://127.0.0.1:${port}/manga/search`, { signal: AbortSignal.timeout(2000) }),
      ),
    );
    const ready = checks.every((check) => check.status === 'fulfilled' && check.value.ok);
    response.writeHead(ready ? 200 : 503);
    response.end(ready ? 'ready' : 'starting');
    return;
  }
  if (url.pathname === '/api/content-sources/media') {
    response.writeHead(200, { 'content-type': 'image/svg+xml' });
    response.end(coverSvg);
    return;
  }
  if (url.pathname === '/api/__test__/echo') {
    response.writeHead(200, {
      'content-type': 'application/json',
      'set-cookie': [
        'fixture_reply=one; Path=/; HttpOnly',
        'fixture_second=two; Path=/; SameSite=Lax',
      ],
    });
    response.end(
      JSON.stringify({
        cookie: request.headers.cookie || '',
        query: url.searchParams.get('value'),
      }),
    );
    return;
  }
  response.writeHead(200, { 'content-type': 'application/json' });
  response.end(JSON.stringify({ success: true, data: fixtureResponse(url) }));
});
fixture.listen(4301, '127.0.0.1');
const children = [
  spawn(
    process.execPath,
    ['node_modules/astro/astro.js', 'dev', '--host', '127.0.0.1', '--port', '4311'],
    { cwd: `${repo}/frontend-astro`, env, stdio: 'inherit', windowsHide: true },
  ),
  spawn(
    process.execPath,
    [
      'node_modules/next/dist/bin/next',
      process.env.UI_PRODUCTION === '1' ? 'start' : 'dev',
      ...(process.env.UI_PRODUCTION === '1' ? [] : ['--webpack']),
      '--hostname',
      '127.0.0.1',
      '--port',
      '3111',
    ],
    { cwd: web, env, stdio: 'inherit', windowsHide: true },
  ),
];

let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  children.forEach((child) => child.kill());
  fixture.close();
  process.exit(code);
}
children.forEach((child) => {
  child.on('error', (error) => {
    console.error(error);
    stop(1);
  });
  child.on('exit', (code) => {
    if (!stopping) stop(code || 1);
  });
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
