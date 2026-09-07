import { writerUtils } from './markdown';
export function mount(scope) {
  // @ts-nocheck
  const API_BASE = document.body.dataset.apiBase || '/api';
  const tokenKey = 'boke_admin_token';
  let token = localStorage.getItem(tokenKey) || '';
  if (!token) {
    location.replace('/admin');
    return;
  }
  const params = new URLSearchParams(location.search);
  let articleId = params.get('id') || '';
  let articles = [];
  let trashedArticles = [];
  let currentFilter = 'all';
  let previewEnabled = false;
  let previewSplit = 52;
  let fontLibrary = [];
  let previewRequestId = 0;
  let isDirty = false;
  let autosaveTimer = null;
  let previewLocalTimer = null;
  let previewRemoteTimer = null;
  let previewController = null;
  let editorUpdateFrame = null;
  let articleListController = null;
  let currentArticleController = null;
  let searchTimer = null;
  let trashLoaded = false;
  const $ = (selector) => scope.query(selector);
  const $$ = (selector) => Array.from(scope.queryAll(selector));
  const mobileWriterQuery = window.matchMedia('(max-width: 760px)');
  function setMobilePanel(panel = 'editor', focusEditor = false) {
    document.body.classList.toggle('mobile-panel-articles', panel === 'articles');
    document.body.classList.toggle('mobile-panel-settings', panel === 'settings');
    $$('.writer-mobile-nav [data-mobile-panel]').forEach((button) => {
      const active = button.dataset.mobilePanel === panel;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-current', active ? 'page' : 'false');
    });
    if (focusEditor && panel === 'editor') scope.timeout(() => $('#content')?.focus(), 80);
  }
  function closeMobilePanels() {
    setMobilePanel('editor');
  }
  function setMessage(text) {
    $('#save-status').textContent = text || '未保存';
  }
  function autosaveKey(id = articleId) {
    return `boke_writer_autosave_${id || 'new'}`;
  }
  function collectLocalDraft() {
    return {
      articleId,
      title: $('#title')?.value || '',
      content: $('#content')?.value || '',
      excerpt: $('#excerpt')?.value || '',
      cover: $('#cover')?.value || '',
      status: $('#status')?.value || 'draft',
      visibility: $('#visibility')?.value || 'public',
      category: $('#category')?.value || '',
      tags: Array.from($('#tags').selectedOptions).map((option) => option.value),
      series: $('#series').value,
      seriesOrder: $('#series-order').value,
      musicTrack: $('#music-track').value,
      titleFont: $('#title-font-select')?.value || '',
      bodyFont: $('#body-font-select')?.value || '',
      isPinned: !!$('#is-pinned')?.checked,
      isRecommended: !!$('#is-recommended')?.checked,
      updatedAt: Date.now(),
    };
  }
  function applyLocalDraft(draft) {
    if (!draft) return;
    $('#title').value = draft.title || '';
    $('#content').value = draft.content || '';
    $('#excerpt').value = draft.excerpt || '';
    $('#cover').value = draft.cover || '';
    $('#status').value = draft.status || 'draft';
    $('#quick-status').value = draft.status || 'draft';
    $('#visibility').value = draft.visibility || 'public';
    $('#category').value = draft.category || '';
    if (Array.isArray(draft.tags)) {
      const selected = new Set(draft.tags.map(String));
      Array.from($('#tags').options).forEach((option) => {
        option.selected = selected.has(option.value);
      });
    }
    if ('series' in draft) $('#series').value = draft.series || '';
    if ('seriesOrder' in draft) $('#series-order').value = draft.seriesOrder || 0;
    if ('musicTrack' in draft) $('#music-track').value = draft.musicTrack || '';
    $('#title-font-select').value = draft.titleFont || '';
    $('#body-font-select').value = draft.bodyFont || '';
    $('#is-pinned').checked = !!draft.isPinned;
    $('#is-recommended').checked = !!draft.isRecommended;
    updateWordCount();
    applyArticleFonts();
  }
  function markDirty() {
    isDirty = true;
    window.clearTimeout(autosaveTimer);
    autosaveTimer = scope.timeout(() => {
      if (!isDirty) return;
      const draft = collectLocalDraft();
      try {
        localStorage.setItem(autosaveKey(), JSON.stringify(draft));
      } catch {
        setMessage('本地自动保存失败，请手动保存文章');
        return;
      }
      setMessage(
        `已本地自动保存 ${new Date(draft.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
      );
    }, 5000);
  }
  function clearLocalDraft(id = articleId) {
    localStorage.removeItem(autosaveKey(id));
  }
  function restoreLocalDraftIfNeeded() {
    const raw = localStorage.getItem(autosaveKey());
    if (!raw) return;
    try {
      const draft = JSON.parse(raw);
      if (!draft?.updatedAt) return;
      const label = new Date(draft.updatedAt).toLocaleString('zh-CN');
      if (confirm(`检测到 ${label} 的本地临时稿，是否恢复？`)) {
        applyLocalDraft(draft);
        isDirty = true;
        setMessage('已恢复本地临时稿');
      }
    } catch {
      if (scope.disposed) return;
      clearLocalDraft();
    }
  }
  function html(value) {
    return writerUtils.html(value);
  }
  function cssString(value = '') {
    return writerUtils.cssString(value);
  }
  function cssUrl(value = '') {
    return writerUtils.cssUrl(value);
  }
  function fontStyleBlock() {
    return writerUtils.fontStyleBlock(fontLibrary);
  }
  function ensureWriterFontStyle() {
    let style = document.getElementById('writer-font-library-style');
    if (!style) {
      style = document.createElement('style');
      style.id = 'writer-font-library-style';
      document.head.appendChild(style);
    }
    style.textContent = fontStyleBlock();
  }
  function fontFamilyCss(font) {
    return writerUtils.fontFamilyCss(font);
  }
  function applyArticleFonts() {
    const titleFont = parseFontSelection($('#title-font-select')?.value || '');
    const bodyFont = parseFontSelection($('#body-font-select')?.value || '');
    const titleFamily = fontFamilyCss(titleFont);
    const bodyFamily = fontFamilyCss(bodyFont);
    $('#title').style.fontFamily = titleFamily || '';
    $('#content').style.fontFamily = bodyFamily || '';
    if (previewEnabled) updatePreview();
  }
  function parseSetting(row) {
    return writerUtils.parseSetting(row);
  }
  function fontKey(font) {
    return writerUtils.fontKey(font);
  }
  function parseFontSelection(value) {
    return writerUtils.parseFontSelection(value);
  }
  function renderFontSelectors() {
    const options = ['<option value="">默认字体</option>']
      .concat(
        fontLibrary.map((font) => {
          const family = font.family || font.name || '';
          const url = font.url || '';
          if (!family || !url) return '';
          return `<option value="${html(fontKey({ family, url }))}">${html(family)}</option>`;
        }),
      )
      .filter(Boolean)
      .join('');
    $('#title-font-select').innerHTML = options;
    $('#body-font-select').innerHTML = options;
    $('#inline-font-select').innerHTML =
      '<option value="">字体</option><option value="__clear">取消字体</option>' +
      options.replace('<option value="">默认字体</option>', '');
    ensureWriterFontStyle();
  }
  async function loadFontLibrary() {
    try {
      const json = await request('/admin/settings');
      const rows = json.data || [];
      const settings = Object.fromEntries(rows.map((item) => [item.key, parseSetting(item)]));
      fontLibrary = Array.isArray(settings.font_library) ? settings.font_library : [];
    } catch {
      if (scope.disposed) return;
      fontLibrary = [];
    }
    renderFontSelectors();
  }
  function renderInlineMarkdown(value) {
    return writerUtils.renderInlineMarkdown(value);
  }
  function markdownToHtml(markdown) {
    return writerUtils.markdownToHtml(markdown);
  }
  function renderPreviewSnapshot(snapshot, contentHtml) {
    $('#preview-panel').innerHTML = writerUtils.buildPreviewHtml({
      title: snapshot.title,
      contentHtml,
      fontCss: snapshot.fontCss,
      titleFont: snapshot.titleFont,
      bodyFont: snapshot.bodyFont,
    });
  }
  function updatePreview({ immediate = false } = {}) {
    if (!previewEnabled) return;
    const requestId = ++previewRequestId;
    const snapshot = {
      title: $('#title').value.trim(),
      content: $('#content').value,
      fontCss: fontStyleBlock(),
      titleFont: parseFontSelection($('#title-font-select')?.value || ''),
      bodyFont: parseFontSelection($('#body-font-select')?.value || ''),
    };
    window.clearTimeout(previewLocalTimer);
    window.clearTimeout(previewRemoteTimer);
    previewController?.abort();
    const renderLocal = () => {
      if (requestId !== previewRequestId) return;
      renderPreviewSnapshot(snapshot, markdownToHtml(snapshot.content));
    };
    if (immediate) renderLocal();
    else previewLocalTimer = scope.timeout(renderLocal, 100);
    previewRemoteTimer = scope.timeout(
      async () => {
        const controller = new AbortController();
        previewController = controller;
        try {
          const json = await request('/admin/markdown/preview', {
            method: 'POST',
            body: JSON.stringify({ content: snapshot.content }),
            signal: controller.signal,
          });
          if (requestId !== previewRequestId) return;
          renderPreviewSnapshot(snapshot, json.data?.html || '');
        } catch (error) {
          if (scope.disposed) return;
          if (error?.name !== 'AbortError') console.warn('远程预览暂不可用，已保留本地预览', error);
        } finally {
          if (previewController === controller) previewController = null;
        }
      },
      immediate ? 0 : 550,
    );
  }
  async function request(path, options = {}) {
    if (!token) {
      setMessage('请先回后台登录');
      throw new Error('请先登录后台');
    }
    const headers = {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    };
    if (!(options.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    let res;
    try {
      res = await scope.fetch(`${API_BASE}${path}`, { ...options, headers });
    } catch (error) {
      if (scope.disposed) return;
      if (error?.name === 'AbortError') throw error;
      throw new Error(`无法连接后端 API（${API_BASE}），请确认 Express 服务已启动且代理配置正常`);
    }
    const json = await res.json().catch(() => ({}));
    if (res.status === 401) {
      localStorage.removeItem(tokenKey);
      token = '';
      location.replace('/admin');
      throw new Error('登录已失效，请重新登录');
    }
    if (!res.ok || json.success === false)
      throw new Error(json.message || `请求失败（HTTP ${res.status}）`);
    return json;
  }
  async function publicRequest(path) {
    try {
      const res = await scope.fetch(`${API_BASE}${path}`);
      if (!res.ok) return { data: [] };
      return res.json();
    } catch {
      if (scope.disposed) return;
      return { data: [] };
    }
  }
  async function uploadFile(file, message = '上传中...') {
    if (!file) return null;
    setMessage(message);
    const form = new FormData();
    form.append('file', file);
    const json = await request('/admin/media/upload', { method: 'POST', body: form });
    return json.data;
  }
  function collectPayload(statusOverride) {
    const titleFont = parseFontSelection($('#title-font-select').value);
    const bodyFont = parseFontSelection($('#body-font-select').value);
    return {
      title: $('#title').value.trim(),
      content: $('#content').value.trim(),
      excerpt: $('#excerpt').value.trim(),
      cover_image: $('#cover').value.trim(),
      title_font_family: titleFont.family,
      title_font_url: titleFont.url,
      body_font_family: bodyFont.family,
      body_font_url: bodyFont.url,
      status: statusOverride || $('#status').value,
      visibility: $('#visibility').value,
      category_id: $('#category').value ? Number($('#category').value) : null,
      tag_ids: Array.from($('#tags').selectedOptions).map((option) => Number(option.value)),
      is_pinned: $('#is-pinned').checked,
      is_recommended: $('#is-recommended').checked,
      series_id: Number($('#series').value) || null,
      series_order: Number($('#series-order').value || 0),
      music_track_id: Number($('#music-track').value) || null,
    };
  }
  function fillArticle(post) {
    window.clearTimeout(autosaveTimer);
    articleId = post?.id ? String(post.id) : '';
    $('#writer-mode').textContent = articleId ? '编辑文章' : '新文章';
    $('#title').value = post?.title || '';
    $('#content').value = post?.content || '';
    $('#excerpt').value = post?.excerpt || '';
    $('#cover').value = post?.cover_image || '';
    $('#status').value = post?.status || 'draft';
    $('#quick-status').value = post?.status || 'draft';
    $('#visibility').value = post?.visibility || 'public';
    $('#category').value = post?.category_id || '';
    $('#title-font-select').value = fontKey({
      family: post?.title_font_family,
      url: post?.title_font_url,
    });
    $('#body-font-select').value = fontKey({
      family: post?.body_font_family,
      url: post?.body_font_url,
    });
    $('#is-pinned').checked = !!post?.is_pinned;
    $('#is-recommended').checked = !!post?.is_recommended;
    $('#series').value = post?.series_id || '';
    $('#series-order').value = post?.series_order || 0;
    $('#music-track').value = post?.music_track_id || '';
    const tagIds = new Set((post?.tags || []).map((tag) => String(tag.id)));
    Array.from($('#tags').options).forEach((option) => {
      option.selected = tagIds.has(option.value);
    });
    updateWordCount();
    applyArticleFonts();
    isDirty = false;
    renderArticleList();
  }
  async function saveArticle(statusOverride) {
    const payload = collectPayload(statusOverride);
    if (!payload.title) {
      setMessage('请先填写标题');
      return;
    }
    if (!payload.content) {
      setMessage('请先填写正文');
      return;
    }
    setMessage('正在保存...');
    try {
      const json = await request(articleId ? `/admin/articles/${articleId}` : '/admin/articles', {
        method: articleId ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      const oldArticleId = articleId;
      if (!articleId && json.data?.id) articleId = String(json.data.id);
      clearLocalDraft(oldArticleId);
      clearLocalDraft(articleId);
      isDirty = false;
      window.clearTimeout(autosaveTimer);
      setMessage(payload.status === 'published' ? '已发布' : '已保存草稿');
      await loadArticles();
    } catch (error) {
      if (scope.disposed) return;
      setMessage(error.message || '保存失败');
    }
  }
  function insertText(before, text, after = '') {
    const textarea = $('#content');
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || start;
    const selected = textarea.value.slice(start, end) || text;
    textarea.setRangeText(`${before}${selected}${after}`, start, end, 'end');
    textarea.focus();
    updateWordCount();
    updatePreview();
  }
  function unwrapInlineFont(value) {
    return writerUtils.unwrapInlineFont(value);
  }
  function inlineFontRangeAt(value, start, end) {
    return writerUtils.inlineFontRangeAt(value, start, end);
  }
  function clearInlineFont() {
    const textarea = $('#content');
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || start;
    const value = textarea.value;
    const selected = value.slice(start, end);
    const enclosing = inlineFontRangeAt(value, start, end);
    if (selected) {
      const cleaned = unwrapInlineFont(selected);
      textarea.setRangeText(cleaned, start, end, 'select');
      setMessage(cleaned === selected ? '选中内容没有局部字体标签' : '已移除选中内容的局部字体');
    } else if (enclosing) {
      textarea.setRangeText(
        unwrapInlineFont(value.slice(enclosing.start, enclosing.end)),
        enclosing.start,
        enclosing.end,
        'select',
      );
      setMessage('已移除局部字体');
    } else {
      setMessage('请选中内容，或把光标放在已有局部字体文字中');
      textarea.focus();
      return;
    }
    textarea.focus();
    updateWordCount();
    updatePreview();
  }
  function applyInlineFont() {
    const select = $('#inline-font-select');
    if (select.value === '__clear') {
      clearInlineFont();
      select.value = '';
      return;
    }
    const font = parseFontSelection(select.value);
    const textarea = $('#content');
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || start;
    const selected = textarea.value.slice(start, end);
    if (!selected) {
      setMessage('请先选中要更换字体的文字');
      select.value = '';
      textarea.focus();
      return;
    }
    const cleanSelected = unwrapInlineFont(selected);
    if (!font.family) {
      textarea.setRangeText(cleanSelected, start, end, 'select');
      setMessage('已移除选中文字的局部字体');
    } else {
      textarea.setRangeText(
        `<span data-font="${html(font.family)}" data-font-url="${html(font.url)}">${cleanSelected}</span>`,
        start,
        end,
        'select',
      );
      setMessage(`已应用局部字体：${font.family}`);
      if (!previewEnabled) setPreviewState(true);
    }
    select.value = '';
    textarea.focus();
    updateWordCount();
    updatePreview();
  }
  function insertMarkdown(kind) {
    const headingLevel = Math.max(1, Math.min(6, Number($('#heading-level')?.value || 2)));
    const snippets = {
      heading: [`\n${'#'.repeat(headingLevel)} `, `H${headingLevel} 标题`, '\n'],
      bold: ['**', '重点文字', '**'],
      italic: ['*', '斜体文字', '*'],
      strike: ['~~', '删除线文字', '~~'],
      hr: ['\n\n', '---', '\n\n'],
      task: ['\n- [ ] ', '待办事项', '\n'],
      ordered: ['\n1. ', '第一项', '\n2. 第二项\n'],
      unordered: ['\n- ', '列表项', '\n- 另一项\n'],
      quote: ['\n> ', '引用内容', '\n'],
      code: ['\n```js\n', 'console.log("Hello")', '\n```\n'],
      inlineCode: ['`', 'code', '`'],
      link: ['[', '链接文字', '](https://example.com)'],
      table: ['\n| 列一 | 列二 |\n| --- | --- |\n| ', '内容', ' | 内容 |\n'],
      math: ['\n$$\n', 'E = mc^2', '\n$$\n'],
      footnote: ['', '需要说明的文字[^1]\n\n[^1]: 脚注内容', ''],
    };
    const item = snippets[kind];
    if (!item) return;
    insertText(item[0], item[1], item[2]);
  }
  function importTextFile(file) {
    if (!file) return;
    const allowed = /\.(txt|md|markdown)$/i.test(file.name) || /^text\//i.test(file.type || '');
    if (!allowed) {
      setMessage('只支持 txt、md、markdown 文本文件');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '').replace(/^\uFEFF/, '');
      const titleFromFile = file.name.replace(/\.(txt|md|markdown)$/i, '');
      if (!$('#title').value.trim()) $('#title').value = titleFromFile;
      $('#content').value = $('#content').value.trim()
        ? `${$('#content').value.trimEnd()}\n\n${text}`
        : text;
      updateWordCount();
      updatePreview();
      setMessage(`已导入：${file.name}`);
    };
    reader.onerror = () => setMessage('文本读取失败');
    reader.readAsText(file, 'utf-8');
  }
  async function importEpubFile(file) {
    if (!file) return;
    if (!/\.epub$/i.test(file.name)) {
      setMessage('只支持 .epub 文件');
      return;
    }
    if (isDirty && ($('#title').value.trim() || $('#content').value.trim())) {
      const confirmed = confirm('导入 EPUB 会替换当前写作台里的标题、正文、摘要和封面。是否继续？');
      if (!confirmed) return;
    }
    const form = new FormData();
    form.append('file', file);
    setMessage('正在解析 EPUB，请稍候…');
    try {
      const json = await request('/admin/articles/epub/import', { method: 'POST', body: form });
      const book = json.data || {};
      articleId = '';
      history.pushState(null, '', '/admin/write');
      $('#writer-mode').textContent = 'EPUB 小说草稿';
      $('#title').value = book.title || file.name.replace(/\.epub$/i, '');
      $('#content').value = book.content || '';
      $('#excerpt').value = book.excerpt || '';
      $('#cover').value = book.cover_image || '';
      $('#status').value = 'draft';
      $('#quick-status').value = 'draft';
      updateWordCount();
      updatePreview(true);
      if (!previewEnabled) setPreviewState(true);
      markDirty();
      setMessage(`${json.message || 'EPUB 已导入'}，请检查并选择专题/卷序后保存`);
    } catch (error) {
      if (scope.disposed) return;
      setMessage(error.message || 'EPUB 导入失败');
    }
  }
  function updateWordCount() {
    const text = `${$('#title').value}\n${$('#content').value}`;
    $('#word-count').textContent = `本章字数：${text.replace(/\s/g, '').length}`;
  }
  function getVisibleArticles() {
    const keyword = $('#article-search').value.trim().toLowerCase();
    const pool = currentFilter === 'trash' ? trashedArticles : articles;
    return pool.filter((post) => {
      const matchFilter =
        currentFilter === 'all' ||
        currentFilter === 'trash' ||
        (currentFilter === 'draft' && post.status !== 'published') ||
        (currentFilter === 'published' && post.status === 'published');
      const matchKeyword =
        !keyword ||
        `${post.title} ${post.slug} ${post.excerpt || ''}`.toLowerCase().includes(keyword);
      return matchFilter && matchKeyword;
    });
  }
  function renderTabs() {
    const counts = {
      all: articles.length,
      draft: articles.filter((post) => post.status !== 'published').length,
      published: articles.filter((post) => post.status === 'published').length,
      trash: trashLoaded ? trashedArticles.length : '…',
    };
    const labels = { all: '全部', draft: '草稿箱', published: '已发布', trash: '回收站' };
    $$('#article-tabs .writer-tab').forEach((button) => {
      const filter = button.dataset.filter;
      button.classList.toggle('active', filter === currentFilter);
      button.textContent = `${labels[filter]} ${counts[filter]}`;
    });
  }
  function renderArticleList() {
    renderTabs();
    const visible = getVisibleArticles();
    const emptyText =
      {
        all: '还没有文章，点上方“新建文章”开始写。',
        draft: '草稿箱里暂时没有文章。',
        published: '还没有已发布文章。',
        trash: '回收站为空。',
      }[currentFilter] || '这里暂时没有文章';
    $('#article-list').innerHTML = visible.length
      ? visible.map(renderArticleItem).join('')
      : `<div class="writer-empty">${html(emptyText)}</div>`;
  }
  function renderArticleItem(post) {
    const isTrash = !!post.deleted_at || currentFilter === 'trash';
    const status = isTrash ? '回收站' : post.status === 'published' ? '已发布' : '草稿';
    const statusKey = isTrash ? 'trash' : post.status === 'published' ? 'published' : 'draft';
    const date = isTrash
      ? `删除于 ${post.deleted_at || post.updated_at || post.created_at || ''}`
      : post.updated_at || post.created_at || '';
    return `
          <article class="writer-post ${String(post.id) === String(articleId) ? 'active' : ''}" data-id="${post.id}" data-status="${statusKey}">
            <div class="writer-post-main">
              <div class="writer-post-title">${html(post.title || '未命名文章')}</div>
              <div class="writer-post-meta">
                <span class="writer-pill ${statusKey}">${html(status)}</span>
                <span class="writer-post-time">${html(date)}</span>
              </div>
            </div>
            <div class="writer-post-actions writer-post-menu">
              ${
                isTrash
                  ? `<button class="writer-mini" type="button" data-action="restore" data-id="${post.id}">恢复</button>
                   <button class="writer-mini danger" type="button" data-action="force-delete" data-id="${post.id}">永久删除</button>`
                  : `<button class="writer-mini" type="button" data-action="edit" data-id="${post.id}">编辑</button>
                   <button class="writer-mini danger" type="button" data-action="delete" data-id="${post.id}">删除</button>`
              }
            </div>
          </article>
        `;
  }
  async function loadArticles({ includeTrash = trashLoaded } = {}) {
    articleListController?.abort();
    const controller = new AbortController();
    articleListController = controller;
    try {
      const requests = [
        request('/admin/articles?summary=true&pageSize=100', { signal: controller.signal }),
      ];
      if (includeTrash) {
        requests.push(
          request('/admin/articles?summary=true&trashed=true&pageSize=100', {
            signal: controller.signal,
          }),
        );
      }
      const [normalJson, trashJson] = await Promise.all(requests);
      articles = normalJson.data || [];
      if (trashJson) {
        trashedArticles = trashJson.data || [];
        trashLoaded = true;
      }
      renderArticleList();
    } finally {
      if (articleListController === controller) articleListController = null;
    }
  }
  async function loadTaxonomy() {
    const [categoryJson, tagJson, seriesJson, musicJson] = await Promise.all([
      publicRequest('/categories'),
      publicRequest('/tags'),
      publicRequest('/series'),
      publicRequest('/music'),
    ]);
    $('#category').innerHTML =
      '<option value="">无分类</option>' +
      (categoryJson.data || [])
        .map((item) => `<option value="${item.id}">${html(item.name)}</option>`)
        .join('');
    $('#tags').innerHTML = (tagJson.data || [])
      .map((item) => `<option value="${item.id}">${html(item.name)}</option>`)
      .join('');
    $('#series').innerHTML =
      '<option value="">不加入专题</option>' +
      (seriesJson.data || [])
        .map((item) => `<option value="${item.id}">${html(item.title)}</option>`)
        .join('');
    $('#music-track').innerHTML =
      '<option value="">不绑定音乐</option>' +
      (musicJson.data || [])
        .map(
          (item) =>
            `<option value="${item.id}">${html(item.title)} · ${html(item.artist || '未知歌手')}</option>`,
        )
        .join('');
  }
  async function loadCurrentArticle() {
    if (!articleId) {
      currentArticleController?.abort();
      fillArticle(null);
      return;
    }
    currentArticleController?.abort();
    const controller = new AbortController();
    currentArticleController = controller;
    const requestedId = String(articleId);
    try {
      setMessage('正在载入文章...');
      const json = await request(`/admin/articles/${requestedId}`, { signal: controller.signal });
      if (requestedId !== String(articleId)) return;
      fillArticle(json.data);
      setMessage('已载入文章');
    } finally {
      if (currentArticleController === controller) currentArticleController = null;
    }
  }
  async function deleteArticle(id) {
    if (!confirm('确定把这篇文章移入回收站吗？')) return;
    await request(`/admin/articles/${id}`, { method: 'DELETE' });
    if (String(id) === String(articleId)) {
      history.pushState(null, '', '/admin/write');
      fillArticle(null);
    }
    setMessage('已移入回收站');
    await loadArticles();
  }
  async function restoreArticle(id) {
    await request(`/admin/articles/${id}/restore`, { method: 'PUT' });
    setMessage('已恢复文章');
    await loadArticles();
  }
  async function forceDeleteArticle(id) {
    if (!confirm('确定永久删除吗？这个操作不能撤销。')) return;
    await request(`/admin/articles/${id}/force`, { method: 'DELETE' });
    if (String(id) === String(articleId)) {
      history.pushState(null, '', '/admin/write');
      fillArticle(null);
    }
    setMessage('已永久删除');
    await loadArticles();
  }
  function setPreviewState(enabled) {
    previewEnabled = enabled;
    document.body.classList.toggle('preview-on', previewEnabled);
    $('#toggle-preview')?.classList.toggle('active', previewEnabled);
    if (previewEnabled) {
      setPreviewSplit(previewSplit);
      updatePreview({ immediate: true });
    }
  }
  function setPreviewSplit(value) {
    previewSplit = Math.max(28, Math.min(72, Number(value) || 52));
    document.documentElement.style.setProperty('--preview-split', `${previewSplit}%`);
  }
  function startPreviewResize(event) {
    if (!previewEnabled) return;
    event.preventDefault();
    const wrap = event.currentTarget.closest('.writer-paper-wrap');
    const rect = wrap.getBoundingClientRect();
    document.body.classList.add('resizing-preview');
    const onMove = (moveEvent) => {
      const raw = ((moveEvent.clientX - rect.left) / rect.width) * 100;
      setPreviewSplit(document.body.classList.contains('preview-left') ? 100 - raw : raw);
    };
    const onUp = () => {
      document.body.classList.remove('resizing-preview');
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    scope.listen(window, 'mousemove', onMove);
    scope.listen(window, 'mouseup', onUp);
  }
  function enterImmersive() {
    setPreviewState(true);
    document.body.classList.add('immersive');
    setMessage('沉浸模式，按 Esc 退出');
  }
  function exitImmersive() {
    document.body.classList.remove('immersive');
    setMessage('已退出沉浸模式');
  }
  function scheduleEditorUpdate() {
    markDirty();
    if (editorUpdateFrame) return;
    editorUpdateFrame = scope.frame(() => {
      editorUpdateFrame = null;
      updateWordCount();
      if (previewEnabled) updatePreview();
    });
  }
  function scheduleArticleSearch() {
    window.clearTimeout(searchTimer);
    searchTimer = scope.timeout(renderArticleList, 120);
  }
  scope.listen($('#quick-status'), 'change', (event) => {
    $('#status').value = event.target.value;
  });
  scope.listen($('#status'), 'change', (event) => {
    $('#quick-status').value = event.target.value;
  });
  scope.listen($('#toggle-left'), 'click', () => {
    document.body.classList.toggle('left-collapsed');
  });
  scope.listen($('#toggle-right'), 'click', () => {
    document.body.classList.toggle('right-collapsed');
  });
  $$('.writer-mobile-nav [data-mobile-panel]').forEach((button) => {
    scope.listen(button, 'click', () => setMobilePanel(button.dataset.mobilePanel || 'editor'));
  });
  $$('[data-mobile-close]').forEach((button) => scope.listen(button, 'click', closeMobilePanels));
  scope.listen(mobileWriterQuery, 'change', (event) => {
    if (!event.matches) closeMobilePanels();
  });
  scope.listen($('#toggle-preview'), 'click', () => {
    setPreviewState(!previewEnabled);
  });
  scope.listen($('#swap-preview'), 'click', () => {
    document.body.classList.toggle('preview-left');
    if (!previewEnabled) setPreviewState(true);
  });
  scope.listen($('#preview-resizer'), 'mousedown', startPreviewResize);
  scope.listen($('#immersive-mode'), 'click', enterImmersive);
  scope.listen(document, 'keydown', (event) => {
    if (event.key === 'Escape' && document.body.classList.contains('immersive')) {
      exitImmersive();
    }
  });
  scope.listen($('#save-draft'), 'click', () => saveArticle('draft'));
  scope.listen($('#publish-article'), 'click', () => saveArticle('published'));
  scope.listen($('#import-text-button'), 'click', () => $('#text-file-input').click());
  scope.listen($('#import-epub-button'), 'click', () => $('#epub-file-input').click());
  scope.listen($('#insert-image-button'), 'click', () => $('#article-image-input').click());
  scope.listen($('#cover-upload-button'), 'click', () => $('#cover-file-input').click());
  scope.listen($('#inline-font-select'), 'change', applyInlineFont);
  scope.listen($('#title-font-select'), 'change', applyArticleFonts);
  scope.listen($('#body-font-select'), 'change', applyArticleFonts);
  scope.listen($('#text-file-input'), 'change', (event) => {
    importTextFile(event.target.files?.[0]);
    event.target.value = '';
  });
  scope.listen($('#epub-file-input'), 'change', async (event) => {
    await importEpubFile(event.target.files?.[0]);
    event.target.value = '';
  });
  scope.listen($('#article-image-input'), 'change', async (event) => {
    try {
      const file = event.target.files?.[0];
      const media = await uploadFile(file, '正在上传插图...');
      if (media?.url) {
        insertText('\n![', file.name.replace(/\.[^.]+$/, '') || '图片', `](${media.url})\n`);
        setMessage('插图已插入');
      }
    } catch (error) {
      if (scope.disposed) return;
      setMessage(error.message || '插图上传失败');
    }
    event.target.value = '';
  });
  scope.listen($('#cover-file-input'), 'change', async (event) => {
    try {
      const media = await uploadFile(event.target.files?.[0], '正在上传封面...');
      if (media?.url) $('#cover').value = media.url;
      setMessage('封面已上传');
    } catch (error) {
      if (scope.disposed) return;
      setMessage(error.message || '封面上传失败');
    }
    event.target.value = '';
  });
  scope.listen($('#new-draft'), 'click', () => {
    history.pushState(null, '', '/admin/write');
    fillArticle(null);
    if (mobileWriterQuery.matches) setMobilePanel('editor', true);
    setMessage('新文章');
  });
  scope.listen($('#article-search'), 'input', scheduleArticleSearch);
  scope.listen($('#content'), 'input', scheduleEditorUpdate);
  scope.listen($('#title'), 'input', scheduleEditorUpdate);
  [
    'excerpt',
    'cover',
    'status',
    'visibility',
    'category',
    'tags',
    'series',
    'series-order',
    'music-track',
    'title-font-select',
    'body-font-select',
    'is-pinned',
    'is-recommended',
  ].forEach((id) => {
    scope.listen(document.getElementById(id), 'change', markDirty);
  });
  scope.listen(window, 'beforeunload', (event) => {
    if (!isDirty) return;
    event.preventDefault();
    event.returnValue = '';
  });
  $$('.writer-tool[data-md-insert]').forEach((button) => {
    scope.listen(button, 'click', () => insertMarkdown(button.dataset.mdInsert));
  });
  $$('#article-tabs .writer-tab').forEach((button) => {
    scope.listen(button, 'click', async () => {
      currentFilter = button.dataset.filter;
      if (currentFilter === 'trash' && !trashLoaded) {
        $('#article-list').innerHTML = '<div class="writer-empty">正在读取回收站…</div>';
        try {
          await loadArticles({ includeTrash: true });
        } catch (error) {
          if (scope.disposed) return;
          if (error?.name !== 'AbortError') setMessage(error.message || '回收站读取失败');
        }
        return;
      }
      renderArticleList();
    });
  });
  scope.listen($('#article-list'), 'click', async (event) => {
    const target = event.target.closest('[data-action]');
    if (!target) return;
    const id = target.dataset.id;
    const action = target.dataset.action;
    try {
      if (action === 'edit') {
        if (isDirty && !confirm('当前文章有未保存修改，确定切换文章吗？')) return;
        articleId = String(id);
        history.pushState(null, '', `/admin/write?id=${encodeURIComponent(articleId)}`);
        renderArticleList();
        await loadCurrentArticle();
        if (mobileWriterQuery.matches) setMobilePanel('editor');
      }
      if (action === 'delete') await deleteArticle(id);
      if (action === 'restore') await restoreArticle(id);
      if (action === 'force-delete') await forceDeleteArticle(id);
    } catch (error) {
      if (scope.disposed) return;
      if (error?.name === 'AbortError') return;
      setMessage(error.message || '操作失败');
    }
  });
  scope.listen(window, 'popstate', () => {
    if (
      mobileWriterQuery.matches &&
      (document.body.classList.contains('mobile-panel-articles') ||
        document.body.classList.contains('mobile-panel-settings'))
    ) {
      closeMobilePanels();
    }
  });
  (async () => {
    try {
      await loadTaxonomy();
      await loadFontLibrary();
      await loadArticles();
      await loadCurrentArticle();
      restoreLocalDraftIfNeeded();
      if (articleId) setMessage('已载入文章');
    } catch (error) {
      if (scope.disposed) return;
      setMessage(error.message || '后端未连接');
    }
  })();

  function flushLocalDraft() {
    if (isDirty) {
      try {
        localStorage.setItem(autosaveKey(), JSON.stringify(collectLocalDraft()));
      } catch {}
    }
  }
  scope.listen(window, 'pagehide', flushLocalDraft);
  scope.defer(() => {
    flushLocalDraft();
    previewController?.abort();
    articleListController?.abort();
    currentArticleController?.abort();
  });
}
