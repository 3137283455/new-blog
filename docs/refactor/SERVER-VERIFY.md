# 在服务器验证主分支的新版

重构已完成：Next 已接管全部前台、漫画、书库、阅读中心、后台和写作台。生产部署只启动 Next 和 API。当前仍使用 SQLite，不能删除数据库或上传目录。

以下适用于 Linux + PM2，以及本仓库默认端口：API 3001、Next 3002。自定义端口需同时修改部署脚本、PM2 配置和 Nginx。要求 Node.js 22+，建议与已验证环境一致使用 Node.js 24。这里提供部署方法，未连接你的服务器执行或验收。

## 更新与构建

先用后台备份功能导出备份并下载到服务器之外，核对包含数据库和上传文件；妥善保存 backend/.env。不要直接复制运行中的 SQLite 单个 db 文件作为唯一备份。需要完全隔离写入时，在独立目录使用备份恢复测试实例，不能让测试后端共用生产数据库。

在项目根目录执行。若工作区有修改或快进拉取失败，先处理差异，不要 reset --hard：

```bash
git status --short
git switch main
git pull --ff-only origin main
node --version

# 一条命令更新、构建并启动 API + Next；保留已有 backend/.env
bash scripts/deploy.sh
```

`--pull` 已包含 `git pull --ff-only origin main`。脚本会安装 backend 和 apps/web 依赖、构建两端、移除旧的 `boke-frontend` PM2 进程、启动 `boke-backend` 与 `boke-web`，并检查 API、Next 和漫画页。构建失败时不会完成 PM2 重载，应安排维护窗口。

## 先验证，不切换公网入口

```bash
pm2 status
curl --fail http://127.0.0.1:3001/api/health
curl --fail http://127.0.0.1:3002/api/health
curl --fail -o /dev/null http://127.0.0.1:3002/manga/search
curl --fail -o /dev/null http://127.0.0.1:3002/admin/write
pm2 logs boke-web --lines 80 --nostream
```

HTTP 成功不等于功能验收。在自己的电脑建立 SSH 隧道（替换用户名与服务器地址）：

```bash
ssh -N -L 3002:127.0.0.1:3002 用户名@服务器地址
```

电脑浏览器打开 http://127.0.0.1:3002/manga/search。无需开放公网 3002 端口。依次验证搜索→详情→目录→阅读/翻页；漫画架/收藏刷新恢复；后台漫画源导入导出；写作台预览/草稿恢复。导入、保存等操作会写当前生产数据，应使用测试内容或独立测试实例。

浏览器收藏、设备身份、草稿按 origin 保存：隧道地址看不到原域名的本地数据不代表数据丢失，不要清空原域名存储。真实图片源的异常要结合 boke-backend 日志判断，模拟源测试不能替代实际源验收。

## 验证后切换与回退

备份现有 Nginx 配置，将站点 `location /` 的前端代理改为 `http://127.0.0.1:3002`；API 仍指向 3001，uploads 保持原配置。若有单独的 `/_next/` 规则，也指向 3002；不要给私人 API 或页面新增公共缓存。执行 `sudo nginx -t` 成功后再 `sudo nginx -s reload`。

本次部署不保留旧前端 PM2 服务，也没有旧前端回退入口。出现新版入口问题时，只能先恢复上一份代码和构建产物，再重新执行部署；这不是数据库回滚，不撤销期间写入的数据。切换前务必保留数据库、上传目录、`.env` 和上一版本构建日志。
