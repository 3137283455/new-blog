function initMangaExperience() {
  const root = document.querySelector('[data-manga-experience]');
  if (!root || root.dataset.ready) return;
  root.dataset.ready = '1';
  const api = window.__PUBLIC_API_BASE__ || '/api';
  const mode = root.dataset.mode || 'home';
  const picker = root.querySelector('[data-manga-source-picker]');
  const sourceInput = picker?.querySelector('[data-manga-selected-source]');
  const sourceLabel = picker?.querySelector('[data-manga-selected-source-label]');
  const sourceDialog = picker?.querySelector('[data-manga-source-dialog]');
  const sourceList = picker?.querySelector('[data-manga-source-list]');
  const sourceFilter = picker?.querySelector('[data-manga-source-filter]');
  const sourceSummary = picker?.querySelector('[data-manga-source-summary]');
  const queryInput = root.querySelector('[data-manga-query]');
  const searchForm = root.querySelector('[data-manga-search-form]');
  const results = root.querySelector('[data-manga-results]');
  const state = root.querySelector('[data-manga-state]');
  let sources = [];
  let selectedSource = root.dataset.source || new URLSearchParams(location.search).get('source') || 'all';

  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const sourceById = (id) => sources.find((source) => source.id === id);
  const coverUrl = (item) => item.cover ? `${api}/content-sources/media?kind=manga&source=${encodeURIComponent(item.source)}&url=${encodeURIComponent(item.cover)}` : '';
  const sourceName = (item) => item.source_label || sourceById(item.source)?.label || '漫画源';

  function setState(message, error = false) {
    if (!state) return;
    state.textContent = message;
    state.classList.toggle('is-error', error);
  }

  function cards(items) {
    return items.map((item) => {
      const href = `/source/manga/${encodeURIComponent(item.source)}/${encodeURIComponent(item.external_id)}`;
      const cover = coverUrl(item);
      return `<article class="manga-result-card"><a class="manga-result-cover" href="${href}">${cover ? `<img src="${escape(cover)}" alt="${escape(item.title)}封面" loading="lazy" decoding="async">` : `<span>${escape(String(item.title || '漫').slice(0, 1))}</span>`}<i>${escape(sourceName(item))}</i>${Number(item.rating) ? `<b>★ ${Number(item.rating).toFixed(1)}</b>` : ''}</a><div><small>${escape(item.author || item.publication || '网络漫画')}</small><h3><a href="${href}">${escape(item.title)}</a></h3><p>${escape(item.total ? `${item.total} 章` : item.description || '查看作品详情')}</p></div></article>`;
    }).join('');
  }

  function empty(title, copy) {
    return `<div class="manga-result-empty"><strong>${escape(title)}</strong><span>${escape(copy)}</span></div>`;
  }

  function setSelected(id, close = true) {
    selectedSource = id || 'all';
    if (sourceInput) sourceInput.value = selectedSource;
    const meta = sourceById(selectedSource);
    if (sourceLabel) sourceLabel.textContent = selectedSource === 'all' ? '全部来源' : (meta?.label || selectedSource);
    sourceList?.querySelectorAll('[data-source-option]').forEach((button) => button.classList.toggle('active', button.dataset.sourceOption === selectedSource));
    if (close) sourceDialog?.close();
    root.dispatchEvent(new CustomEvent('manga-source-change', { detail: { id: selectedSource, source: meta } }));
  }

  function renderSourceList(term = '') {
    if (!sourceList) return;
    const keyword = term.trim().toLocaleLowerCase();
    const visible = sources.filter((source) => `${source.label} ${source.id}`.toLocaleLowerCase().includes(keyword));
    sourceList.innerHTML = `<button class="manga-source-item ${selectedSource === 'all' ? 'active' : ''}" type="button" data-source-option="all"><i>ALL</i><span><strong>全部漫画源</strong><small>聚合搜索 · ${sources.length} 个已启用来源</small></span><b>${selectedSource === 'all' ? '✓' : ''}</b></button>` + visible.map((source) => `<button class="manga-source-item ${selectedSource === source.id ? 'active' : ''}" type="button" data-source-option="${escape(source.id)}"><i>${escape(String(source.label || '源').slice(0, 1))}</i><span><strong>${escape(source.label)}</strong><small>${source.has_reader ? '可站内阅读' : '源站详情'}${source.has_explore ? ' · 支持发现' : ''}</small></span><b>${selectedSource === source.id ? '✓' : ''}</b></button>`).join('') || '<p class="manga-source-empty">没有匹配的漫画源</p>';
    sourceList.querySelectorAll('[data-source-option]').forEach((button) => button.addEventListener('click', () => setSelected(button.dataset.sourceOption)));
    if (sourceSummary) sourceSummary.textContent = `${sources.length} 个来源可用于前台搜索与阅读`;
  }

  async function loadSources() {
    try {
      const response = await fetch(`${api}/content-sources?kind=manga`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || json.success === false) throw new Error(json.message || '漫画源读取失败');
      sources = json.data?.sources || [];
      if (selectedSource !== 'all' && !sourceById(selectedSource)) selectedSource = 'all';
      renderSourceList();
      setSelected(selectedSource, false);
      root.querySelectorAll('[data-source-count]').forEach((node) => { node.textContent = `${sources.length} 个来源`; });
      root.querySelectorAll('[data-source-status]').forEach((node) => { node.textContent = sources.length ? '源已就绪，可直接搜索' : '暂无漫画源，请先导入源仓库'; });
      if (mode === 'home' || mode === 'latest') loadExplore();
      if (mode === 'search' && queryInput?.value.trim()) runSearch();
    } catch (error) {
      setState(error.message || '漫画源读取失败', true);
      if (sourceSummary) sourceSummary.textContent = '漫画源暂时不可用';
    }
  }

  async function loadExplore() {
    const panel = root.querySelector('[data-manga-explore]');
    if (!panel) return;
    const source = selectedSource === 'all' ? sources.find((item) => item.has_explore)?.id : selectedSource;
    const meta = sourceById(source);
    if (!source || !meta?.has_explore) {
      panel.innerHTML = empty('从搜索开始', '选择一个支持发现页的来源，或使用顶部搜索找到漫画。');
      setState('选择来源后即可发现漫画');
      return;
    }
    panel.innerHTML = empty('正在读取', `正在从 ${meta.label} 获取作品…`);
    try {
      const response = await fetch(`${api}/content-sources/explore?kind=manga&source=${encodeURIComponent(source)}&limit=12`, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || json.success === false) throw new Error(json.message || '发现页读取失败');
      const items = json.data?.items || [];
      panel.innerHTML = cards(items) || empty('暂无作品', '这个来源暂时没有返回发现内容。');
      root.querySelectorAll('[data-explore-source]').forEach((node) => { node.textContent = `${meta.label} · ${items.length} 部作品`; });
      setState(`${meta.label} 已返回 ${items.length} 部作品`);
    } catch (error) {
      panel.innerHTML = empty('发现页暂不可用', error.message || '请改用搜索');
      setState(error.message || '发现页读取失败', true);
    }
  }

  async function runSearch() {
    const value = queryInput?.value.trim() || '';
    if (!value) { queryInput?.focus(); setState('请输入漫画名称或关键词', true); return; }
    if (mode !== 'search') { location.href = `/manga/search?q=${encodeURIComponent(value)}&source=${encodeURIComponent(selectedSource)}`; return; }
    if (results) results.innerHTML = empty('正在搜索', '正在请求已启用的漫画源…');
    setState('正在检索漫画源…');
    const url = `${api}/content-sources/search?kind=manga&source=${encodeURIComponent(selectedSource)}&q=${encodeURIComponent(value)}&limit=24`;
    try {
      const response = await fetch(url, { cache: 'no-store' });
      const json = await response.json();
      if (!response.ok || json.success === false) throw new Error(json.message || '漫画源搜索失败');
      const items = json.data?.items || [];
      if (results) results.innerHTML = cards(items) || empty('没有找到漫画', '换一个关键词或来源试试。');
      const aggregate = json.data?.aggregate;
      const okSources = aggregate ? (json.data.sources || []).filter((item) => item.ok).length : 1;
      setState(`${items.length} 个结果${aggregate ? ` · ${okSources} 个来源响应` : ` · ${json.data?.source?.label || '漫画源'}`}`);
      root.querySelectorAll('[data-search-title]').forEach((node) => { node.textContent = `“${value}”的搜索结果`; });
      const next = new URL(location.href); next.searchParams.set('q', value); next.searchParams.set('source', selectedSource); history.replaceState({}, '', next);
    } catch (error) {
      if (results) results.innerHTML = empty('搜索失败', error.message || '请稍后重试');
      setState(error.message || '搜索失败', true);
    }
  }

  picker?.querySelector('[data-manga-source-open]')?.addEventListener('click', () => { renderSourceList(); sourceDialog?.showModal(); });
  picker?.querySelector('[data-manga-source-close]')?.addEventListener('click', () => sourceDialog?.close());
  sourceFilter?.addEventListener('input', () => renderSourceList(sourceFilter.value));
  sourceDialog?.addEventListener('click', (event) => { if (event.target === sourceDialog) sourceDialog.close(); });
  root.addEventListener('manga-source-change', () => { if (mode === 'home' || mode === 'latest') loadExplore(); });
  searchForm?.addEventListener('submit', (event) => { event.preventDefault(); runSearch(); });
  loadSources();
}

document.addEventListener('astro:page-load', initMangaExperience);
initMangaExperience();
