import { Router } from 'express'
import { auth, adminOnly } from '../middleware/auth'
import { deviceAuth } from '../middleware/device'
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
import * as hubCtrl from '../controllers/hub'
import * as personalCtrl from '../controllers/personal'
import * as epubCtrl from '../controllers/epub'
import * as libraryCtrl from '../controllers/library'
import * as bookImportCtrl from '../controllers/book-import'
import * as bookFormatsCtrl from '../controllers/book-formats'
import * as mangaCtrl from '../controllers/manga'
import * as searchSourceCtrl from '../controllers/search-sources'
import * as contentSourceCtrl from '../controllers/content-sources'
import * as veneraSourceCtrl from '../controllers/venera-sources'
import * as contentCenterCtrl from '../controllers/content-center'
import { upload, backupUpload, epubUpload, textBookUpload } from '../middleware/upload'

const router = Router()

// 璁よ瘉
router.post('/auth/login', authCtrl.login)
router.get('/auth/me', auth, authCtrl.me)
router.put('/auth/me', auth, authCtrl.updateMe)

// 鍏紑鎺ュ彛
router.get('/articles', articleCtrl.list)
router.get('/articles/search', articleCtrl.search)
router.get('/articles/random', articleCtrl.random)
router.get('/articles/:slug', articleCtrl.detail)
router.get('/search/all', hubCtrl.searchAll)
router.get('/hub/memories', hubCtrl.memories)
router.get('/hub/insights', personalCtrl.insights)
router.post('/hub/inbox', personalCtrl.submitInbox)
router.get('/series', personalCtrl.seriesList)
router.get('/series/:slug', personalCtrl.seriesDetail)
router.get('/books', libraryCtrl.books)
router.get('/books/:book', libraryCtrl.bookDetail)
router.get('/books/:book/:volume', libraryCtrl.volumeDetail)
router.get('/books/:book/:volume/:chapter', libraryCtrl.chapterDetail)
router.get('/private/reading-center', deviceAuth, contentCenterCtrl.readingCenter)
router.get('/private/library', deviceAuth, libraryCtrl.privateLibrary)
router.get('/private/navigation', deviceAuth, libraryCtrl.getNavigationState)
router.put('/private/navigation', deviceAuth, libraryCtrl.putNavigationState)
router.get('/private/books/:bookId/progress', deviceAuth, libraryCtrl.getReadingState)
router.put('/private/books/:bookId/progress', deviceAuth, libraryCtrl.putReadingState)
router.get('/private/books/:bookId/annotations', deviceAuth, libraryCtrl.annotations)
router.post('/private/books/:bookId/annotations', deviceAuth, libraryCtrl.createAnnotation)
router.put('/private/books/:bookId/annotations/:annotationId', deviceAuth, libraryCtrl.updateAnnotation)
router.delete('/private/books/:bookId/annotations/:annotationId', deviceAuth, libraryCtrl.removeAnnotation)
router.get('/categories', categoryCtrl.list)
router.get('/tags', categoryCtrl.tagList)
router.get('/pages', pageCtrl.publicList)
router.get('/pages/:slug', pageCtrl.getBySlug)
router.get('/navigation', navigationCtrl.publicList)
router.get('/bangumi', bangumiCtrl.publicList)
router.get('/manga', mangaCtrl.publicList)
router.get('/manga/:slug', mangaCtrl.publicDetail)
router.get('/manga/:slug/:volume/:chapter', mangaCtrl.publicChapter)
router.get('/private/manga', deviceAuth, mangaCtrl.privateLibrary)
router.get('/private/manga/:mangaId/progress', deviceAuth, mangaCtrl.getReadingState)
router.put('/private/manga/:mangaId/progress', deviceAuth, mangaCtrl.putReadingState)
router.get('/albums', albumCtrl.publicList)
router.get('/albums/:id', albumCtrl.publicDetail)
router.get('/music', musicCtrl.publicList)
router.get('/music/stats', musicCtrl.stats)
router.post('/music/:id/play', musicCtrl.recordPlay)
router.get('/articles/:id/comments', commentCtrl.list)
router.post('/articles/:id/comments', commentCtrl.create)
router.get('/book-volumes/:id/comments', commentCtrl.listVolume)
router.post('/book-volumes/:id/comments', commentCtrl.createVolume)
router.post('/articles/:id/like', articleCtrl.like)
router.get('/themes/active', themeCtrl.active)
router.get('/plugins/active', pluginCtrl.activePlugins)
router.get('/settings/public', settingCtrl.publicSettings)
router.get('/content-sources', contentSourceCtrl.config)
router.get('/content-sources/search', contentSourceCtrl.search)
router.get('/content-sources/explore', contentSourceCtrl.explore)
router.get('/content-sources/media', contentSourceCtrl.media)
router.get('/content-sources/:kind/:source/:id', contentSourceCtrl.detail)
router.get('/content-sources/:kind/:source/:id/chapter/:chapterId', contentSourceCtrl.chapter)
router.get('/rss', articleCtrl.rss)
router.get('/feed.json', articleCtrl.jsonFeed)
router.get('/visitors/count', dashboardCtrl.todayCount)

