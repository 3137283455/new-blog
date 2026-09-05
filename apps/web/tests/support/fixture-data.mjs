export const sources = [
  { id: 'fixture:alpha', label: '测试漫画源 A', has_explore: true, has_reader: true },
  { id: 'fixture:beta', label: '测试漫画源 B', has_explore: false, has_reader: true },
];

export const shelf = [
  {
    id: 1,
    slug: 'local-fixture',
    title: '本地漫画样例',
    author: '测试作者',
    library_type: 'local',
    cover: '',
  },
  {
    id: 2,
    slug: 'network-fixture',
    title: '网络漫画样例',
    author: '',
    library_type: 'network',
    cover: '',
  },
];

export function results(query = '星海漫游') {
  return Array.from({ length: 7 }, (_, index) => ({
    source: 'fixture:alpha',
    external_id: `fixture/${index}`,
    source_label: '测试漫画源 A',
    title: `${query} ${index + 1}`,
    author: '测试作者',
    total: 12 + index,
    rating: 8.5,
    cover: index === 0 ? 'https://fixture.invalid/cover.svg' : '',
  }));
}

export function fixtureResponse(url) {
  const path = url.pathname;
  if (path === '/api/settings/public')
    return { site_title: 'My Blog', site_language: 'zh-CN', site_start_date: '2026-01-01' };
  if (path === '/api/themes/active') return { config: {} };
  if (path === '/api/music') return [];
  if (path === '/api/manga') return shelf;
  if (path === '/api/content-sources') return { sources };
  if (path === '/api/content-sources/search')
    return { items: results(url.searchParams.get('q') || ''), source: sources[0] };
  if (path === '/api/content-sources/explore') return { items: results(), source: sources[0] };
  if (path === '/api/visitors/count') return { today: 1, total: 1 };
  return [];
}

export const coverSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="#c9d9be"/><circle cx="120" cy="130" r="70" fill="#2f6f4e"/><path d="M0 360L120 210L240 360" fill="#172018"/></svg>';
