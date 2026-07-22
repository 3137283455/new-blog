import db from '../config/database'
import bcrypt from 'bcryptjs'
import { migrate } from './schema'

export function seed() {
  migrate()

  const adminUsername = 'admin'
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin'
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

  // 主题与插件始终确保存在（INSERT OR IGNORE，支持增量补充）
  seedThemes()
  seedPlugins()
}

// ===== 预置主题 =====
function seedThemes() {
  const themes = [
    { id: 'default', name: '经典蓝', primary: '#3b82f6', hover: '#2563eb', light: '#dbeafe' },
    { id: 'sunset', name: '日落橙', primary: '#f97316', hover: '#ea580c', light: '#ffedd5' },
    { id: 'forest', name: '森林绿', primary: '#16a34a', hover: '#15803d', light: '#dcfce7' },
    { id: 'violet', name: '紫罗兰', primary: '#8b5cf6', hover: '#7c3aed', light: '#ede9fe' },
    { id: 'ocean', name: '海洋青', primary: '#0891b2', hover: '#0e7490', light: '#cffafe' },
    { id: 'rose', name: '玫瑰粉', primary: '#e11d48', hover: '#be123c', light: '#ffe4e6' },
  ]

  const stmt = db.prepare(`INSERT OR IGNORE INTO themes (id, name, version, author, description, screenshot, is_active, config)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)

  for (const t of themes) {
    const config = JSON.stringify({
      primary: t.primary,
      primary_hover: t.hover,
      primary_light: t.light,
    })
    stmt.run(t.id, t.name, '1.0.0', 'Boke', `${t.name}主题`, '', t.id === 'default' ? 1 : 0, config)
  }
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
      active: 0,
    },
    {
      id: 'word-count', name: '字数统计', description: '显示文章字数和预计阅读时长',
      active: 1,
    },
    {
      id: 'back-to-top', name: '回到顶部增强', description: '平滑回到顶部并显示阅读百分比',
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
