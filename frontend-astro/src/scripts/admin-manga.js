(() => {
  const root = document.querySelector('.admin-shell')
  if (!root) return
  const base = root.dataset.apiBase || '/api'
  const token = () => localStorage.getItem('boke_admin_token') || ''
  const state = { items: [], sources: [] }
  const $ = (selector) => document.querySelector(selector)
  const html = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
  const notify = (message, failed = false) => window.notifyAdmin?.(message, failed)
  async function api(path, options = {}) {
    const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), ...(options.headers || {}) } })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || json.success === false) throw new Error(json.message || '请求失败')
    return json.data
  }
  function message(value, failed = false) {
    const node = $('#manga-message')
    if (!node) return
    node.textContent = value
    node.classList.toggle('text-error', failed)
    node.classList.toggle('text-success', !failed)
  }
  function syncSources() {
    state.sources = state.sources.map((source, index) => ({ ...source, name: $(`[data-manga-source-name="${index}"]`)?.value || '', url: $(`[data-manga-source-url="${index}"]`)?.value || '', remark: $(`[data-manga-source-remark="${index}"]`)?.value || '', is_default: Boolean($(`[data-manga-source-default="${index}"]`)?.checked), sort_order: index }))
  }
  function renderSources() {
    const list = $('#manga-source-list')
    if (!list) return
    list.innerHTML = state.sources.map((source, index) => `<article class="grid gap-2 rounded-xl bg-base-200/55 p-3 sm:grid-cols-[.75fr_1.4fr_.7fr_auto]"><input class="input input-bordered input-sm rounded-lg" data-manga-source-name="${index}" value="${html(source.name || '')}" placeholder="站点名称"><input class="input input-bordered input-sm rounded-lg" data-manga-source-url="${index}" value="${html(source.url || '')}" placeholder="https://..."><input class="input input-bordered input-sm rounded-lg" data-manga-source-remark="${index}" value="${html(source.remark || '')}" placeholder="备注"><div class="flex items-center gap-2"><label class="flex items-center gap-1 text-xs"><input type="radio" name="manga-default-source" data-manga-source-default="${index}" ${source.is_default ? 'checked' : ''}>默认</label><button class="btn btn-ghost btn-xs text-error" type="button" data-manga-source-remove="${index}">×</button></div></article>`).join('') || '<p class="text-sm text-base-content/45">本地漫画不需要阅读链接；网络条目可以保存一个或多个外部入口。</p>'
    list.querySelectorAll('input').forEach((input) => input.addEventListener('input', syncSources))
  }
  function reset() {
    const form = $('#manga-form')
    form?.reset()
    if (form) {
      form.elements.namedItem('id').value = ''
      form.elements.namedItem('source').value = ''
      form.elements.namedItem('library_type').value = 'network'
      form.elements.namedItem('is_active').checked = true
    }
    state.sources = []
    renderSources()
    message('')
  }
  function fill(item) {
    reset()
    const form = $('#manga-form')
    ;['id', 'title', 'slug', 'original_title', 'author', 'cover', 'publication', 'external_id', 'source_url', 'source', 'library_type', 'status', 'progress', 'rating', 'description', 'sort_order'].forEach((name) => { const field = form.elements.namedItem(name); if (field) field.value = item[name] ?? '' })
    form.elements.namedItem('is_active').checked = Boolean(item.is_active)
    state.sources = (item.read_sources || []).map((source) => ({ ...source, is_default: Boolean(source.is_default) }))
    renderSources()
    form.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
  async function load() {
    if (!token()) return
    state.items = await api('/admin/manga') || []
    const list = $('#manga-list')
    if (!list) return
    list.innerHTML = state.items.map((item) => `<article class="admin-personal-item"><header><span>${html({ reading: '在读', finished: '读完', planned: '想读', paused: '暂放' }[item.status] || '在读')}</span><small>${item.library_type === 'local' ? '本地 · ' + (item.volume_count || 0) + ' 卷 · ' + (item.chapter_count || 0) + ' 章' : '网络 · ' + (item.read_sources || []).length + ' 个入口'}</small></header><strong>${html(item.title)}</strong><p>${html(item.author || item.original_title || '作者未填写')}</p><footer><button data-manga-edit="${item.id}">编辑</button><a href="/manga/${encodeURIComponent(item.slug)}" target="_blank">查看</a><button class="is-danger" data-manga-delete="${item.id}">删除</button></footer></article>`).join('') || '<p class="text-sm text-base-content/45">暂无漫画条目。前台源搜索不要求先建立后台条目。</p>'
  }
  $('#manga-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    syncSources()
    const form = event.currentTarget
    const data = Object.fromEntries(new FormData(form))
    const id = data.id
    delete data.id
    data.is_active = form.elements.namedItem('is_active').checked
    data.read_sources = state.sources.filter((source) => source.url.trim())
    try {
      const item = await api(id ? '/admin/manga/' + id : '/admin/manga', { method: id ? 'PUT' : 'POST', body: JSON.stringify(data) })
      await load()
      fill(item)
      message('漫画基础资料已保存')
    } catch (error) { message(error.message, true) }
  })
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button')
    if (!target) return
    try {
      if (target.dataset.panelTab === 'manga') await load()
      if (target.dataset.mangaEdit) fill(state.items.find((item) => String(item.id) === target.dataset.mangaEdit))
      if (target.dataset.mangaDelete && confirm('确定删除这部漫画吗？')) { await api('/admin/manga/' + target.dataset.mangaDelete, { method: 'DELETE' }); await load() }
      if (target.dataset.mangaSourceRemove !== undefined) {
        syncSources()
        state.sources.splice(Number(target.dataset.mangaSourceRemove), 1)
        if (state.sources.length && !state.sources.some((source) => source.is_default)) state.sources[0].is_default = true
        renderSources()
      }
    } catch (error) { notify(error.message, true) }
  })
  $('#manga-source-add')?.addEventListener('click', () => { syncSources(); state.sources.push({ name: '阅读站点', url: '', remark: '', is_default: state.sources.length === 0, sort_order: state.sources.length }); renderSources() })
  $('#manga-reset')?.addEventListener('click', reset)
  reset()
})()
