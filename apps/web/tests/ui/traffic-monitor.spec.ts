import { test, expect, type BrowserContext } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { fixtureResponse } from '../support/fixture-data.mjs';

const assets = new URL('../../../../services/traffic-monitor/web/', import.meta.url);
const nodeId = 'aaaaaaaaaaaaaaaa';
async function mockTraffic(context: BrowserContext, https = true) {
  await context.addInitScript(() => localStorage.setItem('boke_admin_token', 'fixture-admin'));
  const nodes: any[] = [];
  const created: any[] = [];
  await context.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    const asset =
      path === '/api/traffic/view'
        ? 'index.html'
        : path === '/api/traffic/style.css'
          ? 'style.css'
          : path === '/api/traffic/app.js'
            ? 'app.js'
            : '';
    if (asset)
      return route.fulfill({
        contentType: asset.endsWith('.html')
          ? 'text/html; charset=utf-8'
          : asset.endsWith('.css')
            ? 'text/css'
            : 'text/javascript',
        body: await readFile(new URL(asset, assets)),
        headers: {
          'Content-Security-Policy':
            "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'self'; base-uri 'none'; form-action 'self'",
        },
      });
    if (path === '/api/traffic/api/session')
      return route.fulfill({
        json: {
          authenticated: true,
          user: '博客管理员',
          ingest_url: `${https ? 'https://blog.example' : 'http://127.0.0.1:3111'}/api/traffic/api/ingest`,
        },
      });
    if (path === '/api/traffic/api/fleet') return route.fulfill({ json: { nodes } });
    if (path === `/api/traffic/api/nodes/${nodeId}`)
      return route.fulfill({
        json: { ...nodes[0], daily: [], months: [], sources: [], alerts: [], ssh: {} },
      });
    if (path === `/api/traffic/api/nodes/${nodeId}/ssh-setup`)
      return route.fulfill({
        json: {
          public_key: 'ssh-ed25519 fixture-public-only',
          commands:
            "sudo bash -s <<'BLOG_TRAFFIC_SETUP'\n# fixture: install vnStat and restricted query key\nBLOG_TRAFFIC_SETUP",
          fingerprint: '',
        },
      });
    if (path === `/api/traffic/api/nodes/${nodeId}/ssh-fingerprint`)
      return route.fulfill({ json: { ok: true } });
    if (path === `/api/traffic/api/nodes/${nodeId}/ssh-pull`)
      return route.fulfill({ json: { ok: true, samples: 0, interface: 'eth0' } });
    if (path === '/api/traffic/api/nodes' && req.method() === 'POST') {
      const config = req.postDataJSON();
      created.push(config);
      const now = Math.floor(Date.now() / 1000);
      nodes.push({
        id: nodeId,
        config,
        agent: {},
        connection: 'waiting',
        summary: {
          start: now - 86400,
          end: now + 86400 * 29,
          quota_known: true,
          recorded_buckets: 0,
          baseline_applied: 0,
          reliable: false,
          percent: 0,
          last_received: null,
        },
      });
      return route.fulfill({ status: 201, json: { node_id: nodeId, token: 'fixture-only-token' } });
    }
    if (path === `/api/traffic/api/nodes/${nodeId}/package`)
      return route.fulfill({
        contentType: 'application/gzip',
        body: 'fixture-install-package',
      });
    const data =
      path === '/api/auth/me'
        ? { id: 1, username: 'admin', role: 'admin' }
        : path === '/api/admin/devices/register'
          ? { token: 'fixture-device' }
          : path === '/api/admin/search-sources'
            ? { sources: [], defaults: {} }
            : path === '/api/admin/venera-sources'
              ? { sources: [], repositories: [] }
              : path.startsWith('/api/admin/dashboard/') || path === '/api/admin/media/explorer'
                ? {}
                : path.startsWith('/api/admin/') || ['/api/categories', '/api/tags'].includes(path)
                  ? []
                  : path === '/api/traffic/session'
                    ? { ready: true }
                    : fixtureResponse(url);
    return route.fulfill({ json: { success: true, data } });
  });
  return created;
}

