# 写作台与网页导入

## 页面

- `/admin/write`：文章列表、搜索、草稿、已发布、回收站与网页导入。
- `/admin/write/editor`：新建文章。
- `/admin/write/editor?id=123`：编辑文章；原来的 `/admin/write?id=123` 自动跳转。
- 编辑器保留原有 Markdown、文本/EPUB 导入、插图上传、字体、专题、音乐、预览、沉浸、自动保存和发布设置。

## 安装

后端仍为 Express。Trafilatura 是网页导入的主正文引擎，部署必须安装；Readability 随 npm 依赖安装，仅作为临时异常时的运行时兜底。
每次后端构建都会执行无网络的提取自检，依赖不完整时构建直接失败。
安装 Trafilatura 后优先使用它；临时异常时回退 Readability，仍复用原有下载安全检查、HTML 清洗、图片入库和草稿流程。
Python 仅作为本机正文提取工作进程，不对外开放端口。部署脚本会强制完成 Python 与 Trafilatura 安装，失败会停止部署。
推荐 Python 3.10 或更新版本。Linux 需要安装发行版的 python3-venv 软件包。

在 backend 目录运行：

```sh
python3 -m venv .venv
.venv/bin/python -m pip install --retries 8 --timeout 120 -r requirements-web-import.txt
npm ci
npx playwright install --with-deps chromium
npm run build
```

Windows 使用 `python -m venv .venv` 和 `.venv\Scripts\python.exe -m pip install -r requirements-web-import.txt`。
可通过 `WEB_IMPORT_PYTHON` 指定解释器绝对路径。标准 `scripts/deploy.sh` 已包含安装步骤。
动态文章另需 Chromium，标准部署脚本会安装浏览器及 Linux 系统依赖。请使用同一个系统用户执行安装和启动，避免浏览器缓存目录不一致。
Next 的 API 转发超时已调整为 120 秒；如另有 Nginx/CDN 反向代理，也需为网页导入接口保留足够的响应等待时间。
本地 Windows 已安装 Chrome 时，可设置 `WEB_IMPORT_BROWSER_CHANNEL=chrome`；也可通过 `WEB_IMPORT_CHROMIUM` 指定浏览器可执行文件。不要使用个人浏览器资料目录或上传 Cookie。
仅提交 GitHub 或只替换前端不会更新服务器依赖与后端进程。
重启后端时自动创建文章来源表；不改动已有文章。

## 工作流程

粘贴文章 URL → 提取并预览 → 修改标题、选择图片、确认重复项 → 新建私密草稿或插入当前文章。
保存为草稿不会发布；插入当前文章后仍需正常保存。
普通下载未得到正文时自动启用浏览器加载，随后继续用 Trafilatura 提取。B 站 opus 文章会排除导航、作者头像、文集封面和推荐内容，并规范化短链的最终地址用于查重。
小黑盒若返回 `show_captcha`，显示人工验证提示并切换到「粘贴图文」，不会将页面壳或验证码当作文章导入。
在能正常阅读的浏览器中选中文章正文并复制，在「粘贴图文」粘贴，填写原文章链接后整理预览。电脑浏览器的 HTML 剪贴板会保留图文；只有纯文本的剪贴板只能导入文字。也支持上传不超过 6 MB 的 HTML 文件。
粘贴的 HTML 只作为数据处理，不执行脚本、不加载第三方资源。新入口沿用图片选择、私密草稿、来源及重复检查。
草稿编辑页可调整分类、标签、专题、可见性等原有属性。

提取标题、作者、日期和正文；来源链接写入 Markdown，结构化来源随文章保存。
选中的图片转为 WebP 存入媒体库；未选中的图片不保留外链。
预览不会在浏览器中请求第三方图片，以编号和说明对应图片列表。
重复检测使用原始 URL、最终 URL 和正文指纹；再次导入需明确确认。

## 边界

- 链接提取访问公开 HTTP/HTTPS HTML 文章；动态提取在临时 Chromium 中运行网页脚本，不代登录、不自动处理验证码、不绕过付费墙。
- DNS、重定向和图片下载都检查内网/本机地址，并将已验证地址绑定到实际连接。
- 浏览器的页面、脚本、XHR、iframe、重定向同样经过上述安全下载器；禁用 Service Worker、WebSocket、自动文件下载及媒体/字体/图片加载。仅接受 GET/HEAD 请求，不使用管理员的登录凭据。
- 浏览器提取同时最多 1 个任务，页面生命周期最多 45 秒（不含浏览器启动和后续正文整理），最多 160 个资源请求、累计 40 MB；超时和结束都会取消剩余下载。建议以非 root 用户运行后端，并为生产浏览器配置独立容器/网络出口限制。
- HTML 上限 3 MB；单图 8 MB、单次图片总计 32 MB、最多 30 张；解码像素上限 4000 万。
- 预览 15 分钟有效，归属当前用户；同一预览重复确认不会重复创建草稿。
- 重启会清除未确认的预览，已保存的草稿和媒体不受影响。
- 当前是单网页导入，不包含 RSS 或批量抓取。网站风控可能因设备、网络和时间不同而变化；浏览器渲染不保证通过验证码。

## 检查

```sh
# backend
npm run build
node --test scripts/test-web-import.js
node --test scripts/test-dynamic-web-import.js
# apps/web，先启动本地 Next 服务于 3112 端口
npm run typecheck
npx playwright test --config playwright.writer.config.ts
```
