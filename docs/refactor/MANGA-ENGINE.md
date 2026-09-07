# 漫画引擎第二阶段：图片链路与精确章节

日期：2026-09-06。此阶段保持前台 UI，不迁移数据库、不删除收藏或漫画架、不变更后台入口。

## 已落地

- 原 `venera-sources.ts` 保留兼容入口；图片处理和章节归一化拆到不依赖 Express/SQLite 的 `modules/manga`。
- 阅读图片 URL 显式携带 `purpose=page`、`comic_id`、`chapter_id`，接口长度与源模型对齐（source 180、漫画/章节 ID 300、图片 URL 3000）。缺失阅读上下文返回 400，不再以空 ID 执行规则。
- 页面图片调用 `onImageLoad(url, comicId, epId)`，封面调用 `onThumbnailLoad(url)`。未指定用途的旧封面链接仍可用，但不再误执行章节重排；缩略图按官方契约忽略 `modifyImage`、`onLoadFailed`。
- 统一处理请求配置、跨 VM 的二进制 `onResponse`、实际格式识别/解码和 `modifyImage`。空响应回调保留原字节，不返回已消费的 Response；回调失败不再悄悄显示未经解密/重排的图片。
- 实现规则所需的 `Image.empty`、`copyRange`、`fillImageAt`、`fillImageRangeAt`、`copyAndRotate90`；按 straight RGBA 复制。重排后输出 PNG，不擅自缩放/切页。无重排时保留原始文件字节，包括动画 GIF。
- 网络、HTTP、响应回调、解码/重排失败走同一条有限重试路径（初次 + 最多两次 fallback）。取消请求不触发重试。HTTP 重定向逐跳检查地址、限制次数，跨站移除 Authorization/Cookie。
- 图像计算放入可终止 Worker，避免同步重排阻塞 API 主事件循环。开发 TS 和生产 JS 两条加载路径均验证。
- 图片响应使用实际解码格式的 MIME、`private, no-store`、`nosniff`，不复用上游压缩头或公共缓存。
- 章节为空/失败只显示本章错误，绝不检索附近章节替换用户选择。
- 源初始化采用单次并发加载，完成 init 才进入缓存；失败可重试。配置失效期间的旧加载不回填缓存。调用参数词法隔离，并清理计时器/临时变量，不共享可被并发覆盖的参数全局变量。

## UI 与数据不变的边界

漫画阅读页保留原有 URL、结构、CSS 和客户端分页契约；现在由 Next 原生路由提供，页面变化通过浏览器回归测试覆盖。

失败时文案会明确告知本章失败，这是错误行为修正，并未重新设计错误页面。漫画详情、阅读器、漫画架和后台均由 Next 提供，并通过同源 API 代理衔接。

测试数据使用独立内存库或临时库，正式数据不做清理或迁移。本地 API 重启后使用新构建；源会话此前就是进程内状态，仍未持久化。

## 可复现验收

```powershell
npm run test:manga-engine --prefix backend
npm run test:search-sources --prefix backend
npm run build --prefix apps/web
npm run typecheck --prefix apps/web
npm run test:web
```

浏览器生产模式运行方式见 [主文档](README.md#ui-验收)。

本轮结果：

| 检查 | 结果 |
| --- | --- |
| 漫画引擎与真实控制器接线测试 | 17/17 |
| 旧 JSON 源导入/冲突处理/默认源/搜索/目录/阅读回归 | 通过，独立临时库 |
| 新前台类型检查、单元测试 | 通过，4/4 |
| Next.js 构建 | 通过，0 错误/警告 |
| UI 基线 | 64 文件匹配（仅一行受审核的数据适配） |
| 生产版浏览器回归 | 29/29，含新增 6 项阅读检查 |
| 原 18 组配对截图 | 最大差异 169/329160，约 0.0514%，低于 0.1% |
| TS 开发路径 Worker | 2×2 PNG 解码通过 |

像素测试使用自生成彩色 RGBA 数据，不依赖远端漫画。验证条带余数行、横图、6000px 长图、透明通道、动画 GIF、旋转复制、无效规则、死循环终止、取消、限流字节、跨上下文缓冲区、失败重试、并发参数与不替换章节。控制器接线测试使用内存库、模拟官方脚本 URL、真实 Express HTTP 和真实 Sharp Worker；所有远程请求均被测试拦截，不能当作官方源兼容率统计。

## 真实源只读冒烟结果

通过本地 `http://127.0.0.1:3100` 的 API 代理测试 `venera:manga_dex`：搜索 `one piece` 返回 20 条，首条结果为 `ONE PIECE学園`（并不是宣称搜到《ONE PIECE》本篇）。该条目录 21 章，指定首章返回 46 张图，返回章节 ID 与请求完全一致；首图 HTTP 200、JPEG、764×1200、144395 字节，Sharp 可解码。

- 漫画 ID：`b70113a5-32a3-44e8-a28f-0e88392808ba`
- 章节 ID：`468d2e19-fc64-453d-8105-cea9346c4b5e`

期间官方脚本 CDN/Raw 的 Node 直连出现超时，复测已恢复。未更改 TLS 验证、网络代理或源配置。只测试指定章节首图，没有检查该章全部 46 图，也没有验证用户最早遇到条带切割的那一部漫画。

## 限制与下一步

- **Worker/Node vm 不是安全沙箱。** 主源运行时仍在 API 进程内；图片 Worker 不继承应用环境凭据，但仍有当前操作系统用户权限。`codeGeneration` 开关、执行超时和资源限额不能替代进程/容器权限隔离。只加载受信任的官方源代码；不能据此对公网开放任意脚本执行。
- 仍需独立执行服务、最小权限文件系统/网络出口、DNS/IP 校验（含 IPv6 和重绑定）、源会话隔离与持久化。当前 URL 检查不是完整 SSRF 防护。
- 主运行时 async 超时是停止等待，尚不能终止已开始的异步源任务；图片 Worker 可以真正终止。
- 当前上限：输入/输出 20MiB、24Mi 像素、规则脚本 256KiB、Image 累计申请 192MiB；2 个并发 Worker、32 个等待任务；每次图片 HTTP 25 秒、同步重排 3 秒、整个 Worker 10 秒。超限应报错，不通过裁切或降清晰度“修复”。这些是保护限制，不代表所有超长源图均兼容。
- 只支持 Sharp 解码的 JPEG/PNG/GIF/WebP/AVIF 光栅图片。无变换保留原始动画；有 `modifyImage` 时解码首帧并输出 PNG，对齐本轮参考实现，而非全动画重排。
- 需要用户原问题源与章节继续逐图验收。后续先拆仓库/脚本版本/设置/会话存储，再迁移详情、阅读器、漫画架；每一步保留 UI 对照，不一次性删除旧实现。

## 实现依据

核对了官方 [漫画源接口](https://github.com/venera-app/venera/blob/master/doc/comic_source.md)、[JS API](https://github.com/venera-app/venera/blob/master/doc/js_api.md)、[Image 实现](https://github.com/venera-app/venera/blob/master/lib/utils/image.dart) 和 [官方源仓库](https://github.com/venera-app/venera-configs)。官方源确有按章节 ID 决定条带重排的规则，这支持修复缺失上下文/重排链路的必要性，但不能单独证明用户原问题漫画已修复。
