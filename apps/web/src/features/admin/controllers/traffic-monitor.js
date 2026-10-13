export function register(context) {
  let version = 0;
  context.closeTraffic = () => {
    version += 1;
    const frame = context.$('#traffic-frame');
    frame?.removeAttribute('src');
    frame?.classList.add('hidden');
  };
  context.openTraffic = async () => {
    const current = ++version;
    const frame = context.$('#traffic-frame');
    const status = context.$('#traffic-status');
    if (!frame || !status) return;
    status.hidden = false;
    status.textContent = '正在连接流量监控…';
    try {
      await context.request('/traffic/session', { method: 'POST', body: '{}' });
      if (context.scope.disposed || current !== version) return;
      if (!frame.getAttribute('src')) frame.src = `${context.API_BASE}/traffic/view`;
      frame.classList.remove('hidden');
      status.hidden = true;
    } catch (error) {
      if (context.scope.disposed || current !== version) return;
      status.textContent = error.message || '流量监控暂时无法连接，请点击重新连接。';
      frame.classList.add('hidden');
    }
  };
  context.scope.listen(document, 'click', (event) => {
    if (event.target.closest('#traffic-reload')) {
      context.closeTraffic();
      context.openTraffic();
    }
    if (event.target.closest('#logout-admin')) {
      context.scope
        .fetch(`${context.API_BASE}/traffic/session`, {
          method: 'DELETE',
          credentials: 'same-origin',
        })
        .catch(() => {});
    }
  });
  context.scope.listen(window, 'message', (event) => {
    const frame = context.$('#traffic-frame');
    if (
      event.origin === location.origin &&
      event.source === frame?.contentWindow &&
      event.data?.type === 'boke-traffic-reauth' &&
      context.root?.dataset.activePanel === 'traffic'
    ) {
      context.closeTraffic();
      context.openTraffic();
    }
  });
  function renewSession() {
    context.scope.timeout(
      () => {
        if (context.root?.dataset.activePanel === 'traffic') context.openTraffic();
        if (!context.scope.disposed) renewSession();
      },
      5 * 60 * 1000,
    );
  }
  renewSession();
}
