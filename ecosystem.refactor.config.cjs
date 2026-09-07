// Optional Next frontend. Keep ecosystem.config.cjs running for API and unmigrated routes.
const path = require('node:path');

module.exports = {
  apps: [{
    name: 'boke-web',
    cwd: path.join(__dirname, 'apps/web'),
    script: 'node_modules/next/dist/bin/next',
    args: 'start --hostname 127.0.0.1 --port 3100',
    instances: 1,
    autorestart: true,
    watch: false,
    env: {
      NODE_ENV: 'production',
      API_BASE_INTERNAL: 'http://127.0.0.1:3001',
      LEGACY_WEB_ORIGIN: 'http://127.0.0.1:3002',
    },
    error_file: path.join(__dirname, 'logs/web-error.log'),
    out_file: path.join(__dirname, 'logs/web-out.log'),
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    merge_logs: true,
  }],
};
