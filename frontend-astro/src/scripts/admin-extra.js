(() => {
  const root = document.querySelector('.admin-shell');
  const apiBase = root?.dataset.apiBase || '/api';
  const tokenKey = 'boke_admin_token';
  const state = {
    navigation: [],
    bangumi: [],
    albums: [],
    bangumiSourceItems: [],
    bangumiSourcePage: 0,
    bangumiPlaySources: [],
    activeAlbumId: null,
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

  function setupCollectionDialogs() {
    const moveForm = (formId, hostId) => {
      const form = document.getElementById(formId);
      const host = document.getElementById(hostId);
      if (!form || !host || form.parentElement === host) return;
      form.className = 'grid gap-4';
      host.append(form);
    };
    moveForm('navigation-form', 'navigation-form-host');
    moveForm('album-form', 'album-form-host');
    moveForm('album-photo-form', 'album-photo-form-host');
    const photoForm = $('#album-photo-form');
    if (photoForm && !photoForm.elements.namedItem('id')) {
      const idField = document.createElement('input');
      idField.type = 'hidden';
      idField.name = 'id';
      photoForm.prepend(idField);
    }

    const addListHeader = (listId, title, description, buttonId, buttonLabel) => {
      const list = document.getElementById(listId);
      const card = list?.closest('.ryu-card');
      if (!card || card.querySelector(`#${buttonId}`)) return;
      card.classList.add('admin-collection-panel');
      const oldTitle = card.querySelector('h3');
      const header = document.createElement('div');
      header.className = 'admin-collection-header';
      header.innerHTML = `
        <div>
          <h2>${html(title)}</h2>
          <p>${html(description)}</p>
        </div>
        <div class="admin-collection-header-actions">
          <button id="${buttonId}" class="ryu-btn-primary" type="button">${html(buttonLabel)}</button>
        </div>
      `;
      oldTitle?.replaceWith(header);
    };
    addListHeader('navigation-list', '导航列表', '新增和编辑通过弹窗完成，页面只展示资源列表。', 'navigation-create', '新增导航');
    addListHeader('albums-list', '相册列表', '点击相册管理其中的全部照片。', 'album-create', '新建相册');

    const navigationHeader = $('#navigation-list')?.closest('.ryu-card')?.querySelector('.admin-collection-header');
    if (navigationHeader && !$('#navigation-import')) {
      const actions = navigationHeader.querySelector('button')?.parentElement || navigationHeader;
      actions.insertAdjacentHTML('afterbegin', `
        <button id="navigation-import" class="btn btn-sm rounded-xl" type="button">导入书签</button>
        <button id="navigation-export" class="btn btn-sm rounded-xl" type="button">导出书签</button>
        <input id="navigation-import-file" type="file" accept=".html,.htm,text/html" hidden />
      `);
    }

    const photoAlbumSelect = $('#album-photo-form')?.elements.namedItem('album_id');
    if (photoAlbumSelect) photoAlbumSelect.classList.add('hidden');
  }

  function openNavigationDialog(item = null) {
    resetForm('navigation-form');
    if (item) fill($('#navigation-form'), item, ['id', 'title', 'url', 'category', 'icon', 'avatar', 'sort_order', 'description', 'is_active']);
    $('#navigation-dialog-title').textContent = item ? '编辑导航' : '新增导航';
    setPanelMessage('navigation-message', '');
    $('#navigation-dialog')?.showModal();
  }

  function openAlbumDialog(item = null) {
    resetForm('album-form');
    if (item) fill($('#album-form'), item, ['id', 'title', 'cover', 'event_date', 'location', 'icon', 'sort_order', 'description', 'is_active']);
    $('#album-dialog-title').textContent = item ? '编辑相册' : '新建相册';
    setPanelMessage('album-message', '');
    $('#album-dialog')?.showModal();
  }

  function activeAlbum() {
    return state.albums.find((album) => String(album.id) === String(state.activeAlbumId));
  }

  function renderAlbumPhotos() {
    const album = activeAlbum();
    const grid = $('#album-photos-grid');
    if (!album || !grid) return;
    const photos = album.photos || [];
    $('#album-photos-title').textContent = album.title || '相册照片';
    $('#album-photos-meta').textContent = `${photos.length} 张照片 · ${album.location || '未设置地点'}`;
    grid.innerHTML = photos.map((photo) => `
      <article class="admin-photo-card">
        <img src="${html(photo.image)}" alt="${html(photo.title || album.title || '照片')}" loading="lazy" decoding="async" />
        <div class="admin-photo-card-body">
          <strong>${html(photo.title || '未命名照片')}</strong>
          <small>${html(photo.variant || '1x1')} · 排序 ${Number(photo.sort_order || 0)}</small>
          <div class="admin-photo-actions">
            <a class="btn btn-xs rounded-lg" href="${html(photo.image)}" download target="_blank" rel="noopener">下载</a>
            <button class="btn btn-xs rounded-lg" type="button" data-extra-edit-photo="${photo.id}">编辑</button>
            <button class="btn btn-xs btn-error rounded-lg" type="button" data-extra-delete-photo="${photo.id}">删除</button>
          </div>
        </div>
      </article>
    `).join('') || '<div class="admin-collection-empty">这个相册还没有照片，点击“上传图片”添加第一张。</div>';
  }

  function openAlbumPhotos(albumId) {
    state.activeAlbumId = Number(albumId);
    renderAlbumPhotos();
    $('#album-photos-dialog')?.showModal();
  }

  function openPhotoDialog(photo = null, image = '') {
    const form = $('#album-photo-form');
    resetForm('album-photo-form');
    form.elements.namedItem('album_id').value = state.activeAlbumId || '';
    if (photo) fill(form, photo, ['id', 'image', 'title', 'variant', 'sort_order', 'description']);
    if (image) form.elements.namedItem('image').value = image;
    updateFieldPreview('album-photo-form', 'image');
    $('#album-photo-dialog-title').textContent = photo ? '编辑照片信息' : '填写照片信息';
    setPanelMessage('album-photo-message', '');
    $('#album-photo-dialog')?.showModal();
  }

  function renderNavigationCollection() {
    const list = $('#navigation-list');
    if (!list) return;
    list.className = 'admin-collection-grid mt-5';
    list.innerHTML = state.navigation.map((item) => `
      <article class="admin-resource-card" draggable="true" data-navigation-drag-id="${item.id}">
        <span class="admin-drag-handle" title="拖拽排序" aria-hidden="true">⋮⋮</span>
        <div class="admin-resource-logo">
          ${item.avatar ? `<img src="${html(item.avatar)}" alt="" loading="lazy" decoding="async" />` : `<span>${html(item.icon || item.title?.slice(0, 1) || 'N')}</span>`}
        </div>
        <div class="min-w-0">
          <strong>${html(item.title)}</strong>
          <small>${html(item.category || '默认')} · 排序 ${Number(item.sort_order || 0)}${item.is_active ? '' : ' · 已隐藏'}</small>
          <p>${html(item.description || item.url || '')}</p>
        </div>
        <div class="admin-card-actions">
          <button class="btn btn-xs rounded-lg" type="button" data-extra-move="navigation" data-id="${item.id}" data-direction="up">上移</button>
          <button class="btn btn-xs rounded-lg" type="button" data-extra-move="navigation" data-id="${item.id}" data-direction="down">下移</button>
          <button class="btn btn-xs rounded-lg" type="button" data-extra-edit-navigation="${item.id}">编辑</button>
          <button class="btn btn-xs btn-error rounded-lg" type="button" data-extra-delete-navigation="${item.id}">删除</button>
        </div>
      </article>
    `).join('') || '<div class="admin-collection-empty">还没有导航资源。</div>';
  }

  async function saveNavigationOrder() {
    const ids = Array.from($('#navigation-list')?.querySelectorAll('[data-navigation-drag-id]') || [])
      .map((item) => Number(item.dataset.navigationDragId));
    if (!ids.length) return;
    try {
      await api('/admin/navigation/reorder', { method: 'PUT', body: JSON.stringify({ ids }) });
      await loadNavigation();
      window.notifyAdmin?.('导航排序已保存');
    } catch (error) {
      await loadNavigation().catch(() => {});
      window.notifyAdmin?.(error.message || '保存排序失败', true);
    }
  }

  function setupNavigationDrag() {
    const list = $('#navigation-list');
    if (!list || list.dataset.dragReady) return;
    list.dataset.dragReady = 'true';
    list.addEventListener('dragstart', (event) => {
      const card = event.target.closest('[data-navigation-drag-id]');
      if (!card) return;
      card.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', card.dataset.navigationDragId || '');
    });
    list.addEventListener('dragover', (event) => {
      const dragging = list.querySelector('.is-dragging');
      const target = event.target.closest('[data-navigation-drag-id]');
      if (!dragging || !target || dragging === target) return;
      event.preventDefault();
      const bounds = target.getBoundingClientRect();
      const before = event.clientY < bounds.top + bounds.height / 2;
      list.insertBefore(dragging, before ? target : target.nextElementSibling);
    });
    list.addEventListener('drop', (event) => {
      if (!list.querySelector('.is-dragging')) return;
      event.preventDefault();
      saveNavigationOrder();
    });
    list.addEventListener('dragend', () => list.querySelector('.is-dragging')?.classList.remove('is-dragging'));
  }

  function bookmarkCategory(anchor) {
    let node = anchor.parentElement;
    while (node) {
      if (node.tagName === 'DL') {
        const heading = node.previousElementSibling;
        if (heading?.tagName === 'H3' && heading.textContent?.trim()) return heading.textContent.trim();
      }
      node = node.parentElement;
    }
    return '导入书签';
  }

  async function importNavigationBookmarks(file) {
    const source = await file.text();
    const documentHtml = new DOMParser().parseFromString(source, 'text/html');
    const items = Array.from(documentHtml.querySelectorAll('a[href]')).slice(0, 500).map((anchor) => ({
      title: anchor.textContent?.trim() || anchor.getAttribute('href'),
      url: anchor.getAttribute('href'),
      category: bookmarkCategory(anchor),
      icon: '◇',
    }));
    if (!items.length) throw new Error('没有从文件中识别到书签');
    const json = await api('/admin/navigation/import', { method: 'POST', body: JSON.stringify({ items }) });
    await loadNavigation();
    window.notifyAdmin?.(`已导入 ${json.data?.imported || 0} 个，跳过 ${json.data?.skipped || 0} 个`);
  }

  function exportNavigationBookmarks() {
    const groups = new Map();
    state.navigation.forEach((item) => {
      const category = item.category || '默认';
      if (!groups.has(category)) groups.set(category, []);
      groups.get(category).push(item);
    });
    const body = Array.from(groups.entries()).map(([category, items]) => `
      <DT><H3>${html(category)}</H3>
      <DL><p>
        ${items.map((item) => `<DT><A HREF="${html(item.url)}">${html(item.title)}</A>${item.description ? `<DD>${html(item.description)}` : ''}`).join('\n')}
      </DL><p>
    `).join('\n');
    const content = `<!DOCTYPE NETSCAPE-Bookmark-file-1>\n<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n<TITLE>博客导航书签</TITLE>\n<H1>博客导航书签</H1>\n<DL><p>${body}</DL><p>`;
    const url = URL.createObjectURL(new Blob([content], { type: 'text/html;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `blog-navigation-${new Date().toISOString().slice(0, 10)}.html`;
    link.click();
    URL.revokeObjectURL(url);
    window.notifyAdmin?.('导航书签已导出');
  }

  function renderAlbumCollection() {
    const list = $('#albums-list');
    if (!list) return;
    list.className = 'admin-album-grid mt-5';
    list.innerHTML = state.albums.map((album) => `
      <article class="admin-album-card">
        <button class="admin-album-open" type="button" data-open-album="${album.id}">
          <span class="admin-album-cover">
            ${album.cover ? `<img src="${html(album.cover)}" alt="" loading="lazy" decoding="async" />` : '<span>暂无封面</span>'}
            <b>${(album.photos || []).length} 张</b>
          </span>
          <span class="admin-album-info">
            <strong>${html(album.icon || '▧')} ${html(album.title)}</strong>
            <small>${html(album.event_date || '未设置日期')} · ${html(album.location || '未设置地点')}</small>
            <span>${html(album.description || '点击查看和管理照片')}</span>
          </span>
        </button>
        <div class="admin-card-actions">
          <button class="btn btn-xs rounded-lg" type="button" data-extra-move="album" data-id="${album.id}" data-direction="up">上移</button>
          <button class="btn btn-xs rounded-lg" type="button" data-extra-move="album" data-id="${album.id}" data-direction="down">下移</button>
          <button class="btn btn-xs rounded-lg" type="button" data-extra-edit-album="${album.id}">编辑</button>
          <button class="btn btn-xs btn-error rounded-lg" type="button" data-extra-delete-album="${album.id}">删除</button>
        </div>
      </article>
    `).join('') || '<div class="admin-collection-empty">还没有相册，点击“新建相册”创建。</div>';
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
        const [name, url, ...remarkParts] = line.split('|');
        return {
          name: name?.trim() || '播放链接',
          url: url?.trim() || '',
          remark: remarkParts.join('|').trim(),
        };
      }).filter((link) => link.url);
    }
  }

  function normalizePlaySources(value) {
    return parsePlayLinks(value)
      .filter((source) => source?.url)
      .map((source, index) => ({
        name: String(source.name || '播放源').trim(),
        url: String(source.url || '').trim(),
        remark: String(source.remark || '').trim(),
        is_default: source.is_default === true || source.is_default === 1,
        sort_order: Number.isFinite(Number(source.sort_order)) ? Number(source.sort_order) : index,
      }));
  }

  function renderBangumiPlaySources() {
    const list = $('#bangumi-play-source-list');
    if (!list) return;
    const sources = [...state.bangumiPlaySources]
      .map((source, index) => ({ ...source, index }))
      .sort((a, b) => Number(a.sort_order || 0) - Number(b.sort_order || 0) || a.index - b.index);
    list.innerHTML = sources.map((source) => `
      <article class="bangumi-play-source-row">
        <span class="min-w-0">
          <strong>${html(source.name || '播放源')}</strong>
          ${source.is_default ? '<b>默认</b>' : ''}
          <small title="${html(source.url)}">${html(source.url)}</small>
          ${source.remark ? `<em>${html(source.remark)}</em>` : ''}
        </span>
        <span class="flex shrink-0 gap-1">
          ${source.is_default
            ? '<button class="btn btn-xs rounded-lg" type="button" data-unset-play-source-default>取消默认</button>'
            : '<button class="btn btn-xs rounded-lg" type="button" data-set-play-source-default>设为默认</button>'}
          <button class="btn btn-xs rounded-lg" type="button" data-edit-play-source>编辑</button>
          <button class="btn btn-xs btn-error rounded-lg" type="button" data-delete-play-source>删除</button>
        </span>
      </article>
    `).join('') || '<div class="bangumi-play-source-empty">尚未添加播放源，前台将显示“未知”。</div>';
    list.querySelectorAll('[data-set-play-source-default], [data-unset-play-source-default], [data-edit-play-source], [data-delete-play-source]')
      .forEach((button) => {
        const row = button.closest('.bangumi-play-source-row');
        const sortedIndex = Array.from(list.children).indexOf(row);
        button.dataset.playSourceIndex = String(sources[sortedIndex]?.index ?? -1);
      });
  }

  function openBangumiPlaySourceDialog(index = -1) {
    const form = $('#bangumi-play-source-form');
    const dialog = $('#bangumi-play-source-dialog');
    if (!form || !dialog) return;
    form.reset();
    const source = state.bangumiPlaySources[index];
    form.elements.namedItem('index').value = index >= 0 ? String(index) : '';
    form.elements.namedItem('name').value = source?.name || '';
    form.elements.namedItem('url').value = source?.url || '';
    form.elements.namedItem('remark').value = source?.remark || '';
    form.elements.namedItem('sort_order').value = String(source?.sort_order ?? state.bangumiPlaySources.length);
    form.elements.namedItem('is_default').checked = Boolean(source?.is_default);
    $('#bangumi-play-source-title').textContent = index >= 0 ? '编辑播放源' : '新增播放源';
    dialog.showModal();
    window.setTimeout(() => form.elements.namedItem('name')?.focus(), 0);
  }

  function setBangumiPlaySourceDefault(index, enabled) {
    state.bangumiPlaySources = state.bangumiPlaySources.map((source, sourceIndex) => ({
      ...source,
      is_default: enabled ? sourceIndex === index : (sourceIndex === index ? false : source.is_default),
    }));
    renderBangumiPlaySources();
  }

  function resetBangumiForm() {
    resetForm('bangumi-form');
    state.bangumiPlaySources = [];
    renderBangumiPlaySources();
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
    $('#bangumi-source-dialog')?.close();
    setPanelMessage('bangumi-message', '已导入番剧信息，可继续添加播放源后保存');
  }

  function renderBangumiSourcePage() {
    const results = $('#bangumi-source-results');
    const pagination = $('#bangumi-source-pagination');
    if (!results || !pagination) return;
    const pageSize = 3;
    const totalPages = Math.max(1, Math.ceil(state.bangumiSourceItems.length / pageSize));
    state.bangumiSourcePage = Math.max(0, Math.min(state.bangumiSourcePage, totalPages - 1));
    const pageItems = state.bangumiSourceItems.slice(
      state.bangumiSourcePage * pageSize,
      (state.bangumiSourcePage + 1) * pageSize,
    );
    results.innerHTML = pageItems.map((item) => `
      <button class="bangumi-source-result" type="button" data-import-bangumi-source="${html(encodeURIComponent(JSON.stringify(item)))}">
        <span class="bangumi-source-cover">
          ${item.cover ? `<img src="${html(item.cover)}" alt="" loading="lazy" decoding="async" />` : '<span>暂无封面</span>'}
        </span>
        <span class="min-w-0">
          <strong>${html(item.title || '未命名作品')}</strong>
          <small>Bangumi ${html(item.external_id || '-')} · ${html(item.type || '未知类型')} · ${html(item.season || '未标日期')} · ${Number(item.rating || 0).toFixed(1)}</small>
          <span class="bangumi-source-summary">${html(item.summary || '暂无简介')}</span>
        </span>
      </button>
    `).join('') || '<p class="py-10 text-center text-sm text-base-content/45">没有检索到结果</p>';
    pagination.classList.toggle('hidden', state.bangumiSourceItems.length <= pageSize);
    pagination.classList.toggle('flex', state.bangumiSourceItems.length > pageSize);
    $('#bangumi-source-page').textContent = `第 ${state.bangumiSourcePage + 1} / ${totalPages} 页`;
    $('#bangumi-source-prev').disabled = state.bangumiSourcePage <= 0;
    $('#bangumi-source-next').disabled = state.bangumiSourcePage >= totalPages - 1;
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
    renderNavigationCollection();
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
      state.bangumiSourceItems = json.data || [];
      state.bangumiSourcePage = 0;
      renderBangumiSourcePage();
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
    renderAlbumCollection();
    if (state.activeAlbumId) renderAlbumPhotos();
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
      $('#navigation-dialog')?.close();
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
        play_sources: state.bangumiPlaySources,
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
      resetBangumiForm();
      await loadBangumi();
    } catch (error) {
      setPanelMessage('bangumi-message', error.message || '追番保存失败', true);
    }
  });

  $('#bangumi-play-source-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const indexValue = fields.namedItem('index').value;
    const index = indexValue === '' ? -1 : Number(indexValue);
    const source = {
      name: fields.namedItem('name').value.trim(),
      url: fields.namedItem('url').value.trim(),
      remark: fields.namedItem('remark').value.trim(),
      is_default: fields.namedItem('is_default').checked,
      sort_order: Number(fields.namedItem('sort_order').value || 0),
    };
    if (!source.name || !source.url) return;
    if (source.is_default) {
      state.bangumiPlaySources = state.bangumiPlaySources.map((item) => ({ ...item, is_default: false }));
    }
    if (index >= 0) state.bangumiPlaySources[index] = source;
    else state.bangumiPlaySources.push(source);
    renderBangumiPlaySources();
    $('#bangumi-play-source-dialog')?.close();
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
      $('#album-dialog')?.close();
    } catch (error) {
      setPanelMessage('album-message', error.message || '相册保存失败', true);
    }
  });

  $('#album-photo-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const fields = event.currentTarget.elements;
      const id = fields.namedItem('id')?.value;
      await api(id ? `/admin/album-photos/${id}` : '/admin/album-photos', {
        method: id ? 'PUT' : 'POST',
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
      $('#album-photo-dialog')?.close();
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
    const panel = target.dataset.panel || target.dataset.panelTab;
    if (panel) loadPanel(panel);
    if (target.dataset.resetExtra) {
      if (target.dataset.resetExtra === 'bangumi') resetBangumiForm();
      else resetForm(`${target.dataset.resetExtra}-form`);
    }
    if (target.dataset.extraEditNavigation) {
      const item = state.navigation.find((row) => String(row.id) === target.dataset.extraEditNavigation);
      if (item) openNavigationDialog(item);
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
      if (item) {
        fill($('#bangumi-form'), item, ['id', 'title', 'original_title', 'cover', 'url', 'external_id', 'type', 'total_episodes', 'status', 'progress', 'rating', 'season', 'sort_order', 'summary', 'is_active']);
        state.bangumiPlaySources = normalizePlaySources(item.play_sources || item.play_links);
        renderBangumiPlaySources();
      }
    }
    if (target.dataset.editPlaySource !== undefined) {
      openBangumiPlaySourceDialog(Number(target.dataset.playSourceIndex));
    }
    if (target.dataset.deletePlaySource !== undefined) {
      const index = Number(target.dataset.playSourceIndex);
      if (Number.isInteger(index) && confirm('确认删除这个播放源吗？')) {
        state.bangumiPlaySources.splice(index, 1);
        renderBangumiPlaySources();
      }
    }
    if (target.dataset.setPlaySourceDefault !== undefined) {
      setBangumiPlaySourceDefault(Number(target.dataset.playSourceIndex), true);
    }
    if (target.dataset.unsetPlaySourceDefault !== undefined) {
      setBangumiPlaySourceDefault(Number(target.dataset.playSourceIndex), false);
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
      if (item) openAlbumDialog(item);
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
        renderAlbumPhotos();
        window.notifyAdmin?.('照片已删除');
      } catch (error) {
        window.notifyAdmin?.(error.message || '删除照片失败', true);
      }
    }
    if (target.dataset.openAlbum) {
      openAlbumPhotos(target.dataset.openAlbum);
    }
    if (target.dataset.extraEditPhoto) {
      const photo = (activeAlbum()?.photos || []).find((item) => String(item.id) === target.dataset.extraEditPhoto);
      if (photo) openPhotoDialog(photo);
    }
  });

  setupCollectionDialogs();
  setupNavigationDrag();
  renderBangumiPlaySources();
  $('#navigation-create')?.addEventListener('click', () => openNavigationDialog());
  $('#navigation-import')?.addEventListener('click', () => $('#navigation-import-file')?.click());
  $('#navigation-export')?.addEventListener('click', exportNavigationBookmarks);
  $('#navigation-import-file')?.addEventListener('change', async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      await importNavigationBookmarks(file);
    } catch (error) {
      window.notifyAdmin?.(error.message || '导入书签失败', true);
    } finally {
      event.target.value = '';
    }
  });
  $('#navigation-dialog-close')?.addEventListener('click', () => $('#navigation-dialog')?.close());
  $('#album-create')?.addEventListener('click', () => openAlbumDialog());
  $('#album-dialog-close')?.addEventListener('click', () => $('#album-dialog')?.close());
  $('#album-photos-close')?.addEventListener('click', () => $('#album-photos-dialog')?.close());
  $('#album-photo-dialog-close')?.addEventListener('click', () => $('#album-photo-dialog')?.close());
  $('#album-photo-create')?.addEventListener('click', () => openPhotoDialog());
  $('#bangumi-play-source-create')?.addEventListener('click', () => openBangumiPlaySourceDialog());
  $('#bangumi-play-source-close')?.addEventListener('click', () => $('#bangumi-play-source-dialog')?.close());
  $('[data-close-play-source]')?.addEventListener('click', () => $('#bangumi-play-source-dialog')?.close());

  $('#bangumi-source-open')?.addEventListener('click', () => {
    $('#bangumi-source-dialog')?.showModal();
    window.setTimeout(() => $('#bangumi-source-query')?.focus(), 0);
  });
  $('#bangumi-source-close')?.addEventListener('click', () => $('#bangumi-source-dialog')?.close());
  $('#bangumi-source-search')?.addEventListener('click', searchBangumiSource);
  $('#bangumi-source-query')?.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchBangumiSource();
    }
  });
  $('#bangumi-source-prev')?.addEventListener('click', () => {
    state.bangumiSourcePage -= 1;
    renderBangumiSourcePage();
  });
  $('#bangumi-source-next')?.addEventListener('click', () => {
    state.bangumiSourcePage += 1;
    renderBangumiSourcePage();
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
  $('#album-photo-bulk-upload')?.addEventListener('change', async (event) => {
    try {
      const file = event.currentTarget.files?.[0];
      if (!file || !state.activeAlbumId) return;
      const image = await upload(file);
      openPhotoDialog(null, image);
      const titleField = $('#album-photo-form')?.elements.namedItem('title');
      if (titleField && !titleField.value) titleField.value = file.name.replace(/\.[^.]+$/, '');
      event.currentTarget.value = '';
    } catch (error) {
      window.notifyAdmin?.(error.message || '照片上传失败', true);
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
