import db from '../config/database'

export function migrateArticleSources() {
  db.exec(`CREATE TABLE IF NOT EXISTS article_web_sources (
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    source_url TEXT NOT NULL, final_url TEXT NOT NULL, title TEXT NOT NULL DEFAULT '',
    author TEXT NOT NULL DEFAULT '', published_at TEXT NOT NULL DEFAULT '',
    fetched_at TEXT NOT NULL DEFAULT '', fingerprint TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(article_id, source_url));
    CREATE INDEX IF NOT EXISTS article_web_fingerprint ON article_web_sources(fingerprint);`)
}
export function articleSources(id: number) {
  return db.prepare('SELECT * FROM article_web_sources WHERE article_id=?').all(id)
}
export function saveArticleSources(id: number, sources: unknown) {
  if (!Array.isArray(sources)) return
  const insert = db.prepare(`INSERT OR IGNORE INTO article_web_sources
    (article_id,source_url,final_url,title,author,published_at,fetched_at,fingerprint) VALUES (?,?,?,?,?,?,?,?)`)
  db.transaction(() => {
    for (const item of sources.slice(0, 30)) {
      if (!item || typeof item !== 'object' || !/^https?:\/\//i.test(String(item.source_url || ''))) continue
      const text = (key: string, max = 1000) => String(item[key] || '').slice(0, max)
      insert.run(id, text('source_url', 2000), text('final_url', 2000), text('title'), text('author'), text('published_at', 80), text('fetched_at', 80), text('fingerprint', 64))
    }
  })()
}
