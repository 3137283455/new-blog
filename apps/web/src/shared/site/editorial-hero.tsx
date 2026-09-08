'use client';

import { useEffect, useMemo } from 'react';

function normalizeImages(images: string[] | string | undefined) {
  const values = Array.isArray(images) ? images : typeof images === 'string' ? [images] : [];
  return values
    .flatMap((item) => String(item).split(/\r?\n|,/))
    .map((item) => item.trim())
    .filter(Boolean);
}

function titleSize(title: string) {
  const weight = Array.from(title).reduce((sum, character) => {
    if (/\s/.test(character)) return sum + 0.25;
    return sum + (/^[\x00-\x7f]$/.test(character) ? 0.55 : 1);
  }, 0);
  return weight > 12 ? 'is-very-long' : weight > 5 ? 'is-long' : 'is-short';
}

export function EditorialHero({
  title,
  subtitle = '',
  images,
  interval = 6,
}: {
  title: string;
  subtitle?: string;
  images?: string[] | string;
  interval?: number;
}) {
  const bannerImages = useMemo(() => {
    const normalized = normalizeImages(images);
    return normalized.length ? normalized : ['/home.webp'];
  }, [images]);
  const safeInterval = Math.max(3, Math.min(30, Number(interval) || 6));
  const dateLabel = new Intl.DateTimeFormat('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  }).format(new Date());

  useEffect(() => {
    if (bannerImages.length <= 1 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const slides = Array.from(
      document.querySelectorAll<HTMLImageElement>('[data-editorial-hero] .banner-slide'),
    );
    let index = 0;
    const timer = window.setInterval(() => {
      slides[index]?.classList.remove('is-active');
      index = (index + 1) % slides.length;
      slides[index]?.classList.add('is-active');
    }, safeInterval * 1000);
    return () => window.clearInterval(timer);
  }, [bannerImages, safeInterval]);

  return (
    <section className="editorial-hero" data-editorial-hero="">
      <div className="banner-slides" aria-hidden="true">
        {bannerImages.map((src, index) => (
          <img
            className={`banner-slide${index === 0 ? ' is-active' : ''}`}
            src={src}
            loading={index === 0 ? 'eager' : 'lazy'}
            fetchPriority={index === 0 ? 'high' : 'low'}
            decoding="async"
            alt=""
            data-fallback-src="/home.webp"
            key={`${src}-${index}`}
          />
        ))}
      </div>
      <div className="editorial-hero-shade" />
      <div className="editorial-hero-grain" />
      <div className="editorial-hero-content">
        <p className="editorial-eyebrow">
          <span />
          <time suppressHydrationWarning>{dateLabel}</time>
        </p>
        <h1 className={`editorial-hero-title ${titleSize(title)}`}>{title}</h1>
        {subtitle && <p className="editorial-deck">{subtitle}</p>}
        <div className="editorial-hero-actions">
          <a href="#latest">
            开始阅读 <span>↓</span>
          </a>
          <a href="/nav" className="is-quiet">
            打开导航 <span>↗</span>
          </a>
        </div>
      </div>
      <div className="editorial-hero-index" aria-hidden="true">
        <span>VOL.</span>
        <strong suppressHydrationWarning>
          {String(new Date().getMonth() + 1).padStart(2, '0')}
        </strong>
      </div>
    </section>
  );
}
