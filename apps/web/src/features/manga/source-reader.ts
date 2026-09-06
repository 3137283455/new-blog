import { getJson } from '../../shared/http/json';
import { internalApiOrigin } from '../../shared/site/settings';
import type { SourceKind } from './source-detail';
import { cache } from 'react';
export interface SourceReader {
  title?: string;
  chapter_id?: string;
  chapter_title?: string;
  pages?: string[];
  error?: string;
  content?: string;
  content_html?: string;
}
export interface SourceReaderData {
  source?: { label?: string };
  reader: SourceReader;
}
export const loadSourceReader = cache(
  async (kind: SourceKind, source: string, workId: string, chapter: string) => {
    return getJson<SourceReaderData>(
      `${internalApiOrigin()}/api/content-sources/${encodeURIComponent(kind)}/${encodeURIComponent(source)}/${encodeURIComponent(workId)}/chapter/${encodeURIComponent(chapter)}`,
      AbortSignal.timeout(45000),
    ).catch(() => null);
  },
);
