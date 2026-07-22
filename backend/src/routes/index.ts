import { Router } from 'express'
import { auth, adminOnly } from '../middleware/auth'
import * as authCtrl from '../controllers/auth'
import * as articleCtrl from '../controllers/article'
import * as categoryCtrl from '../controllers/category'
import * as commentCtrl from '../controllers/comment'
import * as pageCtrl from '../controllers/page'
import * as mediaCtrl from '../controllers/media'
import * as dashboardCtrl from '../controllers/dashboard'
import * as themeCtrl from '../controllers/theme'
import * as pluginCtrl from '../controllers/plugin'
import * as settingCtrl from '../controllers/setting'
import * as navigationCtrl from '../controllers/navigation'
import * as bangumiCtrl from '../controllers/bangumi'
import * as albumCtrl from '../controllers/album'
import * as musicCtrl from '../controllers/music'
import * as markdownCtrl from '../controllers/markdown'
import * as backupCtrl from '../controllers/backup'
import { upload, backupUpload } from '../middleware/upload'

const router = Router()

// 认证
router.post('/auth/login', authCtrl.login)
router.get('/auth/me', auth, authCtrl.me)
router.put('/auth/me', auth, authCtrl.updateMe)

// 公开接口
router.get('/articles', articleCtrl.list)
router.get('/articles/search', articleCtrl.search)
router.get('/articles/:slug', articleCtrl.detail)
router.get('/categories', categoryCtrl.list)
router.get('/tags', categoryCtrl.tagList)
router.get('/pages', pageCtrl.publicList)
router.get('/pages/:slug', pageCtrl.getBySlug)
router.get('/navigation', navigationCtrl.publicList)
router.get('/bangumi', bangumiCtrl.publicList)
router.get('/albums', albumCtrl.publicList)
router.get('/albums/:id', albumCtrl.publicDetail)
router.get('/music', musicCtrl.publicList)
router.get('/articles/:id/comments', commentCtrl.list)
router.post('/articles/:id/comments', commentCtrl.create)
router.post('/articles/:id/like', articleCtrl.like)
router.get('/themes/active', themeCtrl.active)
router.get('/plugins/active', pluginCtrl.activePlugins)
router.get('/settings/public', settingCtrl.publicSettings)
router.get('/rss', articleCtrl.rss)
router.get('/visitors/count', dashboardCtrl.todayCount)

// 文章管理
router.get('/admin/articles', auth, articleCtrl.adminList)
router.get('/admin/articles/:id', auth, articleCtrl.getById)
router.post('/admin/articles', auth, articleCtrl.create)
router.put('/admin/articles/:id', auth, articleCtrl.update)
router.delete('/admin/articles/:id', auth, articleCtrl.softDelete)
router.post('/admin/articles/batch-delete', auth, articleCtrl.batchDelete)
router.put('/admin/articles/:id/restore', auth, articleCtrl.restore)
router.delete('/admin/articles/:id/force', auth, articleCtrl.forceDelete)
router.post('/admin/markdown/preview', auth, markdownCtrl.preview)

// 分类管理
router.post('/admin/categories', auth, categoryCtrl.create)
router.put('/admin/categories/:id', auth, categoryCtrl.update)
router.delete('/admin/categories/:id', auth, categoryCtrl.remove)

// 标签管理
router.post('/admin/tags', auth, categoryCtrl.createTag)
router.put('/admin/tags/:id', auth, categoryCtrl.updateTag)
router.delete('/admin/tags/:id', auth, categoryCtrl.removeTag)

// 评论管理
router.get('/admin/comments', auth, commentCtrl.adminList)
router.put('/admin/comments/:id/status', auth, commentCtrl.updateStatus)
router.delete('/admin/comments/:id', auth, commentCtrl.remove)

