export function BackupPanel() {
  return (
    <section id="backup-panel" className="admin-panel hidden">
      <div className="ryu-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">备份与恢复</h2>
            <p className="text-sm text-base-content/50">
              完整备份会同时打包数据库、书库、阅读数据和 uploads 媒体文件。
            </p>
          </div>
          <button id="refresh-backup-manifest" className="ryu-btn btn-sm" type="button">
            刷新清单
          </button>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-4">
          <button
            className="ryu-btn-primary min-h-24 flex-col"
            type="button"
            data-download-backup="full"
          >
            <strong>完整备份</strong>
            <span className="text-xs opacity-75">数据库 + uploads ZIP</span>
          </button>
          <button
            className="ryu-btn min-h-24 flex-col"
            type="button"
            data-download-backup="database"
          >
            <strong>数据库备份</strong>
            <span className="text-xs opacity-75">下载 .db 文件</span>
          </button>
          <button
            className="ryu-btn min-h-24 flex-col"
            type="button"
            data-download-backup="articles"
          >
            <strong>文章导出</strong>
            <span className="text-xs opacity-75">Markdown JSON</span>
          </button>
          <button
            className="ryu-btn min-h-24 flex-col"
            type="button"
            data-download-backup="manifest"
          >
            <strong>备份清单</strong>
            <span className="text-xs opacity-75">设置和数量</span>
          </button>
        </div>
        <div className="mt-6 border-t border-base-content/10 pt-5">
          <div>
            <h3 className="text-lg font-black">导入恢复</h3>
            <p className="text-sm text-base-content/50">
              数据库恢复会替换业务数据并自动保留恢复前快照；文章导入按 slug 新建或更新。
            </p>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <label className="flex min-h-24 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-error/20 bg-error/5 p-4 transition hover:border-error/40">
              <span>
                <strong className="block">恢复数据库</strong>
                <span className="text-xs text-base-content/55">选择 .db / .sqlite 文件</span>
              </span>
              <span className="ryu-btn btn-sm">选择文件</span>
              <input
                id="database-import-input"
                className="hidden"
                type="file"
                accept=".db,.sqlite,.sqlite3,application/x-sqlite3"
              />
            </label>
            <label className="flex min-h-24 cursor-pointer items-center justify-between gap-4 rounded-2xl border border-base-content/10 bg-base-200/45 p-4 transition hover:border-primary/35">
              <span>
                <strong className="block">导入文章</strong>
                <span className="text-xs text-base-content/55">选择文章导出的 JSON 文件</span>
              </span>
              <span className="ryu-btn btn-sm">选择文件</span>
              <input
                id="articles-import-input"
                className="hidden"
                type="file"
                accept=".json,application/json"
              />
            </label>
          </div>
          <p className="mt-3 text-xs text-warning">
            完整 ZIP 用于整体留档；当前恢复入口仍只恢复数据库，媒体可从 ZIP 的 uploads
            目录手动还原。
          </p>
        </div>
        <p id="backup-message" className="mt-4 min-h-6 text-sm"></p>
        <pre
          id="backup-manifest"
          className="mt-4 max-h-96 overflow-auto rounded-2xl bg-base-200/70 p-4 text-xs"
        ></pre>
      </div>
    </section>
  );
}
