'use client';
import { useEffect, useState } from 'react';
import type { SiteSettings } from './settings';
export function SiteFooter({ settings }: { settings: SiteSettings }) {
  const [uptime, setUptime] = useState('--'),
    [visitors, setVisitors] = useState({ today: '--', total: '--' });
  useEffect(() => {
    const start = new Date(`${settings.site_start_date || '2026-01-01'}T00:00:00+08:00`).getTime();
    const update = () => {
      const seconds = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setUptime(
        `${Math.floor(seconds / 86400)} 天 ${Math.floor((seconds % 86400) / 3600)} 时 ${Math.floor((seconds % 3600) / 60)} 分`,
      );
    };
    update();
    const timer = setInterval(update, 60000),
      controller = new AbortController();
    void fetch('/api/visitors/count', { cache: 'no-store', signal: controller.signal })
      .then((response) => response.json())
      .then((json) =>
        setVisitors({ today: json.data?.today ?? '--', total: json.data?.total ?? '--' }),
      )
      .catch(() => {});
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [settings.site_start_date]);
  return (
    <footer className="site-footer mx-auto w-full max-w-blog px-4 pb-10 pt-8">
      <div>
        <a href="/" className="site-footer-brand">
          {settings.site_title || '个人博客'}
        </a>
        <p>{settings.footer_text || '记录所想，分享所见。'}</p>
      </div>
      <div className="site-footer-meta">
        {settings.enable_rss !== false && <a href="/rss.xml">RSS</a>}
        {settings.enable_json_feed !== false && <a href="/feed.json">JSON Feed</a>}
        <span>© {settings.copyright_year || new Date().getFullYear()}</span>
        <span>
          已运行 <strong id="site-uptime">{uptime}</strong>
        </span>
        {settings.show_visitor_stats !== false && (
          <span>
            今日 <strong id="visitor-today">{visitors.today}</strong> · 累计{' '}
            <strong id="visitor-total">{visitors.total}</strong>
          </span>
        )}
      </div>
    </footer>
  );
}