// 页面管理
router.get('/admin/pages', auth, pageCtrl.list)
router.post('/admin/pages', auth, pageCtrl.create)
router.put('/admin/pages/:id', auth, pageCtrl.update)
router.put('/admin/pages/:id/restore', auth, pageCtrl.restore)
router.delete('/admin/pages/:id/force', auth, pageCtrl.forceDelete)
router.delete('/admin/pages/:id', auth, pageCtrl.remove)

// 导航、追番、相册
router.get('/admin/navigation', auth, navigationCtrl.list)
router.post('/admin/navigation', auth, navigationCtrl.create)
router.put('/admin/navigation/:id', auth, navigationCtrl.update)
router.delete('/admin/navigation/:id', auth, navigationCtrl.remove)

router.get('/admin/bangumi', auth, bangumiCtrl.list)
router.post('/admin/bangumi', auth, bangumiCtrl.create)
router.put('/admin/bangumi/:id', auth, bangumiCtrl.update)
router.delete('/admin/bangumi/:id', auth, bangumiCtrl.remove)

router.get('/admin/albums', auth, albumCtrl.list)
router.post('/admin/albums', auth, albumCtrl.create)
router.put('/admin/albums/:id', auth, albumCtrl.update)
router.delete('/admin/albums/:id', auth, albumCtrl.remove)
router.post('/admin/album-photos', auth, albumCtrl.createPhoto)
router.put('/admin/album-photos/:photoId', auth, albumCtrl.updatePhoto)
router.delete('/admin/album-photos/:photoId', auth, albumCtrl.removePhoto)

router.get('/admin/music', auth, musicCtrl.list)
router.get('/admin/music/playlists', auth, musicCtrl.playlists)
router.post('/admin/music/playlists', auth, musicCtrl.createPlaylist)
router.put('/admin/music/playlists/:id', auth, musicCtrl.updatePlaylist)
router.delete('/admin/music/playlists/:id', auth, musicCtrl.removePlaylist)
router.put('/admin/music', auth, musicCtrl.replaceAll)

// 媒体管理
router.get('/admin/media', auth, mediaCtrl.list)
router.post('/admin/media/upload', auth, upload.single('file'), mediaCtrl.upload)
router.delete('/admin/media/:id', auth, mediaCtrl.remove)
router.put('/admin/media/:id/restore', auth, mediaCtrl.restore)
router.delete('/admin/media/:id/force', auth, mediaCtrl.forceDelete)
router.post('/admin/media/cleanup', auth, mediaCtrl.cleanup)

// 仪表盘
router.get('/admin/dashboard/stats', auth, dashboardCtrl.stats)
router.get('/admin/dashboard/charts', auth, dashboardCtrl.charts)
router.get('/admin/visitors/stats', auth, dashboardCtrl.visitorStats)

// 主题管理
router.get('/admin/themes', auth, themeCtrl.list)
router.post('/admin/themes/install', auth, themeCtrl.install)
router.put('/admin/themes/:id/activate', auth, themeCtrl.activate)
router.post('/admin/themes/:id/preview', auth, themeCtrl.preview)
router.post('/admin/themes/clear-preview', auth, themeCtrl.clearPreview)
router.delete('/admin/themes/:id', auth, themeCtrl.remove)

// 插件管理
router.get('/admin/plugins', auth, pluginCtrl.list)
router.post('/admin/plugins/install', auth, pluginCtrl.install)
router.put('/admin/plugins/:id/toggle', auth, pluginCtrl.toggle)

// 系统设置
router.get('/admin/settings', auth, settingCtrl.list)
router.put('/admin/settings', auth, settingCtrl.update)

// 备份导出
router.get('/admin/backup/database', auth, backupCtrl.databaseBackup)
router.get('/admin/backup/articles', auth, backupCtrl.articlesMarkdown)
router.get('/admin/backup/manifest', auth, backupCtrl.manifest)
router.post('/admin/backup/database/import', auth, adminOnly, backupUpload.single('file'), backupCtrl.restoreDatabase)
router.post('/admin/backup/articles/import', auth, adminOnly, backupUpload.single('file'), backupCtrl.restoreArticles)

export default router
