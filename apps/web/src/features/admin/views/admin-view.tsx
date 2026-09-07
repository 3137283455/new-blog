import { LoginPanel } from './login-panel';
import { DashboardPanel } from './dashboard-panel';
import { ContentCenterPanel } from './content-center-panel';
import { ArticlesPanel } from './articles-panel';
import { BooksPanel } from './books-panel';
import { SeriesPanel } from './series-panel';
import { EditorPanel } from './editor-panel';
import { MediaPanel } from './media-panel';
import { FontsPanel } from './fonts-panel';
import { BackupPanel } from './backup-panel';
import { MusicPanel } from './music-panel';
import { TaxonomyPanel } from './taxonomy-panel';
import { PagesPanel } from './pages-panel';
import { CommentsPanel } from './comments-panel';
import { AppearancePanel } from './appearance-panel';
import { PluginsPanel } from './plugins-panel';
import { SettingsPanel } from './settings-panel';
import { SearchSourcesPanel } from './search-sources-panel';
import { NavigationPanel } from './navigation-panel';
import { BangumiPanel } from './bangumi-panel';
import { MangaPanel } from './manga-panel';
import { AlbumsPanel } from './albums-panel';
import { PersonalPanel } from './personal-panel';
import { MangaSettingsDialog } from './manga-settings-dialog';
import { SearchSourceConflictDialog } from './search-source-conflict-dialog';
import { BangumiSourceDialog } from './bangumi-source-dialog';
import { BangumiPlaySourceDialog } from './bangumi-play-source-dialog';
import { NavigationDialog } from './navigation-dialog';
import { BookmarkImportDialog } from './bookmark-import-dialog';
import { AlbumDialog } from './album-dialog';
import { AlbumPhotosDialog } from './album-photos-dialog';
import { AlbumPhotoDialog } from './album-photo-dialog';
import { MusicPlaylistDialog } from './music-playlist-dialog';
import { MusicTracksDialog } from './music-tracks-dialog';
import { MusicTrackDialog } from './music-track-dialog';
import { MediaPickerDialog } from './media-picker-dialog';
export function AdminView() {
  return (
    <>
      <section className="admin-shell" data-api-base="/api">
        <aside className="admin-sidebar">
          <a className="admin-sidebar-brand" href="/" aria-label="返回博客首页">
            <img src="/profile.webp" alt="" />
            <span>
              <strong>My Blog</strong>
              <small>管理后台</small>
            </span>
          </a>
          <nav className="mt-8 grid gap-2">
            <button className="admin-nav is-active" data-panel="dashboard">
              概览
            </button>
            <button className="admin-nav" data-panel="articles">
              内容中心
            </button>
            <button className="admin-nav" data-panel="media">
              媒体库
            </button>
            <button className="admin-nav" data-panel="settings">
              设置
            </button>
          </nav>
        </aside>

        <main className="admin-main">
          <div className="admin-topbar">
            <div className="admin-topbar-context">
              <button
                id="admin-sidebar-toggle"
                className="admin-icon-button"
                type="button"
                aria-label="收起侧栏"
                aria-expanded="true"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
              <span className="admin-topbar-divider" aria-hidden="true">
                ›
              </span>
              <strong id="admin-page-title">概览</strong>
            </div>
            <div className="admin-topbar-actions">
              <label className="admin-global-search" aria-label="搜索设置">
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
                <input
                  id="admin-global-settings-search"
                  type="search"
                  placeholder="搜索设置"
                  autoComplete="off"
                />
                <kbd>Ctrl K</kbd>
              </label>
              <button
                id="admin-search-toggle"
                className="admin-icon-button"
                type="button"
                aria-label="搜索设置"
                title="搜索设置（Ctrl+K）"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="11" cy="11" r="6.5" />
                  <path d="m16 16 4 4" />
                </svg>
              </button>
              <button
                id="admin-notification-toggle"
                className="admin-icon-button"
                type="button"
                aria-label="通知"
                title="通知"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 8h18c0-1-3-1-3-8M10 21h4" />
                </svg>
                <span id="admin-notification-dot" className="admin-notification-dot hidden"></span>
              </button>
              <a
                className="admin-icon-button"
                href="/"
                target="_blank"
                aria-label="访问前台"
                title="访问前台"
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" />
                </svg>
              </a>
              <details className="admin-account-menu">
                <summary>
                  <img id="admin-account-avatar" src="/profile.webp" alt="" />
                  <span id="admin-account-name">管理员</span>
                </summary>
                <div>
                  <button id="refresh-admin" type="button">
                    刷新数据
                  </button>
                  <button id="logout-admin" className="hidden" type="button">
                    退出登录
                  </button>
                </div>
              </details>
            </div>
          </div>
          <p id="admin-notice" className="admin-notice" role="status" aria-live="polite"></p>

          <LoginPanel />

          <DashboardPanel />

          <ContentCenterPanel />
          <ArticlesPanel />

          <BooksPanel />
          <SeriesPanel />

          <EditorPanel />

          <MediaPanel />
          <FontsPanel />

          <BackupPanel />

          <MusicPanel />

          <TaxonomyPanel />

          <PagesPanel />

          <CommentsPanel />

          <AppearancePanel />

          <PluginsPanel />

          <SettingsPanel />
          <SearchSourcesPanel />

          <NavigationPanel />

          <BangumiPanel />

          <MangaPanel />
          <AlbumsPanel />

          <PersonalPanel />
        </main>
      </section>

      <MangaSettingsDialog />
      <SearchSourceConflictDialog />
      <BangumiSourceDialog />

      <BangumiPlaySourceDialog />

      <NavigationDialog />

      <BookmarkImportDialog />
      <AlbumDialog />

      <AlbumPhotosDialog />

      <AlbumPhotoDialog />

      <MusicPlaylistDialog />

      <MusicTracksDialog />

      <MusicTrackDialog />

      <MediaPickerDialog />
    </>
  );
}
