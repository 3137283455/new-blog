(() => {
  const root = document.querySelector('.admin-shell')
  if (!root) return
  const base = root.dataset.apiBase || '/api'
  const token = () => localStorage.getItem('boke_admin_token') || ''
  const state = { items: [] }
  const $ = (selector) => document.querySelector(selector)
  const html = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
  const notify = (message, failed = false) => window.notifyAdmin?.(message, failed)
  const statusLabel = { reading: '在读', finished: '读完', planned: '想读', paused: '暂放' }
  async function api(path, options = {}) {
    const response = await fetch(base + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), ...(options.headers || {}) } })
    const json = await response.json().catch(() => ({}))
    if (!response.ok || json.success === false) throw new Error(json.message || '请求失败')
    return json.data
  }
  function updateStats() {
    const local = state.items.filter((item) => item.library_type === 'local').length
    const network = state.items.filter((item) => item.library_type === 'network').length
    const visible = state.items.filter((item) => item.is_active).length
    $('#manga-local-count') && ($('#manga-local-count').textContent = String(local))
    $('#manga-network-count') && ($('#manga-network-count').textContent = String(network))
    $('#manga-visible-count') && ($('#manga-visible-count').textContent = String(visible))
  }
  function render() {
    const list = $('#manga-list')
    updateStats()
    if (!list) return
    list.innerHTML = state.items.map((item) => `<article class="admin-personal-item"><header><span>${item.library_type === 'local' ? '本地条目' : '兼容网络条目'}</span><small>${html(statusLabel[item.status] || '在读')} · ${item.is_active ? '前台显示' : '已隐藏'}</small></header><strong>${html(item.title)}</strong><p>${html(item.author || item.original_title || '未填写作者')}</p><footer><button data-manga-settings="${item.id}" type="button">基础设置</button><a href="/manga/${encodeURIComponent(item.slug)}" target="_blank" rel="noreferrer">查看</a><button class="is-danger" data-manga-delete="${item.id}" type="button">删除</button></footer></article>`).join('') || '<p class="text-sm text-base-content/45">暂无后台条目。网络漫画请直接从前台搜索；书架和收藏也在前台管理。</p>'
  }
  function openSettings(item) {
    const dialog = $('#manga-settings-dialog')
    const form = $('#manga-settings-form')
    if (!dialog || !form || !item) return
    form.elements.namedItem('id').value = item.id
    form.elements.namedItem('status').value = item.status || 'reading'
    form.elements.namedItem('sort_order').value = item.sort_order ?? 0
    form.elements.namedItem('is_active').checked = Boolean(item.is_active)
    $('#manga-settings-title').textContent = item.title || '漫画基础设置'
    $('#manga-settings-meta').textContent = item.library_type === 'local' ? '本地漫画条目' : '兼容网络条目'
    $('#manga-settings-message').textContent = ''
    dialog.showModal()
  }
  async function load() {
    if (!token()) return
    state.items = await api('/admin/manga') || []
    render()
  }
  $('#manga-settings-form')?.addEventListener('submit', async (event) => {
    event.preventDefault()
    const form = event.currentTarget
    const id = form.elements.namedItem('id').value
    const message = $('#manga-settings-message')
    try {
      await api('/admin/manga/' + id, { method: 'PUT', body: JSON.stringify({ status: form.elements.namedItem('status').value, sort_order: Number(form.elements.namedItem('sort_order').value || 0), is_active: form.elements.namedItem('is_active').checked }) })
      await load()
      message.textContent = '基础设置已保存'
      setTimeout(() => $('#manga-settings-dialog')?.close(), 350)
    } catch (error) { message.textContent = error.message; notify(error.message, true) }
  })
  document.addEventListener('click', async (event) => {
    const target = event.target.closest('button')
    if (!target) return
    if (target.id === 'manga-settings-close' || target.id === 'manga-settings-cancel') { $('#manga-settings-dialog')?.close(); return }
    try {
      if (target.dataset.panelTab === 'manga') await load()
      if (target.dataset.mangaSettings) openSettings(state.items.find((item) => String(item.id) === target.dataset.mangaSettings))
      if (target.dataset.mangaDelete && confirm('确定删除这部漫画吗？')) { await api('/admin/manga/' + target.dataset.mangaDelete, { method: 'DELETE' }); await load() }
    } catch (error) { notify(error.message, true) }
  })
  load().catch((error) => notify(error.message, true))
})()
