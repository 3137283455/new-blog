export function TrafficPanel() {
  return (
    <section id="traffic-panel" className="admin-panel hidden">
      <div className="traffic-panel-heading">
        <div>
          <h2 className="text-2xl font-black">流量监控</h2>
          <p className="text-sm text-base-content/50">管理 VPS、查看流量用量与账期。</p>
        </div>
        <div className="traffic-panel-actions">
          <button id="traffic-help" className="ryu-btn btn-sm" type="button" disabled>
            接入说明
          </button>
          <button id="traffic-reload" className="ryu-btn btn-sm" type="button">
            刷新
          </button>
          <button id="traffic-add-node" className="ryu-btn-primary btn-sm" type="button" disabled>
            添加节点
          </button>
        </div>
      </div>
      <p id="traffic-status" className="px-5 py-3 text-sm" role="status">
        正在连接流量监控…
      </p>
      <iframe
        id="traffic-frame"
        className="hidden"
        title="VPS 流量监控"
        referrerPolicy="same-origin"
      />
    </section>
  );
}