// 鏂囩珷绠＄悊
router.get('/admin/articles', auth, articleCtrl.adminList)
router.get('/admin/articles/:id', auth, articleCtrl.getById)
router.post('/admin/articles', auth, articleCtrl.create)
router.post('/admin/articles/epub/import', auth, epubUpload.single('file'), epubCtrl.importEpub)
router.post('/admin/books/epub/preview', auth, epubUpload.array('files', 20), bookImportCtrl.previewEpub)
router.post('/admin/books/epub/commit', auth, bookImportCtrl.commitEpub)
router.post('/admin/books/text/preview', auth, textBookUpload.array('files', 10), bookFormatsCtrl.previewTextBooks)
router.post('/admin/books/text/commit', auth, bookFormatsCtrl.commitTextBooks)
router.post('/admin/books/pdf/import', auth, upload.single('file'), bookFormatsCtrl.importPdf)
router.post('/admin/devices/register', auth, libraryCtrl.registerDevice)
router.get('/admin/devices', auth, libraryCtrl.devices)
router.delete('/admin/devices/:id', auth, libraryCtrl.revokeDevice)
router.get('/admin/books', auth, libraryCtrl.adminBooks)
router.get('/admin/books/:id', auth, libraryCtrl.adminBookDetail)
router.get('/admin/books/:id/annotations/pending', auth, libraryCtrl.pendingAnnotations)
router.put('/admin/books/:id/annotations/:annotationId/resolve', auth, libraryCtrl.resolveAnnotation)
router.post('/admin/books', auth, libraryCtrl.createBook)
router.put('/admin/books/:id', auth, libraryCtrl.updateBook)
router.delete('/admin/books/:id', auth, libraryCtrl.removeBook)
router.put('/admin/books/:id/restore', auth, libraryCtrl.restoreBook)
router.post('/admin/books/:id/volumes', auth, libraryCtrl.createVolume)
router.put('/admin/books/:id/volumes/:volumeId', auth, libraryCtrl.updateVolume)
router.delete('/admin/books/:id/volumes/:volumeId', auth, libraryCtrl.removeVolume)
router.post('/admin/books/:id/volumes/:volumeId/chapters', auth, libraryCtrl.createChapter)
router.put('/admin/books/:id/volumes/:volumeId/chapters/:chapterId', auth, libraryCtrl.updateChapter)
router.delete('/admin/books/:id/volumes/:volumeId/chapters/:chapterId', auth, libraryCtrl.removeChapter)
router.put('/admin/articles/:id', auth, articleCtrl.update)
router.delete('/admin/articles/:id', auth, articleCtrl.softDelete)
router.post('/admin/articles/batch-delete', auth, articleCtrl.batchDelete)
router.put('/admin/articles/:id/restore', auth, articleCtrl.restore)
router.delete('/admin/articles/:id/force', auth, articleCtrl.forceDelete)
router.post('/admin/markdown/preview', auth, markdownCtrl.preview)

