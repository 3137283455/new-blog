export interface BookSummary {
  id: number;
  title: string;
  slug: string;
  author?: string;
  description?: string;
  cover?: string;
  reading_status?: 'reading' | 'finished' | 'planned' | 'paused' | string;
  reading_mode?: 'chapters' | 'document' | 'external' | string;
  reading_url?: string;
  source_format?: string;
  volume_count?: number;
  chapter_count?: number;
  updated_at?: string;
  volumes?: BookVolume[];
}

export interface BookVolume {
  id: number;
  book_id: number;
  title: string;
  slug: string;
  description?: string;
  cover?: string;
  chapter_count?: number;
  chapters?: BookChapter[];
}

export interface BookChapter {
  id: number;
  volume_id: number;
  title: string;
  slug: string;
  volume_title?: string;
  volume_slug?: string;
  content_html?: string;
}

export interface BookDetail extends BookSummary {
  volumes: BookVolume[];
}

export interface BookChapterResponse {
  book: BookDetail;
  chapter: BookChapter;
  navigation: BookChapter[];
}

export interface BookProgress {
  id: number | string;
  slug?: string;
  title?: string;
  volume_slug?: string;
  volume_title?: string;
  chapter_slug?: string;
  chapter_title?: string;
  chapter_number?: number;
  chapter_count?: number;
  chapter_progress?: number;
  overall_progress?: number;
  volume_id?: number;
  chapter_id?: number;
  position?: number;
  revision?: number;
}
