'use client';
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { mountController } from './navigation-controller';
import type { SiteSettings } from './settings';
export interface SearchEngine {
  id: string;
  name: string;
  mark?: string;
  url: string;
}
export function SiteNavigation({
  settings,
  immersive = false,
}: {
  settings: SiteSettings;
  immersive?: boolean;
}) {
  const pathname = usePathname();
  const [condensed] = useState(false);
  useEffect(() => mountController(), []);
  const brandAvatar = settings.profile_avatar || '/profile.webp';
  const defaultSearchEngines = [
    { id: 'site', name: '站内搜索', mark: '⌕', url: 'site:' },
    { id: 'bing', name: 'Bing', mark: 'B', url: 'https://www.bing.com/search?q={query}' },
  ];
  const searchEngines =
    Array.isArray(settings.nav_search_engines) && settings.nav_search_engines.length
      ? settings.nav_search_engines
      : defaultSearchEngines;
  const primaryItems = [
    { href: '/', label: '文章' },
    { href: '/archive', label: '归档' },
    { href: '/nav', label: '导航' },
    { href: '/series', label: '专题' },
    { href: '/books', label: '书库' },
    { href: '/manga', label: '漫画' },
    { href: '/bangumi', label: '追番' },
    { href: '/albums', label: '相册' },
  ];
  const secondaryItems = [
    { href: '/reading', label: '阅读中心', note: '继续阅读' },
    { href: '/music', label: '音乐', note: '正在听' },
    { href: '/memories', label: '回忆', note: '年度报告' },
    { href: '/search', label: '搜索', note: '⌘ K' },
    { href: '/admin/write', label: '写作', note: '新文章' },
    { href: '/admin', label: '后台', note: '管理' },
    { href: '/rss.xml', label: '订阅', note: 'RSS' },
  ];

  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));
  return (
    <>
      <nav
        className={`site-nav fixed inset-x-0 top-0 z-50 ${immersive ? 'has-hero' : 'on-surface'} ${condensed ? 'is-condensed' : ''}`}
        aria-label="主导航"
        data-adaptive-nav=""
        data-immersive={immersive ? 'true' : 'false'}
      >
        <div className="site-nav-inner">
          <a href="/" className="site-brand" aria-label="返回博客首页">
            <img
              src={brandAvatar}
              alt=""
              width="40"
              height="40"
              fetchPriority="high"
              decoding="async"
              data-fallback-src="/profile.webp"
            />
            <span>
              <strong>{settings.profile_name || settings.site_title || '个人博客'}</strong>
              <small>Notes & Stories</small>
            </span>
          </a>

          <div className="site-nav-links" aria-label="内容导航">
            {primaryItems.map((item) => (
              <a
                key={item.href}
                className={`site-nav-link ${isActive(item.href) ? 'is-active' : ''}`}
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
              >
                {item.label}
              </a>
            ))}
          </div>

          <div className="site-nav-actions">
            <button
              className="site-icon-button"
              id="command-trigger"
              type="button"
              aria-label="打开快速搜索"
              title="快速搜索（Ctrl/⌘ K）"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="11" cy="11" r="6.5"></circle>
                <path d="m16 16 4 4"></path>
              </svg>
            </button>
            <details className="theme-menu dropdown dropdown-end">
              <summary
                className="site-icon-button list-none"
                aria-label="切换颜色模式"
                title="切换颜色模式"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 3a9 9 0 1 0 9 9c0-1.2-.24-2.35-.67-3.39A6.5 6.5 0 0 1 12 3Z"></path>
                </svg>
              </summary>
              <div className="theme-panel dropdown-content">
                <p>外观</p>
                <button className="theme-option" data-theme-option="boke-green">
                  <span className="theme-dot bg-[#5e7c61]"></span>纸张绿<small>明亮</small>
                </button>
                <button className="theme-option" data-theme-option="boke-night">
                  <span className="theme-dot bg-[#7aa2d6]"></span>深海蓝<small>暗色</small>
                </button>
                <button className="theme-option" data-theme-option="boke-punk">
                  <span className="theme-dot bg-[#c86b9b]"></span>霓虹紫<small>高对比</small>
                </button>
              </div>
            </details>
            <details className="site-more-menu dropdown dropdown-end">
              <summary
                className="site-icon-button list-none"
                aria-label="打开更多导航"
                title="更多"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="5" cy="12" r="1"></circle>
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="19" cy="12" r="1"></circle>
                </svg>
              </summary>
              <div className="site-more-panel dropdown-content">
                <p>更多去处</p>
                {secondaryItems.map((item) => (
                  <a key={item.href} href={item.href}>
                    <span>{item.label}</span>
                    <small>{item.note}</small>
                  </a>
                ))}
                <button id="install-app" type="button" hidden>
                  <span>安装应用</span>
                  <small>离线使用</small>
                </button>
              </div>
            </details>
            <details className="mobile-nav dropdown dropdown-end">
              <summary className="site-icon-button list-none" aria-label="打开导航菜单">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16"></path>
                </svg>
              </summary>
              <div className="mobile-nav-panel dropdown-content">
                {[...primaryItems, ...secondaryItems].map((item) => (
                  <a
                    key={item.href}
                    className={isActive(item.href) ? 'is-active' : ''}
                    href={item.href}
                  >
                    {item.label}
                  </a>
                ))}
              </div>
            </details>
          </div>
        </div>
      </nav>

      <div className="command-backdrop" id="command-backdrop" hidden>
        <section className="command-dialog" role="dialog" aria-modal="true" aria-label="快速搜索">
          <header>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5"></circle>
              <path d="m16 16 4 4"></path>
            </svg>
            <input id="command-input" type="search" placeholder="搜索博客内容" autoComplete="off" />
            <kbd>ESC</kbd>
          </header>
          <div className="command-engines" role="listbox" aria-label="选择搜索引擎">
            {searchEngines.map((engine, index) => (
              <button
                type="button"
                role="option"
                key={engine.id}
                className={index === 0 ? 'is-selected' : ''}
                aria-selected={index === 0 ? 'true' : 'false'}
                data-command-engine={engine.id}
                data-command-name={engine.name}
                data-command-mark={engine.mark || engine.name.slice(0, 1)}
                data-command-url={engine.url}
              >
                <b>{engine.mark || engine.name.slice(0, 1)}</b>
                <span>{engine.name}</span>
              </button>
            ))}
          </div>
          <div id="command-results" className="command-results">
            <p>快速前往</p>
            {[...primaryItems, ...secondaryItems].map((item) => (
              <a
                key={item.href}
                href={item.href}
                data-command-item=""
                data-search={item.label.toLowerCase()}
              >
                <span>{item.label}</span>
                <small>↗</small>
              </a>
            ))}
          </div>
          <section className="command-memory" id="command-memory" aria-label="搜索记录">
            <div>
              <header>
                <span>常用搜索</span>
              </header>
              <div id="command-common-searches" className="command-memory-chips">
                <small>重复搜索后会出现在这里</small>
              </div>
            </div>
            <div>
              <header>
                <span>搜索记录</span>
                <button id="command-clear-history" type="button">
                  清除
                </button>
              </header>
              <div id="command-search-history" className="command-memory-chips">
                <small>还没有搜索记录</small>
              </div>
            </div>
          </section>
          <footer>
            <span>↑↓ 选择</span>
            <span>Enter 打开</span>
            <span>Esc 关闭</span>
          </footer>
        </section>
      </div>
    </>
  );
}
