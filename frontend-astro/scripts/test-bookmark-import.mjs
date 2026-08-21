import assert from 'node:assert/strict';
import { createNetscapeBookmarkFile, parseBrowserBookmarks, parseJsonBookmarks, parseNetscapeBookmarks, validateBookmarkItems } from '../src/scripts/bookmark-import.js';

const chromeHtml = `<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
<DL><p>
  <DT><H3 ADD_DATE="1">书签栏</H3>
  <DL><p>
    <DT><A HREF="https://example.com/?a=1&amp;b=2" ADD_DATE="2">Example &amp; Docs</A>
    <DD>Search &amp; tools
    <DT><H3>开发</H3>
    <DL><p><DT><A HREF='https://developer.mozilla.org/'>MDN</A></DL><p>
  </DL><p>
</DL><p>`;
const htmlItems = parseNetscapeBookmarks(chromeHtml);
assert.equal(htmlItems.length, 2);
assert.deepEqual(htmlItems[0], {
  title: 'Example & Docs',
  url: 'https://example.com/?a=1&b=2',
  description: 'Search & tools',
  category: '书签栏',
  icon: '◇',
});
assert.equal(htmlItems[1].category, '开发');
assert.equal(htmlItems[1].title, 'MDN');

const chromeJson = JSON.stringify({
  roots: {
    bookmark_bar: { type: 'folder', name: '书签栏', children: [
      { type: 'url', name: 'OpenAI', url: 'https://openai.com/' },
    ] },
    other: { type: 'folder', name: '其他书签', children: [
      { type: 'url', name: 'Example', url: 'https://example.org/' },
    ] },
  },
});
const chromeItems = parseBrowserBookmarks(chromeJson, 'Bookmarks.json');
assert.equal(chromeItems.length, 2);
assert.equal(chromeItems[0].category, '书签栏');
assert.equal(chromeItems[1].category, '其他书签');

const firefoxItems = parseJsonBookmarks({
  title: '',
  children: [{ title: 'Bookmarks Menu', children: [
    { title: 'Mozilla', uri: 'https://www.mozilla.org/', description: 'Firefox home' },
  ] }],
});
assert.equal(firefoxItems.length, 1);
assert.equal(firefoxItems[0].title, 'Mozilla');
assert.equal(firefoxItems[0].category, 'Bookmarks Menu');
assert.equal(firefoxItems[0].description, 'Firefox home');

const validation = validateBookmarkItems([
  { title: 'Existing', url: 'https://existing.example/' },
  { title: 'Keep this one', url: 'https://new.example/' },
  { title: 'Duplicate in file', url: 'https://new.example/' },
  { title: 'Unsafe', url: 'javascript:alert(1)' },
  { title: 'Long title'.repeat(12), url: 'https://warning.example/', category: '分类'.repeat(25) },
], ['https://existing.example/']);
assert.equal(validation.length, 5);
assert.equal(validation[0].valid, false);
assert.match(validation[0].issues.join(','), /博客中已存在/);
assert.equal(validation[1].valid, true);
assert.equal(validation[1].selected, true);
assert.equal(validation[2].valid, false);
assert.match(validation[2].issues.join(','), /文件内重复/);
assert.equal(validation[3].valid, false);
assert.match(validation[3].issues.join(','), /不支持此链接协议/);
assert.equal(validation[4].valid, true);
assert.equal(validation[4].warnings.length, 2);
const exported = createNetscapeBookmarkFile([
  { title: 'A & B', url: 'https://example.com/?a=1&b=2', description: '说明', category: '工具' },
], { title: '博客导航书签' });
assert.match(exported, /^<!DOCTYPE NETSCAPE-Bookmark-file-1>/);
assert.match(exported, /<H3 ADD_DATE="\d+" LAST_MODIFIED="\d+">工具<\/H3>/);
assert.match(exported, /HREF="https:\/\/example\.com\/\?a=1&amp;b=2"/);
const roundTrip = parseNetscapeBookmarks(exported);
assert.equal(roundTrip.length, 1);
assert.equal(roundTrip[0].title, 'A & B');
assert.equal(roundTrip[0].category, '工具');
assert.equal(roundTrip[0].description, '说明');
assert.throws(() => parseBrowserBookmarks('', 'empty.html'), /书签文件为空/);
assert.throws(() => parseBrowserBookmarks('{bad json', 'bookmarks.json'), /JSON 书签文件无法解析/);
console.log('bookmark import parser: ok');