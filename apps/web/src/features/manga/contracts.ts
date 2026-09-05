// Compatibility DTOs at the legacy API boundary; not the future database model.
export interface MangaSource {
  id: string;
  label: string;
  has_explore?: boolean;
  has_reader?: boolean;
}

export interface MangaSearchItem {
  source: string;
  source_label?: string;
  external_id: string;
  title: string;
  cover?: string;
  author?: string;
  publication?: string;
  description?: string;
  total?: number;
  rating?: number;
}

export interface MangaShelfItem {
  id: number;
  slug: string;
  title: string;
  cover?: string;
  author?: string;
  library_type?: string;
}

export interface MangaResults {
  items: MangaSearchItem[];
  source?: MangaSource;
  aggregate?: boolean;
  sources?: Array<{ ok: boolean }>;
}

export type BrowseMode = 'home' | 'search' | 'latest';
