const DEFAULT_CATEGORY = '导入书签';
const MAX_BOOKMARKS = 5000;

function decodeHtml(value = '') {
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
  return String(value).replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    const normalized = entity.toLowerCase();
    if (normalized.startsWith('#x')) return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    if (normalized.startsWith('#')) return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    return named[normalized] ?? match;
  });
}

function textContent(value = '') {
  return decodeHtml(String(value)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function hrefFromAnchor(anchor) {
  const match = String(anchor).match(/\bhref\s*=\s*(?:(["'])([\s\S]*?)\1|([^\s>]+))/i);
  return decodeHtml(match?.[2] || match?.[3] || '').trim();
}

function normalizeItem(item, category = DEFAULT_CATEGORY) {
  const url = String(item?.url || item?.uri || '').trim();
  if (!url) return null;
  const title = String(item?.title || item?.name || url).replace(/\s+/g, ' ').trim() || url;
  return {
    title,
    url,
    description: String(item?.description || item?.excerpt || '').replace(/\s+/g, ' ').trim(),
    category: String(category || DEFAULT_CATEGORY).replace(/\s+/g, ' ').trim() || DEFAULT_CATEGORY,
    icon: '◇',
  };
}

export function parseNetscapeBookmarks(source) {
  const items = [];
  const categoryStack = [];
  const dlStack = [];
  let pendingCategory = '';
  let lastItem = null;
  const tokens = String(source || '').match(/<h3\b[^>]*>[\s\S]*?<\/h3\s*>|<dl\b[^>]*>|<\/dl\s*>|<a\b[\s\S]*?<\/a\s*>|<dd\b[^>]*>[\s\S]*?(?=<dt\b|<dl\b|<\/dl\s*>|<h3\b|$)/gi) || [];

  tokens.forEach((token) => {
    if (/^<h3\b/i.test(token)) {
      pendingCategory = textContent(token);
      return;
    }
    if (/^<dl\b/i.test(token)) {
      const ownsCategory = Boolean(pendingCategory);
      dlStack.push(ownsCategory);
      if (ownsCategory) categoryStack.push(pendingCategory);
      pendingCategory = '';
      return;
    }
    if (/^<\/dl/i.test(token)) {
      if (dlStack.pop()) categoryStack.pop();
      pendingCategory = '';
      return;
    }
    if (/^<a\b/i.test(token)) {
      const href = hrefFromAnchor(token);
      const title = textContent(token.replace(/^<a\b[^>]*>/i, '').replace(/<\/a\s*>$/i, ''));
      const item = normalizeItem({ title, url: href }, categoryStack.at(-1));
      if (item) {
        items.push(item);
        lastItem = item;
      }
      return;
    }
    if (/^<dd\b/i.test(token) && lastItem) {
      lastItem.description = textContent(token.replace(/^<dd\b[^>]*>/i, ''));
    }
  });

  return items.slice(0, MAX_BOOKMARKS);
}

export function parseJsonBookmarks(source) {
  const data = typeof source === 'string' ? JSON.parse(source) : source;
  const items = [];
  const visited = new Set();

  const walk = (node, categories = []) => {
    if (!node || items.length >= MAX_BOOKMARKS) return;
    if (Array.isArray(node)) {
      node.forEach((child) => walk(child, categories));
      return;
    }
    if (typeof node !== 'object' || visited.has(node)) return;
    visited.add(node);

    const url = node.url || node.uri;
    if (url) {
      const item = normalizeItem(node, categories.at(-1));
      if (item) items.push(item);
      return;
    }

    const children = Array.isArray(node.children) ? node.children : null;
    if (children) {
      const folderName = String(node.name || node.title || '').trim();
      const nextCategories = folderName ? [...categories, folderName] : categories;
      children.forEach((child) => walk(child, nextCategories));
      return;
    }

    if (node.roots && typeof node.roots === 'object') {
      Object.values(node.roots).forEach((root) => walk(root, categories));
      return;
    }

    Object.values(node).forEach((child) => {
      if (child && typeof child === 'object') walk(child, categories);
    });
  };

  walk(data);
  return items.slice(0, MAX_BOOKMARKS);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function createNetscapeBookmarkFile(bookmarks, options = {}) {
  const title = String(options.title || 'Bookmarks').trim() || 'Bookmarks';
  const timestamp = Math.floor(Date.now() / 1000);
  const groups = new Map();
  (Array.isArray(bookmarks) ? bookmarks : []).forEach((bookmark) => {
    const item = normalizeItem(bookmark, bookmark?.category);
    if (!item) return;
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  });
  const folders = Array.from(groups.entries()).map(([category, items]) => [
    `    <DT><H3 ADD_DATE="${timestamp}" LAST_MODIFIED="${timestamp}">${escapeHtml(category)}</H3>`,
    '    <DL><p>',
    ...items.flatMap((item) => [
      `        <DT><A HREF="${escapeHtml(item.url)}" ADD_DATE="${timestamp}">${escapeHtml(item.title)}</A>`,
      ...(item.description ? [`        <DD>${escapeHtml(item.description)}`] : []),
    ]),
    '    </DL><p>',
  ].join('\n')).join('\n');
  return [
    '<!DOCTYPE NETSCAPE-Bookmark-file-1>',
    '<!-- This is an automatically generated file.',
    '     It can be imported by Chrome, Edge, Firefox and other browsers.',
    '     DO NOT EDIT! -->',
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    `<TITLE>${escapeHtml(title)}</TITLE>`,
    `<H1>${escapeHtml(title)}</H1>`,
    '<DL><p>',
    folders,
    '</DL><p>',
    '',
  ].join('\n');
}
export function parseBrowserBookmarks(source, fileName = '') {
  const content = String(source || '').replace(/^\uFEFF/, '').trim();
  if (!content) throw new Error('书签文件为空');
  const looksJson = /\.json$/i.test(fileName) || /^[{[]/.test(content);
  let items = [];
  if (looksJson) {
    try { items = parseJsonBookmarks(content); }
    catch { throw new Error('JSON 书签文件无法解析，请重新从浏览器导出'); }
  } else {
    items = parseNetscapeBookmarks(content);
  }
  if (!items.length) throw new Error('没有识别到书签，请使用浏览器导出的 HTML 或 JSON 文件');
  return items;
}