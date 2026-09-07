export function register(context) {
  context.loadArticles = async function loadArticles() {
    const status = context.$('#status-filter').value;
    const trashed = context.$('#trash-filter')?.checked;
    const qs = new URLSearchParams({ page: '1', pageSize: '30', summary: 'true' });
    if (status) qs.set('status', status);
    if (trashed) qs.set('trashed', 'true');
    const json = await context.request(`/admin/articles?${qs.toString()}`);
    context.state.articles = json.data || [];
    context.renderArticles();
  };
  context.renderArticles = function renderArticles() {
    const trashed = context.$('#trash-filter')?.checked;
    const batchButton = context.$('#batch-delete');
    if (batchButton) {
      batchButton.textContent = trashed ? '批量永久删除' : '批量删除';
      batchButton.classList.toggle('btn-error', !!trashed);
    }
    context.$('#articles-table').innerHTML =
      context.state.articles
        .map(
          (post) => `
    <tr>
      <td><input class="checkbox checkbox-sm article-check" type="checkbox" value="${post.id}" /></td>
      <td>
        <div class="font-black">${context.escapeHtml(post.title)}</div>
        <div class="text-xs text-base-content/45">${context.escapeHtml(post.slug || '')}</div>
      </td>
      <td><span class="badge ${post.status === 'published' ? 'badge-primary' : 'badge-ghost'}">${post.status === 'published' ? '已发布' : '草稿'}</span></td>
      <td>${context.escapeHtml(post.category_name || '未分类')}</td>
      <td>${post.view_count || 0}</td>
      <td>${context.formatDate(post.updated_at || post.created_at)}</td>
      <td>
        <div class="flex justify-end gap-2">
          ${
            trashed
              ? `
            <button class="btn btn-xs rounded-lg" data-restore="${post.id}">恢复</button>
            <button class="btn btn-xs btn-error rounded-lg" data-force-delete="${post.id}">永久删除</button>
          `
              : `
            <a class="btn btn-xs rounded-lg" href="/admin/write?id=${post.id}">编辑</a>
            <button class="btn btn-xs btn-error rounded-lg" data-delete="${post.id}">删除</button>
          `
          }
        </div>
      </td>
    </tr>
  `,
        )
        .join('') ||
      '<tr><td colspan="7" class="text-center text-base-content/45">暂无文章</td></tr>';
  };
  context.useFontInArticleForm = function useFontInArticleForm(index, target) {
    const font = context.state.fontLibrary[Number(index)];
    if (!font) return;
    const select =
      target === 'title' ? context.$('#title-font-select') : context.$('#body-font-select');
    if (!select) return;
    select.value = context.fontKey(font);
    context.$('#font-library-message').textContent =
      `已设为${target === 'title' ? '标题' : '正文'}字体，保存文章后生效`;
    context.switchPanel('articles');
  };
  context.editArticle = async function editArticle(id) {
    const json = await context.request(`/admin/articles/${id}`);
    const post = json.data;
    const form = context.$('#article-form');
    const fields = form.elements;
    fields.namedItem('id').value = post.id;
    fields.namedItem('title').value = post.title || '';
    fields.namedItem('status').value = post.status || 'draft';
    fields.namedItem('visibility').value = post.visibility || 'public';
    fields.namedItem('category_id').value = post.category_id || '';
    fields.namedItem('excerpt').value = post.excerpt || '';
    fields.namedItem('cover_image').value = post.cover_image || '';
    context.updateCoverPreview(post.cover_image || '');
    fields.namedItem('content').value = post.content || '';
    fields.namedItem('title_font_key').value = context.fontKey({
      family: post.title_font_family,
      url: post.title_font_url,
    });
    fields.namedItem('body_font_key').value = context.fontKey({
      family: post.body_font_family,
      url: post.body_font_url,
    });
    fields.namedItem('is_pinned').checked = !!post.is_pinned;
    fields.namedItem('is_recommended').checked = !!post.is_recommended;
    const tagIds = new Set((post.tags || []).map((tag) => String(tag.id)));
    Array.from(fields.namedItem('tag_ids').options).forEach((option) => {
      option.selected = tagIds.has(option.value);
    });
    context.$('#editor-title').textContent = '编辑文章';
    context.$('#editor-message').textContent = '';
    context.switchPanel('editor');
  };
  context.resetEditor = function resetEditor() {
    context.$('#article-form').reset();
    context.$('#article-form').elements.namedItem('id').value = '';
    context.$('#editor-title').textContent = '新建文章';
    context.$('#editor-message').textContent = '';
    context.updateCoverPreview('');
    context.$('#title-font-select').value = '';
    context.$('#body-font-select').value = '';
    Array.from(context.$('#tag-select').options).forEach((option) => {
      option.selected = false;
    });
  };
  context.saveArticle = async function saveArticle(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = form.elements;
    const id = fields.namedItem('id').value;
    const titleFont = context.parseFontSelection(fields.namedItem('title_font_key').value);
    const bodyFont = context.parseFontSelection(fields.namedItem('body_font_key').value);
    const payload = {
      title: fields.namedItem('title').value.trim(),
      content: fields.namedItem('content').value.trim(),
      excerpt: fields.namedItem('excerpt').value.trim(),
      cover_image: fields.namedItem('cover_image').value.trim(),
      title_font_family: titleFont.family,
      title_font_url: titleFont.url,
      body_font_family: bodyFont.family,
      body_font_url: bodyFont.url,
      status: fields.namedItem('status').value,
      visibility: fields.namedItem('visibility').value,
      category_id: fields.namedItem('category_id').value
        ? Number(fields.namedItem('category_id').value)
        : null,
      tag_ids: Array.from(fields.namedItem('tag_ids').selectedOptions).map((option) =>
        Number(option.value),
      ),
      is_pinned: fields.namedItem('is_pinned').checked,
      is_recommended: fields.namedItem('is_recommended').checked,
    };
    context.$('#editor-message').textContent = '正在保存...';
    try {
      await context.request(id ? `/admin/articles/${id}` : '/admin/articles', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      context.$('#editor-message').textContent = '保存成功';
      await Promise.all([context.loadDashboard(), context.loadArticles()]);
      context.switchPanel('articles');
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#editor-message').textContent = error.message;
    }
  };
  context.deleteArticle = async function deleteArticle(id) {
    if (!confirm('确认把这篇文章移入回收站？')) return;
    try {
      await context.request(`/admin/articles/${id}`, { method: 'DELETE' });
      await Promise.all([context.loadDashboard(), context.loadArticles()]);
      context.notify('文章已移入回收站');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '删除文章失败', true);
    }
  };
  context.batchDeleteArticles = async function batchDeleteArticles() {
    const ids = context.$$('.article-check:checked').map((input) => Number(input.value));
    const trashed = context.$('#trash-filter')?.checked;
    if (!ids.length) {
      context.notify(trashed ? '请先勾选要永久删除的文章' : '请先勾选要移动到回收站的文章', true);
      return;
    }
    if (
      !confirm(
        trashed
          ? `确认永久删除 ${ids.length} 篇文章？此操作不可恢复。`
          : `确认把 ${ids.length} 篇文章移入回收站？`,
      )
    )
      return;
    try {
      if (trashed) {
        for (const id of ids) {
          await context.request(`/admin/articles/${id}/force`, { method: 'DELETE' });
        }
      } else {
        await context.request('/admin/articles/batch-delete', {
          method: 'POST',
          body: JSON.stringify({ ids }),
        });
      }
      context.$('#select-all-articles').checked = false;
      await Promise.all([context.loadDashboard(), context.loadArticles()]);
      context.notify(
        trashed ? `已永久删除 ${ids.length} 篇文章` : `已将 ${ids.length} 篇文章移入回收站`,
      );
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || (trashed ? '批量永久删除失败' : '批量删除失败'), true);
    }
  };
  context.restoreArticle = async function restoreArticle(id) {
    try {
      await context.request(`/admin/articles/${id}/restore`, { method: 'PUT' });
      await Promise.all([context.loadDashboard(), context.loadArticles()]);
      context.notify('文章已恢复');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '恢复文章失败', true);
    }
  };
  context.forceDeleteArticle = async function forceDeleteArticle(id) {
    if (!confirm('确认永久删除这篇文章？此操作不可恢复。')) return;
    try {
      await context.request(`/admin/articles/${id}/force`, { method: 'DELETE' });
      await Promise.all([context.loadDashboard(), context.loadArticles()]);
      context.notify('文章已永久删除');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '永久删除文章失败', true);
    }
  };
  context.insertMarkdown = function insertMarkdown(kind) {
    const textarea = context.$('#article-form')?.elements.namedItem('content');
    if (!textarea) return;
    const snippets = {
      heading: { before: '\n## ', text: '小标题', after: '\n' },
      bold: { before: '**', text: '重点文字', after: '**' },
      quote: { before: '\n> ', text: '引用内容', after: '\n' },
      code: { before: '\n```js\n', text: 'console.log(\"Hello\")', after: '\n```\n' },
      table: { before: '\n| 列一 | 列二 |\n| --- | --- |\n| ', text: '内容', after: ' | 内容 |\n' },
      image: { before: '\n![', text: '图片描述', after: '](/uploads/image.png)\n' },
      math: { before: '\n$$\n', text: 'E = mc^2', after: '\n$$\n' },
      footnote: { before: '', text: '需要说明的文字[^1]\n\n[^1]: 脚注内容', after: '' },
    };
    const item = snippets[kind];
    if (!item) return;
    const start = textarea.selectionStart || 0;
    const end = textarea.selectionEnd || start;
    const selected = textarea.value.slice(start, end) || item.text;
    textarea.setRangeText(`${item.before}${selected}${item.after}`, start, end, 'end');
    textarea.focus();
    context.$('#editor-message').textContent = '已插入 Markdown 片段';
  };
}
