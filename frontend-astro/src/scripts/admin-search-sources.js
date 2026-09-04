(() => {
  const root = document.querySelector('.admin-shell');
  if (!root) return;
  const base = root.dataset.apiBase || '/api';
  const token = () => localStorage.getItem('boke_admin_token') || '';
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const state = { config: null, conflictResolve: null, venera: null };

  async function api(path, options = {}) {
    const response = await fetch(base + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) { const error = new Error(json.message || '请求失败'); error.code = json.code || ''; error.status = response.status; throw error; }
    return json.data;
  }

  function message(text, failed = false) {
    const node = $('#content-search-source-message');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('text-error', failed);
    node.classList.toggle('text-success', !failed && Boolean(text));
  }

  function veneraMessage(text, failed = false) {
    const node = $('#venera-repository-status');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('text-error', failed);
    node.classList.toggle('text-success', !failed && Boolean(text));
  }

  function renderVenera() {
    const repositories = state.venera?.repositories || [];
    const sources = state.venera?.sources || [];
    const badge = $('#venera-repository-badge');
    if (badge) {
      badge.textContent = repositories.length ? `${repositories.length} 个仓库 · ${sources.length} 个源` : '尚未同步';
      badge.className = repositories.length ? 'badge badge-success' : 'badge badge-ghost';
    }
    const list = $('#venera-repository-list');
    if (list) list.innerHTML = repositories.map((repository) => `<article class="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-base-200/60 px-4 py-3"><span class="min-w-0"><strong class="block">${escapeHtml(repository.name || 'Venera 源仓库')}</strong><small class="block truncate font-mono text-base-content/45">${escapeHtml(repository.url)}</small><small class="text-base-content/45">${Number(repository.source_count || 0)} 个源 · ${escapeHtml(repository.updated_at || '')}</small></span><button class="btn btn-ghost btn-sm text-error" type="button" data-venera-repository-delete="${escapeHtml(repository.url)}">移除</button></article>`).join('') || '<p class="text-sm text-base-content/45">还没有同步 Venera 源仓库。</p>';
    const select = $('#venera-source-test-select');
    if (select) select.innerHTML = sources.map((source) => `<option value="${escapeHtml(source.id)}">${escapeHtml(source.label)} · ${escapeHtml(source.key)}</option>`).join('');
  }

  async function loadVenera() {
    if (!token()) return;
    try {
      state.venera = await api('/admin/venera-sources');
      renderVenera();
    } catch (error) { veneraMessage(error.message || 'Venera 源加载失败', true); }
  }

  async function importVeneraRepository() {
    const button = $('#venera-repository-import');
    const url = $('#venera-repository-url')?.value.trim();
    if (!url) return veneraMessage('请输入仓库 index.json 地址', true);
    try {
      button.disabled = true;
      veneraMessage('正在下载索引并同步源清单…');
      state.venera = await api('/admin/venera-sources/import', { method: 'POST', body: JSON.stringify({ url }) });
      renderVenera();
      veneraMessage(`同步完成：前台已可使用 ${state.venera.sources.length} 个 Venera 漫画源`);
    } catch (error) { veneraMessage(error.message || '同步失败', true); }
    finally { button.disabled = false; }
  }

  async function testVeneraSource() {
    const button = $('#venera-source-test');
    const source = $('#venera-source-test-select')?.value;
    const query = $('#venera-source-test-query')?.value.trim();
    const results = $('#venera-source-test-results');
    if (!source || !query) return veneraMessage('请选择源并输入测试关键词', true);
    try {
      button.disabled = true;
      results.innerHTML = '<p class="text-sm text-base-content/45">正在执行真实搜索…</p>';
      const data = await api('/admin/venera-sources/test', { method: 'POST', body: JSON.stringify({ source, query }) });
      results.innerHTML = data.items.map((item) => `<article class="grid grid-cols-[3rem_1fr] gap-2 rounded-xl bg-base-200/60 p-2">${item.cover ? `<img class="h-16 w-12 rounded-lg object-cover" src="${escapeHtml(item.cover)}" alt="">` : '<span class="h-16 w-12 rounded-lg bg-base-300"></span>'}<span class="min-w-0"><b class="block truncate text-sm">${escapeHtml(item.title)}</b><small class="block truncate text-base-content/45">${escapeHtml(item.author || item.subtitle || item.external_id || '')}</small></span></article>`).join('') || '<p class="text-sm text-base-content/45">源请求成功，但没有搜索结果。</p>';
      veneraMessage(`测试成功：${data.items.length} 条结果，${data.latency_ms}ms`);
    } catch (error) {
      results.innerHTML = '';
      veneraMessage(error.message || '源测试失败', true);
    } finally { button.disabled = false; }
  }

  async function removeVeneraRepository(url) {
    if (!confirm('移除这个 Venera 仓库及其源清单？本地书架数据不会被删除。')) return;
    try {
      state.venera = await api('/admin/venera-sources', { method: 'DELETE', body: JSON.stringify({ url }) });
      renderVenera();
      veneraMessage('Venera 仓库已移除');
    } catch (error) { veneraMessage(error.message || '移除失败', true); }
  }

  function fileFor(source) {
    return { schema: 'boke-content-search-source', version: 1, source };
  }

  function renderList() {
    const list = $('#content-search-source-list');
    if (!list || !state.config) return;
    const sources = (state.config.sources || []).filter((source) => Array.isArray(source.kinds) && source.kinds.includes('manga'));
    list.innerHTML = sources.map((source) => {
      return `<article class="px-2 py-3">
          <span class="flex items-center justify-between gap-2"><strong class="truncate">${escapeHtml(source.label)}</strong><span class="badge ${source.enabled ? 'badge-success' : 'badge-ghost'} badge-sm">${source.enabled ? '启用' : '停用'}</span></span>
          <small class="mt-1 block truncate font-mono text-base-content/45">${escapeHtml(source.id)} · 漫画</small>
          <small class="mt-1 block truncate text-base-content/45">${escapeHtml(source.search?.method || '接口')} ${escapeHtml(source.search?.path || '已配置')}</small>
        <div class="mt-3 flex flex-wrap gap-2 border-t border-base-content/10 pt-2">
          <button class="btn btn-ghost btn-xs rounded-lg" type="button" data-search-source-export="${escapeHtml(source.id)}">导出</button>
          <button class="btn btn-ghost btn-xs rounded-lg" type="button" data-search-source-toggle="${escapeHtml(source.id)}">${source.enabled ? '停用' : '启用'}</button>
          <button class="btn btn-ghost btn-xs rounded-lg text-error" type="button" data-search-source-delete="${escapeHtml(source.id)}">删除</button>
        </div>
      </article>`;
    }).join('') || '<p class="py-8 text-center text-sm text-base-content/45">还没有导入其他漫画源；通常直接使用上方 Venera 仓库即可。</p>';
  }

  function render() {
    renderList();
  }

  async function load() {
    if (!token()) return;
    try {
      state.config = await api('/admin/search-sources');
      render();
      message('');
      window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    } catch (error) { message(error.message || '检索源加载失败', true); }
  }

  function conflictChoice(source) {
    const dialog = $('#search-source-conflict-dialog');
    if (!dialog) return Promise.resolve({ mode: 'skip' });
    $('#search-source-conflict-text').textContent = `ID“${source.id}”已存在。请选择如何处理“${source.label || source.id}”。`;
    $('#search-source-conflict-new-id').value = `${source.id}-2`;
    dialog.showModal();
    return new Promise((resolve) => { state.conflictResolve = resolve; });
  }

  function finishConflict(choice) {
    $('#search-source-conflict-dialog')?.close();
    const resolve = state.conflictResolve;
    state.conflictResolve = null;
    resolve?.(choice);
  }

  async function importOne(file, successText = '检索源已保存', presetChoice = null) {
    const sourceId = String(file.source.id || '').trim().toLowerCase();
    const exists = state.config?.sources.some((item) => item.id === sourceId);
    const choice = presetChoice || (exists ? await conflictChoice(file.source) : { mode: '' });
    if (!choice || choice.mode === 'cancel' || choice.mode === 'skip') {
      if (choice?.mode === 'skip') message(`已跳过检索源 ${file.source.label || sourceId}`);
      return false;
    }
    const payload = choice.mode ? { file, mode: choice.mode, new_id: choice.newId || '' } : file;
    const saved = await api('/admin/search-sources/import', { method: 'POST', body: JSON.stringify(payload) });
    state.config = saved;
    render();
    message(successText);
    window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    return true;
  }

  async function importFiles(files) {
    if (!files.length) return;
    let imported = 0, skipped = 0;
    try {
      for (const file of files) {
        let parsed;
        try { parsed = JSON.parse(await file.text()); } catch { throw new Error(`${file.name} 不是有效 JSON`); }
        const sourceFiles = parsed?.schema === 'boke-content-search-source-bundle' && Array.isArray(parsed?.config?.sources) ? parsed.config.sources.map(fileFor) : [parsed];
        for (const sourceFile of sourceFiles) { if (await importOne(sourceFile, '')) imported += 1; else skipped += 1; }
      }
      message(`导入完成：新增或覆盖 ${imported} 个${skipped ? `，跳过 ${skipped} 个` : ''}`);
    } catch (error) { message(`导入中止：${error.message}`, true); }
  }
  function download(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = filename; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function exportSource(id) {
    const source = state.config?.sources.find((item) => item.id === id);
    if (!source) throw new Error('请选择要导出的检索源');
    download(fileFor(source), `${source.id}.search-source.json`);
    message(`已导出 ${source.label} 的独立规则文件`);
  }

  async function toggleSource(id) {
    if (!state.config) return;
    const source = state.config.sources.find((item) => item.id === id);
    if (!source) return;
    const next = { ...state.config, sources: state.config.sources.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item) };
    try {
      state.config = await api('/admin/search-sources', { method: 'PUT', body: JSON.stringify(next) });
      render();
      message(`${source.label} 已${source.enabled ? '停用' : '启用'}`);
      window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    } catch (error) { message(error.message, true); }
  }

  async function removeSource(id) {
    const source = state.config?.sources.find((item) => item.id === id);
    if (!source || !confirm(`删除检索源“${source.label}”？此操作不会删除追番或漫画数据。`)) return;
    try {
      state.config = await api(`/admin/search-sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
      render();
      message('检索源已删除');
      window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    } catch (error) { message(error.message, true); }
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.panelTab === 'search-sources' || target.dataset.panel === 'search-sources') { document.querySelector('#bangumi-source-dialog')?.close(); load(); loadVenera(); }
    if (target.dataset.veneraRepositoryDelete) removeVeneraRepository(target.dataset.veneraRepositoryDelete);
    if (target.dataset.searchSourceExport) exportSource(target.dataset.searchSourceExport);
    if (target.dataset.searchSourceToggle) toggleSource(target.dataset.searchSourceToggle);
    if (target.dataset.searchSourceDelete) removeSource(target.dataset.searchSourceDelete);
  });
  $('#search-source-conflict-skip')?.addEventListener('click', () => finishConflict({ mode: 'skip' }));
  $('#search-source-conflict-replace')?.addEventListener('click', () => finishConflict({ mode: 'replace' }));
  $('#search-source-conflict-cancel')?.addEventListener('click', () => finishConflict({ mode: 'cancel' }));
  $('#search-source-conflict-rename')?.addEventListener('click', () => {
    const newId = $('#search-source-conflict-new-id').value.trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(newId)) { message('新源 ID 格式不正确', true); return; }
    finishConflict({ mode: 'rename', newId });
  });
  $('#search-source-conflict-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); finishConflict({ mode: 'cancel' }); });
  $('#search-source-export-all')?.addEventListener('click', () => { if (state.config) download({ schema: 'boke-content-search-source-bundle', version: 1, config: state.config }, 'content-search-sources.backup.json'); });
  $('#search-source-import')?.addEventListener('change', (event) => { importFiles(Array.from(event.target.files || [])); event.target.value = ''; });
  $('#venera-repository-import')?.addEventListener('click', importVeneraRepository);
  $('#venera-source-test')?.addEventListener('click', testVeneraSource);
  $('#venera-source-test-query')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); testVeneraSource(); } });
  window.addEventListener('content-search-sources-request', load);
})();
