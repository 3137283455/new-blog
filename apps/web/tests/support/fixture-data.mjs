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

export const books = [
  {
    id: 31,
    slug: 'book-fixture',
    title: '星海漫游：书库样例',
    author: '测试作者',
    description: '用于验证书库筛选、列表视图和源探索的小说样例。',
    cover: '',
    reading_status: 'reading',
    reading_mode: 'chapters',
    volume_count: 2,
    chapter_count: 8,
    updated_at: '2026-01-02',
  },
  {
    id: 32,
    slug: 'external-book-fixture',
    title: '站外阅读样例',
    author: '外部作者',
    reading_status: 'planned',
    reading_mode: 'external',
    reading_url: 'https://fixture.invalid/book',
    volume_count: 0,
    chapter_count: 0,
    updated_at: '2026-01-01',
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
  if (path === '/api/books') return books;
  if (path === '/api/manga/local-fixture/volume-1/chapter-1')
    return {
      manga: shelf[0],
      chapter: {
        id: 11,
        slug: 'chapter-1',
        title: '初见',
        volume_id: 1,
        volume_slug: 'volume-1',
        volume_title: '第一卷',
        pages: [
          { image_url: '/uploads/fixture/one.svg' },
          { image_url: '/uploads/fixture/two.svg' },
          { image_url: '/uploads/fixture/three.svg' },
        ],
      },
      navigation: [
        {
          id: 11,
          slug: 'chapter-1',
          title: '初见',
          volume_id: 1,
          volume_slug: 'volume-1',
          volume_title: '第一卷',
          page_count: 3,
        },
        {
          id: 21,
          slug: 'chapter-2',
          title: '重逢',
          volume_id: 2,
          volume_slug: 'volume-2',
          volume_title: '第二卷',
          page_count: 3,
        },
      ],
    };
  if (path === '/api/manga/local-fixture')
    return {
      ...shelf[0],
      description: '本地漫画的简介。',
      chapter_count: 2,
      volume_count: 2,
      volumes: [
        {
          id: 1,
          slug: 'volume-1',
          title: '第一卷',
          chapter_count: 1,
          chapters: [{ id: 11, slug: 'chapter-1', title: '初见', page_count: 2 }],
        },
        {
          id: 2,
          slug: 'volume-2',
          title: '第二卷',
          chapter_count: 1,
          chapters: [{ id: 21, slug: 'chapter-2', title: '重逢', page_count: 3 }],
        },
      ],
    };
  if (path === '/api/manga/network-fixture')
    return {
      ...shelf[1],
      status: 'planned',
      read_sources: [
        { id: 1, name: '站点 A', url: 'https://fixture.invalid/read', is_default: true },
        { id: 2, name: '站点 B', url: 'https://fixture.invalid/backup' },
      ],
    };
  if (path === '/api/content-sources') return { sources };
  if (path === '/api/content-sources/search')
    return { items: results(url.searchParams.get('q') || ''), source: sources[0] };
  if (path === '/api/content-sources/explore') return { items: results(), source: sources[0] };
  if (
    [
      '/api/content-sources/manga/fixture:alpha/fixture/0',
      '/api/content-sources/manga/fixture:alpha/fixture-0',
    ].includes(decodeURIComponent(path))
  )
    return {
      source: sources[0],
      item: {
        ...results()[0],
        title: '星海漫游',
        original_title: 'Star Voyage',
        cover: '',
        description: '一段关于星空与远方的旅程。',
        source_url: 'https://fixture.invalid/comic',
      },
      can_read: true,
      chapters: [
        { external_id: 'ep-42', title: '第一章：启程', volume: '第一卷' },
        { external_id: 'ep-43', title: '第二章：远方', volume: '第一卷' },
      ],
    };
  if (
    path.startsWith('/api/content-sources/manga/fixture%3Aalpha/') &&
    path.includes('/chapter/')
  ) {
    const failed = path.endsWith('/failed');
    const sequence = path.endsWith('/sequence');
    return {
      source: sources[0],
      reader: {
        title: '阅读测试',
        chapter_id: failed ? 'failed' : sequence ? 'sequence' : 'ep-42',
        pages: failed
          ? []
          : sequence
            ? Array.from(
                { length: 10 },
                (_, index) =>
                  `https://fixture.invalid/page-${String(index + 1).padStart(2, '0')}.svg`,
              )
            : ['https://fixture.invalid/one.svg', 'https://fixture.invalid/two.svg'],
        error: failed ? '测试：本章暂时不可用' : '',
      },
    };
  }
  if (path === '/api/visitors/count') return { today: 1, total: 1 };
  return [];
}

export const coverSvg =
  '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="360"><rect width="240" height="360" fill="#c9d9be"/><circle cx="120" cy="130" r="70" fill="#2f6f4e"/><path d="M0 360L120 210L240 360" fill="#172018"/></svg>';