router.get('/admin/import-jobs', auth, contentCenterCtrl.importJobs)
router.post('/admin/import-jobs', auth, contentCenterCtrl.createImportJob)
router.put('/admin/import-jobs/:id', auth, contentCenterCtrl.updateImportJob)
router.get('/admin/subscriptions', auth, contentCenterCtrl.subscriptions)
router.post('/admin/subscriptions', auth, contentCenterCtrl.createSubscription)
router.put('/admin/subscriptions/:id', auth, contentCenterCtrl.updateSubscription)
router.delete('/admin/subscriptions/:id', auth, contentCenterCtrl.removeSubscription)
router.get('/admin/content-relations', auth, contentCenterCtrl.relations)
router.post('/admin/content-relations', auth, contentCenterCtrl.createRelation)
router.delete('/admin/content-relations/:id', auth, contentCenterCtrl.removeRelation)
// 个人中心、收集箱与专题
router.get('/admin/personal/inbox', auth, personalCtrl.inboxList)
router.put('/admin/personal/inbox/:id', auth, personalCtrl.updateInbox)
router.post('/admin/personal/inbox/:id/convert', auth, personalCtrl.convertInbox)
router.delete('/admin/personal/inbox/:id', auth, personalCtrl.removeInbox)
router.get('/admin/personal/todos', auth, personalCtrl.todoList)
router.put('/admin/personal/todos/:id', auth, personalCtrl.updateTodo)
router.delete('/admin/personal/todos/:id', auth, personalCtrl.removeTodo)
router.get('/admin/series', auth, personalCtrl.adminSeriesList)
router.get('/admin/series/article-options', auth, personalCtrl.seriesArticleOptions)
router.post('/admin/series', auth, personalCtrl.createSeries)
router.put('/admin/series/:id/articles', auth, personalCtrl.updateSeriesArticles)
router.put('/admin/series/:id', auth, personalCtrl.updateSeries)
router.delete('/admin/series/:id', auth, personalCtrl.removeSeries)

// 鍒嗙被绠＄悊
router.post('/admin/categories', auth, categoryCtrl.create)
router.put('/admin/categories/:id', auth, categoryCtrl.update)
router.delete('/admin/categories/:id', auth, categoryCtrl.remove)

// 鏍囩绠＄悊
router.post('/admin/tags', auth, categoryCtrl.createTag)
router.put('/admin/tags/:id', auth, categoryCtrl.updateTag)
router.delete('/admin/tags/:id', auth, categoryCtrl.removeTag)

// 璇勮绠＄悊
router.get('/admin/comments', auth, commentCtrl.adminList)
router.post('/admin/comments/:id/reply', auth, commentCtrl.adminReply)
router.put('/admin/comments/:id/status', auth, commentCtrl.updateStatus)
router.delete('/admin/comments/:id', auth, commentCtrl.remove)

// 椤甸潰绠＄悊
router.get('/admin/pages', auth, pageCtrl.list)
router.post('/admin/pages', auth, pageCtrl.create)
router.put('/admin/pages/:id', auth, pageCtrl.update)
router.put('/admin/pages/:id/restore', auth, pageCtrl.restore)
router.delete('/admin/pages/:id/force', auth, pageCtrl.forceDelete)
router.delete('/admin/pages/:id', auth, pageCtrl.remove)

// 导航、追番、相册
router.get('/admin/navigation', auth, navigationCtrl.list)
router.post('/admin/navigation/import', auth, navigationCtrl.importMany)
router.put('/admin/navigation/reorder', auth, navigationCtrl.reorder)
router.post('/admin/navigation', auth, navigationCtrl.create)
router.put('/admin/navigation/:id', auth, navigationCtrl.update)
router.delete('/admin/navigation/:id', auth, navigationCtrl.remove)

router.get('/admin/search-sources', auth, searchSourceCtrl.getConfig)
router.put('/admin/search-sources', auth, searchSourceCtrl.saveConfig)
router.post('/admin/search-sources/import', auth, searchSourceCtrl.importSource)
router.post('/admin/search-sources/test', auth, searchSourceCtrl.testSource)
router.delete('/admin/search-sources/:id', auth, searchSourceCtrl.removeSource)
router.get('/admin/venera-sources', auth, veneraSourceCtrl.list)
router.post('/admin/venera-sources/import', auth, veneraSourceCtrl.importRepository)
router.post('/admin/venera-sources/test', auth, veneraSourceCtrl.testSource)
router.delete('/admin/venera-sources', auth, veneraSourceCtrl.removeRepository)

