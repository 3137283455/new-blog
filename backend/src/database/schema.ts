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

    -- Logical media folders. Physical files remain date-partitioned on disk.
    CREATE TABLE IF NOT EXISTS media_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      parent_id INTEGER REFERENCES media_folders(id) ON DELETE RESTRICT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
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
      folder_id INTEGER REFERENCES media_folders(id) ON DELETE SET NULL,
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
      external_id TEXT DEFAULT '',
      source TEXT DEFAULT '',
      type TEXT DEFAULT '',
      total_episodes INTEGER DEFAULT 0,
      play_links TEXT DEFAULT '[]',
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

    CREATE TABLE IF NOT EXISTS bangumi_play_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bangumi_id INTEGER NOT NULL REFERENCES bangumi_items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      remark TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 漫画收藏：元数据与可切换阅读源
    CREATE TABLE IF NOT EXISTS manga_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      original_title TEXT DEFAULT '',
      author TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      description TEXT DEFAULT '',
      external_id TEXT DEFAULT '',
      source TEXT DEFAULT '',
      source_url TEXT DEFAULT '',
      status TEXT DEFAULT 'reading',
      progress TEXT DEFAULT '',
      rating REAL DEFAULT 0,
      publication TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS manga_read_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manga_id INTEGER NOT NULL REFERENCES manga_items(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      url TEXT NOT NULL,
      remark TEXT DEFAULT '',
      is_default INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS manga_volumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      manga_id INTEGER NOT NULL REFERENCES manga_items(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(manga_id, slug)
    );
    CREATE TABLE IF NOT EXISTS manga_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volume_id INTEGER NOT NULL REFERENCES manga_volumes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      source_filename TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(volume_id, slug)
    );
    CREATE TABLE IF NOT EXISTS manga_pages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chapter_id INTEGER NOT NULL REFERENCES manga_chapters(id) ON DELETE CASCADE,
      image_url TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS manga_reading_states (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      manga_id INTEGER NOT NULL REFERENCES manga_items(id) ON DELETE CASCADE,
      volume_id INTEGER REFERENCES manga_volumes(id) ON DELETE SET NULL,
      chapter_id INTEGER REFERENCES manga_chapters(id) ON DELETE SET NULL,
      page_index INTEGER DEFAULT 0,
      mode TEXT DEFAULT 'scroll',
      settings TEXT DEFAULT '{}',
      revision INTEGER DEFAULT 0,
      device_id INTEGER REFERENCES private_devices(id) ON DELETE SET NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, manga_id)
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

    -- 文章专题 / 系列
    CREATE TABLE IF NOT EXISTS article_series (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      status TEXT DEFAULT 'published',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 独立书库：书籍 / 分卷 / 章节
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      author TEXT DEFAULT '',
      description TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      status TEXT DEFAULT 'published',
      reading_status TEXT DEFAULT 'reading',
      sort_order INTEGER DEFAULT 0,
      is_featured INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT
    );
    CREATE TABLE IF NOT EXISTS book_volumes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT DEFAULT '',
      cover TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      source_filename TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      deleted_at TEXT,
      UNIQUE(book_id, slug)
    );
    CREATE TABLE IF NOT EXISTS book_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      volume_id INTEGER NOT NULL REFERENCES book_volumes(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      content_html TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      source_key TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(volume_id, slug)
    );
    CREATE TABLE IF NOT EXISTS private_devices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      platform TEXT DEFAULT '',
      client_id TEXT DEFAULT '',
      token_hash TEXT NOT NULL UNIQUE,
      last_seen_at TEXT DEFAULT (datetime('now')),
      revoked_at TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS personal_sync_state (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      navigation_state TEXT DEFAULT '{}',
      navigation_revision INTEGER DEFAULT 0,
      updated_by_device_id INTEGER REFERENCES private_devices(id) ON DELETE SET NULL,
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS reading_states (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      volume_id INTEGER REFERENCES book_volumes(id) ON DELETE SET NULL,
      chapter_id INTEGER REFERENCES book_chapters(id) ON DELETE SET NULL,
      mode TEXT DEFAULT 'scroll',
      position REAL DEFAULT 0,
      anchor TEXT DEFAULT '',
      settings TEXT DEFAULT '{}',
      revision INTEGER DEFAULT 0,
      device_id INTEGER REFERENCES private_devices(id) ON DELETE SET NULL,
      updated_at TEXT DEFAULT (datetime('now')),
      PRIMARY KEY(user_id, book_id)
    );
    CREATE TABLE IF NOT EXISTS reader_annotations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      book_id INTEGER NOT NULL REFERENCES books(id) ON DELETE CASCADE,
      volume_id INTEGER REFERENCES book_volumes(id) ON DELETE CASCADE,
      chapter_id INTEGER REFERENCES book_chapters(id) ON DELETE CASCADE,
      type TEXT NOT NULL DEFAULT 'bookmark',
      quote TEXT DEFAULT '',
      prefix TEXT DEFAULT '',
      suffix TEXT DEFAULT '',
      note TEXT DEFAULT '',
      color TEXT DEFAULT '',
      position TEXT DEFAULT '{}',
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    -- 个人收集箱
    CREATE TABLE IF NOT EXISTS personal_inbox (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT DEFAULT 'idea',
      content TEXT NOT NULL,
      url TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'homepage',
      converted_type TEXT DEFAULT '',
      converted_id INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 个人待办
    CREATE TABLE IF NOT EXISTS personal_todos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      done INTEGER DEFAULT 0,
      source_inbox_id INTEGER REFERENCES personal_inbox(id) ON DELETE SET NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- 音乐播放记录
    CREATE TABLE IF NOT EXISTS music_play_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      track_id INTEGER NOT NULL REFERENCES music_tracks(id) ON DELETE CASCADE,
      played_at TEXT DEFAULT (datetime('now'))
    );

    -- 七项个人中枢能力
    CREATE TABLE IF NOT EXISTS content_import_jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      kind TEXT NOT NULL DEFAULT 'unknown',
      filename TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      progress INTEGER NOT NULL DEFAULT 0,
      result_type TEXT DEFAULT '',
      result_id INTEGER,
      error TEXT DEFAULT '',
      options TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS content_subscriptions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      kind TEXT NOT NULL DEFAULT 'web',
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      icon TEXT DEFAULT '',
      check_interval INTEGER DEFAULT 360,
      last_checked_at TEXT,
      last_changed_at TEXT,
      last_signature TEXT DEFAULT '',
      unread_count INTEGER DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, url)
    );
    CREATE TABLE IF NOT EXISTS content_relations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'related',
      note TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      UNIQUE(source_type, source_id, target_type, target_id, relation_type)
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
    CREATE INDEX IF NOT EXISTS idx_bangumi_play_sources_item
      ON bangumi_play_sources(bangumi_id, is_default DESC, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_manga_public
      ON manga_items(is_active, status, sort_order);
    CREATE INDEX IF NOT EXISTS idx_manga_read_sources_item
      ON manga_read_sources(manga_id, is_default DESC, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_manga_volumes_item ON manga_volumes(manga_id, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_manga_chapters_volume ON manga_chapters(volume_id, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_manga_pages_chapter ON manga_pages(chapter_id, sort_order, id);
    CREATE INDEX IF NOT EXISTS idx_albums_public
      ON albums(is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_album_photos_album
      ON album_photos(album_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_music_playlists_public
      ON music_playlists(is_active, sort_order);
    CREATE INDEX IF NOT EXISTS idx_music_tracks_public
      ON music_tracks(is_active, playlist_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_article_series_public
      ON article_series(status, is_featured, sort_order);
    CREATE INDEX IF NOT EXISTS idx_books_public ON books(status, deleted_at, is_featured, sort_order);
    CREATE INDEX IF NOT EXISTS idx_book_volumes_book ON book_volumes(book_id, deleted_at, sort_order);
    CREATE INDEX IF NOT EXISTS idx_book_chapters_volume ON book_chapters(volume_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_private_devices_user ON private_devices(user_id, revoked_at, last_seen_at);
    CREATE INDEX IF NOT EXISTS idx_reader_annotations_book ON reader_annotations(user_id, book_id, status, updated_at);    CREATE INDEX IF NOT EXISTS idx_personal_inbox_status
      ON personal_inbox(status, created_at);
    CREATE INDEX IF NOT EXISTS idx_personal_todos_done
      ON personal_todos(done, created_at);
    CREATE INDEX IF NOT EXISTS idx_music_play_logs_track
      ON music_play_logs(track_id, played_at);
    CREATE INDEX IF NOT EXISTS idx_import_jobs_created ON content_import_jobs(created_at DESC, status);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON content_subscriptions(user_id, is_active, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_relations_source ON content_relations(source_type, source_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON content_relations(target_type, target_id);
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

  const addBangumiColumn = (column: string, definition: string) => {
    try {
      db.prepare(`ALTER TABLE bangumi_items ADD COLUMN ${column} ${definition}`).run()
    } catch {
      // Existing databases already have the column.
    }
  }
  addBangumiColumn('external_id', "TEXT DEFAULT ''")
  addBangumiColumn('source', "TEXT DEFAULT ''")
  addBangumiColumn('type', "TEXT DEFAULT ''")
  addBangumiColumn('total_episodes', 'INTEGER DEFAULT 0')
  addBangumiColumn('play_links', "TEXT DEFAULT '[]'")

  try {
    const legacyRows = db.prepare(`
      SELECT id, play_links
      FROM bangumi_items
      WHERE play_links IS NOT NULL
        AND TRIM(play_links) NOT IN ('', '[]')
        AND NOT EXISTS (
          SELECT 1 FROM bangumi_play_sources
          WHERE bangumi_play_sources.bangumi_id = bangumi_items.id
        )
    `).all() as Array<{ id: number; play_links: string }>
    const insertSource = db.prepare(`
      INSERT INTO bangumi_play_sources
        (bangumi_id, name, url, remark, is_default, sort_order)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    const importLegacySources = db.transaction(() => {
      for (const row of legacyRows) {
        let links: any[] = []
        let defaultAssigned = false
        try {
          const parsed = JSON.parse(row.play_links)
          links = Array.isArray(parsed) ? parsed : []
        } catch {
          links = row.play_links.split(/\r?\n/).map((line) => {
            const [name, url, ...remark] = line.split('|')
            return { name, url, remark: remark.join('|') }
          })
        }
        links
          .filter((link) => String(link?.url || '').trim())
          .slice(0, 20)
          .forEach((link, index) => {
            const requestedDefault = Boolean(link?.is_default || link?.isDefault)
            const isDefault = requestedDefault && !defaultAssigned
            if (isDefault) defaultAssigned = true
            insertSource.run(
              row.id,
              String(link?.name || '播放源').trim().slice(0, 60),
              String(link.url).trim().slice(0, 500),
              String(link?.remark || '').trim().slice(0, 120),
              isDefault ? 1 : 0,
              Number.isFinite(Number(link?.sort_order)) ? Math.trunc(Number(link.sort_order)) : index,
            )
          })
      }
    })
    importLegacySources()
  } catch {
    // Keep startup compatible with partially migrated databases.
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

  const addColumn = (table: string, column: string, definition: string) => {
    try {
      db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run()
    } catch {
      // Existing databases already have the column.
    }
  }
  addColumn('articles', 'series_id', 'INTEGER REFERENCES article_series(id) ON DELETE SET NULL')
  addColumn('articles', 'series_order', 'INTEGER DEFAULT 0')
  addColumn('articles', 'music_track_id', 'INTEGER REFERENCES music_tracks(id) ON DELETE SET NULL')
  addColumn('navigation_links', 'workspace', "TEXT DEFAULT 'general'")
  addColumn('albums', 'story_mode', 'INTEGER DEFAULT 0')
  addColumn('album_photos', 'captured_at', "TEXT DEFAULT ''")
  addColumn('album_photos', 'camera', "TEXT DEFAULT ''")
  addColumn('album_photos', 'photo_location', "TEXT DEFAULT ''")
  addColumn('album_photos', 'story_text', "TEXT DEFAULT ''")
  addColumn('bangumi_items', 'watched_episodes', 'INTEGER DEFAULT 0')
  addColumn('bangumi_items', 'episode_duration', 'INTEGER DEFAULT 24')
  addColumn('bangumi_items', 'update_weekday', 'INTEGER DEFAULT 0')
  addColumn('bangumi_items', 'article_id', 'INTEGER REFERENCES articles(id) ON DELETE SET NULL')
  addColumn('music_tracks', 'article_id', 'INTEGER REFERENCES articles(id) ON DELETE SET NULL')
  addColumn('music_tracks', 'photo_id', 'INTEGER REFERENCES album_photos(id) ON DELETE SET NULL')
  addColumn('media', 'folder_id', 'INTEGER REFERENCES media_folders(id) ON DELETE SET NULL')
  addColumn('article_series', 'series_type', "TEXT DEFAULT 'article'")
  addColumn('article_series', 'book_id', 'INTEGER REFERENCES books(id) ON DELETE SET NULL')
  addColumn('comments', 'book_volume_id', 'INTEGER REFERENCES book_volumes(id) ON DELETE CASCADE')
  addColumn('private_devices', 'client_id', "TEXT DEFAULT ''")
  addColumn('books', 'reading_mode', "TEXT DEFAULT 'chapters'")
  addColumn('books', 'reading_url', "TEXT DEFAULT ''")
  addColumn('books', 'source_format', "TEXT DEFAULT 'epub'")
  addColumn('manga_items', 'library_type', "TEXT DEFAULT 'network'")

  try {
    db.exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_private_devices_user_client ON private_devices(user_id, client_id) WHERE client_id != ''")
  } catch {
    // Existing device rows without a client id remain compatible.
  }

  try {
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_media_folder_name
        ON media(folder_id, original_name, deleted_at);
      CREATE INDEX IF NOT EXISTS idx_media_folders_parent
        ON media_folders(parent_id, name);
    `)
  } catch {
    // Keep startup resilient on partially migrated databases.
  }

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

  try {
    const legacyVolumes = db.prepare(`
      SELECT v.* FROM book_volumes v
      WHERE v.deleted_at IS NULL
        AND trim(v.title) IN ('正文', '全文', '全书', '未分卷')
        AND (SELECT COUNT(*) FROM book_volumes sibling WHERE sibling.book_id = v.book_id AND sibling.deleted_at IS NULL) = 1
    `).all() as any[]
    const markerPattern = /(?:第\s*[0-9一二三四五六七八九十百零〇两]+\s*卷|卷\s*[0-9一二三四五六七八九十百零〇两]+|\bvol(?:ume)?[.\s_-]*\d+\b)/i
    const volumeSlug = (bookId: number, title: string, excludeId = 0) => {
      const base = String(title || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '') || 'volume'
      let slug = base, index = 2
      while (db.prepare('SELECT 1 FROM book_volumes WHERE book_id = ? AND slug = ? AND id != ?').get(bookId, slug, excludeId)) slug = `${base}-${index++}`
      return slug
    }
    const repairLegacyVolume = db.transaction((volume: any) => {
      const chapters = db.prepare('SELECT id, title FROM book_chapters WHERE volume_id = ? ORDER BY sort_order, id').all(volume.id) as any[]
      const markers = chapters.map((chapter, index) => markerPattern.test(String(chapter.title || '')) ? index : -1).filter(index => index >= 0)
      if (!markers.length) return false
      const groups = markers.map((markerIndex, index) => ({
        title: String(chapters[markerIndex].title || `第 ${index + 1} 卷`),
        chapters: chapters.slice(index === 0 ? 0 : markerIndex, markers[index + 1] ?? chapters.length),
      }))
      db.prepare("UPDATE book_volumes SET title = ?, slug = ?, updated_at = datetime('now') WHERE id = ?")
        .run(groups[0].title, volumeSlug(volume.book_id, groups[0].title, volume.id), volume.id)
      groups.forEach((group, groupIndex) => {
        let targetId = Number(volume.id)
        if (groupIndex > 0) {
          const inserted = db.prepare('INSERT INTO book_volumes (book_id, title, slug, sort_order, source_filename) VALUES (?, ?, ?, ?, ?)')
            .run(volume.book_id, group.title, volumeSlug(volume.book_id, group.title), Number(volume.sort_order || 0) + groupIndex, volume.source_filename || '')
          targetId = Number(inserted.lastInsertRowid)
        }
        group.chapters.forEach((chapter: any, chapterIndex: number) => {
          db.prepare('UPDATE book_chapters SET volume_id = ?, sort_order = ? WHERE id = ?').run(targetId, chapterIndex, chapter.id)
        })
      })
      db.prepare('UPDATE reader_annotations SET volume_id = (SELECT volume_id FROM book_chapters WHERE id = reader_annotations.chapter_id) WHERE book_id = ? AND chapter_id IS NOT NULL').run(volume.book_id)
      db.prepare('UPDATE reading_states SET volume_id = (SELECT volume_id FROM book_chapters WHERE id = reading_states.chapter_id) WHERE book_id = ? AND chapter_id IS NOT NULL').run(volume.book_id)
      db.prepare("UPDATE books SET updated_at = datetime('now') WHERE id = ?").run(volume.book_id)
      return true
    })
    legacyVolumes.forEach(volume => repairLegacyVolume(volume))
  } catch {
    // Existing libraries remain readable even if a legacy volume cannot be restructured.
  }
  console.log('[DB] 数据库迁移完成')
}

// 直接运行时执行迁移
if (require.main === module) {
  migrate()
}
