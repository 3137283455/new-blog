# 写作台与网页导入

## 页面

- `/admin/write`：文章列表、搜索、草稿、已发布、回收站与网页导入。
- `/admin/write/editor`：新建文章。
- `/admin/write/editor?id=123`：编辑文章；原来的 `/admin/write?id=123` 自动跳转。
- 编辑器保留原有 Markdown、文本/EPUB 导入、插图上传、字体、专题、音乐、预览、沉浸、自动保存和发布设置。

## 安装

后端仍为 Express；Python 仅作为本机正文提取工作进程，不对外开放端口。
推荐 Python 3.10 或更新版本。Linux 需要安装发行版的 python3-venv 软件包。

在 backend 目录运行：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements-web-import.txt
npm ci
npm run build
```

Windows 使用 `python -m venv .venv` 和 `.venv\Scripts\python.exe -m pip install -r requirements-web-import.txt`。
可通过 `WEB_IMPORT_PYTHON` 指定解释器绝对路径。标准 `scripts/deploy.sh` 已包含安装步骤。
重启后端时自动创建文章来源表；不改动已有文章。

## 工作流程

粘贴文章 URL → 提取并预览 → 修改标题、选择图片、确认重复项 → 新建私密草稿或插入当前文章。
保存为草稿不会发布；插入当前文章后仍需正常保存。
草稿编辑页可调整分类、标签、专题、可见性等原有属性。

提取标题、作者、日期和正文；来源链接写入 Markdown，结构化来源随文章保存。
选中的图片转为 WebP 存入媒体库；未选中的图片不保留外链。
预览不会在浏览器中请求第三方图片，以编号和说明对应图片列表。
重复检测使用原始 URL、最终 URL 和正文指纹；再次导入需明确确认。

## 边界

- 仅支持公开 HTTP/HTTPS HTML 文章，不执行网页脚本、不代登录、不绕过付费墙。
- DNS、重定向和图片下载都检查内网/本机地址，并将已验证地址绑定到实际连接。
- HTML 上限 3 MB；单图 8 MB、单次图片总计 32 MB、最多 30 张；解码像素上限 4000 万。
- 预览 15 分钟有效，归属当前用户；同一预览重复确认不会重复创建草稿。
- 重启会清除未确认的预览，已保存的草稿和媒体不受影响。
- 当前是单网页导入；不包含 RSS、批量抓取和浏览器渲染。

## 检查

```sh
# backend
npm run build
node --test scripts/test-web-import.js
# apps/web，先启动本地 Next 服务于 3112 端口
npm run typecheck
npx playwright test --config playwright.writer.config.ts
```
