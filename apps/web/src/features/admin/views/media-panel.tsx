export function MediaPanel() {
  return (
    <section id="media-panel" className="admin-panel admin-media-panel hidden">
      <div className="admin-media-manager">
        <header className="admin-media-hero">
          <div className="admin-media-hero-copy">
            <span className="admin-media-hero-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M3.5 7.5h6l1.7 2h9.3v9.25a1.75 1.75 0 0 1-1.75 1.75H5.25a1.75 1.75 0 0 1-1.75-1.75V7.5Z" />
                <path d="M3.5 7.5V5.25A1.75 1.75 0 0 1 5.25 3.5h4.2l1.8 2h7.5A1.75 1.75 0 0 1 20.5 7.25v2.25" />
              </svg>
            </span>
            <div>
              <p>MEDIA LIBRARY</p>
              <h2>文件资源</h2>
              <span>集中管理图片、音频、视频、字体和文档。</span>
            </div>
          </div>
          <label className="admin-media-upload">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M4 15v4a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-4" />
            </svg>
            上传文件
            <input id="media-upload" className="hidden" type="file" multiple />
          </label>
        </header>

        <div className="admin-media-commandbar">
          <div className="admin-media-create-actions">
            <button id="media-create-folder" type="button">
              <span>＋</span>新建文件夹
            </button>
            <button id="media-create-file" type="button">
              <span>＋</span>新建文件
            </button>
          </div>
          <label className="admin-media-searchbox">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" />
              <path d="m16 16 4 4" />
            </svg>
            <input
              id="media-search"
              type="search"
              placeholder="搜索当前文件夹"
              autoComplete="off"
            />
          </label>
          <div className="admin-media-sort-controls">
            <select id="media-sort" aria-label="媒体排序方式">
              <option value="name">名称</option>
              <option value="type">类型</option>
              <option value="size">大小</option>
              <option value="date">时间</option>
            </select>
            <button id="media-sort-order" type="button" aria-label="切换排序方向">
              ASC ↑
            </button>
          </div>
          <div className="admin-media-mode-switch" aria-label="媒体库模式">
            <button id="media-normal-mode" type="button">
              文件
            </button>
            <button id="media-trash-mode" type="button">
              回收站
            </button>
          </div>
          <details className="admin-media-more">
            <summary aria-label="更多操作">•••</summary>
            <div>
              <button id="cleanup-media" type="button">
                清理冗余文件
              </button>
              <button id="empty-media-trash" className="hidden" type="button">
                清空未引用文件
              </button>
            </div>
          </details>
        </div>

        <div
          id="media-message"
          className="admin-media-message"
          role="status"
          aria-live="polite"
        ></div>
        <div className="admin-media-explorer">
          <aside className="admin-media-sidebar">
            <header>
              <span>资源位置</span>
              <small>文件夹与类型</small>
            </header>
            <nav
              id="media-folder-list"
              className="admin-media-folders"
              aria-label="媒体文件夹"
            ></nav>
          </aside>
          <section className="admin-media-browser">
            <header className="admin-media-breadcrumb">
              <span>媒体库</span>
              <b>/</b>
              <strong id="media-folder-name">全部文件</strong>
              <small id="media-file-count">0 个项目</small>
            </header>
            <div className="admin-media-columns" aria-hidden="true">
              <span>名称</span>
              <span>类型</span>
              <span>大小</span>
              <span>状态</span>
              <span>修改时间</span>
            </div>
            <div id="media-grid" className="admin-media-grid"></div>
            <footer className="admin-media-browser-footer">
              <span>双击打开</span>
              <span>右键查看更多操作</span>
            </footer>
          </section>
        </div>

        <div id="media-context-menu" className="admin-media-context" role="menu" hidden>
          <button type="button" data-media-context="open">
            打开
          </button>
          <button type="button" data-media-context="rename">
            重命名
          </button>
          <button type="button" data-media-context="move">
            移动到…
          </button>
          <button type="button" data-media-context="copy">
            复制链接
          </button>
          <button type="button" data-media-context="font" hidden>
            加入字体库
          </button>
          <hr />
          <button className="is-danger" type="button" data-media-context="delete">
            移入回收站
          </button>
          <button type="button" data-media-context="restore" hidden>
            恢复
          </button>
          <button className="is-danger" type="button" data-media-context="force-delete" hidden>
            永久删除
          </button>
        </div>
      </div>
    </section>
  );
}
