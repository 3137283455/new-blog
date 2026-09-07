export function WriterView() {
  return (
    <>
      <main className="writer-shell" data-writer-scope="">
        <header className="writer-topbar" data-writer-scope="">
          <div className="writer-brand" data-writer-scope="">
            <a className="writer-logo" href="/admin" title="返回后台" data-writer-scope="">
              写
            </a>
            <div className="writer-crumbs" data-writer-scope="">
              <strong data-writer-scope="">写作台</strong>
              <span data-writer-scope="">/</span>
              <span id="writer-mode" data-writer-scope="">
                新文章
              </span>
              <span data-writer-scope="">/</span>
              <select id="quick-status" aria-label="状态" data-writer-scope="">
                <option value="draft" data-writer-scope="">
                  草稿
                </option>
                <option value="published" data-writer-scope="">
                  发布
                </option>
              </select>
            </div>
          </div>
          <div className="writer-actions" data-writer-scope="">
            <button
              id="toggle-left"
              className="writer-btn icon"
              type="button"
              title="收起左侧"
              data-writer-scope=""
            >
              ⇤
            </button>
            <button
              id="toggle-right"
              className="writer-btn icon"
              type="button"
              title="收起右侧"
              data-writer-scope=""
            >
              ⇥
            </button>
            <a className="writer-btn writer-back-link" href="/admin" data-writer-scope="">
              返回后台
            </a>
            <button id="save-draft" className="writer-btn" type="button" data-writer-scope="">
              保存草稿
            </button>
            <button
              id="publish-article"
              className="writer-btn primary"
              type="button"
              data-writer-scope=""
            >
              发布
            </button>
          </div>
        </header>

        <section className="writer-main" data-writer-scope="">
          <aside className="writer-left" data-writer-scope="">
            <div className="writer-mobile-panel-head" data-writer-scope="">
              <strong data-writer-scope="">文章管理</strong>
              <button
                type="button"
                data-mobile-close
                aria-label="关闭文章管理"
                data-writer-scope=""
              >
                ×
              </button>
            </div>
            <div className="writer-left-head" data-writer-scope="">
              <input
                id="article-search"
                className="writer-search"
                type="search"
                placeholder="搜索标题、摘要、slug"
                data-writer-scope=""
              />
              <button
                id="new-draft"
                className="writer-left-action"
                type="button"
                data-writer-scope=""
              >
                + 新建文章
              </button>
              <div className="writer-tabs" id="article-tabs" data-writer-scope="">
                <button
                  className="writer-tab active"
                  type="button"
                  data-filter="all"
                  data-writer-scope=""
                >
                  全部 0
                </button>
                <button
                  className="writer-tab"
                  type="button"
                  data-filter="draft"
                  data-writer-scope=""
                >
                  草稿箱 0
                </button>
                <button
                  className="writer-tab"
                  type="button"
                  data-filter="published"
                  data-writer-scope=""
                >
                  已发布 0
                </button>
                <button
                  className="writer-tab"
                  type="button"
                  data-filter="trash"
                  data-writer-scope=""
                >
                  回收站 0
                </button>
              </div>
            </div>
            <div id="article-list" className="writer-list" data-writer-scope=""></div>
          </aside>

          <section className="writer-stage" data-writer-scope="">
            <div className="writer-toolbar" data-writer-scope="">
              <input
                id="text-file-input"
                className="hidden"
                type="file"
                accept=".txt,.md,.markdown,text/plain,text/markdown"
                data-writer-scope=""
              />
              <input
                id="epub-file-input"
                className="hidden"
                type="file"
                accept=".epub,application/epub+zip"
                data-writer-scope=""
              />
              <input
                id="article-image-input"
                className="hidden"
                type="file"
                accept="image/*"
                data-writer-scope=""
              />
              <input
                id="cover-file-input"
                className="hidden"
                type="file"
                accept="image/*"
                data-writer-scope=""
              />
              <div className="writer-tool-group writer-format-tools" data-writer-scope="">
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="bold"
                  title="加粗"
                  data-writer-scope=""
                >
                  B
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="italic"
                  title="斜体"
                  data-writer-scope=""
                >
                  <em data-writer-scope="">I</em>
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="heading"
                  title="标题"
                  data-writer-scope=""
                >
                  H
                </button>
                <select
                  id="heading-level"
                  className="writer-heading-select"
                  title="标题等级"
                  data-writer-scope=""
                  defaultValue="2"
                >
                  <option value="1" data-writer-scope="">
                    H1
                  </option>
                  <option value="2" data-writer-scope="">
                    H2
                  </option>
                  <option value="3" data-writer-scope="">
                    H3
                  </option>
                  <option value="4" data-writer-scope="">
                    H4
                  </option>
                  <option value="5" data-writer-scope="">
                    H5
                  </option>
                  <option value="6" data-writer-scope="">
                    H6
                  </option>
                </select>
                <span className="writer-divider" data-writer-scope=""></span>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="strike"
                  title="删除线"
                  data-writer-scope=""
                >
                  S
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="hr"
                  title="分隔线"
                  data-writer-scope=""
                >
                  −
                </button>
                <span className="writer-divider" data-writer-scope=""></span>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="task"
                  title="任务列表"
                  data-writer-scope=""
                >
                  ☑
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="ordered"
                  title="编号列表"
                  data-writer-scope=""
                >
                  ⑴
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="unordered"
                  title="无序列表"
                  data-writer-scope=""
                >
                  ☷
                </button>
                <span className="writer-divider" data-writer-scope=""></span>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="code"
                  title="代码块"
                  data-writer-scope=""
                ></button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="inlineCode"
                  title="行内代码"
                  data-writer-scope=""
                >
                  &lt;/&gt;
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="link"
                  title="链接"
                  data-writer-scope=""
                >
                  ↗
                </button>
                <button
                  id="insert-image-button"
                  className="writer-tool writer-import"
                  type="button"
                  title="上传插图"
                  data-writer-scope=""
                >
                  ▧
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="table"
                  title="表格"
                  data-writer-scope=""
                >
                  ▦
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="quote"
                  title="引用"
                  data-writer-scope=""
                >
                  ❝
                </button>
                <button
                  className="writer-tool"
                  type="button"
                  data-md-insert="math"
                  title="公式"
                  data-writer-scope=""
                >
                  Σₓ
                </button>
                <button
                  className="writer-tool is-text"
                  type="button"
                  data-md-insert="footnote"
                  title="脚注"
                  data-writer-scope=""
                >
                  脚注
                </button>
              </div>
              <div className="writer-tool-group writer-action-tools" data-writer-scope="">
                <button
                  id="toggle-preview"
                  className="writer-tool is-text"
                  type="button"
                  title="开启/关闭预览"
                  data-writer-scope=""
                >
                  预览
                </button>
                <button
                  id="swap-preview"
                  className="writer-tool is-text"
                  type="button"
                  title="预览换边"
                  data-writer-scope=""
                >
                  换边
                </button>
                <button
                  id="immersive-mode"
                  className="writer-tool is-text"
                  type="button"
                  title="沉浸模式，Esc 退出"
                  data-writer-scope=""
                >
                  沉浸
                </button>
                <button
                  id="import-text-button"
                  className="writer-tool is-text writer-import"
                  type="button"
                  title="导入 txt/md"
                  data-writer-scope=""
                >
                  导入
                </button>
                <button
                  id="import-epub-button"
                  className="writer-tool is-text writer-epub-import"
                  type="button"
                  title="导入 EPUB 为小说卷"
                  data-writer-scope=""
                >
                  EPUB
                </button>
                <select
                  id="inline-font-select"
                  className="writer-font-select"
                  title="选中文字后应用或移除局部字体"
                  data-writer-scope=""
                >
                  <option value="" data-writer-scope="">
                    字体
                  </option>
                </select>
              </div>
            </div>

            <div className="writer-paper-wrap" data-writer-scope="">
              <article className="writer-paper" data-writer-scope="">
                <input
                  id="title"
                  className="writer-title"
                  placeholder="请输入文章标题"
                  data-writer-scope=""
                />
                <textarea
                  id="content"
                  className="writer-content"
                  placeholder="从这里开始写。支持 Markdown、代码块、表格、图片、公式和脚注。"
                  data-writer-scope=""
                ></textarea>
              </article>
              <div
                id="preview-resizer"
                className="writer-resizer"
                title="拖动调整预览宽度"
                data-writer-scope=""
              ></div>
              <article
                id="preview-panel"
                className="writer-preview"
                data-writer-scope=""
              ></article>
            </div>
          </section>

          <aside className="writer-right" data-writer-scope="">
            <div className="writer-mobile-panel-head" data-writer-scope="">
              <strong data-writer-scope="">文章设置</strong>
              <button
                type="button"
                data-mobile-close
                aria-label="关闭文章设置"
                data-writer-scope=""
              >
                ×
              </button>
            </div>
            <div className="writer-panel" data-writer-scope="">
              <section className="writer-card" data-writer-scope="">
                <h2 data-writer-scope="">文章属性</h2>
                <label className="writer-field" data-writer-scope="">
                  状态
                  <select id="status" data-writer-scope="">
                    <option value="draft" data-writer-scope="">
                      草稿
                    </option>
                    <option value="published" data-writer-scope="">
                      发布
                    </option>
                  </select>
                </label>
                <label className="writer-field" data-writer-scope="">
                  可见性
                  <select id="visibility" data-writer-scope="">
                    <option value="public" data-writer-scope="">
                      公开
                    </option>
                    <option value="private" data-writer-scope="">
                      私密
                    </option>
                  </select>
                </label>
                <label className="writer-check" data-writer-scope="">
                  <input id="is-pinned" type="checkbox" data-writer-scope="" /> 置顶
                </label>
                <label className="writer-check" data-writer-scope="">
                  <input id="is-recommended" type="checkbox" data-writer-scope="" /> 推荐
                </label>
              </section>

              <section className="writer-card" data-writer-scope="">
                <h2 data-writer-scope="">专题与联动</h2>
                <label className="writer-field" data-writer-scope="">
                  所属专题
                  <select id="series" data-writer-scope="">
                    <option value="" data-writer-scope="">
                      不加入专题
                    </option>
                  </select>
                </label>
                <label className="writer-field" data-writer-scope="">
                  专题顺序
                  <input
                    id="series-order"
                    type="number"
                    min="0"
                    max="9999"
                    defaultValue="0"
                    data-writer-scope=""
                  />
                </label>
                <label className="writer-field" data-writer-scope="">
                  背景音乐
                  <select id="music-track" data-writer-scope="">
                    <option value="" data-writer-scope="">
                      不绑定音乐
                    </option>
                  </select>
                </label>
              </section>

              <section className="writer-card" data-writer-scope="">
                <h2 data-writer-scope="">分类与封面</h2>
                <label className="writer-field" data-writer-scope="">
                  分类
                  <select id="category" data-writer-scope=""></select>
                </label>
                <label className="writer-field" data-writer-scope="">
                  标签
                  <select id="tags" multiple data-writer-scope=""></select>
                </label>
                <label className="writer-field" data-writer-scope="">
                  封面图
                  <span className="writer-inline" data-writer-scope="">
                    <input
                      id="cover"
                      placeholder="/uploads/cover.webp"
                      data-writer-scope=""
                    />
                    <button
                      id="cover-upload-button"
                      className="writer-upload-btn"
                      type="button"
                      data-writer-scope=""
                    >
                      上传
                    </button>
                  </span>
                </label>
                <label className="writer-field" data-writer-scope="">
                  摘要
                  <textarea
                    id="excerpt"
                    placeholder="不填时可由正文概括"
                    data-writer-scope=""
                  ></textarea>
                </label>
              </section>

              <section className="writer-card" data-writer-scope="">
                <h2 data-writer-scope="">文章字体</h2>
                <label className="writer-field" data-writer-scope="">
                  标题字体
                  <select id="title-font-select" data-writer-scope=""></select>
                </label>
                <label className="writer-field" data-writer-scope="">
                  正文字体
                  <select id="body-font-select" data-writer-scope=""></select>
                </label>
                <p className="writer-help" data-writer-scope="">
                  字体库在后台「设置」里统一导入；这里仅选择当前文章使用的标题/正文字体。
                </p>
              </section>
            </div>
          </aside>
        </section>

        <footer className="writer-footer" data-writer-scope="">
          <span id="word-count" data-writer-scope="">
            本章字数：0
          </span>
          <span id="save-status" data-writer-scope="">
            未保存
          </span>
        </footer>
        <nav className="writer-mobile-nav" aria-label="移动端写作台导航" data-writer-scope="">
          <button type="button" data-mobile-panel="articles" data-writer-scope="">
            文章
          </button>
          <button
            className="is-active"
            type="button"
            data-mobile-panel="editor"
            data-writer-scope=""
          >
            编辑
          </button>
          <button type="button" data-mobile-panel="settings" data-writer-scope="">
            设置
          </button>
        </nav>
      </main>
    </>
  );
}
