(() => {
  const root = document.querySelector('.admin-shell');
  if (!root) return;
  const base = root.dataset.apiBase || '/api';
  const token = () => localStorage.getItem('boke_admin_token') || '';
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const state = { config: null, selectedId: '', health: {}, conflictResolve: null, venera: null };

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

  function templateFile() {
    return fileFor({
      id: 'my-source',
      label: '我的检索源',
      enabled: true,
      kinds: ['book', 'bangumi', 'manga'],
      api_base: 'https://api.example.com',
      page_base: 'https://www.example.com',
      page_path: '/subject/{id}',
      timeout_ms: 10000,
      headers: {},
      search: {
        method: 'GET',
        path: '/search?keyword={query}&type={type}&limit={limit}',
        body_type: 'json',
        result_path: 'data.items'
      },
      detail: {
        method: 'GET',
        path: '/subjects/{id}',
        body_type: 'json',
        result_path: 'data'
      },
      mapping: {
        id: 'id',
        title: ['name_cn', 'name'],
        original_title: 'name',
        cover: ['images.large', 'cover'],
        rating: 'rating.score',
        publication: 'date',
        description: 'summary',
        type: 'type_name',
        total: 'eps'
      },
      type_values: { bangumi: 2, manga: 1 }
    });
  }

  function selectedFile() {
    const text = String($('#content-search-source-editor')?.value || '').trim();
    if (!text) throw new Error('编辑器里没有规则');
    let parsed;
    try { parsed = JSON.parse(text); } catch (error) { throw new Error(`JSON 格式错误：${error.message}`); }
    if (parsed?.schema !== 'boke-content-search-source' || Number(parsed?.version) !== 1 || !parsed?.source) {
      throw new Error('必须是 schema 为 boke-content-search-source 的单源 JSON 文件');
    }
    return parsed;
  }

  function setEditor(source) {
    state.selectedId = source?.id || '';
    const editor = $('#content-search-source-editor');
    if (editor) editor.value = JSON.stringify(source ? fileFor(source) : templateFile(), null, 2);
    const kind = (source?.kinds || templateFile().source.kinds)[0] || 'book';
    if ($('#search-source-test-kind')) $('#search-source-test-kind').value = kind;
    if ($('#search-source-test-results')) $('#search-source-test-results').innerHTML = '';
    const badge = $('#search-source-test-badge');
    if (badge) { badge.textContent = state.health[state.selectedId]?.ok ? `上次 ${state.health[state.selectedId].latency}ms` : '未测试'; badge.className = state.health[state.selectedId]?.ok ? 'badge badge-success' : 'badge badge-ghost'; }
    renderList();
  }

  function sourceOptions(kind) {
    return (state.config?.sources || []).filter((source) => source.enabled && source.kinds.includes(kind));
  }

  function renderDefaults() {
    for (const kind of ['book', 'bangumi', 'manga']) {
      const select = $(`#search-source-default-${kind}`);
      if (!select || !state.config) continue;
      select.innerHTML = sourceOptions(kind).map((source) => `<option value="${escapeHtml(source.id)}">${escapeHtml(source.label)} · ${escapeHtml(source.id)}</option>`).join('');
      select.value = state.config.defaults[kind] || '';
    }
  }

  function renderList() {
    const list = $('#content-search-source-list');
    if (!list || !state.config) return;
    list.innerHTML = state.config.sources.map((source) => {
      const selected = source.id === state.selectedId;
      const health = state.health[source.id];
      const kinds = source.kinds.map((kind) => kind === 'bangumi' ? '追番' : '漫画').join(' · ');
      return `<article class="border-b border-base-content/10 px-2 py-3 ${selected ? 'bg-primary/5' : ''}">
        <button class="block w-full text-left" type="button" data-search-source-edit="${escapeHtml(source.id)}">
          <span class="flex items-center justify-between gap-2"><strong class="truncate">${escapeHtml(source.label)}</strong><span class="flex gap-1">${health ? `<span class="badge ${health.ok ? 'badge-success' : 'badge-error'} badge-sm">${health.ok ? `${health.latency}ms` : '失败'}</span>` : ''}<span class="badge ${source.enabled ? 'badge-success' : 'badge-ghost'} badge-sm">${source.enabled ? '启用' : '停用'}</span></span></span>
          <small class="mt-1 block truncate font-mono text-base-content/45">${escapeHtml(source.id)} · ${escapeHtml(kinds)}</small>
          <small class="mt-1 block truncate text-base-content/45">${escapeHtml(source.search.method)} ${escapeHtml(source.search.path)}</small>
        </button>
        <div class="mt-3 flex flex-wrap gap-2 border-t border-base-content/10 pt-2">
          <button class="btn btn-ghost btn-xs rounded-lg" type="button" data-search-source-edit="${escapeHtml(source.id)}">编辑</button>
          <button class="btn btn-ghost btn-xs rounded-lg" type="button" data-search-source-export="${escapeHtml(source.id)}">导出</button>
          <button class="btn btn-ghost btn-xs rounded-lg" type="button" data-search-source-toggle="${escapeHtml(source.id)}">${source.enabled ? '停用' : '启用'}</button>
          <button class="btn btn-ghost btn-xs rounded-lg text-error" type="button" data-search-source-delete="${escapeHtml(source.id)}">删除</button>
        </div>
      </article>`;
    }).join('') || '<p class="py-8 text-center text-sm text-base-content/45">还没有检索源。</p>';
  }

  function render() {
    renderDefaults();
    renderList();
    if (!state.selectedId && state.config?.sources?.length) setEditor(state.config.sources[0]);
  }

  async function load() {
    if (!token()) return;
    try {
      state.config = await api('/admin/search-sources');
      if (state.selectedId && !state.config.sources.some((source) => source.id === state.selectedId)) state.selectedId = '';
      render();
      message('');
      window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    } catch (error) { message(error.message || '检索源加载失败', true); }
  }

  async function saveDefaults() {
    if (!state.config) return;
    state.config.defaults = {
      bangumi: $('#search-source-default-bangumi')?.value || '',
      manga: $('#search-source-default-manga')?.value || '',
    };
    try {
      state.config = await api('/admin/search-sources', { method: 'PUT', body: JSON.stringify(state.config) });
      render();
      message('默认检索源已保存');
      window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    } catch (error) { message(error.message, true); await load(); }
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
    state.selectedId = choice.mode === 'rename' ? String(choice.newId || '').trim().toLowerCase() : sourceId;
    render();
    const source = state.config.sources.find((item) => item.id === state.selectedId);
    if (source) setEditor(source);
    message(successText);
    window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    return true;
  }

  async function saveEditor() {
    try {
      const file = selectedFile();
      const sameSelection = state.selectedId && state.selectedId === String(file.source.id || '').trim().toLowerCase();
      await importOne(file, '规则校验通过，当前检索源已保存', sameSelection ? { mode: 'replace' } : null);
    } catch (error) { message(error.message, true); }
  }

  function formatEditor() {
    try {
      const file = selectedFile();
      $('#content-search-source-editor').value = JSON.stringify(file, null, 2);
      message('JSON 已格式化');
    } catch (error) { message(error.message, true); }
  }

  async function testEditor() {
    const button = $('#search-source-test'), badge = $('#search-source-test-badge'), results = $('#search-source-test-results');
    try {
      const file = selectedFile(), kind = $('#search-source-test-kind').value, query = $('#search-source-test-query').value.trim(), id = $('#search-source-test-id').value.trim();
      if (!id && !query) throw new Error('请输入搜索关键词，或填写详情 ID');
      button.disabled = true; badge.textContent = '测试中'; badge.className = 'badge badge-warning'; results.innerHTML = '<p class="text-xs text-base-content/50">正在请求真实 API 并检查字段映射...</p>';
      const data = await api('/admin/search-sources/test', { method: 'POST', body: JSON.stringify({ file, kind, query, id }) });
      const sourceId = String(file.source.id || '').trim().toLowerCase();
      state.health[sourceId] = { ok: true, latency: data.latency_ms };
      badge.textContent = `正常 ${data.latency_ms}ms`; badge.className = 'badge badge-success';
      results.innerHTML = data.items.map((item) => `<article class="grid grid-cols-[2.5rem_1fr] gap-2 rounded-xl bg-base-100/70 p-2">${item.cover ? `<img class="h-14 w-10 rounded-lg object-cover" src="${escapeHtml(item.cover)}" alt="">` : '<span class="grid h-14 w-10 place-items-center rounded-lg bg-base-200">✓</span>'}<span class="min-w-0"><b class="block truncate text-sm">${escapeHtml(item.title)}</b><small class="block truncate text-base-content/45">ID ${escapeHtml(item.external_id)} · ${escapeHtml(item.publication || item.type || '映射正常')}</small></span></article>`).join('');
      message(`试跑成功：${data.mode === 'detail' ? '详情接口' : '搜索接口'}返回 ${data.items.length} 条可用结果`);
      renderList();
    } catch (error) {
      let sourceId = state.selectedId;
      try { sourceId = String(selectedFile().source.id || sourceId).trim().toLowerCase(); } catch {}
      if (sourceId) state.health[sourceId] = { ok: false, latency: 0 };
      badge.textContent = '测试失败'; badge.className = 'badge badge-error';
      results.innerHTML = `<p class="whitespace-pre-line rounded-xl bg-error/10 p-3 text-xs text-error">${escapeHtml(error.message)}</p>`;
      message(error.message, true); renderList();
    } finally { button.disabled = false; }
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
      state.selectedId = '';
      render();
      if (state.config.sources[0]) setEditor(state.config.sources[0]);
      message('检索源已删除');
      window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
    } catch (error) { message(error.message, true); }
  }

  document.addEventListener('click', (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.panelTab === 'search-sources' || target.dataset.panel === 'search-sources') { document.querySelector('#bangumi-source-dialog')?.close(); load(); loadVenera(); }
    if (target.dataset.veneraRepositoryDelete) removeVeneraRepository(target.dataset.veneraRepositoryDelete);
    if (target.dataset.searchSourceEdit) {
      const source = state.config?.sources.find((item) => item.id === target.dataset.searchSourceEdit);
      if (source) setEditor(source);
    }
    if (target.dataset.searchSourceExport) exportSource(target.dataset.searchSourceExport);
    if (target.dataset.searchSourceToggle) toggleSource(target.dataset.searchSourceToggle);
    if (target.dataset.searchSourceDelete) removeSource(target.dataset.searchSourceDelete);
  });
  $('#search-source-new')?.addEventListener('click', () => { setEditor(null); message('已生成单源模板，请按目标站点 API 修改后保存'); });
  $('#search-source-format')?.addEventListener('click', formatEditor);
  $('#search-source-test')?.addEventListener('click', testEditor);
  $('#search-source-test-query')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); testEditor(); } });
  $('#search-source-test-id')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); testEditor(); } });
  $('#search-source-conflict-skip')?.addEventListener('click', () => finishConflict({ mode: 'skip' }));
  $('#search-source-conflict-replace')?.addEventListener('click', () => finishConflict({ mode: 'replace' }));
  $('#search-source-conflict-cancel')?.addEventListener('click', () => finishConflict({ mode: 'cancel' }));
  $('#search-source-conflict-rename')?.addEventListener('click', () => {
    const newId = $('#search-source-conflict-new-id').value.trim().toLowerCase();
    if (!/^[a-z0-9_-]{1,40}$/.test(newId)) { message('新源 ID 格式不正确', true); return; }
    finishConflict({ mode: 'rename', newId });
  });
  $('#search-source-conflict-dialog')?.addEventListener('cancel', (event) => { event.preventDefault(); finishConflict({ mode: 'cancel' }); });
  $('#search-source-save')?.addEventListener('click', saveEditor);
  $('#search-source-export')?.addEventListener('click', () => { try { const file = selectedFile(); download(file, `${file.source.id || 'source'}.search-source.json`); message('已导出编辑器中的独立规则文件'); } catch (error) { message(error.message, true); } });
  $('#search-source-export-all')?.addEventListener('click', () => { if (state.config) download({ schema: 'boke-content-search-source-bundle', version: 1, config: state.config }, 'content-search-sources.backup.json'); });
  $('#search-source-import')?.addEventListener('change', (event) => { importFiles(Array.from(event.target.files || [])); event.target.value = ''; });
  $('#search-source-default-bangumi')?.addEventListener('change', saveDefaults);
  $('#search-source-default-manga')?.addEventListener('change', saveDefaults);
  $('#venera-repository-import')?.addEventListener('click', importVeneraRepository);
  $('#venera-source-test')?.addEventListener('click', testVeneraSource);
  $('#venera-source-test-query')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); testVeneraSource(); } });
  window.addEventListener('content-search-sources-request', load);
})();
