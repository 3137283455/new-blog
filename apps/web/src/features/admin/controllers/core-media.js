export function register(context) {
  context.uploadFile = async function uploadFile(file, folderId = undefined) {
    const body = new FormData();
    body.append('file', file);
    if (folderId !== undefined && folderId !== null) body.append('folder_id', String(folderId));
    const json = await context.request('/admin/media/upload', { method: 'POST', body });
    return { ...json.data, url: json.data?.url || `/uploads/${json.data?.path}` };
  };
  context.loadMedia = async function loadMedia() {
    const sequence = ++context.state.mediaLoadSequence;
    const qs = new URLSearchParams({
      sort: context.state.mediaSort,
      order: context.state.mediaSortOrder,
    });
    if (context.state.mediaCurrentFolderId !== null)
      qs.set('folderId', String(context.state.mediaCurrentFolderId));
    if (context.state.mediaSmartType) qs.set('type', context.state.mediaSmartType);
    if (context.state.mediaTrashMode) qs.set('trashed', 'true');
    const search = (context.$('#media-search')?.value || '').trim();
    if (search) qs.set('search', search);
    const json = await context.request(`/admin/media/explorer?${qs.toString()}`);
    if (sequence !== context.state.mediaLoadSequence) return;
    const data = json.data || {};
    context.state.media = data.files || [];
    context.state.mediaFolders = data.folders || [];
    context.state.mediaAllFolders = data.all_folders || [];
    context.state.mediaBreadcrumb = data.breadcrumb || [];
    context.state.mediaFolderCounts = data.counts || {};
    context.renderMediaExplorer();
  };
  context.isFontMediaExplorer = function isFontMediaExplorer(file) {
    const mime = String(file?.mime_type || '').toLowerCase();
    const name = String(file?.original_name || file?.path || '')
      .split('?')[0]
      .toLowerCase();
    return (
      mime.startsWith('font/') ||
      mime === 'application/vnd.ms-fontobject' ||
      /\.(woff2?|ttf|otf|eot)$/i.test(name)
    );
  };
  context.mediaExplorerEntry = function mediaExplorerEntry(kind, id) {
    const source = kind === 'folder' ? context.state.mediaAllFolders : context.state.media;
    return source.find((entry) => String(entry.id) === String(id));
  };
  context.mediaFolderDepth = function mediaFolderDepth(folder) {
    const byId = new Map(context.state.mediaAllFolders.map((item) => [Number(item.id), item]));
    let depth = 0;
    let current = folder;
    const visited = new Set();
    while (current?.parent_id && !visited.has(current.parent_id) && depth < 6) {
      visited.add(current.parent_id);
      current = byId.get(Number(current.parent_id));
      depth += 1;
    }
    return depth;
  };
  context.orderedMediaFolders = function orderedMediaFolders() {
    const children = new Map();
    context.state.mediaAllFolders.forEach((folder) => {
      const key = folder.parent_id == null ? 'root' : String(folder.parent_id);
      if (!children.has(key)) children.set(key, []);
      children.get(key).push(folder);
    });
    const output = [];
    const walk = (parentId = null) => {
      const key = parentId == null ? 'root' : String(parentId);
      (children.get(key) || [])
        .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'))
        .forEach((folder) => {
          output.push(folder);
          walk(folder.id);
        });
    };
    walk();
    return output;
  };
  context.renderMediaExplorer = function renderMediaExplorer() {
    const grid = context.$('#media-grid');
    if (!grid) return;
    context.$('#media-normal-mode')?.classList.toggle('btn-primary', !context.state.mediaTrashMode);
    context.$('#media-trash-mode')?.classList.toggle('btn-primary', context.state.mediaTrashMode);
    context.$('#cleanup-media')?.classList.toggle('hidden', context.state.mediaTrashMode);
    context.$('#empty-media-trash')?.classList.toggle('hidden', !context.state.mediaTrashMode);
    const canCreate = !context.state.mediaTrashMode && !context.state.mediaSmartType;
    context
      .$('#media-upload')
      ?.closest('label')
      ?.classList.toggle('hidden', context.state.mediaTrashMode);
    context.$('#media-create-folder')?.classList.toggle('hidden', !canCreate);
    context.$('#media-create-file')?.classList.toggle('hidden', !canCreate);
    if (context.$('#media-sort')) context.$('#media-sort').value = context.state.mediaSort;
    if (context.$('#media-sort-order'))
      context.$('#media-sort-order').textContent =
        context.state.mediaSortOrder === 'desc' ? 'DESC \u2193' : 'ASC \u2191';
    const smartFolders = [
      { id: 'image', label: '&#22270;&#29255;', icon: '&#9639;' },
      { id: 'video', label: '&#35270;&#39057;', icon: '&#9654;' },
      { id: 'audio', label: '&#38899;&#39057;', icon: '&#9834;' },
      { id: 'font', label: '&#23383;&#20307;', icon: 'Aa' },
      {
        id: 'document',
        label: '&#25991;&#26723;&#19982;&#21387;&#32553;&#21253;',
        icon: '&#9636;',
      },
      { id: 'other', label: '&#20854;&#20182;&#25991;&#20214;', icon: '&#9671;' },
    ];
    const realFolders = context
      .orderedMediaFolders()
      .map(
        (folder) =>
          `<button class="${!context.state.mediaSmartType && Number(context.state.mediaCurrentFolderId) === Number(folder.id) ? 'is-active' : ''}" type="button" data-media-folder-id="${folder.id}" style="--folder-depth:${context.mediaFolderDepth(folder)}"><i>&#128193;</i><span>${context.escapeHtml(folder.name)}</span></button>`,
      )
      .join('');
    const smart = smartFolders
      .map(
        (folder) =>
          `<button class="${context.state.mediaSmartType === folder.id ? 'is-active' : ''}" type="button" data-media-smart-type="${folder.id}"><i>${folder.icon}</i><span>${folder.label}</span><small>${context.state.mediaFolderCounts[folder.id] || 0}</small></button>`,
      )
      .join('');
    context.$('#media-folder-list').innerHTML = `
    <button class="${!context.state.mediaSmartType && context.state.mediaCurrentFolderId === null ? 'is-active' : ''}" type="button" data-media-folder-id=""><i>&#8962;</i><span>&#23186;&#20307;&#24211;</span><small>${context.state.mediaFolderCounts.all || 0}</small></button>
    ${realFolders || '<p class="admin-media-folder-empty">&#36824;&#27809;&#26377;&#33258;&#24314;&#25991;&#20214;&#22841;</p>'}
    <div class="admin-media-folder-label">&#25353;&#31867;&#22411;&#26597;&#30475;</div>${smart}`;
    const active =
      smartFolders.find((item) => item.id === context.state.mediaSmartType)?.label ||
      (context.state.mediaTrashMode ? '&#22238;&#25910;&#31449;' : '');
    const crumbs =
      context.state.mediaSmartType || context.state.mediaTrashMode
        ? `<button type="button" data-media-breadcrumb-root>&#23186;&#20307;&#24211;</button><b>/</b><strong>${active}</strong>`
        : `<button type="button" data-media-breadcrumb-root>&#23186;&#20307;&#24211;</button>${context.state.mediaBreadcrumb.map((folder) => `<b>/</b><button type="button" data-media-breadcrumb-id="${folder.id}">${context.escapeHtml(folder.name)}</button>`).join('')}`;
    const header = context.$('.admin-media-breadcrumb');
    if (header)
      header.innerHTML = `<nav aria-label="Breadcrumb">${crumbs}</nav><small id="media-file-count">${context.state.mediaFolders.length + context.state.media.length} &#20010;&#39033;&#30446;</small>`;
    const categoryIcons = {
      image: '&#9639;',
      video: '&#9654;',
      audio: '&#9834;',
      font: 'Aa',
      document: '&#9636;',
      other: '&#9671;',
    };
    const categoryLabels = {
      image: '&#22270;&#29255;',
      video: '&#35270;&#39057;',
      audio: '&#38899;&#39057;',
      font: '&#23383;&#20307;',
      document: '&#25991;&#26723;',
      other: '&#25991;&#20214;',
    };
    const folderRows = context.state.mediaFolders
      .map(
        (
          folder,
        ) => `<article class="admin-media-item is-folder" data-media-kind="folder" data-media-id="${folder.id}" tabindex="0">
    <div class="admin-media-file"><div class="admin-media-preview"><span>&#128193;</span></div><div class="admin-media-name"><strong>${context.escapeHtml(folder.name)}</strong><small>&#25991;&#20214;&#22841;</small></div></div>
    <span>&#25991;&#20214;&#22841;</span><span>-</span><span>&#21487;&#29992;</span><time>${context.formatDate(folder.updated_at || folder.created_at)}</time></article>`,
      )
      .join('');
    const fileRows = context.state.media
      .map((file) => {
        const url = file.url || `/uploads/${file.path}`;
        const category = file.category || 'other';
        const image = file.mime_type?.startsWith('image/');
        return `<article class="admin-media-item" data-media-kind="file" data-media-id="${file.id}" tabindex="0">
      <div class="admin-media-file"><div class="admin-media-preview">${image ? `<img src="${context.escapeHtml(url)}" alt="" loading="lazy" decoding="async" />` : `<span>${categoryIcons[category] || '&#9671;'}</span>`}</div><div class="admin-media-name"><strong>${context.escapeHtml(file.original_name || file.filename || 'Untitled')}</strong><small>${context.escapeHtml(file.path || '')}</small></div></div>
      <span>${categoryLabels[category] || '&#25991;&#20214;'}</span><span>${context.formatSize(file.size)}</span><span>${context.state.mediaTrashMode ? '&#22238;&#25910;&#31449;' : '&#21487;&#29992;'}</span><time>${context.formatDate(file.created_at)}</time></article>`;
      })
      .join('');
    grid.innerHTML =
      folderRows + fileRows ||
      '<p class="admin-media-empty">&#36825;&#20010;&#25991;&#20214;&#22841;&#26159;&#31354;&#30340;</p>';
  };
  context.openMediaExplorerEntry = function openMediaExplorerEntry(kind, entry) {
    if (!entry) return;
    if (kind === 'folder') {
      context.state.mediaCurrentFolderId = Number(entry.id);
      context.state.mediaSmartType = '';
      context.loadMedia();
    } else window.open(entry.url || `/uploads/${entry.path}`, '_blank', 'noopener,noreferrer');
  };
  context.closeMediaExplorerContext = function closeMediaExplorerContext() {
    const menu = context.$('#media-context-menu');
    if (menu) menu.hidden = true;
    context.state.mediaContext = null;
  };
  context.showMediaExplorerContext = function showMediaExplorerContext(event, kind, id) {
    const entry = context.mediaExplorerEntry(kind, id);
    const menu = context.$('#media-context-menu');
    if (!entry || !menu) return;
    event.preventDefault();
    context.scope.moveToBody(menu);
    context.state.mediaContext = { kind, id: Number(id) };
    menu.querySelector('[data-media-context="copy"]').hidden = kind === 'folder';
    menu.querySelector('[data-media-context="font"]').hidden =
      context.state.mediaTrashMode || kind === 'folder' || !context.isFontMediaExplorer(entry);
    menu.querySelector('[data-media-context="rename"]').hidden = context.state.mediaTrashMode;
    menu.querySelector('[data-media-context="move"]').hidden = context.state.mediaTrashMode;
    menu.querySelector('[data-media-context="delete"]').hidden = context.state.mediaTrashMode;
    menu.querySelector('[data-media-context="restore"]').hidden =
      !context.state.mediaTrashMode || kind === 'folder';
    menu.querySelector('[data-media-context="force-delete"]').hidden =
      !context.state.mediaTrashMode || kind === 'folder';
    menu.hidden = false;
    const width = menu.offsetWidth;
    const height = menu.offsetHeight;
    menu.style.left = `${Math.max(8, Math.min(event.clientX, window.innerWidth - width - 8))}px`;
    menu.style.top = `${Math.max(8, Math.min(event.clientY, window.innerHeight - height - 8))}px`;
  };
  context.createMediaExplorerEntry = async function createMediaExplorerEntry(kind) {
    const name = window
      .prompt(
        kind === 'folder'
          ? '\u65b0\u5efa\u6587\u4ef6\u5939\u540d\u79f0'
          : '\u65b0\u5efa\u6587\u4ef6\u540d\u79f0',
        kind === 'folder' ? '\u65b0\u5efa\u6587\u4ef6\u5939' : '\u65b0\u5efa\u6587\u4ef6.txt',
      )
      ?.trim();
    if (!name) return;
    try {
      const url = kind === 'folder' ? '/admin/media/folders' : '/admin/media/files';
      const body =
        kind === 'folder'
          ? { name, parent_id: context.state.mediaCurrentFolderId }
          : { name, folder_id: context.state.mediaCurrentFolderId };
      await context.request(url, { method: 'POST', body: JSON.stringify(body) });
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || 'Create failed', true);
    }
  };
  context.renameMediaExplorerEntry = async function renameMediaExplorerEntry(kind, entry) {
    const current = kind === 'folder' ? entry.name : entry.original_name;
    const name = window.prompt('\u8f93\u5165\u65b0\u540d\u79f0', current)?.trim();
    if (!name || name === current) return;
    try {
      const url =
        kind === 'folder' ? `/admin/media/folders/${entry.id}` : `/admin/media/${entry.id}`;
      await context.request(url, { method: 'PUT', body: JSON.stringify({ name }) });
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || 'Rename failed', true);
    }
  };
  context.moveMediaExplorerEntry = async function moveMediaExplorerEntry(kind, entry) {
    const folders = context.state.mediaAllFolders.filter(
      (folder) => kind !== 'folder' || Number(folder.id) !== Number(entry.id),
    );
    const choices = folders.map((folder) => `${folder.id}: ${folder.name}`).join('\n');
    const input = window.prompt(
      `\u8f93\u5165\u76ee\u6807\u6587\u4ef6\u5939\u7f16\u53f7\uff0c\u7559\u7a7a\u79fb\u5230\u6839\u76ee\u5f55\n\n${choices}`,
      '',
    );
    if (input === null) return;
    const folderId = input.trim() ? Number(input.trim()) : null;
    if (folderId !== null && !folders.some((folder) => Number(folder.id) === folderId))
      return context.notify('\u76ee\u6807\u6587\u4ef6\u5939\u4e0d\u5b58\u5728', true);
    try {
      const url =
        kind === 'folder' ? `/admin/media/folders/${entry.id}` : `/admin/media/${entry.id}`;
      await context.request(url, {
        method: 'PUT',
        body: JSON.stringify({ parent_id: folderId, folder_id: folderId }),
      });
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || 'Move failed', true);
    }
  };
  context.deleteMediaExplorerFolder = async function deleteMediaExplorerFolder(folder) {
    if (!confirm(`Delete empty folder "${folder.name}"?`)) return;
    try {
      await context.request(`/admin/media/folders/${folder.id}`, { method: 'DELETE' });
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || 'Delete failed', true);
    }
  };
  context.addFontFromMedia = function addFontFromMedia(id) {
    const file = context.state.media.find((item) => String(item.id) === String(id));
    if (!file) return;
    const url = file.url || `/uploads/${file.path}`;
    const family = String(file.original_name || file.filename || '未命名字体').replace(
      /\.[^.]+$/,
      '',
    );
    context.addFontEntry(family, url, '已从媒体库加入字体库，记得保存字体库');
  };
  context.uploadCover = async function uploadCover(file) {
    context.$('#editor-message').textContent = '正在上传封面...';
    try {
      const media = await context.uploadFile(file);
      context.$('#article-form').elements.namedItem('cover_image').value = media.url;
      window.updateAdminFieldPreview?.('article-form', 'cover_image');
      context.updateCoverPreview(media.url);
      context.$('#editor-message').textContent = '封面上传成功';
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#editor-message').textContent = error.message;
    }
  };
  context.uploadMediaFiles = async function uploadMediaFiles(files) {
    if (!files.length) return;
    context.$('#media-message').textContent = `正在上传 ${files.length} 个文件...`;
    try {
      const uploaded = [];
      for (const file of files) {
        uploaded.push(
          await context.uploadFile(
            file,
            context.state.mediaSmartType ? null : context.state.mediaCurrentFolderId,
          ),
        );
      }
      const categoryLabels = {
        image: '图片',
        video: '视频',
        audio: '音频',
        font: '字体',
        document: '文档',
        other: '其他文件',
      };
      const categories = Array.from(
        new Set(uploaded.map((item) => categoryLabels[item.category] || '其他文件')),
      );
      context.$('#media-message').textContent = `上传完成，已自动归入：${categories.join('、')}`;
      context.notify(`已上传 ${files.length} 个媒体文件`);
      await context.loadMedia();
      await context.loadDashboard();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#media-message').textContent = error.message;
      context.notify(error.message || '上传媒体失败', true);
    }
    if (context.$('#media-upload')) context.$('#media-upload').value = '';
  };
  context.deleteMedia = async function deleteMedia(id) {
    if (!confirm('确认把这个媒体文件移入回收站？')) return;
    try {
      await context.request(`/admin/media/${id}`, { method: 'DELETE' });
      await context.loadMedia();
      await context.loadDashboard();
      context.notify('媒体文件已移入回收站');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '删除媒体失败', true);
    }
  };
  context.restoreMedia = async function restoreMedia(id) {
    try {
      await context.request(`/admin/media/${id}/restore`, { method: 'PUT' });
      context.$('#media-message').textContent = '媒体文件已恢复';
      await context.loadMedia();
      await context.loadDashboard();
      context.notify('媒体文件已恢复');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '恢复媒体失败', true);
    }
  };
  context.forceDeleteMedia = async function forceDeleteMedia(id) {
    if (!confirm('确认永久删除这个媒体文件？删除后磁盘文件也会被移除，不能恢复。')) return;
    try {
      await context.request(`/admin/media/${id}/force`, { method: 'DELETE' });
      context.$('#media-message').textContent = '媒体文件已永久删除';
      await context.loadMedia();
      await context.loadDashboard();
      context.notify('媒体文件已永久删除');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '永久删除媒体失败', true);
    }
  };
  context.cleanupMedia = async function cleanupMedia() {
    if (
      !confirm(
        '确认清理冗余媒体文件？系统会保留正在引用的文件和 1 小时内新上传的文件，其余文件会先移入媒体回收站。',
      )
    )
      return;
    try {
      const json = await context.request('/admin/media/cleanup', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const data = json.data || {};
      const moved = (data.movedFiles || []).slice(0, 5).join('、');
      const kept = (data.keptFiles || [])
        .slice(0, 3)
        .map((item) => `${item.name}（${(item.references || []).join('、')}）`)
        .join('、');
      context.$('#media-message').innerHTML = `
      <span>${context.escapeHtml(json.message || '清理完成')}</span>
      ${moved ? `<br><span class="text-base-content/50">移入回收站：${context.escapeHtml(moved)}</span>` : ''}
      ${kept ? `<br><span class="text-base-content/50">已保留：${context.escapeHtml(kept)}</span>` : ''}
    `;
      await context.loadMedia();
      await context.loadDashboard();
      context.notify(json.message || '冗余媒体已移入回收站');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '清理媒体失败', true);
    }
  };
  context.emptyMediaTrash = async function emptyMediaTrash() {
    if (!context.state.mediaTrashMode) return;
    const removable = context.state.media.filter((file) => !file.in_use);
    const locked = context.state.media.length - removable.length;
    if (!removable.length) {
      context.$('#media-message').textContent = locked
        ? '回收站里的文件仍被引用，不能清空'
        : '媒体回收站为空';
      return;
    }
    if (
      !confirm(
        `确认永久删除 ${removable.length} 个未引用的回收站文件？${locked ? `\n另有 ${locked} 个仍被引用的文件会保留。` : ''}`,
      )
    )
      return;
    let successCount = 0;
    let failedCount = 0;
    for (const file of removable) {
      try {
        await context.request(`/admin/media/${file.id}/force`, { method: 'DELETE' });
        successCount++;
      } catch {
        if (context.scope.disposed) return;
        failedCount++;
      }
    }
    context.$('#media-message').textContent =
      `已永久删除 ${successCount} 个文件${failedCount ? `，${failedCount} 个删除失败或仍被引用` : ''}${locked ? `，保留 ${locked} 个使用中文件` : ''}`;
    await context.loadMedia();
    await context.loadDashboard();
    context.notify('媒体回收站清理完成');
  };
  context.uploadMusicField = async function uploadMusicField(file, fieldName) {
    context.$('#music-message').textContent = '正在上传文件...';
    try {
      const media = await context.uploadFile(file);
      context.$('#music-form').elements.namedItem(fieldName).value = media.url;
      window.updateAdminFieldPreview?.('music-form', fieldName);
      context.$('#music-message').textContent = '上传成功';
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#music-message').textContent = error.message;
    }
  };
  context.uploadAvatar = async function uploadAvatar(file) {
    context.$('#profile-message').textContent = '正在上传头像...';
    try {
      const media = await context.uploadFile(file);
      context.$('#profile-form').elements.namedItem('profile_avatar').value = media.url;
      window.updateAdminFieldPreview?.('profile-form', 'profile_avatar');
      context.$('#profile-message').textContent = '头像上传成功，记得保存';
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#profile-message').textContent = error.message || '头像上传失败';
      context.notify(error.message || '头像上传失败', true);
    }
  };
  context.uploadBannerImages = async function uploadBannerImages(files) {
    if (!files.length) return;
    context.$('#settings-message').textContent = `正在上传 ${files.length} 张 Banner 图...`;
    const input = context.$('#site-settings-form').elements.namedItem('banner_images');
    const current = input.value
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter(Boolean);
    try {
      for (const file of files) {
        const media = await context.uploadFile(file);
        current.push(media.url);
      }
      input.value = Array.from(new Set(current)).join('\n');
      await context.saveBannerImages();
      context.$('#settings-message').textContent = 'Banner 图已上传并保存';
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#settings-message').textContent = error.message;
      context.notify(error.message || 'Banner 图上传失败', true);
    }
  };
}
