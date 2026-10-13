# 后台流量监控入口

后台左侧「媒体库」下方新增「流量监控」，点击后直接在后台右侧显示完整监控面板，复用博客管理员登录。

## 部署

执行原来的 `bash scripts/deploy.sh --pull`。监控代码已经随博客打包，后端会自动启动并管理本机 Python 监控进程，不需要另行克隆仓库、配置访问地址或部署 Docker。需要 Python 3.11+，脚本会检查版本和时区数据库。

通过博客域名或原来的 `:3002/admin` 都能使用。所有页面和接口通过同源 `/api/traffic/` 接入，现有 `/api/` 转发继续生效，无需新增 Nginx location。原型中的独立 `/traffic/` 跳转已撤销。

监控使用独立数据库 `backend/data/traffic-monitor/traffic.sqlite3`（路径跟随 `DB_PATH` 所在目录），保留节点、流量、账期和提醒，重启不清空。端口默认 `127.0.0.1:8098`，不向公网暴露。后台通过短期 HttpOnly 会话访问，采集上报仍要求每个节点自己的令牌。

节点管理、套餐、图表、CSV、期初补录、提醒和采集器安装包均保留。首次打开没有虚构节点或流量；添加 VPS 后下载其安装包，在对应 VPS 安装采集器。真实采集器要求博客有 HTTPS，裸 HTTP 地址可查看和管理面板，但不能作为生产上报地址。

离开监控页会停止内嵌页面的刷新；服务端和 VPS 采集继续运行。博客离线缓存不缓存监控页面、接口或登录状态。

## 可选环境变量

- `TRAFFIC_PYTHON`：Python 可执行文件，默认 `python3`，部署脚本使用现有 Python 虚拟环境。
- `TRAFFIC_PORT`：本机端口，默认 `8098`。
- `TRAFFIC_PUBLIC_URL`：需要固定采集上报域名时填写 `https://你的博客域名`；默认使用管理员进入面板时的站点源。

## 来源

集成自用户自己的 [vps-traffic-monitor](https://github.com/3137283455/vps-traffic-monitor)，版本 `1c2f4de594458f7d5a0a23ed1146e40f996aa956`。源码位于 `services/traffic-monitor/`，适配了后台登录、同源接口和采集配置下载；未导入仓库中的 private 凭据或真实节点令牌。

## 验证

后端构建后运行 `node backend/scripts/test-traffic-monitor.js`，测试使用临时数据库验证完整接入流程，不修改实际博客或监控数据。Windows 可通过 `TRAFFIC_PYTHON` 指定 Python 路径。
