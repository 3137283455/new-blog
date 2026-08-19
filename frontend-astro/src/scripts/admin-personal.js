(() => {
  const root = document.querySelector('.admin-shell')
  const API_BASE = root?.dataset.apiBase || '/api'
  const token = () => localStorage.getItem('boke_admin_token') || ''
  const $ = (selector) => document.querySelector(selector)
  const $$ = (selector) => Array.from(document.querySelectorAll(selector))
  const html = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char])
  const state = { inbox: [], todos: [], series: [], seriesArticles: [], selectedArticleIds: [], activeSeriesId: null, themes: [], insights: null }

  async function api(path, options = {}) {
    const response = await fetch(`${API_BASE}${path}`, { ...options, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token()}`, ...(options.headers || {}) } })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || json.success === false) throw new Error(json.message || '请求失败')
    return json.data
  }

  function notice(message, failed = false) {
    if (window.notifyAdmin) window.notifyAdmin(message, failed)
  }

  function showTab(name) {
    $$('[data-personal-tab]').forEach((button) => button.classList.toggle('is-active', button.dataset.personalTab === name))
    $$('[data-personal-section]').forEach((section) => section.classList.toggle('hidden', section.dataset.personalSection !== name))
  }

  async function loadInbox() {
    const filter = $('#personal-inbox-filter')?.value || 'all'
    state.inbox = await api(`/admin/personal/inbox?status=${encodeURIComponent(filter)}`) || []
    state.todos = await api('/admin/personal/todos') || []
    renderInbox()
    renderTodos()
  }

  function renderInbox() {
    const labels = { idea: '想法', link: '网址', write: '待写', watch: '待看', organize: '整理' }
    $('#personal-inbox-list').innerHTML = state.inbox.map((item) => `
      <article class="admin-personal-item ${item.status === 'done' ? 'is-done' : ''}">
        <header><span>${html(labels[item.type] || item.type)}</span><time>${html(String(item.created_at || '').slice(0, 16))}</time></header>
        <strong>${html(item.content)}</strong>
        ${item.url ? `<a href="${html(item.url)}" target="_blank" rel="noreferrer">${html(item.url)}</a>` : ''}
        <footer>${item.status === 'pending' ? `<button data-inbox-convert="article" data-id="${item.id}">转为文章</button><button data-inbox-convert="navigation" data-id="${item.id}">转为导航</button><button data-inbox-convert="todo" data-id="${item.id}">转为待办</button>` : `<span>已转为${html(item.converted_type || '内容')} #${item.converted_id || ''}</span>`}<button class="is-danger" data-inbox-delete="${item.id}">删除</button></footer>
      </article>
    `).join('') || '<p class="text-sm text-base-content/45">收集箱是空的，去导航首页记录一个想法吧。</p>'
  }

  function renderTodos() {
    $('#personal-todo-list').innerHTML = state.todos.map((item) => `
      <article class="admin-personal-todo ${item.done ? 'is-done' : ''}"><button data-todo-toggle="${item.id}" aria-label="切换完成">${item.done ? '✓' : ''}</button><span>${html(item.title)}</span><button data-todo-delete="${item.id}">×</button></article>
    `).join('') || '<p class="text-sm text-base-content/45">还没有后台待办。</p>'
  }

  async function convertInbox(id, target) {
    const item = state.inbox.find((row) => String(row.id) === String(id))
    const payload = { target }
    if (target === 'navigation') {
      payload.url = item?.url || prompt('请输入要保存的网址', item?.content || 'https://') || ''
      if (!payload.url) return
      payload.title = prompt('导航标题', item?.type === 'link' ? '' : item?.content || '') || item?.content
      payload.category = '临时收藏'
    }
    await api(`/admin/personal/inbox/${id}/convert`, { method: 'POST', body: JSON.stringify(payload) })
    notice('收集箱记录已转换')
    await loadInbox()
  }

  async function loadSeries() {
    const [series, articles] = await Promise.all([api('/admin/series'), api('/admin/series/article-options')])
    state.series = series || []
    state.seriesArticles = articles || []
    $('#personal-series-list').innerHTML = state.series.map((item) => `
      <article class="admin-personal-item ${Number(state.activeSeriesId) === Number(item.id) ? 'is-selected' : ''}"><header><span>${item.is_featured ? '首页专题' : '专题'}</span><small>${item.article_count || 0} 篇</small></header><strong>${html(item.title)}</strong><p>${html(item.description || '')}</p><footer><button type="button" data-series-edit="${item.id}">编辑与编排</button><a href="/series/${encodeURIComponent(item.slug)}" target="_blank">查看</a><button class="is-danger" type="button" data-series-delete="${item.id}">删除</button></footer></article>
    `).join('') || '<p class="text-sm text-base-content/45">还没有专题，先在左侧创建一个吧。</p>'
    if (state.activeSeriesId && !state.series.some((item) => Number(item.id) === Number(state.activeSeriesId))) fillSeries()
    else renderSeriesArticles()
  }

  function fillSeries(item = {}) {
    const form = $('#personal-series-form')
    form.reset()
    ;['id', 'title', 'slug', 'cover', 'description', 'sort_order', 'status'].forEach((name) => { if (form.elements.namedItem(name)) form.elements.namedItem(name).value = item[name] ?? (name === 'status' ? 'published' : '') })
    form.elements.namedItem('is_featured').checked = Boolean(item.is_featured)
    state.activeSeriesId = item.id ? Number(item.id) : null
    state.selectedArticleIds = state.activeSeriesId
      ? state.seriesArticles.filter((article) => Number(article.series_id) === state.activeSeriesId).sort((a, b) => Number(a.series_order) - Number(b.series_order)).map((article) => Number(article.id))
      : []
    renderSeriesArticles()
    $$('#personal-series-list .admin-personal-item').forEach((card) => {
      const button = card.querySelector('[data-series-edit]')
      card.classList.toggle('is-selected', Number(button?.dataset.seriesEdit) === Number(state.activeSeriesId))
    })
  }

  function articleMeta(article) {
    const parts = [article.status === 'published' ? '已发布' : '草稿']
    if (article.series_id && Number(article.series_id) !== Number(state.activeSeriesId)) parts.push(`当前在「${article.series_title || '其他专题'}」`)
    return parts.join(' · ')
  }

  function renderSeriesArticles() {
    const active = state.series.find((item) => Number(item.id) === Number(state.activeSeriesId))
    const hint = $('#personal-series-articles-hint')
    const save = $('#personal-series-articles-save')
    if (hint) hint.textContent = active ? `正在编排「${active.title}」，保存后同步到前台。` : '请先新建或选择一个专题。'
    if (save) save.disabled = !active
    const selected = state.selectedArticleIds.map((id) => state.seriesArticles.find((article) => Number(article.id) === Number(id))).filter(Boolean)
    if ($('#personal-series-article-count')) $('#personal-series-article-count').textContent = `${selected.length} 篇`
    const selectedList = $('#personal-series-article-selected')
    if (selectedList) selectedList.innerHTML = active
      ? selected.map((article, index) => `<article class="admin-series-article"><span class="admin-series-order">${index + 1}</span><div><strong>${html(article.title)}</strong><small>${html(articleMeta(article))}</small></div><div class="admin-series-actions"><button type="button" data-series-article-up="${article.id}" ${index === 0 ? 'disabled' : ''} aria-label="上移">↑</button><button type="button" data-series-article-down="${article.id}" ${index === selected.length - 1 ? 'disabled' : ''} aria-label="下移">↓</button><button class="is-danger" type="button" data-series-article-remove="${article.id}">移除</button></div></article>`).join('') || '<p class="text-sm text-base-content/45">还没有文章，从左侧文章库加入。</p>'
      : '<p class="text-sm text-base-content/45">选择专题后即可编排文章。</p>'

    const query = ($('#personal-series-article-search')?.value || '').trim().toLowerCase()
    const available = state.seriesArticles.filter((article) => !state.selectedArticleIds.includes(Number(article.id)) && (!query || String(article.title || '').toLowerCase().includes(query)))
    const options = $('#personal-series-article-options')
    if (options) options.innerHTML = active
      ? available.map((article) => `<article class="admin-series-article"><div><strong>${html(article.title)}</strong><small>${html(articleMeta(article))}</small></div><button type="button" data-series-article-add="${article.id}">${article.series_id && Number(article.series_id) !== Number(state.activeSeriesId) ? '移入' : '加入'}</button></article>`).join('') || '<p class="text-sm text-base-content/45">没有匹配的可选文章。</p>'
      : '<p class="text-sm text-base-content/45">选择专题后显示文章库。</p>'
  }

  async function loadReport(year = new Date().getFullYear()) {
    state.insights = await api(`/hub/insights?year=${year}`)
    const years = Array.from({ length: 6 }, (_, index) => new Date().getFullYear() - index)
    $('#personal-report-year').innerHTML = years.map((value) => `<option value="${value}" ${value === Number(state.insights.year) ? 'selected' : ''}>${value} 年</option>`).join('')
    const values = [
      ['文章', state.insights.totals?.articles || 0],
      ['字数', Number(state.insights.totals?.words || 0).toLocaleString('zh-CN')],
      ['阅读', Number(state.insights.totals?.views || 0).toLocaleString('zh-CN')],
      ['连续写作', `${state.insights.streak?.current || 0} 天`],
    ]
    $('#personal-report-stats').innerHTML = values.map(([label, value]) => `<article class="ryu-card p-4"><p class="text-sm text-base-content/50">${label}</p><strong class="mt-2 block text-3xl">${value}</strong></article>`).join('')
    const map = new Map((state.insights.heatmap || []).map((item) => [item.day, item.count]))
    const now = new Date(); const days = Array.from({ length: 365 }, (_, offset) => { const day = new Date(now); day.setDate(now.getDate() - (364 - offset)); const key = day.toISOString().slice(0, 10); return { key, count: Number(map.get(key) || 0) } }); const max = Math.max(1, ...days.map((item) => item.count))
    $('#personal-report-heatmap').innerHTML = days.map((item) => `<i class="${item.count ? 'has-post' : ''}" title="${item.key} · ${item.count} 篇" style="--heat:${item.count / max}"></i>`).join('')
    $('#personal-report-months').innerHTML = (state.insights.months || []).map((item) => `<div><span>${item.month} 月</span><i style="--month-value:${Math.min(100, Number(item.articles) * 14)}%"></i><strong>${item.articles} 篇</strong><small>${Number(item.words || 0).toLocaleString('zh-CN')} 字</small></div>`).join('')
  }

  const presets = {
    spring: { primary: '#5e8b62', primary_hover: '#426b47', primary_light: '#dcebdc', body_font: 'system-ui', title_font: 'Georgia, serif', card_radius: 22, card_opacity: 90, content_width: 72 },
    summer: { primary: '#247b82', primary_hover: '#175b61', primary_light: '#d6eff0', body_font: 'system-ui', title_font: 'Georgia, serif', card_radius: 16, card_opacity: 82, content_width: 76 },
    autumn: { primary: '#9a6738', primary_hover: '#754a25', primary_light: '#f0e1cf', body_font: 'system-ui', title_font: 'Georgia, serif', card_radius: 12, card_opacity: 92, content_width: 68 },
    winter: { primary: '#506b91', primary_hover: '#354e70', primary_light: '#dce5f1', body_font: 'system-ui', title_font: 'Georgia, serif', card_radius: 8, card_opacity: 78, content_width: 74 },
  }

  async function loadThemes() {
    state.themes = await api('/admin/themes') || []
    $('#personal-theme-select').innerHTML = state.themes.map((item) => `<option value="${html(item.id)}" ${item.is_active ? 'selected' : ''}>${html(item.name)}${item.is_active ? '（当前）' : ''}</option>`).join('')
    fillTheme()
  }

  function fillTheme() {
    const theme = state.themes.find((item) => item.id === $('#personal-theme-select').value) || state.themes[0]
    if (!theme) return
    const config = theme.config || {}
    const form = $('#personal-theme-form')
    const values = { season: config.season || 'custom', primary: config.primary || '#5e7c61', primary_hover: config.primary_hover || '#456248', primary_light: config.primary_light || '#dce8dc', body_font: config.body_font || 'system-ui', title_font: config.title_font || 'Georgia, serif', card_radius: config.card_radius ?? 18, card_opacity: Math.round(Number(config.card_opacity ?? 0.86) * 100), content_width: config.content_width ?? 72 }
    Object.entries(values).forEach(([name, value]) => { const field = form.elements.namedItem(name); if (field) field.value = value })
    updateThemePreview()
  }

  function updateThemePreview() {
    const form = $('#personal-theme-form'); const preview = $('#personal-theme-preview')
    const radius = Number(form.elements.namedItem('card_radius').value); const opacity = Number(form.elements.namedItem('card_opacity').value); const width = Number(form.elements.namedItem('content_width').value)
    $('[data-theme-value="card_radius"]').textContent = radius
    $('[data-theme-value="card_opacity"]').textContent = opacity
    $('[data-theme-value="content_width"]').textContent = width
    preview.style.setProperty('--preview-primary', form.elements.namedItem('primary').value)
    preview.style.setProperty('--preview-radius', `${radius}px`)
    preview.style.setProperty('--preview-opacity', String(opacity / 100))
    preview.style.fontFamily = form.elements.namedItem('body_font').value
    preview.querySelector('h2').style.fontFamily = form.elements.namedItem('title_font').value
  }

  async function loadAll() {
    if (!token()) return
    await Promise.all([loadInbox(), loadReport(), loadThemes()])
  }

  $$('[data-personal-tab]').forEach((button) => button.addEventListener('click', () => showTab(button.dataset.personalTab)))
  document.querySelector('[data-panel="personal"]')?.addEventListener('click', () => loadAll().catch((error) => notice(error.message, true)))
  document.querySelector('[data-panel="articles"]')?.addEventListener('click', () => loadSeries().catch((error) => notice(error.message, true)))
  $('#personal-inbox-filter')?.addEventListener('change', () => loadInbox().catch((error) => notice(error.message, true)))
  $('#personal-report-year')?.addEventListener('change', (event) => loadReport(Number(event.target.value)).catch((error) => notice(error.message, true)))
  $('#personal-series-reset')?.addEventListener('click', () => fillSeries())
  $('#personal-theme-select')?.addEventListener('change', fillTheme)
  $('#personal-theme-form')?.addEventListener('input', updateThemePreview)
  $('#personal-theme-form')?.elements.namedItem('season')?.addEventListener('change', (event) => { const preset = presets[event.target.value]; if (!preset) return; const form = $('#personal-theme-form'); Object.entries(preset).forEach(([name, value]) => { form.elements.namedItem(name).value = value }); updateThemePreview() })

  $('#personal-series-article-search')?.addEventListener('input', renderSeriesArticles)
  $('#personal-series-articles-save')?.addEventListener('click', async () => { try { if (!state.activeSeriesId) return; const activeId = state.activeSeriesId; await api(`/admin/series/${activeId}/articles`, { method: 'PUT', body: JSON.stringify({ article_ids: state.selectedArticleIds }) }); await loadSeries(); fillSeries(state.series.find((item) => Number(item.id) === Number(activeId))); notice('专题文章与顺序已保存') } catch (error) { notice(error.message, true) } })
  $('#personal-series-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { const form = event.currentTarget; const id = form.elements.namedItem('id').value; const payload = Object.fromEntries(new FormData(form).entries()); payload.is_featured = form.elements.namedItem('is_featured').checked; payload.sort_order = Number(payload.sort_order || 0); const saved = await api(id ? `/admin/series/${id}` : '/admin/series', { method: id ? 'PUT' : 'POST', body: JSON.stringify(payload) }); state.activeSeriesId = Number(saved.id); await loadSeries(); fillSeries(state.series.find((item) => Number(item.id) === Number(saved.id)) || saved); notice(id ? '专题信息已保存' : '专题已创建，现在可以添加文章') } catch (error) { notice(error.message, true) } })
  $('#personal-theme-form')?.addEventListener('submit', async (event) => { event.preventDefault(); try { const form = event.currentTarget; const id = form.elements.namedItem('id').value; const config = Object.fromEntries(new FormData(form).entries()); config.card_radius = Number(config.card_radius); config.card_opacity = Number(config.card_opacity) / 100; config.content_width = Number(config.content_width); await api(`/admin/themes/${encodeURIComponent(id)}/config`, { method: 'PUT', body: JSON.stringify({ config }) }); await loadThemes(); notice('主题配置已保存，刷新前台即可查看') } catch (error) { notice(error.message, true) } })

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button')
    if (!button || !token()) return
    try {
      if (button.dataset.inboxConvert) await convertInbox(button.dataset.id, button.dataset.inboxConvert)
      if (button.dataset.inboxDelete && confirm('删除这条记录吗？')) { await api(`/admin/personal/inbox/${button.dataset.inboxDelete}`, { method: 'DELETE' }); await loadInbox() }
      if (button.dataset.todoToggle) { const item = state.todos.find((row) => String(row.id) === button.dataset.todoToggle); await api(`/admin/personal/todos/${button.dataset.todoToggle}`, { method: 'PUT', body: JSON.stringify({ done: !item?.done }) }); await loadInbox() }
      if (button.dataset.todoDelete) { await api(`/admin/personal/todos/${button.dataset.todoDelete}`, { method: 'DELETE' }); await loadInbox() }
      if (button.dataset.seriesEdit) fillSeries(state.series.find((item) => String(item.id) === button.dataset.seriesEdit))
      if (button.dataset.seriesArticleAdd) { state.selectedArticleIds.push(Number(button.dataset.seriesArticleAdd)); renderSeriesArticles() }
      if (button.dataset.seriesArticleRemove) { state.selectedArticleIds = state.selectedArticleIds.filter((id) => id !== Number(button.dataset.seriesArticleRemove)); renderSeriesArticles() }
      if (button.dataset.seriesArticleUp || button.dataset.seriesArticleDown) { const id = Number(button.dataset.seriesArticleUp || button.dataset.seriesArticleDown); const index = state.selectedArticleIds.indexOf(id); const next = button.dataset.seriesArticleUp ? index - 1 : index + 1; if (index >= 0 && next >= 0 && next < state.selectedArticleIds.length) [state.selectedArticleIds[index], state.selectedArticleIds[next]] = [state.selectedArticleIds[next], state.selectedArticleIds[index]]; renderSeriesArticles() }
      if (button.dataset.seriesDelete && confirm('删除专题吗？文章会保留并移出专题。')) { await api(`/admin/series/${button.dataset.seriesDelete}`, { method: 'DELETE' }); if (Number(button.dataset.seriesDelete) === Number(state.activeSeriesId)) fillSeries(); await loadSeries() }
    } catch (error) { notice(error.message, true) }
  })

  $('#personal-theme-export')?.addEventListener('click', async () => { try { const id = $('#personal-theme-select').value; const theme = await api(`/admin/themes/${encodeURIComponent(id)}/export`); const blob = new Blob([JSON.stringify({ ...theme, is_active: false }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${id}-theme.json`; link.click(); URL.revokeObjectURL(link.href) } catch (error) { notice(error.message, true) } })
  $('#personal-theme-import')?.addEventListener('change', async (event) => { try { const file = event.target.files?.[0]; if (!file) return; const theme = JSON.parse(await file.text()); await api('/admin/themes/import', { method: 'POST', body: JSON.stringify({ theme }) }); await loadThemes(); notice('主题配置已导入') } catch (error) { notice(error.message || '主题文件无效', true) } finally { event.target.value = '' } })
})()
