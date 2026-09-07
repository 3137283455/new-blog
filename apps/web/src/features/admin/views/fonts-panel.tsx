export function FontsPanel() {
  return (
    <section id="fonts-panel" className="admin-panel hidden">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <form id="font-library-form" className="ryu-card grid gap-4 p-5">
          <div>
            <h2 className="text-2xl font-black">字体库</h2>
            <p className="text-sm text-base-content/50">
              统一上传和维护字体文件，写作页和文章编辑只负责选择字体。
            </p>
          </div>
          <label className="form-control">
            <span className="label-text">字体名称</span>
            <input
              className="input input-bordered rounded-xl"
              id="font-name-input"
              placeholder="例如：霞鹜文楷 / 思源宋体"
            />
          </label>
          <label className="form-control">
            <span className="label-text">字体文件</span>
            <div className="join w-full">
              <input
                className="input join-item input-bordered w-full rounded-l-xl"
                id="font-url-input"
                placeholder="/uploads/... 或 https://..."
              />
              <label className="btn join-item rounded-r-xl">
                上传
                <input
                  id="font-file-upload"
                  className="hidden"
                  type="file"
                  accept=".woff,.woff2,.ttf,.otf,.eot,font/*"
                />
              </label>
            </div>
          </label>
          <div className="flex flex-wrap gap-2">
            <button id="add-font-library" className="ryu-btn-primary" type="button">
              加入字体库
            </button>
            <button id="save-font-library" className="ryu-btn" type="button">
              保存字体库
            </button>
          </div>
          <p id="font-library-message" className="min-h-6 text-sm"></p>
        </form>
        <div className="ryu-card p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-black">已导入字体</h3>
              <p className="text-sm text-base-content/50">
                可在媒体库筛选“字体”，把已上传字体加入这里；删除后记得保存字体库。
              </p>
            </div>
          </div>
          <div id="font-library-list" className="mt-5 grid gap-3 text-sm"></div>
        </div>
      </div>
    </section>
  );
}
