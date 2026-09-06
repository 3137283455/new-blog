'use client';
import { useEffect, useState } from 'react';
import { ensurePrivateDeviceToken } from '../../shared/device/private-device';
export interface LocalProgress {
  chapter_id: number;
  page_index: number;
  page_count?: number;
  volume_slug?: string;
  chapter_slug?: string;
}
export function useLocalProgress(id: number | string, enabled = true) {
  const [progress, setProgress] = useState<LocalProgress | null>(null);
  useEffect(() => {
    setProgress(null);
    if (!enabled) return;
    const controller = new AbortController();
    let disposed = false;
    void (async () => {
      const token = await ensurePrivateDeviceToken('/api');
      if (!token || disposed) return;
      try {
        const response = await fetch(`/api/private/manga/${encodeURIComponent(id)}/progress`, {
          headers: { 'X-Device-Token': token },
          signal: controller.signal,
        });
        const json = await response.json();
        if (response.ok && !disposed && json.data && Number.isFinite(Number(json.data.chapter_id)))
          setProgress(json.data);
      } catch {}
    })();
    return () => {
      disposed = true;
      controller.abort();
    };
  }, [id, enabled]);
  return progress;
}
