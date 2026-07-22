# GitHub 与服务器部署

## 首次上传 GitHub

在本地项目根目录执行：

```bash
git init
git add .
git commit -m "Initial blog project"
git branch -M main
git remote add origin https://github.com/YOUR_NAME/YOUR_REPOSITORY.git
git push -u origin main
```

`backend/.env`、数据库、上传媒体、备份、日志、依赖和构建产物均不会提交到 GitHub。

## 服务器首次部署

服务器需要安装 Git、Node.js 20 或更高版本和 npm。然后执行：

```bash
git clone https://github.com/YOUR_NAME/YOUR_REPOSITORY.git /opt/boke
cd /opt/boke
bash scripts/deploy.sh
```

部署脚本会：

1. 生成 `backend/.env`、随机 JWT 密钥和初始管理员密码。
2. 安装前后端依赖。
3. 构建 Express 和 Astro。
4. 安装并启动 PM2。
5. 通过前端 `/api/health` 检查内部代理。

只需在云服务器安全组和系统防火墙开放 TCP `3000`。后端 `3001` 只监听服务器内部，不需要对公网开放。

首次运行时终端会输出随机管理员密码，请立即保存。也可以指定密码：

```bash
ADMIN_PASSWORD='your-strong-password' bash scripts/deploy.sh
```

## 更新部署

```bash
cd /opt/boke
bash scripts/deploy.sh --pull
```

## 开机自启

首次部署后运行：

```bash
pm2 startup
```

按照 PM2 输出，再执行它给出的 `sudo` 命令，随后执行：

```bash
pm2 save
```

## 迁移现有数据

源码仓库不保存私人数据。需要另行传输：

- 数据库：使用后台“备份与恢复”导出 `.db`，部署后在后台恢复。
- 媒体文件：把本机 `backend/uploads/` 上传到服务器 `/opt/boke/backend/uploads/`。

示例：

```bash
scp -r backend/uploads/* user@SERVER_PUBLIC_IP:/opt/boke/backend/uploads/
```

## 常用命令

```bash
pm2 status
pm2 logs
pm2 restart boke-backend
pm2 restart boke-frontend
curl http://127.0.0.1:3000/api/health
```
