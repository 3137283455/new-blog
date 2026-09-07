export function register(context) {
  context.loadComments = async function loadComments() {
    const status = context.$('#comment-status-filter')?.value || '';
    const qs = new URLSearchParams({ page: '1', pageSize: '50' });
    if (status) qs.set('status', status);
    const json = await context.request(`/admin/comments?${qs.toString()}`);
    context.state.comments = json.data || [];
    context.renderComments();
  };
  context.replyComment = async function replyComment(id) {
    const comment = context.state.comments.find((item) => String(item.id) === String(id));
    const content = window.prompt(`回复 ${comment?.author_name || '这条评论'}：`);
    if (!content?.trim()) return;
    try {
      await context.request(`/admin/comments/${id}/reply`, {
        method: 'POST',
        body: JSON.stringify({ content: content.trim() }),
      });
      await context.loadComments();
      context.notify('回复已发布');
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '回复失败', true);
    }
  };
  context.renderComments = function renderComments() {
    const list = context.$('#comments-list');
    if (!list) return;
    list.innerHTML =
      context.state.comments
        .map(
          (comment) => `
    <div class="rounded-2xl bg-base-100/65 p-4">
      <div class="flex flex-wrap items-start justify-between gap-3">
        <label class="mt-1 inline-flex items-center">
          <input class="checkbox checkbox-sm" type="checkbox" data-comment-check="${comment.id}" aria-label="选择评论" />
        </label>
        <div class="min-w-0 flex-1">
          <p class="font-black">${context.escapeHtml(comment.author_name)} <span class="badge badge-ghost">${context.escapeHtml(comment.status)}</span></p>
          <p class="text-xs text-base-content/45">${context.escapeHtml(comment.article_title || '未知文章')} · ${context.formatDate(comment.created_at)}</p>
          <p class="mt-2 text-sm">${context.escapeHtml(comment.content)}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="btn btn-xs rounded-lg" data-reply-comment="${comment.id}">回复</button>
          <button class="btn btn-xs rounded-lg" data-comment-status="${comment.id}" data-status="approved">通过</button>
          <button class="btn btn-xs rounded-lg" data-comment-status="${comment.id}" data-status="spam">垃圾</button>
          <button class="btn btn-xs btn-error rounded-lg" data-delete-comment="${comment.id}">删除</button>
        </div>
      </div>
    </div>
  `,
        )
        .join('') || '<p class="text-base-content/45">暂无评论</p>';
  };
  context.updateCommentStatus = async function updateCommentStatus(id, status) {
    try {
      await context.request(`/admin/comments/${id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      context.notify(status === 'approved' ? '评论已通过' : '评论已标记为垃圾');
      await Promise.all([context.loadComments(), context.loadDashboard()]);
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '评论状态更新失败', true);
    }
  };
  context.deleteComment = async function deleteComment(id) {
    if (!confirm('确认删除这条评论？')) return;
    try {
      await context.request(`/admin/comments/${id}`, { method: 'DELETE' });
      context.notify('评论已删除');
      await Promise.all([context.loadComments(), context.loadDashboard()]);
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '评论删除失败', true);
    }
  };
  context.selectedCommentIds = function selectedCommentIds() {
    return context
      .$$('[data-comment-check]:checked')
      .map((input) => input.dataset.commentCheck)
      .filter(Boolean);
  };
  context.batchUpdateComments = async function batchUpdateComments(status) {
    const ids = context.selectedCommentIds();
    if (!ids.length) {
      context.notify('请先选择评论', true);
      return;
    }
    const label = status === 'approved' ? '通过' : '标记为垃圾';
    if (!confirm(`确认将 ${ids.length} 条评论批量${label}？`)) return;
    try {
      for (const id of ids) {
        await context.request(`/admin/comments/${id}/status`, {
          method: 'PUT',
          body: JSON.stringify({ status }),
        });
      }
      context.notify(`已批量处理 ${ids.length} 条评论`);
      await Promise.all([context.loadComments(), context.loadDashboard()]);
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '批量处理评论失败', true);
    }
  };
  context.batchDeleteComments = async function batchDeleteComments() {
    const ids = context.selectedCommentIds();
    if (!ids.length) {
      context.notify('请先选择评论', true);
      return;
    }
    if (!confirm(`确认删除 ${ids.length} 条评论？此操作不可恢复。`)) return;
    try {
      for (const id of ids) {
        await context.request(`/admin/comments/${id}`, { method: 'DELETE' });
      }
      context.notify(`已删除 ${ids.length} 条评论`);
      await Promise.all([context.loadComments(), context.loadDashboard()]);
    } catch (error) {
      if (context.scope.disposed) return;
      context.notify(error.message || '批量删除评论失败', true);
    }
  };
}
