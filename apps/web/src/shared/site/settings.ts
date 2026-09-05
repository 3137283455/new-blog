import { cache } from 'react';
import { getJson } from '../http/json';

export interface SiteSettings {
  site_title?: string;
  site_language?: string;
  site_author?: string;
  profile_name?: string;
  site_keywords?: string;
  site_description?: string;
  site_start_date?: string;
  allow_search_indexing?: boolean;
  enable_rss?: boolean;
  enable_json_feed?: boolean;
  banner_images?: string[] | string;
  profile_avatar?: string;
}

export interface ThemeConfig {
  primary?: string;
  primary_hover?: string;
  card_radius?: number;
  card_opacity?: number;
  content_width?: number;
  body_font?: string;
  title_font?: string;
  season?: string;
}

export const internalApiOrigin = () => process.env.API_BASE_INTERNAL || 'http://127.0.0.1:3001';

export const getSiteSettings = cache(async () => {
  const [settings, theme] = await Promise.all([
    getJson<SiteSettings>(
      `${internalApiOrigin()}/api/settings/public`,
      AbortSignal.timeout(10000),
    ).catch(() => ({}) as SiteSettings),
    getJson<{ config?: ThemeConfig } | null>(
      `${internalApiOrigin()}/api/themes/active`,
      AbortSignal.timeout(10000),
    ).catch(() => null),
  ]);
  return { settings, theme: theme?.config || {} };
});

export function themeCss(theme: ThemeConfig) {
  const primary = String(theme.primary || '#2f6f4e').replace(/[^#a-zA-Z0-9(),.%\s-]/g, '');
  const hover = String(theme.primary_hover || theme.primary || '#245a3e').replace(
    /[^#a-zA-Z0-9(),.%\s-]/g,
    '',
  );
  const font = (value: string) => value.replace(/[{};<>]/g, '');
  return `:root{--theme-primary:${primary};--brand:${primary};--theme-primary-hover:${hover};--theme-card-radius:${Number(theme.card_radius || 18)}px;--theme-card-opacity:${Number(theme.card_opacity || 0.86)};--theme-content-width:${Number(theme.content_width || 72)}rem;--theme-body-font:${font(theme.body_font || 'system-ui')};--theme-title-font:${font(theme.title_font || 'Georgia, serif')};}`;
}
