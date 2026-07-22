import { Response } from 'express'
import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'
import db from '../config/database'
import { config } from '../config'
import { success, error } from '../utils/response'
import { renderMarkdown } from '../utils/markdown'
import { AuthRequest } from '../middleware/auth'

const APP_TABLES = [
  'users',
  'categories',
  'tags',
  'articles',
  'article_tags',
  'comments',
  'pages',
  'media',
  'settings',
  'likes',
  'visitor_logs',
  'themes',
  'plugins',
  'navigation_links',
  'bangumi_items',
  'albums',
  'album_photos',
  'music_playlists',
  'music_tracks',
] as const

const DELETE_ORDER = [...APP_TABLES].reverse()
const REQUIRED_BACKUP_TABLES = ['users', 'articles', 'settings']

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-')
}

function backupDirectory() {
  const directory = path.resolve(config.uploadDir, '../backups')
  fs.mkdirSync(directory, { recursive: true })
  return directory
}

function quoteIdentifier(value: string) {
  return `"${value.replace(/"/g, '""')}"`
}

function tableNames(connection: Database.Database, schema = 'main') {
  return new Set(
    (connection.prepare(`SELECT name FROM ${schema}.sqlite_master WHERE type = 'table'`).all() as Array<{ name: string }>)
      .map((row) => row.name),
  )
}

function tableColumns(connection: Database.Database, schema: string, table: string) {
  return (connection.prepare(`PRAGMA ${schema}.table_info(${quoteIdentifier(table)})`).all() as Array<{ name: string }>)
    .map((column) => column.name)
}

function sqliteHeaderIsValid(buffer: Buffer) {
  return buffer.length >= 16 && buffer.subarray(0, 16).toString('utf8') === 'SQLite format 3\u0000'
}

function validateDatabaseFile(filename: string) {
  const candidate = new Database(filename, { readonly: true, fileMustExist: true })
  try {
    const integrity = candidate.pragma('integrity_check', { simple: true })
    if (integrity !== 'ok') throw new Error(`SQLite 完整性检查失败：${String(integrity)}`)
    const tables = tableNames(candidate)
    const missing = REQUIRED_BACKUP_TABLES.filter((table) => !tables.has(table))
    if (missing.length) throw new Error(`备份缺少必要数据表：${missing.join('、')}`)
    return tables
  } finally {
    candidate.close()
  }
}

async function createDatabaseSnapshot(prefix = 'blog') {
  const filename = `${prefix}-${timestamp()}.db`
  const target = path.join(backupDirectory(), filename)
  await db.backup(target)
  return { filename, target }
}

export async function databaseBackup(_req: AuthRequest, res: Response) {
  if (!fs.existsSync(config.dbPath)) {
    return error(res, '数据库文件不存在', 'DB_NOT_FOUND', 404)
  }

  try {
    const snapshot = await createDatabaseSnapshot('blog')
    return res.download(snapshot.target, snapshot.filename)
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '数据库备份失败', 'BACKUP_FAILED', 500)
  }
}

export async function restoreDatabase(req: AuthRequest, res: Response) {
  if (!req.file?.buffer) return error(res, '请选择数据库备份文件', 'FILE_REQUIRED', 400)
  if (!sqliteHeaderIsValid(req.file.buffer)) return error(res, '文件不是有效的 SQLite 数据库', 'INVALID_DATABASE', 400)

  const staging = path.join(backupDirectory(), `restore-staging-${timestamp()}.db`)
  fs.writeFileSync(staging, req.file.buffer)

  let attached = false
  let foreignKeysDisabled = false
  try {
    const backupTables = validateDatabaseFile(staging)
    const safetySnapshot = await createDatabaseSnapshot('before-restore')
    const currentTables = tableNames(db)
    const restorableTables = APP_TABLES.filter((table) => currentTables.has(table) && backupTables.has(table))

    db.pragma('foreign_keys = OFF')
    foreignKeysDisabled = true
    db.prepare('ATTACH DATABASE ? AS restore_db').run(staging)
    attached = true

    const restore = db.transaction(() => {
      for (const table of DELETE_ORDER) {
        if (restorableTables.includes(table)) {
          db.prepare(`DELETE FROM main.${quoteIdentifier(table)}`).run()
        }
      }

      for (const table of APP_TABLES) {
        if (!restorableTables.includes(table)) continue
        const currentColumns = tableColumns(db, 'main', table)
        const backupColumns = new Set(tableColumns(db, 'restore_db', table))
        const columns = currentColumns.filter((column) => backupColumns.has(column))
        if (!columns.length) continue
        const columnList = columns.map(quoteIdentifier).join(', ')
        db.prepare(`INSERT INTO main.${quoteIdentifier(table)} (${columnList}) SELECT ${columnList} FROM restore_db.${quoteIdentifier(table)}`).run()
      }
    })

    restore()
    try {
      db.prepare("INSERT INTO articles_fts(articles_fts) VALUES ('rebuild')").run()
    } catch {
      // Older backups or SQLite builds may not expose FTS5.
    }

    db.prepare('DETACH DATABASE restore_db').run()
    attached = false
    db.pragma('foreign_keys = ON')
    foreignKeysDisabled = false

    return success(res, {
      restored_tables: restorableTables,
      safety_backup: safetySnapshot.filename,
    }, `数据库恢复完成，共恢复 ${restorableTables.length} 个数据表`)
  } catch (cause) {
    if (attached) {
      try { db.prepare('DETACH DATABASE restore_db').run() } catch { /* Ignore detach failures. */ }
    }
    if (foreignKeysDisabled) db.pragma('foreign_keys = ON')
    return error(res, cause instanceof Error ? cause.message : '数据库恢复失败', 'RESTORE_FAILED', 400)
  } finally {
    fs.rmSync(staging, { force: true })
  }
}

