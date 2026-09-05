# UI 不变的架构重构

## 约束与当前阶段

用户授权更换底层架构，但不授权重新设计 UI。验收对象是旧站**实际渲染效果**，不是另一套模板，也不是代码里从未生效的设计。

目标架构：Next.js/React 网站、按业务拆分的服务模块、独立受限的源执行服务、PostgreSQL 和本地文件存储。采用分阶段替换，不能一次性删除旧项目。

第一批已实现：

- `apps/web`：可独立启动、构建的 Next.js 应用。
- `/manga`、`/manga/search`、`/manga/latest` 已迁移为 React 组件。
- 原页面结构、文案、类名、布局尺寸、源弹窗、主题设置、搜索参数和链接保留。
- 请求逻辑独立于 UI：过期请求取消、旧结果隔离、卸载清理。
- 其他页面通过同源反向代理继续交给旧站，不是空白占位或跨域跳转。
- `ui-inventory.json` 冻结 64 个旧 UI 源文件的内容哈希，阻止无意修改旧站。
- 单元测试和新旧页面截图/交互回归测试。

**未完成，不得宣称完成：** PostgreSQL 数据迁移、独立源执行服务、Venera 完整兼容、图片解码/重排、漫画详情/阅读器/漫画架及其他业务的 React 迁移。现有 SQLite、源配置、收藏、阅读进度、设备身份和上传文件没有做迁移或清理。

## 目录职责

| 位置 | 职责 |
| --- | --- |
| `apps/web/src/app` | 路由、服务端数据读取、页面元信息 |
| `apps/web/src/features/manga` | 漫画 DTO、API 边界、状态逻辑、展示组件 |
| `apps/web/src/shared/http` | 通用 JSON 请求与请求隔离 |
| `apps/web/src/shared/site` | 原站点设置、主题及页面副作用 |
| `apps/web/tests` | 不依赖真实漫画源/数据库的可重复回归 |
| `scripts/refactor` | 基线核查、样式机械提取、并行开发启动 |

当前 `contracts.ts` 是旧接口的边界 DTO，不把它当作新数据库模型。新源引擎通过适配层接入，避免页面直接依赖脚本运行时。

## 本地启动

需要 Node.js 22+（本轮使用 Node.js 24）。首次安装和准备，在仓库根目录执行：

```powershell
npm ci --prefix backend
npm ci --prefix frontend-astro
npm ci --prefix apps/web
npm run build --prefix backend
npm run dev:refactor
```

- 新版预览：`http://127.0.0.1:3100/manga`
- 原版对照：`http://127.0.0.1:4321/manga`
- 原 API：`http://127.0.0.1:3001/api`

启动脚本只管理本次创建的子进程；已经运行且健康的项目服务会复用，不会批量终止其他 Node 进程。如果复用现有服务，请自行确认它运行的是最新构建。

自定义代理目标可复制 `apps/web/.env.example` 为 `.env.local`。单独启动新版用 `npm run dev:web`。生产构建用 `npm run build:web`；代理地址在构建时设置，部署到另一环境时需要重新构建。

旧 `start:all` 和默认构建路径保持不变，本阶段没有修改正式端口或部署配置。新预览使用不同端口，因此 localStorage 与旧端口天然隔离：**预览中没显示旧收藏不代表数据丢失**。正式切换必须保留原 origin，或先完成明确的浏览器状态迁移，不得静默清空存储。

## UI 验收

```powershell
npm run refactor:inventory
npm run typecheck --prefix apps/web
npm run test:web
cd apps/web
npx playwright install chromium
npm run test:ui
```

测试自动启动独立的只读样例 API（4301）、旧站（4311）和新版（3111），不用真实站点数据，也不写真实收藏/源配置。Windows 下浏览器和测试进程需要正常的进程创建权限。

视觉用例：1440×1000 与 390×844，两种尺寸各覆盖首页、初始搜索、搜索结果、最新发现、空结果、错误状态、源弹窗、夜间主题、朋克主题，共 18 组。每组保存 `legacy.png`、`next.png`、`diff.png` 和差异统计到 `apps/web/test-results`；不把本地截图与 trace 提交到 Git。

要求页面尺寸相同；像素比较阈值 0.1，差异像素占比不超过 0.1%。不遮蔽任何业务区域；只统一动画/光标和测试数据。截图通过不替代真实源、阅读器、登录和数据迁移测试。

生产模式再验收：

```powershell
cd apps/web
$env:NEXT_BUILD_DIR='.next-parity'
$env:API_BASE_INTERNAL='http://127.0.0.1:4301'
$env:LEGACY_WEB_ORIGIN='http://127.0.0.1:4311'
npm run build
$env:UI_PRODUCTION='1'
npm run test:ui
```

测试输出目录独立，避免覆盖正常开发构建。正式构建前使用新的终端或清除这些测试环境变量。

## 已发现、刻意不混入重构的 UI 缺陷

旧漫画页面用 `innerHTML` 插入搜索卡片、源列表和后续空状态；插入元素没有 Astro scope 属性，导致对应 scoped CSS 实际不生效。直接把这些 CSS 变成全局样式，会改变用户现有界面。

因此机械提取工具只迁移当前生效的规则，并保留初始占位与动态状态的差异；React 不再使用 `innerHTML`。这不是新设计，也不是永久建议：要恢复旧代码中未生效的卡片/列表设计，需用户单独批准 UI 修复，并更新视觉基线。不可通过修改测试样例掩盖变化。

旧站全局样式和 Tailwind 主题暂时直接复用，页面 CSS 按路由隔离，防止同名类相互覆盖。后续样式拆分也必须通过同样的视觉验收。

## 后续迁移顺序与退出条件

1. 漫画源：持久化仓库/脚本版本/设置/会话；导入导出覆盖 JSON 和 Venera；更新不重置启停状态；分层测试能力；后台入口仍归属漫画。
2. 图片与章节：保留漫画/章节上下文；完整实现所需响应转换与图片重排；失败不得替换成其他章节；用真实问题漫画逐图验证。
3. 详情/阅读器/漫画架：以当前 DOM、样式和交互为基线迁移；保留所有模式和设备状态；补齐网络进度同步与收藏备份恢复。
4. PostgreSQL：先设计版本化模型与只读迁移审计，再做独立数据库演练；核对记录数、主外键、时间、JSON 配置、文件路径与阅读进度；未通过不得切换。
5. 其他业务：逐模块迁移；完成全站桌面/移动/主题/权限/异常回归后才能删除旧实现和兼容代理。

切换前保留同源 URL 与存储键，备份数据库和媒体清单；切换后新写入数据的回退处理必须单独设计。不能仅回退代码却丢掉新增收藏和阅读记录。

## Git

在 `codex/ui-preserving-refactor` 分支分阶段提交。之前本地未提交的两处漫画修复已保存，并合并远端历史。推送使用 HTTPS + Git Credential Manager 已保存的令牌，不把凭据写入 URL、脚本或文档，不强制覆盖远端历史。
