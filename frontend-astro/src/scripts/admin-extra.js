(() => {
  const root = document.querySelector('.admin-shell');
  const apiBase = root?.dataset.apiBase || '/api';
  const tokenKey = 'boke_admin_token';
  const state = {
    navigation: [],
    bangumi: [],
    albums: [],
    mediaPicker: null,
    mediaPickerItems: [],
  };
  const $ = (selector) => document.querySelector(selector);

  function token() {
    return localStorage.getItem(tokenKey) || '';
  }

  async function api(path, options = {}) {
    const isForm = options.body instanceof FormData;
    const headers = { ...(options.headers || {}) };
    if (!isForm) headers['Content-Type'] = 'application/json';
    const authToken = token();
    if (authToken) headers.Authorization = `Bearer ${authToken}`;
    let res;
    try {
      res = await fetch(`${apiBase}${path}`, { ...options, headers });
    } catch {
      throw new Error(`无法连接后端 API（${apiBase}），请确认 Express 服务已启动`);
    }
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.success === false) throw new Error(json.message || `接口请求失败（HTTP ${res.status}）`);
    return json;
  }

  async function upload(file) {
    const body = new FormData();
    body.append('file', file);
    const json = await api('/admin/media/upload', { method: 'POST', body });
    return json.data?.url || `/uploads/${json.data?.path || ''}`;
  }

  function setPanelMessage(id, message, error = false) {
    const el = $(`#${id}`);
    if (!el) return;
    el.textContent = message;
    el.classList.toggle('text-error', error);
    el.classList.toggle('text-success', !error && !!message);
  }

  function mediaUrl(file) {
    return file.url || `/uploads/${file.path || ''}`;
  }

  function mediaName(file) {
    return file.original_name || file.filename || mediaUrl(file);
  }

  function setTargetValue(config, value) {
    const form = document.getElementById(config.form);
    const field = form?.elements.namedItem(config.field);
    if (!field) return;
    if (config.append) {
      const current = String(field.value || '').trim();
      field.value = current ? `${current}\n${value}` : value;
    } else {
      field.value = value;
    }
    updateFieldPreview(config.form, config.field);
    if (config.form === 'article-form' && config.field === 'cover_image' && typeof updateCoverPreview === 'function') {
      updateCoverPreview(value);
    }
  }

  function renderMediaPicker() {
    const grid = $('#media-picker-grid');
    if (!grid) return;
    const keyword = String($('#media-picker-search')?.value || '').trim().toLowerCase();
    const type = String($('#media-picker-type')?.value || '');
    const visibleItems = state.mediaPickerItems.filter((file) => {
      const url = mediaUrl(file);
      const haystack = `${mediaName(file)} ${url} ${file.mime_type || ''}`.toLowerCase();
      return (!keyword || haystack.includes(keyword)) && (!type || file.mime_type?.startsWith(`${type}/`));
    });
    grid.innerHTML = visibleItems.map((file) => {
      const url = mediaUrl(file);
      const isImage = file.mime_type?.startsWith('image/');
      const isAudio = file.mime_type?.startsWith('audio/');
      return `
        <button class="admin-media-picker-card" type="button" data-choose-media="${html(url)}">
          <div class="admin-media-picker-thumb">
            ${isImage ? `<img src="${html(url)}" alt="" />` : isAudio ? '<span class="text-3xl">♪</span>' : '<span class="text-3xl">□</span>'}
          </div>
          <div class="p-3">
            <p class="truncate text-sm font-black">${html(mediaName(file))}</p>
            <p class="truncate text-xs text-base-content/45">${html(url)}</p>
          </div>
        </button>
      `;
    }).join('') || '<p class="text-base-content/45">没有匹配的媒体文件。</p>';
  }

  async function openMediaPicker(config) {
    state.mediaPicker = config;
    const qs = new URLSearchParams({ page: '1', pageSize: '80' });
    if (config.type) qs.set('type', config.type);
    $('#media-picker-dialog h3').textContent = '选择媒体资源';
    $('#close-media-picker').textContent = '关闭';
    $('#media-picker-type').value = config.type || '';
    $('#media-picker-search').value = '';
    $('#media-picker-hint').textContent = config.append ? '选择后会追加到当前字段。' : '选择后会自动写入当前字段。';
    $('#media-picker-grid').innerHTML = '<p class="text-base-content/45">正在读取媒体库...</p>';
    $('#media-picker-dialog')?.showModal();
    try {
      const json = await api(`/admin/media?${qs.toString()}`);
      state.mediaPickerItems = json.data || [];
      renderMediaPicker();
    } catch (error) {
      $('#media-picker-grid').innerHTML = `<p class="text-error">${html(error.message || '媒体库读取失败')}</p>`;
    }
  }

  async function reloadMediaPickerItems() {
    const type = String($('#media-picker-type')?.value || '');
    const qs = new URLSearchParams({ page: '1', pageSize: '80' });
    if (type) qs.set('type', type);
    $('#media-picker-grid').innerHTML = '<p class="text-base-content/45">正在读取媒体库...</p>';
    try {
      const json = await api(`/admin/media?${qs.toString()}`);
      state.mediaPickerItems = json.data || [];
      renderMediaPicker();
    } catch (error) {
      $('#media-picker-grid').innerHTML = `<p class="text-error">${html(error.message || '媒体库读取失败')}</p>`;
    }
  }

  function html(value) {
    return String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[char]));
  }

  function updateFieldPreview(formId, fieldName) {
    const form = document.getElementById(formId);
    const field = form?.elements.namedItem(fieldName);
    if (!field) return;
    const value = String(field.value || '').trim().split(/\r?\n/).filter(Boolean).at(-1) || '';
    const previewId = `${formId}-${fieldName}-preview`;
    let preview = document.getElementById(previewId);
    if (!preview) {
      preview = document.createElement('div');
      preview.id = previewId;
      preview.className = 'admin-field-preview mt-3 hidden';
      const anchor = field.closest('.join') || field;
      anchor.insertAdjacentElement('afterend', preview);
    }
    if (!value) {
      preview.classList.add('hidden');
      preview.innerHTML = '';
      return;
    }
    preview.classList.remove('hidden');
    if (/\.(mp3|wav|ogg|flac|m4a|aac)(\?|#|$)/i.test(value)) {
      preview.innerHTML = `<audio controls src="${html(value)}"></audio>`;
    } else {
      preview.innerHTML = `<img src="${html(value)}" alt="预览" />`;
    }
  }
  window.updateAdminFieldPreview = updateFieldPreview;

  function fill(form, item, fields) {
    fields.forEach((field) => {
      const input = form.elements.namedItem(field);
      if (!input) return;
      if (input.type === 'checkbox') input.checked = item[field] === true || item[field] === 1;
      else input.value = item[field] ?? '';
      updateFieldPreview(form.id, field);
    });
  }

  function resetForm(formId) {
    const form = $(`#${formId}`);
    form?.reset();
    form?.elements.namedItem('id') && (form.elements.namedItem('id').value = '');
    const active = form?.elements.namedItem('is_active');
    if (active) active.checked = true;
  }

  function parsePlayLinks(value) {
    if (Array.isArray(value)) return value;
    const text = String(value || '').trim();
    if (!text) return [];
    try {
      const parsed = JSON.parse(text);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return text.split(/\r?\n/).map((line) => {
        const [name, ...urlParts] = line.split('|');
        return { name: name?.trim() || '播放链接', url: urlParts.join('|').trim() };
      }).filter((link) => link.url);
    }
  }

  function playLinksToText(value) {
    return parsePlayLinks(value).map((link) => `${link.name || '播放链接'}|${link.url || ''}${link.remark ? `|${link.remark}` : ''}`).join('\n');
  }

  function fillBangumiSource(item) {
    const form = $('#bangumi-form');
    if (!form) return;
    fill(form, {
      external_id: item.external_id || '',
      title: item.title || '',
      original_title: item.original_title || '',
      cover: item.cover || '',
      url: item.url || '',
      type: item.type || '',
      total_episodes: item.total_episodes || '',
      rating: item.rating || '',
      season: item.season || '',
      summary: item.summary || '',
    }, ['external_id', 'title', 'original_title', 'cover', 'url', 'type', 'total_episodes', 'rating', 'season', 'summary']);
    setPanelMessage('bangumi-message', '已导入数据源信息，可继续编辑播放链接后保存');
  }

  function selectedExtraIds(type) {
    return Array.from(document.querySelectorAll(`[data-extra-select="${type}"]:checked`)).map((input) => input.value);
  }

  async function batchDeleteExtra(type) {
    const ids = selectedExtraIds(type);
    const labels = { navigation: '导航', bangumi: '追番', album: '相册' };
    if (!ids.length) {
      window.notifyAdmin?.(`请先勾选要删除的${labels[type] || '项目'}`, true);
      return;
    }
    if (!confirm(`确认删除选中的 ${ids.length} 项${labels[type] || ''}吗？`)) return;
    const paths = {
      navigation: '/admin/navigation',
      bangumi: '/admin/bangumi',
      album: '/admin/albums',
    };
    try {
      for (const id of ids) {
        await api(`${paths[type]}/${id}`, { method: 'DELETE' });
      }
      if (type === 'navigation') await loadNavigation();
      if (type === 'bangumi') await loadBangumi();
      if (type === 'album') await loadAlbums();
      window.notifyAdmin?.(`已删除 ${ids.length} 项${labels[type] || ''}`);
    } catch (error) {
      window.notifyAdmin?.(error.message || `批量删除${labels[type] || '项目'}失败`, true);
    }
  }

  async function moveExtra(type, id, direction) {
    const collections = {
      navigation: state.navigation,
      bangumi: state.bangumi,
      album: state.albums,
    };
    const paths = {
      navigation: '/admin/navigation',
      bangumi: '/admin/bangumi',
      album: '/admin/albums',
    };
    const items = [...(collections[type] || [])].sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || Number(b.id) - Number(a.id));
    const index = items.findIndex((item) => String(item.id) === String(id));
    const nextIndex = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return;
    const current = items[index];
    const target = items[nextIndex];
    const currentOrder = Number(current.sort_order || 0);
    const targetOrder = Number(target.sort_order || 0);
    try {
      await api(`${paths[type]}/${current.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: targetOrder }) });
      await api(`${paths[type]}/${target.id}`, { method: 'PUT', body: JSON.stringify({ sort_order: currentOrder }) });
      if (type === 'navigation') await loadNavigation();
      if (type === 'bangumi') await loadBangumi();
      if (type === 'album') await loadAlbums();
      window.notifyAdmin?.('排序已更新');
    } catch (error) {
      window.notifyAdmin?.(error.message || '调整排序失败', true);
    }
  }

  async function loadNavigation() {
    const json = await api('/admin/navigation');
    state.navigation = json.data || [];
    const list = $('#navigation-list');
    if (!list) return;
    list.innerHTML = `
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm text-base-content/50">共 ${state.navigation.length} 个资源</span>
        <button class="btn btn-sm btn-error rounded-xl" type="button" data-extra-batch-delete="navigation">批量删除</button>
      </div>
      ${state.navigation.map((item) => `
        <div class="rounded-2xl bg-base-100/65 p-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex min-w-0 flex-1 items-start gap-3">
              <input class="checkbox checkbox-sm mt-1" type="checkbox" value="${item.id}" data-extra-select="navigation" />
              <div class="min-w-0">
                <p class="font-black">${html(item.icon || '◇')} ${html(item.title)} ${item.is_active ? '' : '<span class="badge badge-ghost">隐藏</span>'}</p>
                <p class="text-xs text-base-content/45">${html(item.category || '默认')} · ${html(item.url)} · 排序 ${Number(item.sort_order || 0)}</p>
                <p class="mt-1 text-sm text-base-content/60">${html(item.description || '')}</p>
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-xs rounded-lg" type="button" data-extra-move="navigation" data-id="${item.id}" data-direction="up">上移</button>
              <button class="btn btn-xs rounded-lg" type="button" data-extra-move="navigation" data-id="${item.id}" data-direction="down">下移</button>
              <button class="btn btn-xs rounded-lg" type="button" data-extra-edit-navigation="${item.id}">编辑</button>
              <button class="btn btn-xs btn-error rounded-lg" type="button" data-extra-delete-navigation="${item.id}">删除</button>
            </div>
          </div>
        </div>
      `).join('') || '<p class="text-base-content/45">暂无导航数据</p>'}
    `;
  }

  async function searchBangumiSource() {
    const input = $('#bangumi-source-query');
    const results = $('#bangumi-source-results');
    const keyword = String(input?.value || '').trim();
    if (!keyword) {
      setPanelMessage('bangumi-message', '请输入番剧名称或 Bangumi ID', true);
      return;
    }
    if (results) results.innerHTML = '<p class="text-sm text-base-content/50">正在检索数据源...</p>';
    try {
      const param = /^\d+$/.test(keyword) ? `id=${encodeURIComponent(keyword)}` : `q=${encodeURIComponent(keyword)}`;
      const json = await api(`/admin/bangumi/search?${param}`);
      const items = json.data || [];
      if (!results) return;
      results.innerHTML = items.map((item) => `
        <button class="rounded-2xl border border-base-content/10 bg-base-100/70 p-3 text-left transition hover:border-primary" type="button" data-import-bangumi-source="${html(encodeURIComponent(JSON.stringify(item)))}">
          <div class="flex gap-3">
            <div class="h-24 w-16 shrink-0 overflow-hidden rounded-xl bg-base-200">${item.cover ? `<img class="h-full w-full object-cover" src="${html(item.cover)}" alt="" />` : ''}</div>
            <div class="min-w-0">
              <p class="font-black">${html(item.title || '未命名作品')}</p>
              <p class="text-xs text-base-content/45">Bangumi ${html(item.external_id || '-')} · ${html(item.type || '未知类型')} · ${html(item.season || '未标日期')} · ${Number(item.rating || 0).toFixed(1)}</p>
              <p class="mt-1 line-clamp-2 text-sm text-base-content/60">${html(item.summary || '')}</p>
            </div>
          </div>
        </button>
      `).join('') || '<p class="text-sm text-base-content/45">没有检索到结果</p>';
    } catch (error) {
      if (results) results.innerHTML = `<p class="text-sm text-error">${html(error.message || '数据源检索失败')}</p>`;
    }
  }

  async function loadBangumi() {
    const json = await api('/admin/bangumi');
    state.bangumi = json.data || [];
    const list = $('#bangumi-list');
    if (!list) return;
    list.innerHTML = `
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm text-base-content/50">共 ${state.bangumi.length} 个作品</span>
        <button class="btn btn-sm btn-error rounded-xl" type="button" data-extra-batch-delete="bangumi">批量删除</button>
      </div>
      ${state.bangumi.map((item) => `
        <div class="rounded-2xl bg-base-100/65 p-4">
          <div class="flex flex-wrap items-center gap-3">
            <input class="checkbox checkbox-sm" type="checkbox" value="${item.id}" data-extra-select="bangumi" />
            <div class="h-20 w-14 overflow-hidden rounded-xl bg-base-200">${item.cover ? `<img class="h-full w-full object-cover" src="${html(item.cover)}" alt="" />` : ''}</div>
            <div class="min-w-0 flex-1">
              <p class="font-black">${html(item.title)} ${item.is_active ? '' : '<span class="badge badge-ghost">隐藏</span>'}</p>
              <p class="text-xs text-base-content/45">${html(item.status || 'watching')} · ${html(item.progress || '未填进度')} · 评分 ${Number(item.rating || 0).toFixed(1)} · 排序 ${Number(item.sort_order || 0)}</p>
              <p class="mt-1 line-clamp-2 text-sm text-base-content/60">${html(item.summary || '')}</p>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-xs rounded-lg" type="button" data-extra-move="bangumi" data-id="${item.id}" data-direction="up">上移</button>
              <button class="btn btn-xs rounded-lg" type="button" data-extra-move="bangumi" data-id="${item.id}" data-direction="down">下移</button>
              <button class="btn btn-xs rounded-lg" type="button" data-extra-edit-bangumi="${item.id}">编辑</button>
              <button class="btn btn-xs btn-error rounded-lg" type="button" data-extra-delete-bangumi="${item.id}">删除</button>
            </div>
          </div>
        </div>
      `).join('') || '<p class="text-base-content/45">暂无追番数据</p>'}
    `;
  }

  async function loadAlbums() {
    const json = await api('/admin/albums');
    state.albums = json.data || [];
    const selector = $('#album-photo-form')?.elements.namedItem('album_id');
    if (selector) {
      selector.innerHTML = state.albums.map((album) => `<option value="${album.id}">${html(album.title)}</option>`).join('');
    }
    const list = $('#albums-list');
    if (!list) return;
    list.innerHTML = `
      <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span class="text-sm text-base-content/50">共 ${state.albums.length} 个相册</span>
        <button class="btn btn-sm btn-error rounded-xl" type="button" data-extra-batch-delete="album">批量删除</button>
      </div>
      ${state.albums.map((album) => `
        <div class="rounded-2xl bg-base-100/65 p-4">
          <div class="flex flex-wrap items-start gap-3">
            <input class="checkbox checkbox-sm mt-1" type="checkbox" value="${album.id}" data-extra-select="album" />
            <div class="h-20 w-28 overflow-hidden rounded-xl bg-base-200">${album.cover ? `<img class="h-full w-full object-cover" src="${html(album.cover)}" alt="" />` : ''}</div>
            <div class="min-w-0 flex-1">
              <p class="font-black">${html(album.icon || '▧')} ${html(album.title)} ${album.is_active ? '' : '<span class="badge badge-ghost">隐藏</span>'}</p>
              <p class="text-xs text-base-content/45">${html(album.event_date || '未标日期')} · ${html(album.location || '未标地点')} · ${(album.photos || []).length} 张照片 · 排序 ${Number(album.sort_order || 0)}</p>
              <p class="mt-1 line-clamp-2 text-sm text-base-content/60">${html(album.description || '')}</p>
              <div class="mt-3 flex flex-wrap gap-2">
                ${(album.photos || []).map((photo) => `
                  <span class="inline-flex items-center gap-2 rounded-xl bg-base-200/80 px-2 py-1 text-xs">
                    ${html(photo.title || '照片')}
                    <button class="text-error" type="button" data-extra-delete-photo="${photo.id}">删除</button>
                  </span>
                `).join('')}
              </div>
            </div>
            <div class="flex flex-wrap gap-2">
              <button class="btn btn-xs rounded-lg" type="button" data-extra-move="album" data-id="${album.id}" data-direction="up">上移</button>
              <button class="btn btn-xs rounded-lg" type="button" data-extra-move="album" data-id="${album.id}" data-direction="down">下移</button>
              <button class="btn btn-xs rounded-lg" type="button" data-extra-edit-album="${album.id}">编辑</button>
              <button class="btn btn-xs btn-error rounded-lg" type="button" data-extra-delete-album="${album.id}">删除</button>
            </div>
          </div>
        </div>
      `).join('') || '<p class="text-base-content/45">暂无相册数据</p>'}
    `;
  }

  async function loadPanel(panel) {
    if (!token()) return;
    try {
      if (panel === 'navigation') await loadNavigation();
      if (panel === 'bangumi') await loadBangumi();
      if (panel === 'albums') await loadAlbums();
    } catch (error) {
      console.warn(error);
    }
  }

  $('#navigation-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const form = event.currentTarget;
      const fields = form.elements;
      const id = fields.namedItem('id').value;
      const payload = {
        title: fields.namedItem('title').value.trim(),
        url: fields.namedItem('url').value.trim(),
        category: fields.namedItem('category').value.trim() || '默认',
        icon: fields.namedItem('icon').value.trim(),
        avatar: fields.namedItem('avatar').value.trim(),
        sort_order: Number(fields.namedItem('sort_order').value || 0),
        description: fields.namedItem('description').value.trim(),
        is_active: fields.namedItem('is_active').checked,
      };
      await api(id ? `/admin/navigation/${id}` : '/admin/navigation', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setPanelMessage('navigation-message', '导航已保存');
      resetForm('navigation-form');
      await loadNavigation();
    } catch (error) {
      setPanelMessage('navigation-message', error.message || '导航保存失败', true);
    }
  });

  $('#bangumi-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const form = event.currentTarget;
      const fields = form.elements;
      const id = fields.namedItem('id').value;
      const payload = {
        title: fields.namedItem('title').value.trim(),
        original_title: fields.namedItem('original_title').value.trim(),
        cover: fields.namedItem('cover').value.trim(),
        url: fields.namedItem('url').value.trim(),
        external_id: fields.namedItem('external_id').value.trim(),
        source: fields.namedItem('external_id').value.trim() ? 'bangumi' : '',
        type: fields.namedItem('type').value.trim(),
        total_episodes: Number(fields.namedItem('total_episodes').value || 0),
        play_links: parsePlayLinks(fields.namedItem('play_links').value),
        status: fields.namedItem('status').value,
        progress: fields.namedItem('progress').value.trim(),
        rating: Number(fields.namedItem('rating').value || 0),
        season: fields.namedItem('season').value.trim(),
        sort_order: Number(fields.namedItem('sort_order').value || 0),
        summary: fields.namedItem('summary').value.trim(),
        is_active: fields.namedItem('is_active').checked,
      };
      await api(id ? `/admin/bangumi/${id}` : '/admin/bangumi', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setPanelMessage('bangumi-message', '追番已保存');
      resetForm('bangumi-form');
      await loadBangumi();
    } catch (error) {
      setPanelMessage('bangumi-message', error.message || '追番保存失败', true);
    }
  });

  $('#album-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const form = event.currentTarget;
      const fields = form.elements;
      const id = fields.namedItem('id').value;
      const payload = {
        title: fields.namedItem('title').value.trim(),
        cover: fields.namedItem('cover').value.trim(),
        event_date: fields.namedItem('event_date').value,
        location: fields.namedItem('location').value.trim(),
        icon: fields.namedItem('icon').value.trim(),
        sort_order: Number(fields.namedItem('sort_order').value || 0),
        description: fields.namedItem('description').value.trim(),
        is_active: fields.namedItem('is_active').checked,
      };
      await api(id ? `/admin/albums/${id}` : '/admin/albums', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) });
      setPanelMessage('album-message', '相册已保存');
      resetForm('album-form');
      await loadAlbums();
    } catch (error) {
      setPanelMessage('album-message', error.message || '相册保存失败', true);
    }
  });

  $('#album-photo-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const fields = event.currentTarget.elements;
      await api('/admin/album-photos', {
        method: 'POST',
        body: JSON.stringify({
          album_id: Number(fields.namedItem('album_id').value),
          image: fields.namedItem('image').value.trim(),
          title: fields.namedItem('title').value.trim(),
          variant: fields.namedItem('variant').value,
          sort_order: Number(fields.namedItem('sort_order').value || 0),
          description: fields.namedItem('description').value.trim(),
        }),
      });
      setPanelMessage('album-photo-message', '照片已添加');
      event.currentTarget.reset();
      await loadAlbums();
    } catch (error) {
      setPanelMessage('album-photo-message', error.message || '照片添加失败', true);
    }
  });

  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button');
    if (!target) return;
    if (target.dataset.importBangumiSource) {
      try {
        fillBangumiSource(JSON.parse(decodeURIComponent(target.dataset.importBangumiSource)));
      } catch {
        setPanelMessage('bangumi-message', '导入数据源结果失败', true);
      }
    }
    if (target.dataset.pickMedia !== undefined) {
      await openMediaPicker({
        form: target.dataset.targetForm,
        field: target.dataset.targetField,
        type: target.dataset.mediaType || '',
        append: target.dataset.appendMedia === 'true',
      });
      return;
    }
    if (target.dataset.chooseMedia) {
      if (state.mediaPicker) setTargetValue(state.mediaPicker, target.dataset.chooseMedia);
      $('#media-picker-dialog')?.close();
      return;
    }
    if (target.dataset.extraBatchDelete) {
      await batchDeleteExtra(target.dataset.extraBatchDelete);
      return;
    }
    if (target.dataset.extraMove) {
      await moveExtra(target.dataset.extraMove, target.dataset.id, target.dataset.direction);
      return;
    }
    const panel = target.dataset.panel;
    if (panel) loadPanel(panel);
    if (target.dataset.resetExtra) resetForm(`${target.dataset.resetExtra}-form`);
    if (target.dataset.extraEditNavigation) {
      const item = state.navigation.find((row) => String(row.id) === target.dataset.extraEditNavigation);
      if (item) fill($('#navigation-form'), item, ['id', 'title', 'url', 'category', 'icon', 'avatar', 'sort_order', 'description', 'is_active']);
    }
    if (target.dataset.extraDeleteNavigation && confirm('确认删除这个导航吗？')) {
      try {
        await api(`/admin/navigation/${target.dataset.extraDeleteNavigation}`, { method: 'DELETE' });
        await loadNavigation();
        window.notifyAdmin?.('导航已删除');
      } catch (error) {
        window.notifyAdmin?.(error.message || '删除导航失败', true);
      }
    }
    if (target.dataset.extraEditBangumi) {
      const item = state.bangumi.find((row) => String(row.id) === target.dataset.extraEditBangumi);
      if (item) fill($('#bangumi-form'), { ...item, play_links: playLinksToText(item.play_links) }, ['id', 'title', 'original_title', 'cover', 'url', 'external_id', 'type', 'total_episodes', 'play_links', 'status', 'progress', 'rating', 'season', 'sort_order', 'summary', 'is_active']);
    }
    if (target.dataset.extraDeleteBangumi && confirm('确认删除这个追番吗？')) {
      try {
        await api(`/admin/bangumi/${target.dataset.extraDeleteBangumi}`, { method: 'DELETE' });
        await loadBangumi();
        window.notifyAdmin?.('追番已删除');
      } catch (error) {
        window.notifyAdmin?.(error.message || '删除追番失败', true);
      }
    }
    if (target.dataset.extraEditAlbum) {
      const item = state.albums.find((row) => String(row.id) === target.dataset.extraEditAlbum);
      if (item) fill($('#album-form'), item, ['id', 'title', 'cover', 'event_date', 'location', 'icon', 'sort_order', 'description', 'is_active']);
    }
    if (target.dataset.extraDeleteAlbum && confirm('确认删除这个相册及其照片吗？')) {
      try {
        await api(`/admin/albums/${target.dataset.extraDeleteAlbum}`, { method: 'DELETE' });
        await loadAlbums();
        window.notifyAdmin?.('相册已删除');
      } catch (error) {
        window.notifyAdmin?.(error.message || '删除相册失败', true);
      }
    }
    if (target.dataset.extraDeletePhoto && confirm('确认删除这张照片吗？')) {
      try {
        await api(`/admin/album-photos/${target.dataset.extraDeletePhoto}`, { method: 'DELETE' });
        await loadAlbums();
        window.notifyAdmin?.('照片已删除');
      } catch (error) {
        window.notifyAdmin?.(error.message || '删除照片失败', true);
      }
    }
  });

  $('#bangumi-source-search')?.addEventListener('click', searchBangumiSource);
  $('#bangumi-source-query')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchBangumiSource();
    }
  });
  $('#bangumi-source-clear')?.addEventListener('click', () => {
    const results = $('#bangumi-source-results');
    if (results) results.innerHTML = '';
  });

  $('#bangumi-cover-upload')?.addEventListener('change', async (event) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      $('#bangumi-form').elements.namedItem('cover').value = await upload(file);
      updateFieldPreview('bangumi-form', 'cover');
      setPanelMessage('bangumi-message', '封面上传成功');
    } catch (error) {
      setPanelMessage('bangumi-message', error.message || '封面上传失败', true);
    }
  });
  $('#navigation-avatar-upload')?.addEventListener('change', async (event) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      $('#navigation-form').elements.namedItem('avatar').value = await upload(file);
      updateFieldPreview('navigation-form', 'avatar');
      setPanelMessage('navigation-message', '图片上传成功');
    } catch (error) {
      setPanelMessage('navigation-message', error.message || '图片上传失败', true);
    }
  });
  $('#album-cover-upload')?.addEventListener('change', async (event) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      $('#album-form').elements.namedItem('cover').value = await upload(file);
      updateFieldPreview('album-form', 'cover');
      setPanelMessage('album-message', '封面上传成功');
    } catch (error) {
      setPanelMessage('album-message', error.message || '封面上传失败', true);
    }
  });
  $('#album-photo-upload')?.addEventListener('change', async (event) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      $('#album-photo-form').elements.namedItem('image').value = await upload(file);
      updateFieldPreview('album-photo-form', 'image');
      setPanelMessage('album-photo-message', '照片上传成功');
    } catch (error) {
      setPanelMessage('album-photo-message', error.message || '照片上传失败', true);
    }
  });
  $('#close-media-picker')?.addEventListener('click', () => {
    $('#media-picker-dialog')?.close();
  });
  $('#media-picker-search')?.addEventListener('input', renderMediaPicker);
  $('#media-picker-type')?.addEventListener('change', reloadMediaPickerItems);
  [
    ['article-form', 'cover_image'],
    ['music-form', 'url'],
    ['music-form', 'cover'],
    ['music-playlist-form', 'cover'],
    ['account-form', 'avatar'],
    ['profile-form', 'profile_avatar'],
    ['navigation-form', 'avatar'],
    ['bangumi-form', 'cover'],
    ['album-form', 'cover'],
    ['album-photo-form', 'image'],
  ].forEach(([formId, fieldName]) => {
    const field = document.getElementById(formId)?.elements.namedItem(fieldName);
    field?.addEventListener('input', () => updateFieldPreview(formId, fieldName));
    updateFieldPreview(formId, fieldName);
  });
})();