function parseFrontmatter(markdown: string) {
  const normalized = String(markdown || '').replace(/^\uFEFF/, '')
  if (!normalized.startsWith('---\n')) return { metadata: {} as Record<string, unknown>, content: normalized }
  const end = normalized.indexOf('\n---\n', 4)
  if (end < 0) return { metadata: {} as Record<string, unknown>, content: normalized }
  const metadata: Record<string, unknown> = {}
  for (const line of normalized.slice(4, end).split('\n')) {
    const separator = line.indexOf(':')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const raw = line.slice(separator + 1).trim()
    try {
      metadata[key] = JSON.parse(raw)
    } catch {
      metadata[key] = raw
    }
  }
  return { metadata, content: normalized.slice(end + 5) }
}

function makeSlug(value: string, fallback: string) {
  const slug = String(value || '').trim().toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return (slug || fallback).slice(0, 180)
}

function ensureCategory(name: string) {
  if (!name) return null
  const existing = db.prepare('SELECT id FROM categories WHERE name = ?').get(name) as { id: number } | undefined
  if (existing) return existing.id
  const slug = makeSlug(name, `category-${Date.now()}`)
  db.prepare('INSERT OR IGNORE INTO categories (name, slug) VALUES (?, ?)').run(name, slug)
  return (db.prepare('SELECT id FROM categories WHERE name = ? OR slug = ? LIMIT 1').get(name, slug) as { id: number }).id
}

function ensureTag(name: string) {
  const existing = db.prepare('SELECT id FROM tags WHERE name = ?').get(name) as { id: number } | undefined
  if (existing) return existing.id
  const slug = makeSlug(name, `tag-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`)
  db.prepare('INSERT OR IGNORE INTO tags (name, slug) VALUES (?, ?)').run(name, slug)
  return (db.prepare('SELECT id FROM tags WHERE name = ? OR slug = ? LIMIT 1').get(name, slug) as { id: number }).id
}

