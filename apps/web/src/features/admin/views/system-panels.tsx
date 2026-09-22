export function StoragePanel() {
  return (
    <section id="storage-panel" className="admin-panel hidden">
      <header className="admin-settings-heading">
        <div>
          <p>SYSTEM</p>
          <h2>存储空间</h2>
          <span>查看整站占用、真实磁盘余量与容量提醒。</span>
        </div>
      </header>{' '}
      <form
        id="storage-settings-form"
        className="admin-settings-section"
        data-settings-search="存储 空间 配额 容量 告警 阈值"
      >
        <header>
          <div>
            <h3>存储空间</h3>
            <p>配额包含上传资源、数据库、备份日志和程序运行文件。</p>
          </div>
        </header>
        <label className="admin-setting-row">
          <span>
            <b>存储配额</b>
            <small>达到配额后停止接受新的文件上传。</small>
          </span>
          <div className="admin-setting-unit">
            <input
              id="storage-quota-gb"
              className="input input-bordered"
              type="number"
              min="1"
              max="1024"
              step="0.1"
            />
            <span>GB</span>
          </div>
        </label>
        <label className="admin-setting-row">
          <span>
            <b>普通告警</b>
            <small>达到此比例时在概览中提醒。</small>
          </span>
          <div className="admin-setting-unit">
            <input
              id="storage-warn-percent"
              className="input input-bordered"
              type="number"
              min="1"
              max="98"
            />
            <span>%</span>
          </div>
        </label>
        <label className="admin-setting-row">
          <span>
            <b>严重告警</b>
            <small>必须高于普通告警阈值。</small>
          </span>
          <div className="admin-setting-unit">
            <input
              id="storage-critical-percent"
              className="input input-bordered"
              type="number"
              min="2"
              max="100"
            />
            <span>%</span>
          </div>
        </label>
        <footer className="admin-settings-actions">
          <p id="storage-settings-message" className="min-h-6 text-sm"></p>
          <button className="ryu-btn-primary" type="submit">
            保存存储设置
          </button>
        </footer>
      </form>
    </section>
  );
}
export function LogsPanel() {
  return (
    <section id="logs-panel" className="admin-panel hidden">
      <header className="admin-settings-heading">
        <div>
          <p>SYSTEM</p>
          <h2>日志与诊断</h2>
          <span>筛选运行记录，查看系统状态。</span>
        </div>
      </header>
      <section
        className="admin-settings-section"
        data-settings-search="日志 清理 保留周期 自动清理 容量"
      >
        <header>
          <h3>保留与清理</h3>
          <span id="logs-storage-usage"></span>
        </header>
        <p className="admin-log-policy">
          每小时自动清理过期记录。单文件约 10 MB 轮转，最多保留 10
          份归档及当前文件；容量上限可能早于保留天数触发。
        </p>
        <form id="logs-policy-form" className="admin-setting-row">
          <label htmlFor="logs-retention-days">保留天数</label>
          <input
            id="logs-retention-days"
            type="number"
            min="1"
            max="365"
            defaultValue="30"
            required
            className="input input-bordered"
          />
          <button type="submit" className="ryu-btn-primary">
            保存周期
          </button>
        </form>
        <div className="admin-settings-actions">
          <button type="button" data-log-clear="expired" className="ryu-btn">
            清理过期日志
          </button>
          <button type="button" data-log-clear="all" className="ryu-btn text-error">
            清空历史日志
          </button>
          <span id="logs-policy-message" role="status"></span>
        </div>
      </section>
      <section
        id="logs-settings"
        className="admin-settings-section"
        data-settings-search="日志 错误 告警 诊断 最近报错 内存 请求 日志管理"
      >
        <header>
          <div>
            <h3>日志与诊断</h3>
            <p>查看最近错误、请求异常和系统告警；日志会自动轮转并脱敏。</p>
          </div>
          <button id="logs-refresh" className="ryu-btn btn-sm" type="button">
            刷新
          </button>
        </header>
        <div className="admin-log-summary">
          <div>
            <small>最近24小时错误</small>
            <strong id="logs-errors-count">—</strong>
          </div>
          <div>
            <small>最近24小时告警</small>
            <strong id="logs-warnings-count">—</strong>
          </div>
          <div>
            <small>最近日志</small>
            <strong id="logs-latest-at">—</strong>
          </div>
        </div>
        <form id="memory-settings-form" className="admin-log-memory-settings">
          <div>
            <b>内存告警</b>
            <small>按进程 RSS 判断；连续 3 次超过阈值才记录告警，避免短暂波动误报。</small>
          </div>
          <label>
            <span>普通告警</span>
            <div className="admin-setting-unit">
              <input
                id="memory-warn-mb"
                className="input input-bordered"
                type="number"
                min="128"
                max="32768"
                step="1"
              />
              <span>MB</span>
            </div>
          </label>
          <label>
            <span>严重参考线</span>
            <div className="admin-setting-unit">
              <input
                id="memory-critical-mb"
                className="input input-bordered"
                type="number"
                min="128"
                max="32768"
                step="1"
              />
              <span>MB</span>
            </div>
          </label>
          <button className="ryu-btn" type="submit">
            保存阈值
          </button>
          <p id="memory-settings-message" className="text-sm"></p>
        </form>
        <div className="admin-log-toolbar">
          <select id="logs-level-filter" className="select select-bordered" aria-label="日志级别">
            <option value="">全部级别</option>
            <option value="error">错误</option>
            <option value="warn">告警</option>
            <option value="info">信息</option>
          </select>
          <select id="logs-source-filter" className="select select-bordered" aria-label="日志来源">
            <option value="">全部来源</option>
          </select>
          <input
            id="logs-query-filter"
            className="input input-bordered"
            type="search"
            placeholder="搜索日志内容"
          />
        </div>
        <div id="admin-log-list" className="admin-log-list" aria-live="polite"></div>
        <p id="logs-message" className="mt-3 min-h-5 text-sm"></p>
      </section>
    </section>
  );
}
