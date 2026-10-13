export function TrafficPanel() {
  return (
    <section id="traffic-panel" className="admin-panel hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <h2 className="text-xl font-black">流量监控</h2>
        <button id="traffic-reload" className="ryu-btn btn-sm" type="button">
          重新连接
        </button>
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
