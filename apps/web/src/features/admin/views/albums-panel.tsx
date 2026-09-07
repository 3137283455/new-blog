export function AlbumsPanel() {
  return (
    <section id="albums-panel" className="admin-panel hidden">
      <div className="grid gap-4 xl:grid-cols-[0.8fr_0.8fr_1.2fr]">
        <form id="album-form" className="ryu-card grid gap-4 p-5">
          <input type="hidden" name="id" />
          <div>
            <h2 className="text-2xl font-black">相册管理</h2>
            <p className="text-sm text-base-content/50">创建相册，管理封面、日期、地点。</p>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="title"
            maxLength={100}
            placeholder="相册标题"
            required
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
              data-target-form="album-form"
              data-target-field="cover"
              data-media-type="image"
            >
              选择
            </button>
            <label className="btn join-item rounded-r-xl">
              上传
              <input id="album-cover-upload" className="hidden" type="file" accept="image/*" />
            </label>
          </div>
          <input className="input input-bordered rounded-xl" name="event_date" type="date" />
          <input
            className="input input-bordered rounded-xl"
            name="location"
            maxLength={120}
            placeholder="地点"
          />
          <input
            className="input input-bordered rounded-xl"
            name="icon"
            maxLength={40}
            placeholder="图标字符"
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
            name="description"
            maxLength={500}
            placeholder="相册描述"
          ></textarea>
          <label className="label cursor-pointer justify-start gap-3">
            <input className="checkbox" name="story_mode" type="checkbox" />
            多图故事模式
          </label>
          <label className="label cursor-pointer justify-start gap-3">
            <input className="checkbox" name="is_active" type="checkbox" defaultChecked />
            前台显示
          </label>
          <div className="flex gap-2">
            <button className="ryu-btn-primary" type="submit">
              保存相册
            </button>
            <button className="ryu-btn" type="button" data-reset-extra="album">
              清空
            </button>
          </div>
          <p id="album-message" className="min-h-6 text-sm"></p>
        </form>
        <form id="album-photo-form" className="ryu-card grid gap-4 p-5">
          <div>
            <h2 className="text-2xl font-black">添加照片</h2>
            <p className="text-sm text-base-content/50">上传图片后挂到指定相册。</p>
          </div>
          <select className="select select-bordered rounded-xl" name="album_id" required></select>
          <div className="join w-full">
            <input
              className="input join-item input-bordered w-full rounded-l-xl"
              name="image"
              maxLength={500}
              placeholder="图片地址 /uploads/..."
              required
            />
            <button
              className="btn join-item"
              type="button"
              data-pick-media
              data-target-form="album-photo-form"
              data-target-field="image"
              data-media-type="image"
            >
              选择
            </button>
            <label className="btn join-item rounded-r-xl">
              上传
              <input id="album-photo-upload" className="hidden" type="file" accept="image/*" />
            </label>
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="title"
            maxLength={100}
            placeholder="照片标题"
          />
          <select className="select select-bordered rounded-xl" name="variant">
            <option value="1x1">方图</option>
            <option value="4x3">横图 4:3</option>
            <option value="3x4">竖图 3:4</option>
            <option value="16x9">宽图 16:9</option>
          </select>
          <input
            className="input input-bordered rounded-xl"
            name="sort_order"
            type="number"
            min="-9999"
            max="9999"
            placeholder="排序"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <input
              className="input input-bordered rounded-xl"
              name="captured_at"
              type="datetime-local"
            />
            <input
              className="input input-bordered rounded-xl"
              name="camera"
              maxLength={160}
              placeholder="相机 / 手机（上传后自动读取）"
            />
          </div>
          <input
            className="input input-bordered rounded-xl"
            name="photo_location"
            maxLength={160}
            placeholder="拍摄地点或 GPS（上传后自动读取）"
          />
          <textarea
            className="textarea textarea-bordered rounded-xl"
            name="story_text"
            maxLength={2000}
            placeholder="这张照片在故事中的文字"
          ></textarea>
          <textarea
            className="textarea textarea-bordered rounded-xl"
            name="description"
            maxLength={500}
            placeholder="照片描述"
          ></textarea>
          <button className="ryu-btn-primary" type="submit">
            添加照片
          </button>
          <p id="album-photo-message" className="min-h-6 text-sm"></p>
        </form>
        <div className="ryu-card p-5">
          <h3 className="text-xl font-black">相册列表</h3>
          <div id="albums-list" className="mt-4 grid gap-3"></div>
        </div>
      </div>
    </section>
  );
}
