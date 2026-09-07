export function BangumiPanel() {
  return (
    <section id="bangumi-panel" className="admin-panel hidden">
      <div className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <form id="bangumi-form" className="ryu-card grid gap-4 p-5">
          <input type="hidden" name="id" />
          <div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-2xl font-black">追番管理</h2>
                <p className="text-sm text-base-content/50">
                  管理前台「追番」页面的番剧海报、进度和评分。
                </p>
              </div>
              <button id="bangumi-source-open" className="ryu-btn" type="button">
                检索番剧
              </button>
            </div>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="title"
            maxLength={100}
            placeholder="番剧标题"
            required
          />
          <input
            className="input input-bordered rounded-xl"
            name="original_title"
            maxLength={100}
            placeholder="原名 / 别名"
          />
          <div className="join w-full">
            <input
              className="input join-item input-bordered w-full rounded-l-xl"
              name="cover"
              maxLength={500}
              placeholder="封面地址 /uploads/..."
            />
            <button
              className="btn join-item"
              type="button"
              data-pick-media
              data-target-form="bangumi-form"
              data-target-field="cover"
              data-media-type="image"
            >
              选择
            </button>
            <label className="btn join-item rounded-r-xl">
              上传
              <input id="bangumi-cover-upload" className="hidden" type="file" accept="image/*" />
            </label>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="url"
            maxLength={500}
            placeholder="详情链接"
          />
          <div className="grid gap-3 md:grid-cols-3">
            <input
              className="input input-bordered rounded-xl"
              name="external_id"
              maxLength={40}
              placeholder="Bangumi ID"
            />
            <input
              className="input input-bordered rounded-xl"
              name="type"
              maxLength={60}
              placeholder="类型，如 TV / 剧场版"
            />
            <input
              className="input input-bordered rounded-xl"
              name="total_episodes"
              type="number"
              min="0"
              max="9999"
              placeholder="总集数"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-1">
            <input
              className="input input-bordered rounded-xl"
              name="article_id"
              type="number"
              min="1"
              placeholder="观后感文章 ID"
            />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="select select-bordered rounded-xl" name="status">
              <option value="watching">追番中</option>
              <option value="done">已看完</option>
              <option value="plan">想看</option>
              <option value="paused">搁置</option>
            </select>
            <input
              className="input input-bordered rounded-xl"
              name="progress"
              maxLength={60}
              placeholder="进度，如 8/12"
            />
            <input
              className="input input-bordered rounded-xl"
              name="rating"
              type="number"
              min="0"
              max="10"
              step="0.1"
              placeholder="评分"
            />
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="season"
            maxLength={60}
            placeholder="季度，如 2026 春"
          />
          <input
            className="input input-bordered rounded-xl"
            name="sort_order"
            type="number"
            min="-9999"
            max="9999"
            placeholder="排序"
          />
          <textarea
            className="textarea textarea-bordered rounded-xl"
            name="summary"
            maxLength={500}
            placeholder="简介"
          ></textarea>
          <section className="bangumi-source-manager">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-black">播放源</h3>
                <p className="text-xs text-base-content/45">
                  每个播放源独立管理，可选择一个默认源。
                </p>
              </div>
              <button id="bangumi-play-source-create" className="ryu-btn btn-sm" type="button">
                新增播放源
              </button>
            </div>
            <div id="bangumi-play-source-list" className="mt-3 grid gap-2"></div>
          </section>
          <label className="label cursor-pointer justify-start gap-3">
            <input className="checkbox" name="is_active" type="checkbox" defaultChecked />
            前台显示
          </label>
          <div className="flex gap-2">
            <button className="ryu-btn-primary" type="submit">
              保存追番
            </button>
            <button className="ryu-btn" type="button" data-reset-extra="bangumi">
              清空
            </button>
          </div>
          <p id="bangumi-message" className="min-h-6 text-sm"></p>
        </form>
        <div className="ryu-card p-5">
          <h3 className="text-xl font-black">追番列表</h3>
          <div id="bangumi-list" className="mt-4 grid gap-3"></div>
        </div>
      </div>
    </section>
  );
}