for (const width of [1440, 390]) {
  test(`${width} traffic monitor matches admin styling and guides node setup`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({ viewport: { width, height: 1000 } });
    const created = await mockTraffic(context);
    const page = await context.newPage();
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('http://127.0.0.1:3111/admin');
    await expect(page.locator('.admin-shell')).toHaveAttribute('data-status', '已连接后端 API');
    await page.getByRole('button', { name: '流量监控', exact: true }).click();
    const frame = page.frameLocator('#traffic-frame');
    await expect(page.locator('#traffic-add-node')).toBeEnabled();
    await expect(frame.getByRole('heading', { name: '还没有接入的 VPS' })).toBeVisible();
    await expect(frame.locator('aside')).toHaveCount(0);
    await expect(frame.locator('.workspace-tabs')).toBeVisible();
    const sameRadius = await page.evaluate(() => {
      const doc = (document.querySelector('#traffic-frame') as HTMLIFrameElement).contentDocument!;
      return (
        getComputedStyle(document.querySelector('#dashboard-panel .ryu-card')!).borderRadius ===
        getComputedStyle(doc.querySelector('.panel')!).borderRadius
      );
    });
    expect(sameRadius).toBe(true);
    await page.locator('#traffic-help').click();
    await expect(frame.getByRole('dialog', { name: '如何添加我的节点' })).toBeVisible();
    await expect(frame.locator('#help-dialog')).toContainText('SSH');
    await frame.getByRole('button', { name: '知道了' }).click();
    await page.locator('#traffic-add-node').click();
    await expect(frame.getByRole('dialog', { name: '添加节点', exact: true })).toBeVisible();
    await frame.locator('[name="collection_mode"]').selectOption('agent');
    await frame.getByLabel('节点名称', { exact: true }).fill('我的日本 VPS');
    await frame.locator('[name="host"]').fill('203.0.113.42');
    await frame.locator('[name="ssh_port"]').fill('3101');
    await frame.locator('#wizard-next').click();
    await frame.locator('[name="quota_mode"]').selectOption('limited');
    await frame.locator('[name="quota"]').fill('100');
    await frame.locator('[name="reset_day"]').fill('15');
    await frame.locator('[name="confirmed"]').check();
    await frame.locator('#save-node').click();
    await expect(frame.getByRole('dialog', { name: '连接采集器', exact: true })).toBeVisible();
    expect(created[0]).toMatchObject({
      name: '我的日本 VPS',
      host: '203.0.113.42',
      ssh_port: 3101,
      quota: 100,
      reset_day: 15,
      interface: 'auto',
    });
    await expect(frame.locator('#token-endpoint')).toHaveText(
      'https://blog.example/api/traffic/api/ingest',
    );
    await expect(frame.locator('#download-package')).toBeEnabled();
    const configDownload = page.waitForEvent('download');
    await frame.locator('#download-agent').click();
    const download = await configDownload;
    const configText = await readFile((await download.path())!, 'utf8');
    expect(configText).toContain('INGEST_URL=https://blog.example/api/traffic/api/ingest');
    await frame.getByRole('button', { name: '稍后接入' }).click();
    await expect(frame.locator('.fleet-card')).toContainText('我的日本 VPS');
    expect(
      await frame
        .locator('body')
        .evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath('traffic-monitor.png'), fullPage: true });
    expect(errors).toEqual([]);
    await context.close();
  });
}

test('HTTP setup explains HTTPS prerequisite instead of producing an unusable collector configuration', async ({
  browser,
}) => {
  const context = await browser.newContext();
  await mockTraffic(context, false);
  const page = await context.newPage();
  await page.goto('http://127.0.0.1:3111/admin');
  await expect(page.locator('.admin-shell')).toHaveAttribute('data-status', '已连接后端 API');
  await page.getByRole('button', { name: '流量监控', exact: true }).click();
  await page.locator('#traffic-add-node').click();
  const frame = page.frameLocator('#traffic-frame');
  await frame.locator('[name="collection_mode"]').selectOption('agent');
  await frame.getByLabel('节点名称', { exact: true }).fill('待接入 VPS');
  await frame.locator('#wizard-next').click();
  await frame.locator('#save-node').click();
  await expect(frame.locator('#token-endpoint-note')).toBeVisible();
  await expect(frame.locator('#token-endpoint-note')).toContainText('HTTP');
  await expect(frame.locator('#download-package')).toBeDisabled();
  await context.close();
});