router.get('/admin/bangumi', auth, bangumiCtrl.list)
router.get('/admin/bangumi/search', auth, bangumiCtrl.searchSource)
router.get('/admin/bangumi/source/:id', auth, bangumiCtrl.sourceDetail)
router.post('/admin/bangumi', auth, bangumiCtrl.create)
router.put('/admin/bangumi/:id', auth, bangumiCtrl.update)
router.get('/admin/bangumi/:id/play-sources', auth, bangumiCtrl.playSources)
router.post('/admin/bangumi/:id/play-sources', auth, bangumiCtrl.createPlaySource)
router.put('/admin/bangumi/:id/play-sources/:sourceId', auth, bangumiCtrl.editPlaySource)
router.delete('/admin/bangumi/:id/play-sources/:sourceId', auth, bangumiCtrl.removePlaySource)
router.delete('/admin/bangumi/:id', auth, bangumiCtrl.remove)

router.get('/admin/manga', auth, mangaCtrl.list)
router.post('/admin/manga', auth, mangaCtrl.create)
router.put('/admin/manga/:id', auth, mangaCtrl.update)
router.delete('/admin/manga/:id', auth, mangaCtrl.remove)

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

// 濯掍綋绠＄悊
router.get('/admin/media', auth, mediaCtrl.list)
router.get('/admin/media/explorer', auth, mediaCtrl.explorer)
router.get('/admin/media/folders', auth, mediaCtrl.folders)
router.post('/admin/media/folders', auth, mediaCtrl.createFolder)
router.put('/admin/media/folders/:id', auth, mediaCtrl.updateFolder)
router.delete('/admin/media/folders/:id', auth, mediaCtrl.removeFolder)
router.post('/admin/media/files', auth, mediaCtrl.createFile)
router.post('/admin/media/upload', auth, upload.single('file'), mediaCtrl.upload)
router.put('/admin/media/:id', auth, mediaCtrl.updateMedia)
router.delete('/admin/media/:id', auth, mediaCtrl.remove)
router.put('/admin/media/:id/restore', auth, mediaCtrl.restore)
router.delete('/admin/media/:id/force', auth, mediaCtrl.forceDelete)
router.post('/admin/media/cleanup', auth, mediaCtrl.cleanup)

// 仪表盘
router.get('/admin/dashboard/stats', auth, dashboardCtrl.stats)
router.get('/admin/dashboard/charts', auth, dashboardCtrl.charts)
router.get('/admin/visitors/stats', auth, dashboardCtrl.visitorStats)

// 涓婚绠＄悊
router.get('/admin/themes', auth, themeCtrl.list)
router.post('/admin/themes/install', auth, themeCtrl.install)
router.put('/admin/themes/:id/activate', auth, themeCtrl.activate)
router.post('/admin/themes/:id/preview', auth, themeCtrl.preview)
router.post('/admin/themes/clear-preview', auth, themeCtrl.clearPreview)
router.put('/admin/themes/:id/config', auth, themeCtrl.updateConfig)
router.get('/admin/themes/:id/export', auth, themeCtrl.exportConfig)
router.post('/admin/themes/import', auth, themeCtrl.importConfig)
router.delete('/admin/themes/:id', auth, themeCtrl.remove)

// 鎻掍欢绠＄悊
router.get('/admin/plugins', auth, pluginCtrl.list)
router.post('/admin/plugins/install', auth, pluginCtrl.install)
router.put('/admin/plugins/:id/toggle', auth, pluginCtrl.toggle)

// 绯荤粺璁剧疆
router.get('/admin/settings', auth, settingCtrl.list)
router.put('/admin/settings', auth, settingCtrl.update)

// 澶囦唤瀵煎嚭
router.get('/admin/backup/database', auth, backupCtrl.databaseBackup)
router.get('/admin/backup/full', auth, backupCtrl.fullBackup)
router.get('/admin/backup/articles', auth, backupCtrl.articlesMarkdown)
router.get('/admin/backup/manifest', auth, backupCtrl.manifest)
router.post('/admin/backup/database/import', auth, adminOnly, backupUpload.single('file'), backupCtrl.restoreDatabase)
router.post('/admin/backup/articles/import', auth, adminOnly, backupUpload.single('file'), backupCtrl.restoreArticles)

export default router
