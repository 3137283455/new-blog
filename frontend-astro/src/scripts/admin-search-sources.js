(() => {
  const root = document.querySelector('.admin-shell');
  if (!root) return;
  const base = root.dataset.apiBase || '/api';
  const token = () => localStorage.getItem('boke_admin_token') || '';
  const $ = (selector) => document.querySelector(selector);
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
  const state = { config: null, selectedId: '' };

  async function api(path, options = {}) {
    const response = await fetch(base + path, {
      ...options,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) },
    });
    const json = await response.json().catch(() => ({}));
    if (!response.ok || json.success === false) throw new Error(json.message || '请求失败');
    return json.data;
  }

  function message(text, failed = false) {
    const node = $('#content-search-source-message');
    if (!node) return;
    node.textContent = text;
    node.classList.toggle('text-error', failed);
    node.classList.toggle('text-success', !failed && Boolean(text));
  }

  function fileFor(source) {
    return { schema: 'boke-content-search-source', version: 1, source };
  }

  function templateFile() {
    return fileFor({
      id: 'my-source',
      label: '我的检索源',
      enabled: true,
      kinds: ['bangumi', 'manga'],
      api_base: 'https://api.example.com',
      page_base: 'https://www.example.com',
      page_path: '/subject/{id}',
      headers: {},
      search: {
        method: 'GET',
        path: '/search?keyword={query}&type={type}&limit={limit}',
        result_path: 'data.items'
      },
      detail: {
        method: 'GET',
        path: '/subjects/{id}',
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
    renderList();
  }

  function sourceOptions(kind) {
    return (state.config?.sources || []).filter((source) => source.enabled && source.kinds.includes(kind));
  }

  function renderDefaults() {
    for (const kind of ['bangumi', 'manga']) {
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
      const kinds = source.kinds.map((kind) => kind === 'bangumi' ? '追番' : '漫画').join(' · ');
      return `<article class="rounded-2xl border p-3 ${selected ? 'border-primary bg-primary/5' : 'border-base-content/10 bg-base-100/55'}">
        <button class="block w-full text-left" type="button" data-search-source-edit="${escapeHtml(source.id)}">
          <span class="flex items-center justify-between gap-2"><strong class="truncate">${escapeHtml(source.label)}</strong><span class="badge ${source.enabled ? 'badge-success' : 'badge-ghost'} badge-sm">${source.enabled ? '启用' : '停用'}</span></span>
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
    }).join('') || '<p class="rounded-xl border border-dashed p-5 text-sm text-base-content/45">还没有检索源。</p>';
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

  async function importOne(file, successText = '检索源已保存') {
    const saved = await api('/admin/search-sources/import', { method: 'POST', body: JSON.stringify(file) });
    state.config = saved;
    state.selectedId = String(file.source.id || '').trim().toLowerCase();
    render();
    const source = state.config.sources.find((item) => item.id === state.selectedId);
    if (source) setEditor(source);
    message(successText);
    window.dispatchEvent(new CustomEvent('content-search-sources-updated', { detail: state.config }));
  }

  async function saveEditor() {
    try { await importOne(selectedFile(), '规则校验通过，当前检索源已保存'); }
    catch (error) { message(error.message, true); }
  }

  async function importFiles(files) {
    if (!files.length) return;
    let imported = 0;
    try {
      for (const file of files) {
        let parsed;
        try { parsed = JSON.parse(await file.text()); } catch { throw new Error(`${file.name} 不是有效 JSON`); }
        if (parsed?.schema === 'boke-content-search-source-bundle' && Array.isArray(parsed?.config?.sources)) {
          for (const source of parsed.config.sources) { await importOne(fileFor(source), ''); imported += 1; }
        } else {
          await importOne(parsed, ''); imported += 1;
        }
      }
      message(`已逐个校验并导入 ${imported} 个检索源`);
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
    if (target.dataset.panelTab === 'settings') { document.querySelector('#bangumi-source-dialog')?.close(); load(); }
    if (target.dataset.searchSourceEdit) {
      const source = state.config?.sources.find((item) => item.id === target.dataset.searchSourceEdit);
      if (source) setEditor(source);
    }
    if (target.dataset.searchSourceExport) exportSource(target.dataset.searchSourceExport);
    if (target.dataset.searchSourceToggle) toggleSource(target.dataset.searchSourceToggle);
    if (target.dataset.searchSourceDelete) removeSource(target.dataset.searchSourceDelete);
  });
  $('#search-source-new')?.addEventListener('click', () => { setEditor(null); message('已生成单源模板，请按目标站点 API 修改后保存'); });
  $('#search-source-save')?.addEventListener('click', saveEditor);
  $('#search-source-export')?.addEventListener('click', () => { try { const file = selectedFile(); download(file, `${file.source.id || 'source'}.search-source.json`); message('已导出编辑器中的独立规则文件'); } catch (error) { message(error.message, true); } });
  $('#search-source-export-all')?.addEventListener('click', () => { if (state.config) download({ schema: 'boke-content-search-source-bundle', version: 1, config: state.config }, 'content-search-sources.backup.json'); });
  $('#search-source-import')?.addEventListener('change', (event) => { importFiles(Array.from(event.target.files || [])); event.target.value = ''; });
  $('#search-source-default-bangumi')?.addEventListener('change', saveDefaults);
  $('#search-source-default-manga')?.addEventListener('change', saveDefaults);
  window.addEventListener('content-search-sources-request', load);
})();