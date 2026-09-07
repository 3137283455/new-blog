export function TaxonomyPanel() {
  return (
    <section id="taxonomy-panel" className="admin-panel hidden">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="ryu-card p-5">
          <h2 className="text-xl font-black">分类</h2>
          <form id="category-form" className="mt-4 flex gap-2">
            <input
              className="input input-bordered rounded-xl"
              name="name"
              maxLength={40}
              placeholder="分类名称"
              required
            />
            <button className="ryu-btn-primary" type="submit">
              添加
            </button>
          </form>
          <p id="category-message" className="mt-2 min-h-5 text-sm"></p>
          <div id="category-list" className="mt-4 flex flex-wrap gap-2"></div>
        </div>
        <div className="ryu-card p-5">
          <h2 className="text-xl font-black">标签</h2>
          <form id="tag-form" className="mt-4 flex gap-2">
            <input
              className="input input-bordered rounded-xl"
              name="name"
              maxLength={40}
              placeholder="标签名称"
              required
            />
            <button className="ryu-btn-primary" type="submit">
              添加
            </button>
          </form>
          <p id="tag-message" className="mt-2 min-h-5 text-sm"></p>
          <div id="tag-list" className="mt-4 flex flex-wrap gap-2"></div>
        </div>
      </div>
    </section>
  );
}
