export function CommentsPanel() {
  return (
    <section id="comments-panel" className="admin-panel hidden">
      <div className="ryu-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-black">评论管理</h2>
            <p className="text-sm text-base-content/50">审核、标记垃圾评论或删除评论。</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select
              id="comment-status-filter"
              className="select select-bordered select-sm rounded-xl"
            >
              <option value="">全部评论</option>
              <option value="pending">待审核</option>
              <option value="approved">已通过</option>
              <option value="spam">垃圾评论</option>
            </select>
            <button id="comment-select-all" className="ryu-btn btn-sm" type="button">
              全选
            </button>
            <button className="ryu-btn btn-sm" type="button" data-comment-batch-status="approved">
              批量通过
            </button>
            <button className="ryu-btn btn-sm" type="button" data-comment-batch-status="spam">
              批量垃圾
            </button>
            <button id="comment-batch-delete" className="ryu-btn btn-sm btn-error" type="button">
              批量删除
            </button>
          </div>
        </div>
        <div id="comments-list" className="mt-5 grid gap-3"></div>
      </div>
    </section>
  );
}
