import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import type { Viewport } from 'next';
import { appearanceThemesCss, getSiteSettings } from '../shared/site/settings';
import { ToastProvider } from '../shared/ui/toast-provider';
import '../shared/ui/toast.css';

export const dynamic = 'force-dynamic';
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#f4f2ea' };
export const metadata: Metadata = {
  icons: { icon: '/logo.png', apple: '/logo.png' },
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const { settings, activeTheme, themes } = await getSiteSettings();
  const themeTypes = { 'boke-green': 'light', 'boke-night': 'dark', 'boke-punk': 'dark' } as const;
  const defaultTheme = activeTheme?.id && themeTypes[activeTheme.id] ? activeTheme.id : 'boke-green';
  const defaultThemeType = themeTypes[defaultTheme];
  const bootstrap = `try{var y={'boke-green':'light','boke-night':'dark','boke-punk':'dark'},a=location.pathname==='/admin'||location.pathname.indexOf('/admin/')===0,d=${JSON.stringify(defaultTheme)},s=localStorage.getItem('theme'),t=a?'boke-admin':(y[s]?s:d);document.documentElement.setAttribute('data-site-layout',a?'admin':'public');document.documentElement.setAttribute('data-theme',t);document.documentElement.setAttribute('data-theme-type',a?'light':y[t])}catch{}window.__PUBLIC_API_BASE__='/api';`;
  return (
    <html
      lang={settings.site_language || 'zh-CN'}
      data-theme={defaultTheme}
      data-theme-type={defaultThemeType}
      data-scroll-behavior="smooth"
      data-personal-season={activeTheme?.config?.season || 'custom'}
      suppressHydrationWarning
    >
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html: appearanceThemesCss(themes),
          }}
        />
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
      </head>
      <body
        className="flex min-h-screen flex-col bg-[var(--banner-wave-bg)] layout-full-bleed"
        data-site-start-date={settings.site_start_date || '2026-01-01'}
      >
        <div className="site-bg-grid" />
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
