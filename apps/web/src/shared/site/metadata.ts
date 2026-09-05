import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { getSiteSettings } from './settings';

export async function pageMetadata(
  title: string,
  description: string,
  path: string,
): Promise<Metadata> {
  const { settings } = await getSiteSettings();
  const requestHeaders = await headers();
  const host = requestHeaders.get('host') || '127.0.0.1:3100';
  const protocol = requestHeaders.get('x-forwarded-proto') === 'https' ? 'https' : 'http';
  const origin = `${protocol}://${host}`;
  const siteTitle = settings.site_title || '个人博客';
  const images = Array.isArray(settings.banner_images)
    ? settings.banner_images
    : (settings.banner_images || '')
        .split(/\r?\n|,/)
        .map((item) => item.trim())
        .filter(Boolean);
  const image = new URL(images[0] || settings.profile_avatar || '/home.webp', origin).href;
  return {
    title: `${title} - ${siteTitle}`,
    description,
    authors: [{ name: settings.site_author || settings.profile_name || siteTitle }],
    keywords: settings.site_keywords || undefined,
    robots: settings.allow_search_indexing === false ? 'noindex, nofollow' : undefined,
    manifest: '/manifest.webmanifest',
    alternates: {
      canonical: new URL(path, origin).href,
      types: {
        ...(settings.enable_rss !== false
          ? { 'application/rss+xml': [{ url: '/rss.xml', title: `${siteTitle} RSS` }] }
          : {}),
        ...(settings.enable_json_feed !== false
          ? { 'application/feed+json': [{ url: '/feed.json', title: `${siteTitle} JSON Feed` }] }
          : {}),
      },
    },
    openGraph: {
      locale: 'zh_CN',
      type: 'website',
      siteName: siteTitle,
      title,
      description,
      url: new URL(path, origin).href,
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