export function restoreArticles(req: AuthRequest, res: Response) {
  if (!req.file?.buffer) return error(res, '请选择文章 JSON 文件', 'FILE_REQUIRED', 400)

  try {
    const parsed = JSON.parse(req.file.buffer.toString('utf8').replace(/^\uFEFF/, ''))
    const items = Array.isArray(parsed) ? parsed : parsed?.data
    if (!Array.isArray(items)) return error(res, '文章备份格式不正确', 'INVALID_ARTICLE_BACKUP', 400)
    if (items.length > 5000) return error(res, '单次最多导入 5000 篇文章', 'IMPORT_LIMIT', 400)

    let created = 0
    let updated = 0
    const importArticles = db.transaction(() => {
      for (let index = 0; index < items.length; index++) {
        const item = items[index] || {}
        const frontmatter = parseFrontmatter(item.markdown || '')
        const metadata = { ...frontmatter.metadata, ...item }
        const title = String(metadata.title || '').trim().slice(0, 240)
        const content = String(item.content ?? frontmatter.content ?? '')
        if (!title || !content) throw new Error(`第 ${index + 1} 篇文章缺少标题或正文`)
        const slug = makeSlug(String(metadata.slug || title), `article-${Date.now()}-${index}`)
        const status = metadata.status === 'published' ? 'published' : 'draft'
        const visibility = ['public', 'private', 'password'].includes(String(metadata.visibility)) ? String(metadata.visibility) : 'public'
        const categoryName = String(metadata.category || metadata.category_name || '').trim().slice(0, 80)
        const categoryId = ensureCategory(categoryName)
        const tags: string[] = Array.isArray(metadata.tags)
          ? metadata.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean).slice(0, 50)
          : []
        const existing = db.prepare('SELECT id FROM articles WHERE slug = ?').get(slug) as { id: number } | undefined
        const contentHtml = renderMarkdown(content)
        let articleId: number

        if (existing) {
          db.prepare(`
            UPDATE articles SET title = ?, content = ?, content_html = ?, excerpt = ?, status = ?, visibility = ?,
              category_id = ?, published_at = ?, updated_at = datetime('now'), deleted_at = NULL
            WHERE id = ?
          `).run(
            title,
            content,
            contentHtml,
            String(metadata.excerpt || '').slice(0, 1000),
            status,
            visibility,
            categoryId,
            metadata.published_at || (status === 'published' ? new Date().toISOString() : null),
            existing.id,
          )
          articleId = existing.id
          updated++
        } else {
          const result = db.prepare(`
            INSERT INTO articles
              (title, slug, content, content_html, excerpt, status, visibility, author_id, category_id, published_at, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')), COALESCE(?, datetime('now')))
          `).run(
            title,
            slug,
            content,
            contentHtml,
            String(metadata.excerpt || '').slice(0, 1000),
            status,
            visibility,
            req.userId || null,
            categoryId,
            metadata.published_at || (status === 'published' ? new Date().toISOString() : null),
            metadata.created_at || null,
            metadata.updated_at || null,
          )
          articleId = Number(result.lastInsertRowid)
          created++
        }

        db.prepare('DELETE FROM article_tags WHERE article_id = ?').run(articleId)
        const insertTag = db.prepare('INSERT OR IGNORE INTO article_tags (article_id, tag_id) VALUES (?, ?)')
        for (const tagName of tags) insertTag.run(articleId, ensureTag(tagName.slice(0, 80)))
      }
    })

    importArticles()
    return success(res, { total: items.length, created, updated }, `文章导入完成：新建 ${created} 篇，更新 ${updated} 篇`)
  } catch (cause) {
    return error(res, cause instanceof Error ? cause.message : '文章导入失败', 'ARTICLE_IMPORT_FAILED', 400)
  }
}

export function articlesMarkdown(_req: AuthRequest, res: Response) {
  const rows = db.prepare(`
    SELECT
      a.id, a.title, a.slug, a.status, a.visibility, a.excerpt, a.content,
      a.created_at, a.updated_at, a.published_at,
      c.name AS category_name,
      GROUP_CONCAT(t.name) AS tag_names
    FROM articles a
    LEFT JOIN categories c ON c.id = a.category_id
    LEFT JOIN article_tags at ON at.article_id = a.id
    LEFT JOIN tags t ON t.id = at.tag_id
    WHERE a.deleted_at IS NULL
    GROUP BY a.id
    ORDER BY a.created_at DESC
  `).all() as any[]

  const payload = rows.map((row) => {
    const tags = String(row.tag_names || '').split(',').map((item) => item.trim()).filter(Boolean)
    const frontmatter = [
      '---',
      `title: ${JSON.stringify(row.title || '')}`,
      `slug: ${JSON.stringify(row.slug || '')}`,
      `status: ${JSON.stringify(row.status || '')}`,
      `visibility: ${JSON.stringify(row.visibility || '')}`,
      `category: ${JSON.stringify(row.category_name || '')}`,
      `tags: ${JSON.stringify(tags)}`,
      `created_at: ${JSON.stringify(row.created_at || '')}`,
      `updated_at: ${JSON.stringify(row.updated_at || '')}`,
      `published_at: ${JSON.stringify(row.published_at || '')}`,
      `excerpt: ${JSON.stringify(row.excerpt || '')}`,
      '---',
      '',
    ].join('\n')
    return {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      visibility: row.visibility,
      category: row.category_name || '',
      tags,
      excerpt: row.excerpt || '',
      content: row.content || '',
      created_at: row.created_at,
      updated_at: row.updated_at,
      published_at: row.published_at,
      filename: `${row.slug || row.id}.md`,
      markdown: `${frontmatter}${row.content || ''}`,
    }
  })

  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="articles-${timestamp()}.json"`)
  return res.json({ success: true, data: payload, message: '文章导出成功' })
}

export function manifest(_req: AuthRequest, res: Response) {
  const articles = (db.prepare('SELECT COUNT(*) as count FROM articles WHERE deleted_at IS NULL').get() as any).count
  const media = (db.prepare('SELECT COUNT(*) as count FROM media WHERE deleted_at IS NULL').get() as any).count
  const trashedMedia = (db.prepare('SELECT COUNT(*) as count FROM media WHERE deleted_at IS NOT NULL').get() as any).count
  const settings = db.prepare('SELECT key, value, type FROM settings ORDER BY key').all()
  return success(res, {
    generated_at: new Date().toISOString(),
    database_path: config.dbPath,
    upload_dir: config.uploadDir,
    counts: { articles, media, trashedMedia },
    settings,
  }, '备份清单生成成功')
}
