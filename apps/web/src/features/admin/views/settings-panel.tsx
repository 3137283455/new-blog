export function SettingsPanel() {
  return (
    <section id="settings-panel" className="admin-panel hidden">
      <header className="admin-settings-heading">
        <div>
          <p>SETTINGS</p>
          <h2>站点与账号</h2>
          <span>管理站点身份、前台资料、首页行为、评论与公开信息。</span>
        </div>
        <label className="admin-settings-search">
          <span>⌕</span>
          <input id="settings-search" type="search" placeholder="搜索设置" autoComplete="off" />
        </label>
      </header>

      <div className="admin-settings-dashboard">
        <div className="admin-settings-main">
          <form
            id="account-form"
            className="admin-settings-section"
            data-settings-search="账号 登录 昵称 头像 密码"
          >
            <header>
              <div>
                <h3>后台账号</h3>
                <p>用于管理后台登录和身份识别。</p>
              </div>
            </header>
            <label className="admin-setting-row">
              <span>
                <b>后台昵称</b>
                <small>显示在后台状态栏中。</small>
              </span>
              <input
                className="input input-bordered"
                name="nickname"
                maxLength={60}
                placeholder="后台昵称"
              />
            </label>
            <div className="admin-setting-row">
              <span>
                <b>后台头像</b>
                <small>建议使用正方形图片。</small>
              </span>
              <div className="join w-full">
                <input
                  className="input join-item input-bordered w-full"
                  name="avatar"
                  maxLength={500}
                  placeholder="/uploads/..."
                />
                <button
                  className="btn join-item"
                  type="button"
                  data-pick-media
                  data-target-form="account-form"
                  data-target-field="avatar"
                  data-media-type="image"
                >
                  选择
                </button>
              </div>
            </div>
            <label className="admin-setting-row">
              <span>
                <b>修改密码</b>
                <small>至少 8 位；留空时保持现有密码。</small>
              </span>
              <input
                className="input input-bordered"
                name="password"
                type="password"
                minLength={8}
                maxLength={128}
                autoComplete="new-password"
                placeholder="输入新密码"
              />
            </label>
            <footer className="admin-settings-actions">
              <p id="account-message" className="min-h-6 text-sm"></p>
              <button className="ryu-btn-primary" type="submit">
                保存账号
              </button>
            </footer>
          </form>

          <form
            id="profile-form"
            className="admin-settings-section"
            data-settings-search="前台 资料卡 博主 头像 简介"
          >
            <header>
              <div>
                <h3>前台资料卡</h3>
                <p>用于首页侧栏、导航品牌和文章作者信息。</p>
              </div>
            </header>
            <label className="admin-setting-row">
              <span>
                <b>显示名称</b>
                <small>未填写时使用站点标题。</small>
              </span>
              <input
                className="input input-bordered"
                name="profile_name"
                maxLength={60}
                placeholder="个人博客"
              />
            </label>
            <div className="admin-setting-row">
              <span>
                <b>资料头像</b>
                <small>首页、导航和音乐页共用。</small>
              </span>
              <div className="join w-full">
                <input
                  className="input join-item input-bordered w-full"
                  name="profile_avatar"
                  maxLength={500}
                  placeholder="/uploads/..."
                />
                <button
                  className="btn join-item"
                  type="button"
                  data-pick-media
                  data-target-form="profile-form"
                  data-target-field="profile_avatar"
                  data-media-type="image"
                >
                  选择
                </button>
                <label className="btn join-item">
                  上传
                  <input id="avatar-upload" className="hidden" type="file" accept="image/*" />
                </label>
              </div>
            </div>
            <label className="admin-setting-row">
              <span>
                <b>个人简介</b>
                <small>一句话介绍自己或这个博客。</small>
              </span>
              <textarea
                className="textarea textarea-bordered"
                name="profile_bio"
                maxLength={200}
                placeholder="记录技术、生活和灵感"
              ></textarea>
            </label>
            <footer className="admin-settings-actions">
              <p id="profile-message" className="min-h-6 text-sm"></p>
              <button className="ryu-btn-primary" type="submit">
                保存资料
              </button>
            </footer>
          </form>

          <form
            id="site-settings-form"
            className="admin-settings-section"
            data-settings-search="站点 标题 描述 作者 关键词 SEO 语言 页脚 版权 建站 日期 RSS Feed 访客 Banner 轮播 分页 评论 审核"
          >
            <header>
              <div>
                <h3>站点基础信息</h3>
                <p>这些内容会用于页面标题、搜索摘要、分享卡片与页脚。</p>
              </div>
            </header>
            <label className="admin-setting-row">
              <span>
                <b>站点标题</b>
                <small>浏览器标题和站点品牌名称。</small>
              </span>
              <input
                className="input input-bordered"
                name="site_title"
                maxLength={80}
                placeholder="My Blog"
              />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>站点描述</b>
                <small>用于首页介绍和页面 description。</small>
              </span>
              <textarea
                className="textarea textarea-bordered"
                name="site_description"
                maxLength={300}
                placeholder="个人博客简介"
              ></textarea>
            </label>
            <label className="admin-setting-row">
              <span>
                <b>站点作者</b>
                <small>写入页面 author 元数据。</small>
              </span>
              <input
                className="input input-bordered"
                name="site_author"
                maxLength={80}
                placeholder="作者名称"
              />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>搜索关键词</b>
                <small>用逗号分隔，写入页面 keywords 元数据。</small>
              </span>
              <input
                className="input input-bordered"
                name="site_keywords"
                maxLength={300}
                placeholder="博客, 技术, 生活"
              />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>站点语言</b>
                <small>设置 HTML 文档语言。</small>
              </span>
              <select className="select select-bordered" name="site_language">
                <option value="zh-CN">简体中文</option>
                <option value="zh-TW">繁体中文</option>
                <option value="ja-JP">日本語</option>
                <option value="en-US">English</option>
              </select>
            </label>
            <label className="admin-setting-row">
              <span>
                <b>允许搜索引擎收录</b>
                <small>关闭后页面会输出 noindex、nofollow。</small>
              </span>
              <input className="toggle" name="allow_search_indexing" type="checkbox" />
            </label>

            <header className="admin-settings-group">
              <div>
                <h3>首页与内容</h3>
                <p>控制首页轮播和文章列表基础行为。</p>
              </div>
            </header>
            <div className="admin-setting-row admin-setting-row-stack">
              <span>
                <b>首页 Banner 轮播图</b>
                <small>一行一个图片地址，最多 12 张；留空使用默认封面。</small>
              </span>
              <div className="w-full">
                <textarea
                  className="textarea textarea-bordered min-h-28 w-full"
                  name="banner_images"
                  placeholder="/home.webp&#10;/uploads/..."
                ></textarea>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    className="ryu-btn btn-sm"
                    type="button"
                    data-pick-media
                    data-target-form="site-settings-form"
                    data-target-field="banner_images"
                    data-media-type="image"
                    data-append-media="true"
                  >
                    选择已有图
                  </button>
                  <label className="ryu-btn btn-sm">
                    上传并追加
                    <input
                      id="banner-upload"
                      className="hidden"
                      type="file"
                      accept="image/*"
                      multiple
                    />
                  </label>
                </div>
              </div>
            </div>
            <label className="admin-setting-row">
              <span>
                <b>轮播间隔</b>
                <small>3–30 秒。</small>
              </span>
              <div className="admin-setting-unit">
                <input
                  className="input input-bordered"
                  name="banner_interval"
                  type="number"
                  min="3"
                  max="30"
                  step="1"
                />
                <span>秒</span>
              </div>
            </label>
            <label className="admin-setting-row">
              <span>
                <b>每页文章数</b>
                <small>文章归档和列表默认分页数量。</small>
              </span>
              <input
                className="input input-bordered"
                name="posts_per_page"
                type="number"
                min="1"
                max="50"
              />
            </label>

            <header className="admin-settings-group">
              <div>
                <h3>页脚与订阅</h3>
                <p>管理页脚文字、运行时间和订阅入口。</p>
              </div>
            </header>
            <label className="admin-setting-row">
              <span>
                <b>页脚文字</b>
                <small>显示在站点名称下方。</small>
              </span>
              <input
                className="input input-bordered"
                name="footer_text"
                maxLength={160}
                placeholder="记录所想，分享所见。"
              />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>建站日期</b>
                <small>用于计算站点运行时间。</small>
              </span>
              <input className="input input-bordered" name="site_start_date" type="date" />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>版权年份</b>
                <small>显示在页脚版权信息中。</small>
              </span>
              <input
                className="input input-bordered"
                name="copyright_year"
                type="number"
                min="2000"
                max="2100"
              />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>显示 RSS 入口</b>
                <small>保留 RSS 订阅链接与 head 声明。</small>
              </span>
              <input className="toggle" name="enable_rss" type="checkbox" />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>显示 JSON Feed</b>
                <small>保留 JSON Feed 订阅链接与 head 声明。</small>
              </span>
              <input className="toggle" name="enable_json_feed" type="checkbox" />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>显示访客统计</b>
                <small>在页脚显示今日与累计访问量。</small>
              </span>
              <input className="toggle" name="show_visitor_stats" type="checkbox" />
            </label>

            <header className="admin-settings-group">
              <div>
                <h3>评论</h3>
                <p>控制全站文章评论与审核流程。</p>
              </div>
            </header>
            <label className="admin-setting-row">
              <span>
                <b>启用评论</b>
                <small>关闭后文章页不显示评论入口。</small>
              </span>
              <input className="toggle" name="enable_comments" type="checkbox" />
            </label>
            <label className="admin-setting-row">
              <span>
                <b>评论需要审核</b>
                <small>新评论通过审核后才会公开。</small>
              </span>
              <input className="toggle" name="comment_moderation" type="checkbox" />
            </label>
            <footer className="admin-settings-actions">
              <p id="settings-message" className="min-h-6 text-sm"></p>
              <button className="ryu-btn-primary" type="submit">
                保存站点设置
              </button>
            </footer>
          </form>
          <p id="settings-search-empty" className="admin-settings-empty hidden">
            没有匹配的设置项。
          </p>
        </div>

        <aside className="admin-settings-aside" aria-label="站点预览与状态">
          <section className="admin-settings-preview">
            <header>
              <div>
                <p>LIVE PREVIEW</p>
                <h3>站点预览</h3>
              </div>
              <a href="/" target="_blank" rel="noreferrer">
                访问前台 ↗
              </a>
            </header>
            <div className="admin-settings-preview-frame">
              <img id="settings-preview-image" src="/home.webp" alt="站点首页预览" />
              <div>
                <strong id="settings-preview-title">My Blog</strong>
                <span id="settings-preview-description">记录技术、生活和灵感。</span>
              </div>
            </div>
            <dl className="admin-settings-preview-stats">
              <div>
                <dt>语言</dt>
                <dd id="settings-preview-language">简体中文</dd>
              </div>
              <div>
                <dt>轮播</dt>
                <dd id="settings-preview-banner-count">默认</dd>
              </div>
            </dl>
          </section>

          <section className="admin-settings-status">
            <header>
              <div>
                <p>CONFIGURATION</p>
                <h3>功能状态</h3>
              </div>
            </header>
            <dl>
              <div>
                <dt>评论</dt>
                <dd id="settings-preview-comments">已启用</dd>
              </div>
              <div>
                <dt>内容订阅</dt>
                <dd id="settings-preview-feeds">RSS · JSON</dd>
              </div>
              <div>
                <dt>搜索收录</dt>
                <dd id="settings-preview-indexing">允许</dd>
              </div>
            </dl>
          </section>

          <section className="admin-settings-system">
            <header>
              <div>
                <p>SYSTEM</p>
                <h3>系统信息</h3>
              </div>
            </header>
            <dl>
              <div>
                <dt>前端</dt>
                <dd>Next.js</dd>
              </div>
              <div>
                <dt>后端</dt>
                <dd>Express + SQLite</dd>
              </div>
              <div>
                <dt>接口</dt>
                <dd>/api</dd>
              </div>
            </dl>
          </section>
        </aside>
      </div>
    </section>
  );
}
