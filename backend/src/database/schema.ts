import db from '../config/database'

export function migrate() {
  db.exec(`
    -- 用户表
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      nickname TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      role TEXT DEFAULT 'admin',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 分类表
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 标签表
    CREATE TABLE IF NOT EXISTS tags (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 文章表
    CREATE TABLE IF NOT EXISTS articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT DEFAULT '',
      content_html TEXT DEFAULT '',
      excerpt TEXT DEFAULT '',
      cover_image TEXT DEFAULT '',
      status TEXT DEFAULT 'draft',
      visibility TEXT DEFAULT 'public',
      password TEXT DEFAULT '',
      is_pinned INTEGER DEFAULT 0,
      is_recommended INTEGER DEFAULT 0,
      title_font_family TEXT DEFAULT '',
      title_font_url TEXT DEFAULT '',
      body_font_family TEXT DEFAULT '',
      body_font_url TEXT DEFAULT '',
      author_id INTEGER REFERENCES users(id),
      category_id INTEGER REFERENCES categories(id),
      view_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      published_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- 文章-标签关联
    CREATE TABLE IF NOT EXISTS article_tags (
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      tag_id INTEGER REFERENCES tags(id) ON DELETE CASCADE,
      PRIMARY KEY (article_id, tag_id)
    );

    -- 评论表
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      page_id INTEGER,
      parent_id INTEGER REFERENCES comments(id) ON DELETE CASCADE,
      author_name TEXT NOT NULL,
      author_email TEXT DEFAULT '',
      author_url TEXT DEFAULT '',
      content TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 自定义页面表
    CREATE TABLE IF NOT EXISTS pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      content TEXT DEFAULT '',
      content_html TEXT DEFAULT '',
      template TEXT DEFAULT 'default',
      status TEXT DEFAULT 'published',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- 媒体资源表
    CREATE TABLE IF NOT EXISTS media (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      path TEXT NOT NULL,
      mime_type TEXT DEFAULT '',
      size INTEGER DEFAULT 0,
      width INTEGER,
      height INTEGER,
      alt_text TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );

    -- 设置表
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL UNIQUE,
      value TEXT,
      type TEXT DEFAULT 'string',
      description TEXT DEFAULT ''
    );

    -- 点赞表
    CREATE TABLE IF NOT EXISTS likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
      ip TEXT DEFAULT '',
      fingerprint TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 访客日志
    CREATE TABLE IF NOT EXISTS visitor_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip TEXT DEFAULT '',
      user_agent TEXT DEFAULT '',
      path TEXT DEFAULT '',
      referer TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- 主题表
    CREATE TABLE IF NOT EXISTS themes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT DEFAULT '1.0.0',
      author TEXT DEFAULT '',
      description TEXT DEFAULT '',
      screenshot TEXT DEFAULT '',
      is_active INTEGER DEFAULT 0,
      config TEXT DEFAULT '{}',
      installed_at TEXT DEFAULT (datetime('now'))
    );

    -- 插件表
    CREATE TABLE IF NOT EXISTS plugins (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT DEFAULT '1.0.0',
      author TEXT DEFAULT '',
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 0,
      config TEXT DEFAULT '{}',
      installed_at TEXT DEFAULT (datetime('now'))
    );

    -- 导航资源
    CREATE TABLE IF NOT EXISTS navigation_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      description TEXT DEFAULT '',
      category TEXT DEFAULT '默认',
      icon TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 追番列表
    CREATE TABLE IF NOT EXISTS bangumi_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      original_title TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      url TEXT DEFAULT '',
      status TEXT DEFAULT 'watching',
      progress TEXT DEFAULT '',
      rating REAL DEFAULT 0,
      season TEXT DEFAULT '',
      summary TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 相册
    CREATE TABLE IF NOT EXISTS albums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      event_date TEXT DEFAULT '',
      location TEXT DEFAULT '',
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 相册照片
    CREATE TABLE IF NOT EXISTS album_photos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      album_id INTEGER NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
      title TEXT DEFAULT '',
      image TEXT NOT NULL,
      description TEXT DEFAULT '',
      variant TEXT DEFAULT '1x1',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS music_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS music_tracks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER REFERENCES music_playlists(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      artist TEXT DEFAULT '',
      url TEXT NOT NULL,
      cover TEXT DEFAULT '',
      lyrics TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 全文搜索 FTS5
    CREATE VIRTUAL TABLE IF NOT EXISTS articles_fts USING fts5(
      title,
      content,
      excerpt,
      content='articles',
      content_rowid='id',
      tokenize='unicode61'
    );

    -- FTS 同步触发器
    CREATE TRIGGER IF NOT EXISTS articles_fts_insert AFTER INSERT ON articles BEGIN
      INSERT INTO articles_fts(rowid, title, content, excerpt)
      VALUES (new.id, new.title, new.content, new.excerpt);
    END;

    CREATE TRIGGER IF NOT EXISTS articles_fts_delete AFTER DELETE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, content, excerpt)
      VALUES ('delete', old.id, old.title, old.content, old.excerpt);
    END;

    CREATE TRIGGER IF NOT EXISTS articles_fts_update AFTER UPDATE ON articles BEGIN
      INSERT INTO articles_fts(articles_fts, rowid, title, content, excerpt)
      VALUES ('delete', old.id, old.title, old.content, old.excerpt);
      INSERT INTO articles_fts(rowid, title, content, excerpt)
      VALUES (new.id, new.title, new.content, new.excerpt);
    END;

    CREATE INDEX IF NOT EXISTS idx_articles_public_list
      ON articles(status, visibility, deleted_at, is_pinned, published_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_articles_category
      ON articles(category_id, status, deleted_at, published_at);
    CREATE INDEX IF NOT EXISTS idx_articles_deleted
      ON articles(deleted_at, updated_at);
    CREATE INDEX IF NOT EXISTS idx_article_tags_tag
      ON article_tags(tag_id, article_id);
    CREATE INDEX IF NOT EXISTS idx_comments_article_status
      ON comments(article_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_comments_status_created
      ON comments(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_pages_public
      ON pages(status, deleted_at, updated_at);
    CREATE INDEX IF NOT EXISTS idx_media_deleted_created
      ON media(deleted_at, created_at);
    CREATE INDEX IF NOT EXISTS idx_navigation_public
      ON navigation_links(is_active, category, sort_order);
    CREATE INDEX IF NOT EXISTS idx_bangumi_public
      ON bangumi_items(is_active, status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_albums_public
      ON albums(is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_album_photos_album
      ON album_photos(album_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_music_playlists_public
      ON music_playlists(is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_music_tracks_public
      ON music_tracks(is_active, playlist_id, sort_order);
  `)

  try {
    db.prepare("INSERT INTO articles_fts(articles_fts) VALUES ('rebuild')").run()
  } catch {
    // Keep startup resilient if FTS is unavailable in a local SQLite build.
  }

  try {
    db.prepare("ALTER TABLE navigation_links ADD COLUMN avatar TEXT DEFAULT ''").run()
  } catch {
    // Existing databases already have the column.
  }

  const addArticleColumn = (column: string) => {
    try {
      db.prepare(`ALTER TABLE articles ADD COLUMN ${column} TEXT DEFAULT ''`).run()
    } catch {
      // Existing databases already have the column.
    }
  }
  addArticleColumn('title_font_family')
  addArticleColumn('title_font_url')
  addArticleColumn('body_font_family')
  addArticleColumn('body_font_url')

  try {
    db.prepare("ALTER TABLE media ADD COLUMN deleted_at TEXT").run()
  } catch {
    // column exists
  }

  try {
    db.prepare("ALTER TABLE pages ADD COLUMN deleted_at TEXT").run()
  } catch {
    // column exists
  }

  try {
    const count = (db.prepare('SELECT COUNT(*) as count FROM music_tracks').get() as any)?.count || 0
    if (!count) {
      const row = db.prepare("SELECT value, type FROM settings WHERE key = 'music_playlist'").get() as any
      const legacyTracks = row?.value ? JSON.parse(row.value) : []
      if (Array.isArray(legacyTracks) && legacyTracks.length) {
        const playlistStmt = db.prepare(`
          INSERT OR IGNORE INTO music_playlists (name, sort_order, is_active)
          VALUES (?, ?, 1)
        `)
        const playlistIdStmt = db.prepare('SELECT id FROM music_playlists WHERE name = ?')
        const trackStmt = db.prepare(`
          INSERT INTO music_tracks (playlist_id, title, artist, url, cover, lyrics, sort_order, is_active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `)
        const migrateMusic = db.transaction((tracks: any[]) => {
          tracks.forEach((track, index) => {
            if (!track?.title || !track?.url) return
            const playlistName = track.playlist || track.collection || '默认歌单'
            playlistStmt.run(playlistName, index)
            const playlist = playlistIdStmt.get(playlistName) as any
            trackStmt.run(
              playlist?.id || null,
              track.title,
              track.artist || '',
              track.url,
              track.cover || '',
              track.lyrics || '',
              Number(track.sort_order ?? index),
            )
          })
        })
        migrateMusic(legacyTracks)
      }
    }
  } catch {
    // Legacy settings may be empty or malformed; keep migration non-blocking.
  }

  console.log('[DB] 数据库迁移完成')
}

// 直接运行时执行迁移
if (require.main === module) {
  migrate()
}
