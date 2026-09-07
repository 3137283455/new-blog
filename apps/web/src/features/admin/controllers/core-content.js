export function register(context) {
  context.loadPages = async function loadPages() {
    const qs = new URLSearchParams();
    if (context.state.pagesTrashMode) qs.set('trashed', 'true');
    const json = await context.request(`/admin/pages${qs.toString() ? `?${qs.toString()}` : ''}`);
    context.state.pages = json.data || [];
    context.renderPages();
  };
  context.renderPages = function renderPages() {
    const list = context.$('#pages-list');
    if (!list) return;
    context.$('#pages-normal-mode')?.classList.toggle('btn-primary', !context.state.pagesTrashMode);
    context.$('#pages-trash-mode')?.classList.toggle('btn-primary', context.state.pagesTrashMode);
    list.innerHTML =
      context.state.pages
        .map(
          (page) => `
    <div class="rounded-2xl bg-base-100/65 p-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-black">${context.escapeHtml(page.title)}</p>
          <p class="text-xs text-base-content/45">/page/${context.escapeHtml(page.slug)} · ${context.escapeHtml(page.template || 'default')} · ${context.escapeHtml(page.status || 'published')}${page.deleted_at ? ` · 删除于 ${context.escapeHtml(context.formatDate(page.deleted_at))}` : ''}</p>
        </div>
        <div class="flex gap-2">
          ${
            context.state.pagesTrashMode
              ? `
            <button class="btn btn-xs rounded-lg" data-restore-page="${page.id}">恢复</button>
            <button class="btn btn-xs btn-error rounded-lg" data-force-delete-page="${page.id}">永久删除</button>
          `
              : `
            <a class="btn btn-xs rounded-lg" href="/page/${context.escapeHtml(page.slug)}" target="_blank">查看</a>
            <button class="btn btn-xs rounded-lg" data-edit-page="${page.id}">编辑</button>
            <button class="btn btn-xs btn-error rounded-lg" data-delete-page="${page.id}">删除</button>
          `
          }
        </div>
      </div>
    </div>
  `,
        )
        .join('') ||
      `<p class="text-base-content/45">${context.state.pagesTrashMode ? '页面回收站为空' : '暂无自定义页面'}</p>`;
  };
  context.createCategory = async function createCategory(event) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('name');
    const message = context.$('#category-message');
    message.textContent = '';
    try {
      await context.request('/admin/categories', {
        method: 'POST',
        body: JSON.stringify({ name: input.value.trim() }),
      });
      input.value = '';
      await context.loadTaxonomy();
      message.textContent = '分类已添加';
      context.notify('分类已添加');
    } catch (error) {
      if (context.scope.disposed) return;
      message.textContent = error.message || '分类添加失败';
      context.notify(error.message || '分类添加失败', true);
    }
  };
  context.createTag = async function createTag(event) {
    event.preventDefault();
    const input = event.currentTarget.elements.namedItem('name');
    const message = context.$('#tag-message');
    message.textContent = '';
    try {
      await context.request('/admin/tags', {
        method: 'POST',
        body: JSON.stringify({ name: input.value.trim() }),
      });
      input.value = '';
      await context.loadTaxonomy();
      message.textContent = '标签已添加';
      context.notify('标签已添加');
    } catch (error) {
      if (context.scope.disposed) return;
      message.textContent = error.message || '标签添加失败';
      context.notify(error.message || '标签添加失败', true);
    }
  };
  context.editCategory = async function editCategory(id) {
    const item = context.state.categories.find((cat) => String(cat.id) === String(id));
    const name = prompt('分类名称', item?.name || '');
    if (!name) return;
    try {
      await context.request(`/admin/categories/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
      await context.loadTaxonomy();
      context.$('#category-message').textContent = '分类已更新';
      context.notify('分类已更新');
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#category-message').textContent = error.message || '分类更新失败';
      context.notify(error.message || '分类更新失败', true);
    }
  };
  context.deleteCategory = async function deleteCategory(id) {
    if (!confirm('确认删除这个分类？相关文章会变为未分类。')) return;
    try {
      await context.request(`/admin/categories/${id}`, { method: 'DELETE' });
      await Promise.all([context.loadTaxonomy(), context.loadArticles()]);
      context.$('#category-message').textContent = '分类已删除，相关文章已变为未分类';
      context.notify('分类已删除');
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#category-message').textContent = error.message || '分类删除失败';
      context.notify(error.message || '分类删除失败', true);
    }
  };
  context.editTag = async function editTag(id) {
    const item = context.state.tags.find((tag) => String(tag.id) === String(id));
    const name = prompt('标签名称', item?.name || '');
    if (!name) return;
    try {
      await context.request(`/admin/tags/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ name }),
      });
      await context.loadTaxonomy();
      context.$('#tag-message').textContent = '标签已更新';
      context.notify('标签已更新');
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#tag-message').textContent = error.message || '标签更新失败';
      context.notify(error.message || '标签更新失败', true);
    }
  };
  context.deleteTag = async function deleteTag(id) {
    if (!confirm('确认删除这个标签？文章上的关联会一起移除。')) return;
    try {
      await context.request(`/admin/tags/${id}`, { method: 'DELETE' });
      await Promise.all([context.loadTaxonomy(), context.loadArticles()]);
      context.$('#tag-message').textContent = '标签已删除，文章关联已移除';
      context.notify('标签已删除');
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#tag-message').textContent = error.message || '标签删除失败';
      context.notify(error.message || '标签删除失败', true);
    }
  };
  context.resetPageForm = function resetPageForm() {
    context.$('#page-form').reset();
    context.$('#page-form').elements.namedItem('id').value = '';
    context.$('#page-editor-title').textContent = '新建独立页面';
    context.$('#page-message').textContent = '';
  };
  context.editPage = function editPage(id) {
    const page = context.state.pages.find((item) => String(item.id) === String(id));
    if (!page) return;
    const fields = context.$('#page-form').elements;
    fields.namedItem('id').value = page.id;
    fields.namedItem('title').value = page.title || '';
    fields.namedItem('template').value = page.template || 'default';
    fields.namedItem('status').value = page.status || 'published';
    fields.namedItem('content').value = page.content || '';
    context.$('#page-editor-title').textContent = '编辑独立页面';
    context.switchPanel('pages');
  };
  context.savePage = async function savePage(event) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const id = fields.namedItem('id').value;
    const payload = {
      title: fields.namedItem('title').value.trim(),
      template: fields.namedItem('template').value,
      status: fields.namedItem('status').value,
      content: fields.namedItem('content').value,
    };
    try {
      await context.request(id ? `/admin/pages/${id}` : '/admin/pages', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      context.$('#page-message').textContent = '页面已保存';
      context.notify('页面已保存');
      context.resetPageForm();
      context.state.pagesTrashMode = false;
      await context.loadPages();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#page-message').textContent = error.message || '页面保存失败';
      context.notify(error.message || '页面保存失败', true);
    }
  };
  context.deletePage = async function deletePage(id) {
    if (!confirm('确认把这个独立页面移入回收站？')) return;
    try {
      await context.request(`/admin/pages/${id}`, { method: 'DELETE' });
      context.notify('页面已移入回收站');
      await context.loadPages();
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '删除页面失败', true);
    }
  };
  context.restorePage = async function restorePage(id) {
    try {
      await context.request(`/admin/pages/${id}/restore`, { method: 'PUT' });
      context.notify('页面已恢复');
      await context.loadPages();
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '恢复页面失败', true);
    }
  };
  context.forceDeletePage = async function forceDeletePage(id) {
    if (!confirm('确认永久删除这个独立页面？此操作不可恢复。')) return;
    try {
      await context.request(`/admin/pages/${id}/force`, { method: 'DELETE' });
      context.notify('页面已永久删除');
      await context.loadPages();
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '永久删除页面失败', true);
    }
  };
}
