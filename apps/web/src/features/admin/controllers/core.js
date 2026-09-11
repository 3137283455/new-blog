import { register as register0 } from './core-shell';
import { register as register1 } from './core-media';
import { register as register2 } from './core-articles';
import { register as register3 } from './core-settings';
import { register as register4 } from './core-content';
import { register as register5 } from './core-comments';
import { register as register6 } from './core-music';
import { register as register7 } from './core-backup';
export function mount(scope) {
  const context = { scope };
  register0(context);
  register1(context);
  register2(context);
  register3(context);
  register4(context);
  register5(context);
  register6(context);
  register7(context);
  context.root = context.scope.query('.admin-shell');
  context.API_BASE = context.root?.dataset.apiBase || '/api';
  context.tokenKey = 'boke_admin_token';
  context.state = {
    token: localStorage.getItem(context.tokenKey) || '',
    articles: [],
    categories: [],
    tags: [],
    media: [],
    mediaTrashMode: false,
    mediaCurrentFolderId: null,
    mediaSmartType: '',
    mediaFolders: [],
    mediaAllFolders: [],
    mediaBreadcrumb: [],
    mediaFolderCounts: {},
    mediaSort: localStorage.getItem('boke_media_sort') || 'name',
    mediaSortOrder: localStorage.getItem('boke_media_sort_order') || 'asc',
    mediaContext: null,
    mediaLoadSequence: 0,
    music: [],
    musicPlaylists: [],
    activeMusicPlaylistName: '',
    comments: [],
    pages: [],
    pagesTrashMode: false,
    themes: [],
    plugins: [],
    settings: {},
    fontLibrary: [],
    user: null,
    stats: null,
    charts: null,
  };
  context.$ = (selector) => context.scope.query(selector);
  context.$$ = (selector) => Array.from(context.scope.queryAll(selector));
  context.apiLabel = context.$('#api-base-label');
  if (context.apiLabel) context.apiLabel.textContent = context.API_BASE;
  window.notifyAdmin = context.notify;
  context.contentPanels = [
    'content-center',
    'articles',
    'series',
    'books',
    'navigation',
    'bangumi',
    'manga',
    'albums',
    'music',
  ];
  context.mediaPanels = ['media', 'fonts'];
  context.settingsPanels = [
    'settings',
    'personal',
    'appearance',
    'taxonomy',
    'comments',
    'backup',
    'plugins',
  ];
  context.navPanelMap = {
    'content-center': 'articles',
    series: 'articles',
    books: 'articles',
    navigation: 'articles',
    bangumi: 'articles',
    manga: 'articles',
    albums: 'articles',
    music: 'articles',
    'search-sources': 'articles',
    fonts: 'media',
    personal: 'settings',
    appearance: 'settings',
    backup: 'settings',
    taxonomy: 'settings',
    comments: 'settings',
    plugins: 'settings',
  };
  context.contentLabels = {
    'content-center': '导入与关联',
    articles: '文章',
    series: '专题',
    books: '书库',
    navigation: '导航',
    bangumi: '追番',
    manga: '漫画',
    albums: '相册',
    music: '音乐',
  };
  context.mediaLabels = { media: '文件资源', fonts: '字体库' };
  context.settingsLabels = {
    settings: '站点与账号',
    personal: '个人与同步',
    appearance: '主题外观',
    taxonomy: '分类标签',
    comments: '评论',
    backup: '备份与恢复',
    plugins: '插件',
  };
  context.panelTitles = {
    dashboard: '概览',
    'content-center': '个人内容中枢',
    articles: '文章管理',
    series: '专题管理',
    books: '书库管理',
    navigation: '导航管理',
    bangumi: '追番管理',
    manga: '漫画管理',
    albums: '相册管理',
    music: '音乐管理',
    media: '媒体资源',
    fonts: '字体库',
    settings: '系统设置',
    personal: '个人与同步',
    appearance: '主题外观',
    'search-sources': '漫画源管理',
    taxonomy: '分类标签',
    comments: '评论管理',
    backup: '备份与恢复',
    plugins: '插件管理',
    login: '后台登录',
  };
  context.$$('.admin-nav').forEach((button) => {
    context.scope.listen(button, 'click', () => {
      context.notify('');
      context.switchPanel(button.dataset.panel);
    });
  });
  context.scope.listen(document, 'click', (event) => {
    const tab = event.target.closest('[data-panel-tab]');
    if (tab) {
      context.notify('');
      context.switchPanel(tab.dataset.panelTab);
    }
  });
  context.scope.listen(context.$('#login-form'), 'submit', async (event) => {
    event.preventDefault();
    context.$('#login-message').textContent = '正在登录...';
    try {
      const data = new FormData(event.currentTarget);
      const user = await context.login(data.get('username'), data.get('password'));
      context.$('#login-message').textContent = '';
      context.setStatus(`已登录：${user.nickname || user.username}`);
      const results = await Promise.allSettled([
        context.loadTaxonomy(),
        context.loadDashboard(),
        context.loadArticles(),
        context.loadMedia(),
        context.loadSettings(),
      ]);
      const failed = results.filter((result) => result.status === 'rejected').length;
      context.setStatus(
        failed
          ? `已登录：${user.nickname || user.username}，${failed} 个后台模块加载失败`
          : `已登录：${user.nickname || user.username}`,
      );
      const hashPanel = location.hash.replace(/^#/, '').split('?')[0];
      context.switchPanel(context.resolveHashPanel(hashPanel));
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#login-message').textContent = context.friendlyLoginError(error);
    }
  });
  context.scope.listen(context.$('#logout-admin'), 'click', () => {
    localStorage.removeItem(context.tokenKey);
    context.state.token = '';
    context.$('#logout-admin').classList.add('hidden');
    context.setStatus('已退出登录');
    context.switchPanel('login');
  });
  context.scope.listen(context.$('#refresh-admin'), 'click', context.loadAll);
  context.scope.listen(context.$('#status-filter'), 'change', context.loadArticles);
  context.scope.listen(context.$('#trash-filter'), 'change', context.loadArticles);
  context.scope.listen(context.$('#batch-delete'), 'click', context.batchDeleteArticles);
  context.scope.listen(context.$('#select-all-articles'), 'change', (event) => {
    context.$$('.article-check').forEach((input) => {
      input.checked = event.currentTarget.checked;
    });
  });
  context.mediaSearchTimer = 0;
  context.scope.listen(context.$('#media-search'), 'input', () => {
    window.clearTimeout(context.mediaSearchTimer);
    context.mediaSearchTimer = context.scope.timeout(context.loadMedia, 180);
  });
  context.scope.listen(context.$('#media-folder-list'), 'click', (event) => {
    const folder = event.target.closest('[data-media-folder-id]');
    const smart = event.target.closest('[data-media-smart-type]');
    if (folder) {
      context.state.mediaCurrentFolderId = folder.dataset.mediaFolderId
        ? Number(folder.dataset.mediaFolderId)
        : null;
      context.state.mediaSmartType = '';
      context.state.mediaTrashMode = false;
      context.loadMedia();
    }
    if (smart) {
      context.state.mediaSmartType = smart.dataset.mediaSmartType || '';
      context.state.mediaCurrentFolderId = null;
      context.state.mediaTrashMode = false;
      context.loadMedia();
    }
  });
  context.scope.listen(context.$('.admin-media-breadcrumb'), 'click', (event) => {
    const rootButton = event.target.closest('[data-media-breadcrumb-root]');
    const folder = event.target.closest('[data-media-breadcrumb-id]');
    if (!rootButton && !folder) return;
    context.state.mediaCurrentFolderId = folder ? Number(folder.dataset.mediaBreadcrumbId) : null;
    context.state.mediaSmartType = '';
    context.state.mediaTrashMode = false;
    context.loadMedia();
  });
  context.scope.listen(context.$('#media-create-folder'), 'click', () =>
    context.createMediaExplorerEntry('folder'),
  );
  context.scope.listen(context.$('#media-create-file'), 'click', () =>
    context.createMediaExplorerEntry('file'),
  );
  context.scope.listen(context.$('#media-sort'), 'change', (event) => {
    context.state.mediaSort = event.currentTarget.value;
    localStorage.setItem('boke_media_sort', context.state.mediaSort);
    context.loadMedia();
  });
  context.scope.listen(context.$('#media-sort-order'), 'click', () => {
    context.state.mediaSortOrder = context.state.mediaSortOrder === 'desc' ? 'asc' : 'desc';
    localStorage.setItem('boke_media_sort_order', context.state.mediaSortOrder);
    context.loadMedia();
  });
  context.scope.listen(context.$('#media-upload'), 'change', (event) =>
    context.uploadMediaFiles(Array.from(event.currentTarget.files || [])),
  );
  context.scope.listen(context.$('#cover-upload'), 'change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) context.uploadCover(file);
  });
  context.scope.listen(context.$('#reset-editor'), 'click', context.resetEditor);
  context.scope.listen(context.$('#article-form'), 'submit', context.saveArticle);
  context.scope.listen(context.$('#markdown-toolbar'), 'click', (event) => {
    const button = event.target.closest('[data-md-insert]');
    if (button) context.insertMarkdown(button.dataset.mdInsert);
  });
  context.scope.listen(context.$('#add-font-library'), 'click', context.addFontToLibrary);
  context.scope.listen(context.$('#save-font-library'), 'click', context.saveFontLibrary);
  context.scope.listen(context.$('#font-file-upload'), 'change', async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    context.$('#font-library-message').textContent = '正在上传字体...';
    try {
      const media = await context.uploadFile(file);
      context.$('#font-url-input').value = media.url;
      context.$('#font-name-input').value =
        context.$('#font-name-input').value.trim() || file.name.replace(/\.[^.]+$/, '');
      context.$('#font-library-message').textContent = '字体已上传，可点击加入字体库';
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#font-library-message').textContent = error.message;
    }
  });
  context.scope.listen(context.$('#font-library-list'), 'click', (event) => {
    const remove = event.target.closest('[data-remove-font]');
    const edit = event.target.closest('[data-edit-font]');
    const title = event.target.closest('[data-use-title-font]');
    const body = event.target.closest('[data-use-body-font]');
    if (edit) context.editFontEntry(edit.dataset.editFont);
    if (title) context.useFontInArticleForm(title.dataset.useTitleFont, 'title');
    if (body) context.useFontInArticleForm(body.dataset.useBodyFont, 'body');
    if (remove) {
      context.state.fontLibrary.splice(Number(remove.dataset.removeFont), 1);
      context.renderFontLibrary();
      context.$('#font-library-message').textContent = '字体已移除，记得保存字体库';
    }
  });
  context.scope.listen(context.$('#category-form'), 'submit', context.createCategory);
  context.scope.listen(context.$('#tag-form'), 'submit', context.createTag);
  context.scope.listen(context.$('#page-form'), 'submit', context.savePage);
  context.scope.listen(context.$('#reset-page'), 'click', context.resetPageForm);
  context.scope.listen(context.$('#pages-normal-mode'), 'click', () => {
    context.state.pagesTrashMode = false;
    context.loadPages();
  });
  context.scope.listen(context.$('#pages-trash-mode'), 'click', () => {
    context.state.pagesTrashMode = true;
    context.resetPageForm();
    context.loadPages();
  });
  context.scope.listen(context.$('#comment-status-filter'), 'change', context.loadComments);
  context.scope.listen(context.$('#theme-form'), 'submit', context.installTheme);
  context.scope.listen(context.$('#plugin-form'), 'submit', context.installPlugin);
  context.scope.listen(context.$('#account-form'), 'submit', context.saveAccount);
  context.scope.listen(context.$('#profile-form'), 'submit', context.saveProfile);
  context.scope.listen(context.$('#site-settings-form'), 'submit', context.saveSiteSettings);
  context.scope.listen(context.$('#site-settings-form'), 'input', context.renderSettingsPreview);
  context.scope.listen(context.$('#site-settings-form'), 'change', context.renderSettingsPreview);
  context.scope.listen(context.$('#storage-settings-form'), 'submit', async (event) => {
    event.preventDefault();
    const message = context.$('#storage-settings-message');
    try {
      const data = {
        quota_gb: Number(context.$('#storage-quota-gb')?.value),
        warn_percent: Number(context.$('#storage-warn-percent')?.value),
        critical_percent: Number(context.$('#storage-critical-percent')?.value),
      };
      const result = await context.request('/admin/storage/settings', { method: 'PUT', body: JSON.stringify(data) });
      context.state.stats = { ...(context.state.stats || {}), storage: result.data };
      context.renderDashboard();
      if (message) message.textContent = '配额设置已保存';
    } catch (error) {
      if (message) message.textContent = error.message || '保存失败';
    }
  });
  context.scope.listen(context.$('#memory-settings-form'), 'submit', context.saveMemorySettings);
  context.scope.listen(context.$('#logs-refresh'), 'click', context.loadLogs);
  context.scope.listen(context.$('#logs-level-filter'), 'change', context.loadLogs);
  context.scope.listen(context.$('#logs-source-filter'), 'change', context.loadLogs);
  context.scope.listen(context.$('#logs-query-filter'), 'input', () => {
    window.clearTimeout(context.logsTimer);
    context.logsTimer = context.scope.timeout(context.loadLogs, 220);
  });
  context.scope.listen(context.$('#admin-sidebar-toggle'), 'click', (event) => {
    const collapsed = context.root?.classList.toggle('is-sidebar-collapsed') || false;
    event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
    event.currentTarget.setAttribute('aria-label', collapsed ? '展开侧栏' : '收起侧栏');
  });
  context.scope.listen(context.$('#admin-search-toggle'), 'click', context.openAdminSettingsSearch);
  context.scope.listen(context.$('#admin-global-settings-search'), 'input', (event) => {
    context.switchPanel('settings');
    context.syncGlobalSettingsSearch(event.currentTarget.value || '');
  });
  context.scope.listen(context.$('#admin-global-settings-search'), 'keydown', (event) => {
    if (event.key === 'Escape') {
      context.scope.query('.admin-topbar')?.classList.remove('is-searching');
      event.currentTarget.blur();
    }
  });
  context.scope.listen(context.$('#admin-notification-toggle'), 'click', () => {
    const notice = context.$('#admin-notice');
    if (notice?.textContent) notice.classList.toggle('is-visible');
    context.$('#admin-notification-dot')?.classList.add('hidden');
  });
  context.scope.listen(document, 'keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      context.openAdminSettingsSearch();
    }
  });
  context.scope.listen(context.$('#settings-search'), 'input', (event) => {
    const term = String(event.currentTarget.value || '')
      .trim()
      .toLocaleLowerCase();
    const sections = Array.from(context.scope.queryAll('#settings-panel .admin-settings-section'));
    let visible = 0;
    sections.forEach((section) => {
      const headerText = section.querySelector(':scope > header')?.textContent || '';
      const sectionMatch =
        !term ||
        `${section.dataset.settingsSearch || ''} ${headerText}`.toLocaleLowerCase().includes(term);
      const rows = Array.from(section.querySelectorAll('.admin-setting-row'));
      let rowMatches = 0;
      rows.forEach((row) => {
        const match = sectionMatch || row.textContent.toLocaleLowerCase().includes(term);
        row.classList.toggle('hidden', !match);
        if (match) rowMatches += 1;
      });
      section
        .querySelectorAll('.admin-settings-group')
        .forEach((heading) => heading.classList.toggle('hidden', Boolean(term) && !sectionMatch));
      const show = !term || sectionMatch || rowMatches > 0;
      section.classList.toggle('hidden', !show);
      if (show) visible += 1;
    });
    context.$('#settings-search-empty')?.classList.toggle('hidden', visible > 0);
  });
  context.scope.listen(context.$('#avatar-upload'), 'change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) context.uploadAvatar(file);
  });
  context.scope.listen(context.$('#banner-upload'), 'change', (event) => {
    context.uploadBannerImages(Array.from(event.currentTarget.files || []));
  });
  context.scope.listen(context.$('#media-normal-mode'), 'click', () => {
    context.state.mediaTrashMode = false;
    context.state.mediaSmartType = '';
    context.state.mediaCurrentFolderId = null;
    context.loadMedia();
  });
  context.scope.listen(context.$('#media-trash-mode'), 'click', () => {
    context.state.mediaTrashMode = true;
    context.state.mediaSmartType = '';
    context.state.mediaCurrentFolderId = null;
    context.loadMedia();
  });
  context.scope.listen(context.$('#cleanup-media'), 'click', context.cleanupMedia);
  context.scope.listen(context.$('#empty-media-trash'), 'click', context.emptyMediaTrash);
  context.scope.listen(context.$('#refresh-backup-manifest'), 'click', context.loadBackupManifest);
  context.scope.listen(context.$('#database-import-input'), 'change', (event) => {
    context.handleBackupImport('database', event.currentTarget.files?.[0]);
  });
  context.scope.listen(context.$('#articles-import-input'), 'change', (event) => {
    context.handleBackupImport('articles', event.currentTarget.files?.[0]);
  });
  context.scope.listen(context.$('#backup-panel'), 'click', (event) => {
    const button = event.target.closest('[data-download-backup]');
    if (button) context.handleBackupDownload(button.dataset.downloadBackup);
  });
  context.scope.listen(context.$('#music-form'), 'submit', context.addMusic);
  context.scope.listen(context.$('#save-music'), 'click', context.saveMusic);
  context.scope.listen(context.$('#music-playlist-filter'), 'change', context.renderMusic);
  context.scope.listen(context.$('#music-playlist-form'), 'submit', context.saveMusicPlaylist);
  context.scope.listen(context.$('#reset-music-playlist'), 'click', () =>
    context.resetMusicPlaylistForm(true),
  );
  context.scope.listen(context.$('#music-playlist-dialog-close'), 'click', () =>
    context.$('#music-playlist-dialog')?.close(),
  );
  context.scope.listen(context.$('#cancel-music-playlist'), 'click', () =>
    context.$('#music-playlist-dialog')?.close(),
  );
  context.scope.listen(context.$('#music-tracks-dialog-close'), 'click', () =>
    context.$('#music-tracks-dialog')?.close(),
  );
  context.scope.listen(context.$('#create-music-track'), 'click', () =>
    context.openMusicTrackDialog(),
  );
  context.scope.listen(context.$('#music-track-dialog-close'), 'click', () =>
    context.$('#music-track-dialog')?.close(),
  );
  context.scope.listen(context.$('#cancel-music-track'), 'click', () =>
    context.$('#music-track-dialog')?.close(),
  );
  context.scope.listen(context.$('#music-audio-upload'), 'change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) context.uploadMusicField(file, 'url');
  });
  context.scope.listen(context.$('#music-cover-upload'), 'change', (event) => {
    const file = event.currentTarget.files?.[0];
    if (file) context.uploadMusicField(file, 'cover');
  });
  context.scope.listen(context.$('#music-playlist-cover-upload'), 'change', async (event) => {
    const file = event.currentTarget.files?.[0];
    if (!file) return;
    try {
      const media = await context.uploadFile(file);
      context.$('#music-playlist-form').elements.namedItem('cover').value = media.url;
      window.updateAdminFieldPreview?.('music-playlist-form', 'cover');
      context.$('#music-playlist-message').textContent = '封面上传成功';
      await context.loadMedia();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#music-playlist-message').textContent = error.message || '封面上传失败';
    }
  });
  context.scope.listen(context.$('#articles-table'), 'click', (event) => {
    const edit = event.target.closest('[data-edit]');
    const del = event.target.closest('[data-delete]');
    const restore = event.target.closest('[data-restore]');
    const forceDelete = event.target.closest('[data-force-delete]');
    if (edit) context.editArticle(edit.dataset.edit);
    if (del) context.deleteArticle(del.dataset.delete);
    if (restore) context.restoreArticle(restore.dataset.restore);
    if (forceDelete) context.forceDeleteArticle(forceDelete.dataset.forceDelete);
  });
  context.scope.listen(context.$('#media-grid'), 'click', (event) => {
    const item = event.target.closest('[data-media-id]');
    if (item)
      context
        .$$('#media-grid [data-media-id]')
        .forEach((row) => row.classList.toggle('is-selected', row === item));
  });
  context.scope.listen(context.$('#media-grid'), 'dblclick', (event) => {
    const item = event.target.closest('[data-media-id]');
    if (item)
      context.openMediaExplorerEntry(
        item.dataset.mediaKind || 'file',
        context.mediaExplorerEntry(item.dataset.mediaKind || 'file', item.dataset.mediaId),
      );
  });
  context.scope.listen(context.$('#media-grid'), 'contextmenu', (event) => {
    const item = event.target.closest('[data-media-id]');
    if (item)
      context.showMediaExplorerContext(
        event,
        item.dataset.mediaKind || 'file',
        item.dataset.mediaId,
      );
  });
  context.scope.listen(context.$('#media-context-menu'), 'click', async (event) => {
    const action = event.target.closest('[data-media-context]')?.dataset.mediaContext;
    const context = context.state.mediaContext;
    if (!action || !context) return;
    const entry = context.mediaExplorerEntry(context.kind, context.id);
    context.closeMediaExplorerContext();
    if (!entry) return;
    if (action === 'open') context.openMediaExplorerEntry(context.kind, entry);
    if (action === 'rename') context.renameMediaExplorerEntry(context.kind, entry);
    if (action === 'move') context.moveMediaExplorerEntry(context.kind, entry);
    if (action === 'copy' && context.kind === 'file') {
      await navigator.clipboard?.writeText(entry.url || `/uploads/${entry.path}`);
      context.notify('\u5a92\u4f53\u94fe\u63a5\u5df2\u590d\u5236');
    }
    if (action === 'font' && context.kind === 'file') context.addFontFromMedia(entry.id);
    if (action === 'delete')
      context.kind === 'folder'
        ? context.deleteMediaExplorerFolder(entry)
        : context.deleteMedia(entry.id);
    if (action === 'restore' && context.kind === 'file') context.restoreMedia(entry.id);
    if (action === 'force-delete' && context.kind === 'file') context.forceDeleteMedia(entry.id);
  });
  context.scope.listen(document, 'click', (event) => {
    if (!event.target.closest('#media-context-menu')) context.closeMediaExplorerContext();
  });
  context.scope.listen(window, 'blur', context.closeMediaExplorerContext);
  context.scope.listen(context.$('#music-list'), 'click', async (event) => {
    const batchRemove = event.target.closest('[data-batch-remove-music]');
    const edit = event.target.closest('[data-edit-song]');
    const move = event.target.closest('[data-move-song]');
    const remove = event.target.closest('[data-remove-song]');
    if (batchRemove) {
      await context.batchRemoveMusic();
      return;
    }
    if (edit) {
      const index = Number(edit.dataset.editSong);
      if (!context.state.music[index]) return;
      context.openMusicTrackDialog(index);
      return;
    }
    if (move) {
      const index = Number(move.dataset.moveSong);
      const playlistName = context.musicPlaylistName(context.state.music[index] || {});
      const playlistIndexes = context.state.music
        .map((song, songIndex) => ({ song, songIndex }))
        .filter((entry) => context.musicPlaylistName(entry.song) === playlistName)
        .map((entry) => entry.songIndex);
      const position = playlistIndexes.indexOf(index);
      const nextPosition = move.dataset.direction === 'up' ? position - 1 : position + 1;
      if (position < 0 || nextPosition < 0 || nextPosition >= playlistIndexes.length) return;
      const nextIndex = playlistIndexes[nextPosition];
      const current = context.state.music[index];
      context.state.music[index] = context.state.music[nextIndex];
      context.state.music[nextIndex] = current;
      context.renderMusic();
      context.$('#music-message').textContent = '顺序已调整，请保存排序';
      return;
    }
    if (remove) {
      context.state.music.splice(Number(remove.dataset.removeSong), 1);
      context.renderMusic();
      await context.saveMusic();
    }
  });
  context.scope.listen(context.$('#music-playlist-list'), 'click', (event) => {
    const open = event.target.closest('[data-open-music-playlist]');
    const edit = event.target.closest('[data-edit-music-playlist]');
    const del = event.target.closest('[data-delete-music-playlist]');
    if (open) context.openMusicTracks(open.dataset.openMusicPlaylist);
    if (edit) context.editMusicPlaylist(edit.dataset.editMusicPlaylist);
    if (del) context.deleteMusicPlaylist(del.dataset.deleteMusicPlaylist);
  });
  context.scope.listen(context.$('#category-list'), 'click', (event) => {
    const edit = event.target.closest('[data-edit-category]');
    const del = event.target.closest('[data-delete-category]');
    if (edit) context.editCategory(edit.dataset.editCategory);
    if (del) context.deleteCategory(del.dataset.deleteCategory);
  });
  context.scope.listen(context.$('#tag-list'), 'click', (event) => {
    const edit = event.target.closest('[data-edit-tag]');
    const del = event.target.closest('[data-delete-tag]');
    if (edit) context.editTag(edit.dataset.editTag);
    if (del) context.deleteTag(del.dataset.deleteTag);
  });
  context.scope.listen(context.$('#pages-list'), 'click', (event) => {
    const edit = event.target.closest('[data-edit-page]');
    const del = event.target.closest('[data-delete-page]');
    const restore = event.target.closest('[data-restore-page]');
    const forceDelete = event.target.closest('[data-force-delete-page]');
    if (edit) context.editPage(edit.dataset.editPage);
    if (del) context.deletePage(del.dataset.deletePage);
    if (restore) context.restorePage(restore.dataset.restorePage);
    if (forceDelete) context.forceDeletePage(forceDelete.dataset.forceDeletePage);
  });
  context.scope.listen(context.$('#comments-list'), 'click', (event) => {
    const reply = event.target.closest('[data-reply-comment]');
    const status = event.target.closest('[data-comment-status]');
    const del = event.target.closest('[data-delete-comment]');
    if (reply) context.replyComment(reply.dataset.replyComment);
    if (status) context.updateCommentStatus(status.dataset.commentStatus, status.dataset.status);
    if (del) context.deleteComment(del.dataset.deleteComment);
  });
  context.scope.listen(context.$('#comment-select-all'), 'click', () => {
    const checks = context.$$('[data-comment-check]');
    const shouldCheck = checks.some((input) => !input.checked);
    checks.forEach((input) => {
      input.checked = shouldCheck;
    });
  });
  context.$$('[data-comment-batch-status]').forEach((button) => {
    context.scope.listen(button, 'click', () =>
      context.batchUpdateComments(button.dataset.commentBatchStatus),
    );
  });
  context.scope.listen(context.$('#comment-batch-delete'), 'click', context.batchDeleteComments);
  context.scope.listen(context.$('#themes-list'), 'click', (event) => {
    const preview = event.target.closest('[data-preview-theme]');
    const activate = event.target.closest('[data-activate-theme]');
    const del = event.target.closest('[data-delete-theme]');
    if (preview) context.previewTheme(preview.dataset.previewTheme);
    if (activate) context.activateTheme(activate.dataset.activateTheme);
    if (del) context.deleteTheme(del.dataset.deleteTheme);
  });
  context.scope.listen(context.$('#plugins-list'), 'click', (event) => {
    const toggle = event.target.closest('[data-toggle-plugin]');
    if (toggle) context.togglePlugin(toggle.dataset.togglePlugin);
  });
  context.loadAll();
}
