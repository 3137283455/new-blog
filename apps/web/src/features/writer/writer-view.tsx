export function WriterView() {
  return (
    <>
      <main className="writer-shell" data-astro-cid-he2mkkt2="">
        <header className="writer-topbar" data-astro-cid-he2mkkt2="">
          <div className="writer-brand" data-astro-cid-he2mkkt2="">
            <a className="writer-logo" href="/admin" title="返回后台" data-astro-cid-he2mkkt2="">
              写
            </a>
            <div className="writer-crumbs" data-astro-cid-he2mkkt2="">
              <strong data-astro-cid-he2mkkt2="">写作台</strong>
              <span data-astro-cid-he2mkkt2="">/</span>
              <span id="writer-mode" data-astro-cid-he2mkkt2="">
                新文章
              </span>
              <span data-astro-cid-he2mkkt2="">/</span>
              <select id="quick-status" aria-label="状态" data-astro-cid-he2mkkt2="">
                <option value="draft" data-astro-cid-he2mkkt2="">
                  草稿
                </option>
                <option value="published" data-astro-cid-he2mkkt2="">
                  发布
                </option>
              </select>
            </div>
          </div>
          <div className="writer-actions" data-astro-cid-he2mkkt2="">
            <button
              id="toggle-left"
              className="writer-btn icon"
              type="button"
              title="收起左侧"
              data-astro-cid-he2mkkt2=""
            >
              ⇤
            </button>
            <button
              id="toggle-right"
              className="writer-btn icon"
              type="button"
              title="收起右侧"
              data-astro-cid-he2mkkt2=""
            >
              ⇥
            </button>
            <a className="writer-btn writer-back-link" href="/admin" data-astro-cid-he2mkkt2="">
              返回后台
            </a>
            <button id="save-draft" className="writer-btn" type="button" data-astro-cid-he2mkkt2="">
              保存草稿
            </button>
            <button
              id="publish-article"
              className="writer-btn primary"
              type="button"
              data-astro-cid-he2mkkt2=""
            >
              发布
            </button>
          </div>
        </header>

        <section className="writer-main" data-astro-cid-he2mkkt2="">
          <aside className="writer-left" data-astro-cid-he2mkkt2="">
            <div className="writer-mobile-panel-head" data-astro-cid-he2mkkt2="">
              <strong data-astro-cid-he2mkkt2="">文章管理</strong>
              <button
                type="button"
                data-mobile-close
                aria-label="关闭文章管理"
                data-astro-cid-he2mkkt2=""
              >
                ×
              </button>
            </div>
            <div className="writer-left-head" data-astro-cid-he2mkkt2="">
              <input
                id="article-search"
                className="writer-search"
                type="search"
                placeholder="搜索标题、摘要、slug"
                data-astro-cid-he2mkkt2=""
              />
              <button
                id="new-draft"
                className="writer-left-action"
                type="button"
                data-astro-cid-he2mkkt2=""
              >
                + 新建文章
              </button>
              <div className="writer-tabs" id="article-tabs" data-astro-cid-he2mkkt2="">
                <button
                  className="writer-tab active"
                  type="button"
                  data-filter="all"
                  data-astro-cid-he2mkkt2=""
                >
                  全部 0
                </button>
                <button
                  className="writer-tab"
                  type="button"
                  data-filter="draft"
                  data-astro-cid-he2mkkt2=""
                >
                  草稿箱 0
                </button>
                <button
                  className="writer-tab"
                  type="button"
                  data-filter="published"
                  data-astro-cid-he2mkkt2=""
                >
                  已发布 0
                </button>
                <button
                  className="writer-tab"
                  type="button"
                  data-filter="trash"
                  data-astro-cid-he2mkkt2=""
                >
                  回收站 0
                </button>
              </div>
            </div>
            <div id="article-list" className="writer-list" data-astro-cid-he2mkkt2=""></div>
          </aside>

          <section className="writer-stage" data-astro-cid-he2mkkt2="">
            <div className="writer-toolbar" data-astro-cid-he2mkkt2="">
              <input
                id="text-file-input"
                className="hidden"
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                data-astro-cid-he2mkkt2=""
              />
              <input
                id="epub-file-input"
                className="hidden"
                type="file"
                accept=".epub,application/epub+zip"
                data-astro-cid-he2mkkt2=""
              />
              <input
                id="article-image-input"
                className="hidden"
                type="file"
                accept="image/*"
                data-astro-cid-he2mkkt2=""
              />
              <input
                id="cover-file-input"
                className="hidden"
                type="file"
                accept="image/*"
                data-astro-cid-he2mkkt2=""
              />
              <div className="writer-tool-group writer-format-tools" data-astro-cid-he2mkkt2="">
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="bold"
                  title="加粗"
                  data-astro-cid-he2mkkt2=""
                >
                  B
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="italic"
                  title="斜体"
                  data-astro-cid-he2mkkt2=""
                >
                  <em data-astro-cid-he2mkkt2="">I</em>
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="heading"
                  title="标题"
                  data-astro-cid-he2mkkt2=""
                >
                  H
                </button>
                <select
                  id="heading-level"
                  className="writer-heading-select"
                  title="标题等级"
                  data-astro-cid-he2mkkt2=""
                  defaultValue="2"
                >
                  <option value="1" data-astro-cid-he2mkkt2="">
                    H1
                  </option>
                  <option value="2" data-astro-cid-he2mkkt2="">
                    H2
                  </option>
                  <option value="3" data-astro-cid-he2mkkt2="">
                    H3
                  </option>
                  <option value="4" data-astro-cid-he2mkkt2="">
                    H4
                  </option>
                  <option value="5" data-astro-cid-he2mkkt2="">
                    H5
                  </option>
                  <option value="6" data-astro-cid-he2mkkt2="">
                    H6
                  </option>
                </select>
                <span className="writer-divider" data-astro-cid-he2mkkt2=""></span>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="strike"
                  title="删除线"
                  data-astro-cid-he2mkkt2=""
                >
                  S
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="hr"
                  title="分隔线"
                  data-astro-cid-he2mkkt2=""
                >
                  −
                </button>
                <span className="writer-divider" data-astro-cid-he2mkkt2=""></span>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="task"
                  title="任务列表"
                  data-astro-cid-he2mkkt2=""
                >
                  ☑
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="ordered"
                  title="编号列表"
                  data-astro-cid-he2mkkt2=""
                >
                  ⑴
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="unordered"
                  title="无序列表"
                  data-astro-cid-he2mkkt2=""
                >
                  ☷
                </button>
                <span className="writer-divider" data-astro-cid-he2mkkt2=""></span>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="code"
                  title="代码块"
                  data-astro-cid-he2mkkt2=""
                ></button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="inlineCode"
                  title="行内代码"
                  data-astro-cid-he2mkkt2=""
                >
                  &lt;/&gt;
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="link"
                  title="链接"
                  data-astro-cid-he2mkkt2=""
                >
                  ↗
                </button>
                <button
                  id="insert-image-button"
                  className="writer-tool writer-import"
                  type="button"
                  title="上传插图"
                  data-astro-cid-he2mkkt2=""
                >
                  ▧
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="table"
                  title="表格"
                  data-astro-cid-he2mkkt2=""
                >
                  ▦
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="quote"
                  title="引用"
                  data-astro-cid-he2mkkt2=""
                >
                  ❝
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="math"
                  title="公式"
                  data-astro-cid-he2mkkt2=""
                >
                  Σₓ
                </button>
                <button
                  className="writer-tool is-text"
                  type="button"
                  data-md-insert="footnote"
                  title="脚注"
                  data-astro-cid-he2mkkt2=""
                >
                  脚注
                </button>
              </div>
              <div className="writer-tool-group writer-action-tools" data-astro-cid-he2mkkt2="">
                <button
                  id="toggle-preview"
                  className="writer-tool is-text"
                  type="button"
                  title="开启/关闭预览"
                  data-astro-cid-he2mkkt2=""
                >
                  预览
                </button>
                <button
                  id="swap-preview"
                  className="writer-tool is-text"
                  type="button"
                  title="预览换边"
                  data-astro-cid-he2mkkt2=""
                >
                  换边
                </button>
                <button
                  id="immersive-mode"
                  className="writer-tool is-text"
                  type="button"
                  title="沉浸模式，Esc 退出"
                  data-astro-cid-he2mkkt2=""
                >
                  沉浸
                </button>
                <button
                  id="import-text-button"
                  className="writer-tool is-text writer-import"
                  type="button"
                  title="导入 txt/md"
                  data-astro-cid-he2mkkt2=""
                >
                  导入
                </button>
                <button
                  id="import-epub-button"
                  className="writer-tool is-text writer-epub-import"
                  type="button"
                  title="导入 EPUB 为小说卷"
                  data-astro-cid-he2mkkt2=""
                >
                  EPUB
                </button>
                <select
                  id="inline-font-select"
                  className="writer-font-select"
                  title="选中文字后应用或移除局部字体"
                  data-astro-cid-he2mkkt2=""
                >
                  <option value="" data-astro-cid-he2mkkt2="">
                    字体
                  </option>
                </select>
              </div>
            </div>

            <div className="writer-paper-wrap" data-astro-cid-he2mkkt2="">
              <article className="writer-paper" data-astro-cid-he2mkkt2="">
                <input
                  id="title"
                  className="writer-title"
                  placeholder="请输入文章标题"
                  data-astro-cid-he2mkkt2=""
                />
                <textarea
                  id="content"
                  className="writer-content"
                  placeholder="从这里开始写。支持 Markdown、代码块、表格、图片、公式和脚注。"
                  data-astro-cid-he2mkkt2=""
                ></textarea>
              </article>
              <div
                id="preview-resizer"
                className="writer-resizer"
                title="拖动调整预览宽度"
                data-astro-cid-he2mkkt2=""
              ></div>
              <article
                id="preview-panel"
                className="writer-preview"
                data-astro-cid-he2mkkt2=""
              ></article>
            </div>
          </section>

          <aside className="writer-right" data-astro-cid-he2mkkt2="">
            <div className="writer-mobile-panel-head" data-astro-cid-he2mkkt2="">
              <strong data-astro-cid-he2mkkt2="">文章设置</strong>
              <button
                type="button"
                data-mobile-close
                aria-label="关闭文章设置"
                data-astro-cid-he2mkkt2=""
              >
                ×
              </button>
            </div>
            <div className="writer-panel" data-astro-cid-he2mkkt2="">
              <section className="writer-card" data-astro-cid-he2mkkt2="">
                <h2 data-astro-cid-he2mkkt2="">文章属性</h2>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  状态
                  <select id="status" data-astro-cid-he2mkkt2="">
                    <option value="draft" data-astro-cid-he2mkkt2="">
                      草稿
                    </option>
                    <option value="published" data-astro-cid-he2mkkt2="">
                      发布
                    </option>
                  </select>
                </label>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  可见性
                  <select id="visibility" data-astro-cid-he2mkkt2="">
                    <option value="public" data-astro-cid-he2mkkt2="">
                      公开
                    </option>
                    <option value="private" data-astro-cid-he2mkkt2="">
                      私密
                    </option>
                  </select>
                </label>
                <label className="writer-check" data-astro-cid-he2mkkt2="">
                  <input id="is-pinned" type="checkbox" data-astro-cid-he2mkkt2="" /> 置顶
                </label>
                <label className="writer-check" data-astro-cid-he2mkkt2="">
                  <input id="is-recommended" type="checkbox" data-astro-cid-he2mkkt2="" /> 推荐
                </label>
              </section>

              <section className="writer-card" data-astro-cid-he2mkkt2="">
                <h2 data-astro-cid-he2mkkt2="">专题与联动</h2>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  所属专题
                  <select id="series" data-astro-cid-he2mkkt2="">
                    <option value="" data-astro-cid-he2mkkt2="">
                      不加入专题
                    </option>
                  </select>
                </label>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  专题顺序
                  <input
                    id="series-order"
                    type="number"
                    min="0"
                    max="9999"
                    defaultValue="0"
                    data-astro-cid-he2mkkt2=""
                  />
                </label>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  背景音乐
                  <select id="music-track" data-astro-cid-he2mkkt2="">
                    <option value="" data-astro-cid-he2mkkt2="">
                      不绑定音乐
                    </option>
                  </select>
                </label>
              </section>

              <section className="writer-card" data-astro-cid-he2mkkt2="">
                <h2 data-astro-cid-he2mkkt2="">分类与封面</h2>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  分类
                  <select id="category" data-astro-cid-he2mkkt2=""></select>
                </label>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  标签
                  <select id="tags" multiple data-astro-cid-he2mkkt2=""></select>
                </label>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  封面图
                  <span className="writer-inline" data-astro-cid-he2mkkt2="">
                    <input
                      id="cover"
                      placeholder="/uploads/cover.webp"
                      data-astro-cid-he2mkkt2=""
                    />
                    <button
                      id="cover-upload-button"
                      className="writer-upload-btn"
                      type="button"
                      data-astro-cid-he2mkkt2=""
                    >
                      上传
                    </button>
                  </span>
                </label>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  摘要
                  <textarea
                    id="excerpt"
                    placeholder="不填时可由正文概括"
                    data-astro-cid-he2mkkt2=""
                  ></textarea>
                </label>
              </section>

              <section className="writer-card" data-astro-cid-he2mkkt2="">
                <h2 data-astro-cid-he2mkkt2="">文章字体</h2>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  标题字体
                  <select id="title-font-select" data-astro-cid-he2mkkt2=""></select>
                </label>
                <label className="writer-field" data-astro-cid-he2mkkt2="">
                  正文字体
                  <select id="body-font-select" data-astro-cid-he2mkkt2=""></select>
                </label>
                <p className="writer-help" data-astro-cid-he2mkkt2="">
                  字体库在后台「设置」里统一导入；这里仅选择当前文章使用的标题/正文字体。
                </p>
              </section>
            </div>
          </aside>
        </section>

        <footer className="writer-footer" data-astro-cid-he2mkkt2="">
          <span id="word-count" data-astro-cid-he2mkkt2="">
            本章字数：0
          </span>
          <span id="save-status" data-astro-cid-he2mkkt2="">
            未保存
          </span>
        </footer>
        <nav className="writer-mobile-nav" aria-label="移动端写作台导航" data-astro-cid-he2mkkt2="">
          <button type="button" data-mobile-panel="articles" data-astro-cid-he2mkkt2="">
            文章
          </button>
          <button
            className="is-active"
            type="button"
            data-mobile-panel="editor"
            data-astro-cid-he2mkkt2=""
          >
            编辑
          </button>
          <button type="button" data-mobile-panel="settings" data-astro-cid-he2mkkt2="">
            设置
          </button>
        </nav>
      </main>
    </>
  );
}
