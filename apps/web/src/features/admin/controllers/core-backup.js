export function register(context) {
  context.loadBackupManifest = async function loadBackupManifest() {
    const json = await context.request('/admin/backup/manifest');
    context.$('#backup-manifest').textContent = JSON.stringify(json.data || {}, null, 2);
    context.$('#backup-message').textContent = '备份清单已刷新';
  };
  context.handleBackupDownload = async function handleBackupDownload(type) {
    try {
      if (type === 'full') {
        await context.downloadAdminFile('/admin/backup/full', 'boke-full.zip');
      } else if (type === 'database') {
        await context.downloadAdminFile('/admin/backup/database', 'blog.db');
      } else if (type === 'articles') {
        await context.downloadAdminFile('/admin/backup/articles', 'articles.json');
      } else if (type === 'manifest') {
        await context.downloadAdminFile('/admin/backup/manifest', 'backup-manifest.json');
        await context.loadBackupManifest();
      }
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#backup-message').textContent = error.message || '导出失败';
      context.notify(error.message || '导出失败', true);
    }
  };
  context.handleBackupImport = async function handleBackupImport(type, file) {
    if (!file) return;
    const isDatabase = type === 'database';
    const warning = isDatabase
      ? `确认使用“${file.name}”恢复数据库？\n\n当前业务数据会被备份文件替换，系统会先自动保存一份恢复前快照。媒体实体文件不会随数据库导入。`
      : `确认导入“${file.name}”中的文章？\n\n相同 slug 的文章会更新，不存在的文章会新建。`;
    if (!window.confirm(warning)) return;
    const input = isDatabase
      ? context.$('#database-import-input')
      : context.$('#articles-import-input');
    const endpoint = isDatabase ? '/admin/backup/database/import' : '/admin/backup/articles/import';
    const formData = new FormData();
    formData.append('file', file);
    context.$('#backup-message').textContent = isDatabase
      ? '正在校验并恢复数据库，请勿关闭页面...'
      : '正在导入文章...';
    try {
      const headers = {};
      if (context.state.token) headers.Authorization = `Bearer ${context.state.token}`;
      const response = await context.scope.fetch(`${context.API_BASE}${endpoint}`, {
        method: 'POST',
        headers,
        body: formData,
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok || json.success === false) {
        throw new Error(json.message || `导入失败（HTTP ${response.status}）`);
      }
      context.$('#backup-message').textContent = json.message || '导入完成';
      context.notify(json.message || '导入完成');
      await context.loadAll();
      await context.loadBackupManifest();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#backup-message').textContent = error.message || '导入失败';
      context.notify(error.message || '导入失败', true);
    } finally {
      if (input) input.value = '';
    }
  };
}
