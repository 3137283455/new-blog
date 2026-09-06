/** Cache the document and its same-origin rendering dependencies as one confirmed job. */
export async function cacheReading(href: string) {
  if (!('serviceWorker' in navigator)) throw new Error('当前浏览器不支持离线阅读');
  if (!href) throw new Error('缺少阅读地址');
  const target = new URL(href, location.origin);
  if (target.origin !== location.origin) throw new Error('仅支持本站阅读页面');
  const response = await fetch(target, { signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error('无法下载阅读页面');
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  const urls = new Set([target.pathname + target.search]);
  for (const element of doc.querySelectorAll('img[src],script[src],link[href],iframe[src]')) {
    if (
      element.tagName === 'LINK' &&
      !['stylesheet', 'preload', 'modulepreload'].includes(element.getAttribute('rel') || '')
    )
      continue;
    try {
      const url = new URL(
        element.getAttribute('src') || element.getAttribute('href') || '',
        target,
      );
      if (url.origin === location.origin) urls.add(url.pathname + url.search);
    } catch {
      /* Ignore malformed optional asset URLs. */
    }
  }
  // React Flight references route/layout chunks inside inline bootstrap records rather
  // than script[src]. Read only their static asset paths; never execute page scripts.
  for (const script of doc.querySelectorAll('script:not([src])')) {
    for (const match of (script.textContent || '').matchAll(/static\/chunks\/[^"\\\s<>]+\.js/g)) {
      urls.add('/_next/' + match[0].replace(/\[/g, '%5B').replace(/\]/g, '%5D'));
    }
  }
  if (urls.size > 800) throw new Error('章节资源过多，请分章保存');
  let timer: ReturnType<typeof setTimeout> | undefined;
  const registration = await Promise.race([
    navigator.serviceWorker.ready,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('离线服务尚未就绪')), 10000);
    }),
  ]).finally(() => clearTimeout(timer));
  const worker = registration.active;
  if (!worker) throw new Error('离线服务尚未就绪');
  await new Promise<void>((resolve, reject) => {
    const channel = new MessageChannel();
    const finish = (error?: Error) => {
      clearTimeout(timeout);
      channel.port1.close();
      channel.port2.close();
      if (error) reject(error);
      else resolve();
    };
    const timeout = setTimeout(() => finish(new Error('离线保存超时，请重试')), 120000);
    channel.port1.onmessage = ({ data }) => {
      if (data?.type !== 'CACHE_READING_DONE') return;
      finish(
        data.saved === urls.size && data.total === urls.size
          ? undefined
          : new Error('部分资源未保存，请联网重试'),
      );
    };
    channel.port1.onmessageerror = () => finish(new Error('离线服务响应无效'));
    try {
      worker.postMessage({ type: 'CACHE_READING', urls: [...urls] }, [channel.port2]);
    } catch {
      finish(new Error('无法启动离线保存'));
    }
  });
}