for (const width of [1440, 390]) {
  test(`${width} HTTP admin can set up SSH without upload tokens or private keys`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height: 850 } });
    const created = await mockTraffic(context, false);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3111/admin');
    await page.getByRole('button', { name: '流量监控', exact: true }).click();
    await page.locator('#traffic-add-node').click();
    const frame = page.frameLocator('#traffic-frame');
    await expect(frame.locator('[name="collection_mode"]')).toHaveValue('ssh');
    await frame.getByLabel('节点名称', { exact: true }).fill('VirNAT SSH 节点');
    await frame.locator('[name="host"]').fill('203.0.113.42');
    await frame.locator('[name="ssh_port"]').fill('3101');
    await frame.locator('#wizard-next').click();
    await frame.locator('#save-node').click();
    await expect(frame.getByRole('dialog', { name: 'SSH 拉取接入' })).toBeVisible();
    expect(created[0]).toMatchObject({
      collection_mode: 'ssh',
      ssh_user: 'traffic-monitor',
      host: '203.0.113.42',
      ssh_port: 3101,
    });
    await expect(frame.locator('#ssh-commands')).toContainText('sudo bash');
    await expect(frame.locator('#ssh-commands')).not.toContainText('PRIVATE KEY');
    await expect(frame.locator('#token-dialog')).not.toBeVisible();
    await frame.locator('#ssh-test').click();
    await expect(frame.locator('#ssh-error')).toContainText('SHA256');
    await frame.locator('#ssh-fingerprint').fill('SHA256:' + 'A'.repeat(43));
    await frame.locator('#ssh-test').click();
    await expect(frame.locator('#ssh-error')).toContainText('SSH 已连通');
    await frame.locator('#ssh-dialog .close-ssh.secondary').click();
    await expect(frame.locator('.fleet-card')).toContainText('SSH 接入 / 测试');
    await frame.getByRole('button', { name: '节点设置', exact: true }).click();
    await expect(frame.locator('#ssh-settings-tools')).toBeVisible();
    await expect(frame.locator('#agent-settings-tools')).toBeHidden();
    await frame.locator('#pull-ssh-now').click();
    await expect(frame.locator('#toast')).toContainText('SSH 已连通');
    await context.close();
  });
}

for (const width of [1440, 390]) {
  test(`${width} traffic content can scroll to the bottom and recover after a dialog`, async ({
    browser,
  }) => {
    const context = await browser.newContext({ viewport: { width, height: 720 } });
    await mockTraffic(context);
    const page = await context.newPage();
    await page.goto('http://127.0.0.1:3111/admin');
    await page.getByRole('button', { name: '流量监控', exact: true }).click();
    await expect(page.locator('#traffic-help')).toBeEnabled();
    const frame = page.frameLocator('#traffic-frame');
    // Long node lists resize the embedded document beyond the admin grid row.
    await frame.locator('#fleet-page').evaluate((element) => {
      const list = document.createElement('div');
      list.style.height = '2400px';
      const end = document.createElement('p');
      end.id = 'scroll-end';
      end.textContent = '流量列表底部';
      element.append(list, end);
    });
    await expect
      .poll(() => page.locator('#traffic-frame').evaluate((el) => el.clientHeight))
      .toBeGreaterThan(2400);
    const wheelToBottom = async () => {
      await page.mouse.move(width - 60, 500);
      await page.mouse.wheel(0, 6000);
      await expect
        .poll(() =>
          frame.locator('#scroll-end').evaluate((el) => {
            const rect = el.getBoundingClientRect();
            const parentRect = window.frameElement!.getBoundingClientRect();
            const top = parentRect.top + rect.top;
            return top >= 0 && top + rect.height <= window.parent.innerHeight;
          }),
        )
        .toBe(true);
    };
    await wheelToBottom();
    // Opening a modal must not leave a fixed-height or clipped panel behind.
    await page.locator('#traffic-help').click();
    await frame.getByRole('button', { name: '知道了' }).click();
    await wheelToBottom();
    await context.close();
  });
}
