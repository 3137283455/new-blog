import db from '../config/database'
import bcrypt from 'bcryptjs'
import { migrate } from './schema'

export function seed() {
  migrate()

  const adminUsername = 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123'
  const isFirstRun = !db.prepare('SELECT id FROM users WHERE username = ?').get(adminUsername)

  if (isFirstRun) {
    // 创建默认管理员
    const passwordHash = bcrypt.hashSync(adminPassword, 10)
    db.prepare(`INSERT INTO users (username, password_hash, nickname, role) VALUES (?, ?, ?, ?)`).run(
      'admin', passwordHash, '管理员', 'admin'
    )

    // 创建默认分类
    const categories = ['技术', '生活', '随笔', '开源']
    const insertCat = db.prepare('INSERT INTO categories (name, slug, description) VALUES (?, ?, ?)')
    for (const cat of categories) {
      insertCat.run(cat, toSlug(cat), '')
    }

    // 创建示例页面
    db.prepare(`INSERT INTO pages (title, slug, content, content_html, template) VALUES (?, ?, ?, ?, ?)`).run(
      '关于我', 'about', '# 关于我\n\n这是我的个人博客。', '<h1>关于我</h1><p>这是我的个人博客。</p>', 'about'
    )
    db.prepare(`INSERT INTO pages (title, slug, content, content_html, template) VALUES (?, ?, ?, ?, ?)`).run(
      '留言板', 'guestbook', '# 留言板\n\n欢迎留言！', '<h1>留言板</h1><p>欢迎留言！</p>', 'guestbook'
    )

    // 创建默认设置
    const insertSetting = db.prepare('INSERT OR REPLACE INTO settings (key, value, type, description) VALUES (?, ?, ?, ?)')
    const settings: [string, string, string, string][] = [
      ['site_title', 'My Blog', 'string', '站点标题'],
      ['site_description', '个人博客', 'string', '站点描述'],
      ['site_author', '博主', 'string', '站点作者'],
      ['site_keywords', '个人博客,生活,记录', 'string', '搜索关键词'],
      ['site_language', 'zh-CN', 'string', '站点语言'],
      ['footer_text', '记录所想，分享所见。', 'string', '页脚文字'],
      ['site_start_date', '2026-01-01', 'string', '建站日期'],
      ['copyright_year', '2026', 'number', '版权年份'],
      ['banner_interval', '6', 'number', '首页轮播间隔秒数'],
      ['allow_search_indexing', 'true', 'boolean', '允许搜索引擎收录'],
      ['enable_rss', 'true', 'boolean', '显示 RSS'],
      ['enable_json_feed', 'true', 'boolean', '显示 JSON Feed'],
      ['show_visitor_stats', 'true', 'boolean', '显示访客统计'],
      ['posts_per_page', '10', 'number', '每页文章数'],
      ['enable_comments', 'true', 'boolean', '是否启用评论'],
      ['comment_moderation', 'true', 'boolean', '评论是否需要审核'],
      ['active_theme', 'default', 'string', '当前激活主题'],
    ]
    for (const s of settings) {
      insertSetting.run(...s)
    }

    console.log('[Seed] 种子数据创建完成')
    console.log('[Seed] 管理员账号: admin / admin123')
  } else {
    console.log('[Seed] 管理员已存在，跳过基础种子')
  }

  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, type, description)
    VALUES ('nav_search_engines', ?, 'json', '导航页搜索引擎')
  `).run(JSON.stringify([
    { id: 'site', name: '站内搜索', mark: '⌕', url: 'site:' },
    { id: 'bing', name: 'Bing', mark: 'B', url: 'https://www.bing.com/search?q={query}' },
    { id: 'baidu', name: '百度', mark: '百', url: 'https://www.baidu.com/s?wd={query}' },
    { id: 'google', name: 'Google', mark: 'G', url: 'https://www.google.com/search?q={query}' },
  ]))

  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, type, description)
    VALUES ('bangumi_search_source', 'bangumi_lol', 'string', '番剧检索数据源')
  `).run()
  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, type, description)
    VALUES ('storage_quota_bytes', ?, 'number', '站点总占用配额（字节）')
  `).run(String(15 * 1024 * 1024 * 1024))
  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, type, description)
    VALUES ('storage_warn_percent', '80', 'number', '存储空间普通告警阈值')
  `).run()
  db.prepare(`
    INSERT OR IGNORE INTO settings (key, value, type, description)
    VALUES ('storage_critical_percent', '90', 'number', '存储空间严重告警阈值')
  `).run()
  // 主题与插件始终确保存在（INSERT OR IGNORE，支持增量补充）
  seedThemes()
  seedPlugins()
}

