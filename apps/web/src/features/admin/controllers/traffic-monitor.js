export function register(context) {
  let version = 0;
  let ready = false;
  let dialogOpen = false;
  let contentHeight = 720;
  let savedScroll = null;
  context.closeTraffic = () => {
    version += 1;
    ready = false;
    dialogOpen = false;
    savedScroll = null;
    const frame = context.$('#traffic-frame');
    frame?.removeAttribute('src');
    frame?.classList.add('hidden');
    for (const id of ['traffic-add-node', 'traffic-help']) context.$(`#${id}`).disabled = true;
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
      if (ready)
        for (const id of ['traffic-add-node', 'traffic-help']) context.$(`#${id}`).disabled = false;
    } catch (error) {
      if (context.scope.disposed || current !== version) return;
      status.textContent = error.message || '流量监控暂时无法连接，请点击重新连接。';
      frame.classList.add('hidden');
      for (const id of ['traffic-add-node', 'traffic-help']) context.$(`#${id}`).disabled = true;
    }
  };
  context.scope.listen(document, 'click', (event) => {
    const action = event.target.closest('#traffic-add-node, #traffic-help');
    if (action) {
      context.$('#traffic-frame')?.contentWindow?.postMessage(
        {
          type: action.id === 'traffic-add-node' ? 'boke-traffic-add-node' : 'boke-traffic-help',
        },
        location.origin,
      );
    }
    if (event.target.closest('#traffic-reload')) {
      const frame = context.$('#traffic-frame');
      if (ready && !frame?.classList.contains('hidden'))
        frame.contentWindow?.postMessage({ type: 'boke-traffic-refresh' }, location.origin);
      else {
        context.closeTraffic();
        context.openTraffic();
      }
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
    if (event.origin !== location.origin || event.source !== frame?.contentWindow) return;
    if (event.data?.type === 'boke-traffic-ready') {
      ready = true;
      for (const id of ['traffic-add-node', 'traffic-help']) context.$(`#${id}`).disabled = false;
    }
    if (
      event.data?.type === 'boke-traffic-size' &&
      context.root?.dataset.activePanel === 'traffic'
    ) {
      const height = Number(event.data.height);
      if (Number.isFinite(height) && height > 0) {
        contentHeight = Math.max(560, Math.min(30000, height + 4));
        if (!dialogOpen) frame.style.height = `${contentHeight}px`;
      }
    }
    if (
      event.data?.type === 'boke-traffic-dialog' &&
      context.root?.dataset.activePanel === 'traffic'
    ) {
      if (event.data.open) {
        if (!dialogOpen)
          savedScroll = { main: context.$('.admin-main')?.scrollTop || 0, page: window.scrollY };
        dialogOpen = true;
        frame.style.height = `${Math.max(320, window.innerHeight - 100)}px`;
        frame.style.scrollMarginTop = '72px';
        frame.scrollIntoView({ block: 'start', behavior: 'instant' });
      } else if (dialogOpen) {
        dialogOpen = false;
        frame.style.height = `${contentHeight}px`;
        if (savedScroll) {
          const main = context.$('.admin-main');
          if (main) main.scrollTop = savedScroll.main;
          window.scrollTo({ top: savedScroll.page, behavior: 'instant' });
          savedScroll = null;
        }
      }
    }
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
