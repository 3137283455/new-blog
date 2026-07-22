# 个人博客系统 (Boke)

一个功能完整的个人博客系统，前后端分离架构，支持 Markdown 写作、评论、搜索、主题切换、媒体管理等功能。

## ✨ 功能特性

### 核心功能
- 📝 **Markdown 写作**：代码高亮、表格、图片、公式、脚注排版
- 🗂️ **文章管理**：草稿/发布、置顶、推荐、私密、批量删除、回收站
- 🔍 **全文搜索**：标题+正文+标签+分类模糊搜索，关键词高亮
- 💬 **评论系统**：发表、回复、审核、垃圾过滤
- ❤️ **互动功能**：点赞、分享、回到顶部
- 📄 **自定义页面**：留言板、关于我、项目展示等独立页面
- 🖼️ **媒体管理**：图片上传、冗余清理、本地存储

### 管理后台
- 📊 **仪表盘**：统计概览、最近/热门文章
- 🎨 **主题管理**：一键切换主题
- 🔌 **插件管理**：启用/禁用插件
- ⚙️ **系统设置**：站点信息、评论审核等配置

### 用户体验
- 🌓 **明暗双模式**：自动跟随系统 + 手动切换
- 📱 **响应式设计**：PC、平板、手机三端适配
- ⚡ **性能优化**：懒加载、静态资源压缩、分页加载
- 🚨 **错误页面**：自定义 404/500 美化页

## 🛠️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | Astro + TypeScript + Tailwind CSS + DaisyUI |
| 后端 | Node.js + Express + TypeScript |
| 数据库 | SQLite (better-sqlite3) |
| Markdown | markdown-it + highlight.js |
| 认证 | JWT |

## 📦 项目结构

```
boke/
├── frontend-astro/    # Astro 前台与独立写作/后台界面
│   └── src/
│       ├── pages/         # 前台页面、后台、写作台
│       ├── components/    # 公共组件
│       ├── layouts/       # 页面布局
│       └── styles/        # 主题样式
├── backend/           # Express 后端 API
│   └── src/
│       ├── controllers/   # 控制器
│       ├── routes/        # 路由
│       ├── middleware/    # 中间件（认证、上传、错误处理）
│       ├── database/      # 数据库 schema 与种子
│       └── utils/         # 工具（日志、Markdown、响应）
├── ecosystem.config.cjs   # PM2 配置
└── nginx.conf.example     # Nginx 配置示例
```

## 🚀 快速开始

### 环境要求
- Node.js >= 18
- npm >= 9

### 1. 安装依赖

```bash
# 后端
cd backend
npm install

# 前端
cd ../frontend-astro
npm install
```

### 2. 配置环境变量

```bash
cd backend
cp .env.example .env
# 按需修改 .env 中的配置（尤其 JWT_SECRET）
```

常用上传相关配置：

```bash
# 普通媒体默认 10MB
MAX_FILE_SIZE=10485760

# 字体文件默认 100MB，Nginx 示例已预留 120M 请求体上限
MAX_FONT_FILE_SIZE=104857600
```

### 3. 启动开发服务

```bash
# 终端 1：启动后端（端口 3001）
cd backend
npm run dev

# 终端 2：启动前端（端口 3000，自动代理 API 到 3001）
cd frontend-astro
npm run dev
```

访问 http://localhost:3000 查看博客，http://localhost:3000/admin 访问后台。

> 本地开发时必须同时启动后端和前端。前端开发服务器会把 `/api` 和 `/uploads` 代理到 `http://localhost:3001`；如果只启动前端，导航、追番、相册、写作台等动态数据会显示“API 读取失败”或无法保存。

### 4. 默认账号

```
用户名: admin
密码:   admin123
```

> ⚠️ 首次登录后请立即在系统设置中修改密码或重新创建管理员账号。

## 📡 API 概览

### 公开接口
- `GET /api/articles` — 文章列表（分页、分类、标签筛选）
- `GET /api/articles/:slug` — 文章详情
- `GET /api/articles/search?q=` — 全文搜索
- `GET /api/categories` / `GET /api/tags` — 分类/标签
- `GET /api/pages/:slug` — 自定义页面
- `GET /api/navigation` — 导航资源
- `GET /api/bangumi` — 追番列表
- `GET /api/albums` / `GET /api/albums/:id` — 相册与照片
- `GET /api/settings/public` — 公开站点设置与音乐数据
- `POST /api/articles/:id/comments` — 发表评论
- `POST /api/articles/:id/like` — 点赞

### 管理接口（需 JWT）
- 文章 CRUD、批量删除、回收站恢复
- 分类/标签/评论/页面/媒体管理
- 仪表盘统计、主题/插件管理、系统设置

详细接口见 [架构设计文档](C:\Users\fu\.claude\plans\joyful-toasting-hoare.md)。

## 🏗️ 生产部署

### 1. 构建前端

```bash
cd frontend-astro
npm run build
# 当前 Astro 前端产物在 frontend-astro/dist/
```

### 2. 编译后端

```bash
cd backend
npm run build
# 产物在 backend/dist/
```

### 3. 使用 PM2 守护进程

```bash
npm install -g pm2
mkdir -p logs
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup  # 开机自启
```

### 4. 配置 Nginx

```bash
sudo cp nginx.conf.example /etc/nginx/sites-available/boke
# 修改 server_name 和路径
sudo ln -s /etc/nginx/sites-available/boke /etc/nginx/sites-enabled/
sudo nginx -t && sudo nginx -s reload
```

### 5. 宕机告警

PM2 自带进程崩溃自动重启。配合健康检查端点 `/api/health` 可接入外部监控：

```bash
# 定时探测，失败则告警（加入 crontab）
*/1 * * * * curl -sf http://localhost:3001/api/health || echo "博客宕机" | mail -s "告警" you@example.com
```

或使用 Uptime Robot 等监控服务，配置 Webhook 通知。

## 📂 数据存储

- **数据库**：`backend/data/blog.db`（SQLite 单文件，零配置）
- **上传文件**：`backend/uploads/`（按年月组织）
- **日志**：`logs/backend-error.log`、`logs/backend-out.log`、`logs/frontend-error.log`、`logs/frontend-out.log`

备份只需复制 `data/` 和 `uploads/` 目录即可。

## 🎨 主题与字体

- 主题通过 CSS 变量和 `data-theme` 实现，当前前台样式集中在 `frontend-astro/src/styles/global.scss`
- 字体库由后台独立管理，写作台可为文章标题/正文选择全局文章字体，也可对局部文字插入字体标记

## 📝 开发说明

- 后端开发：`npm run dev`（tsx watch 热重载）
- 前端开发：在 `frontend-astro` 下运行 `npm run dev`（Astro/Vite HMR）
- 数据库迁移：`npm run db:migrate`
- 重置种子数据：删除 `backend/data/blog.db` 后重启

## 📄 License

MIT