// ===== 预置主题 =====
function seedThemes() {
  const themes = [
    {
      id: 'boke-green', name: '纸张绿', primary: '#5e7c61', hover: '#456249', light: '#e8f2e8',
      description: '前台明亮外观，纸张质感与自然绿色。',
      config: { card_radius: 22, card_opacity: 0.86, content_width: 72 },
    },
    {
      id: 'boke-night', name: '深海蓝', primary: '#7aa2d6', hover: '#5e8fcf', light: '#17243a',
      description: '前台暗色外观，适合夜间阅读。',
      config: { card_radius: 18, card_opacity: 0.86, content_width: 72 },
    },
    {
      id: 'boke-punk', name: '霓虹紫', primary: '#c86b9b', hover: '#d946ef', light: '#32133f',
      description: '前台高对比外观，紫色霓虹与青色点缀。',
      config: { card_radius: 12, card_opacity: 0.88, content_width: 72 },
    },
  ]

  const stmt = db.prepare(`INSERT OR IGNORE INTO themes (id, name, version, author, description, screenshot, is_active, config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

  for (const t of themes) {
    const config = JSON.stringify({
      primary: t.primary,
      primary_hover: t.hover,
      primary_light: t.light,
      body_font: 'system-ui',
      title_font: 'Georgia, serif',
      season: 'custom',
      ...t.config,
    })
    stmt.run(t.id, t.name, '1.0.0', 'Boke', t.description, '', 0, config)
  }

  const ids = themes.map((theme) => theme.id)
  const savedDefault = db.prepare("SELECT value FROM settings WHERE key = 'active_theme'").get() as { value?: string } | undefined
  const activeRow = db.prepare(`SELECT id FROM themes WHERE is_active = 1 AND id IN (${ids.map(() => '?').join(',')}) LIMIT 1`).get(...ids) as { id?: string } | undefined
  const preferred = ids.includes(String(savedDefault?.value || ''))
    ? String(savedDefault?.value)
    : (activeRow?.id || 'boke-green')
  db.prepare('UPDATE themes SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END').run(preferred)
  db.prepare("INSERT OR REPLACE INTO settings (key, value, type, description) VALUES ('active_theme', ?, 'string', '前台默认外观')").run(preferred)
}

// ===== 预置插件 =====
function seedPlugins() {
  const plugins = [
    {
      id: 'reading-progress', name: '阅读进度条', description: '文章页顶部显示阅读进度条',
      active: 1,
    },
    {
      id: 'table-of-contents', name: '文章目录', description: '自动生成文章目录，支持锚点跳转',
      active: 1,
    },
    {
      id: 'word-count', name: '字数统计', description: '显示文章字数和预计阅读时长',
      active: 1,
    },
    {
      id: 'back-to-top', name: '回到顶部增强', description: '平滑回到顶部并显示阅读百分比',
      active: 1,
    },
    {
      id: 'article-like', name: '文章点赞', description: '在文章操作栏显示点赞按钮和点赞数量',
      active: 1,
    },
    {
      id: 'reading-history', name: '阅读记录', description: '在当前浏览器保存阅读位置并在首页展示最近阅读',
      active: 1,
    },
    {
      id: 'article-bookmark', name: '文章收藏', description: '允许访客在当前浏览器收藏文章并在首页快速访问',
      active: 1,
    },
    {
      id: 'reading-mode', name: '沉浸阅读', description: '提供字号、行高、正文宽度和专注模式调节',
      active: 1,
    },
    {
      id: 'code-copy', name: '代码复制', description: '为文章代码块增加语言提示和一键复制按钮',
      active: 1,
    },
  ]

  const stmt = db.prepare(`INSERT OR IGNORE INTO plugins (id, name, version, author, description, is_active, config)
    VALUES (?, ?, ?, ?, ?, ?, ?)`)

  for (const p of plugins) {
    stmt.run(p.id, p.name, '1.0.0', 'Boke', p.description, p.active, '{}')
  }
}

function toSlug(text: string): string {
  let slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w一-鿿-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
  if (!slug) slug = 'cat-' + Date.now()
  return slug
}

if (require.main === module) {
  seed()
}
