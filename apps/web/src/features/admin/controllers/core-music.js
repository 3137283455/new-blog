export function register(context) {
  context.renderMusicPlaylists = function renderMusicPlaylists() {
    const list = context.$('#music-playlist-list');
    if (!list) return;
    list.innerHTML =
      (context.state.musicPlaylists || [])
        .map(
          (playlist) => `
    <article class="admin-playlist-card">
      <button class="admin-playlist-open" type="button" data-open-music-playlist="${context.escapeHtml(playlist.name)}">
        <span class="admin-playlist-cover">
          ${playlist.cover ? `<img src="${context.escapeHtml(playlist.cover)}" alt="" loading="lazy" decoding="async" />` : '<span>♪</span>'}
          <b>${Number(playlist.track_count || 0)} 首</b>
        </span>
        <span class="admin-playlist-info">
          <strong>${context.escapeHtml(playlist.name)}</strong>
          <small>${playlist.is_active ? '前台启用' : '已停用'} · 排序 ${Number(playlist.sort_order || 0)}</small>
          <span>${context.escapeHtml(playlist.description || '点击管理这个歌单中的歌曲')}</span>
        </span>
      </button>
      <div class="admin-card-actions">
        <button class="btn btn-xs rounded-lg" type="button" data-edit-music-playlist="${playlist.id}">编辑</button>
        <button class="btn btn-xs btn-error rounded-lg" type="button" data-delete-music-playlist="${playlist.id}">删除</button>
      </div>
    </article>
  `,
        )
        .join('') || '<div class="admin-collection-empty">还没有歌单，点击“新建歌单”创建。</div>';
  };
  context.musicPlaylistName = function musicPlaylistName(song) {
    return song.playlist || song.collection || '默认歌单';
  };
  context.renderMusic = function renderMusic() {
    const list = context.$('#music-list');
    const filter = context.$('#music-playlist-filter');
    const summary = context.$('#music-summary');
    if (!list) return;
    const selected = context.state.activeMusicPlaylistName || filter?.value || '';
    if (filter) filter.value = selected;
    const visibleSongs = context.state.music
      .map((song, index) => ({ ...song, index }))
      .filter((song) => !selected || context.musicPlaylistName(song) === selected);
    if (summary) {
      summary.textContent = `${visibleSongs.length} 首歌`;
    }
    const batchToolbar = visibleSongs.length
      ? `
    <div class="admin-track-batch">
      <p>勾选歌曲后可批量移除</p>
      <button class="btn btn-sm btn-error rounded-xl" type="button" data-batch-remove-music>批量移除</button>
    </div>
  `
      : '';
    list.innerHTML =
      batchToolbar +
        visibleSongs
          .map(
            (song) => `
    <article class="admin-track-row">
      <input class="checkbox checkbox-sm checkbox-primary shrink-0" type="checkbox" value="${song.index}" data-music-select aria-label="选择 ${context.escapeHtml(song.title)}" />
      <span class="admin-track-cover">
        ${song.cover ? `<img src="${context.escapeHtml(song.cover)}" alt="" loading="lazy" decoding="async" />` : '<span>♪</span>'}
      </span>
      <span class="admin-track-info">
        <strong>${context.escapeHtml(song.title)}</strong>
        <small>${context.escapeHtml(song.artist || '未知歌手')} · ${song.lyrics ? '有歌词' : '无歌词'}</small>
        <audio src="${context.escapeHtml(song.url)}" controls preload="none"></audio>
      </span>
      <div class="admin-card-actions">
        <button class="btn btn-xs rounded-lg" data-edit-song="${song.index}">编辑</button>
        <button class="btn btn-xs rounded-lg" data-move-song="${song.index}" data-direction="up">上移</button>
        <button class="btn btn-xs rounded-lg" data-move-song="${song.index}" data-direction="down">下移</button>
        <button class="btn btn-xs btn-error rounded-lg" data-remove-song="${song.index}">移除</button>
      </div>
    </article>
  `,
          )
          .join('') ||
      '<div class="admin-collection-empty">这个歌单还没有歌曲，点击“新增歌曲”添加。</div>';
  };
  context.syncMusicPlaylistOptions = function syncMusicPlaylistOptions(selectedName = '') {
    const field = context.$('#music-form')?.elements.namedItem('playlist');
    if (!field) return;
    const playlists = context.state.musicPlaylists || [];
    field.innerHTML = playlists
      .map(
        (playlist) =>
          `<option value="${context.escapeHtml(playlist.name)}">${context.escapeHtml(playlist.name)}</option>`,
      )
      .join('');
    const fallback = context.state.activeMusicPlaylistName || playlists[0]?.name || '';
    field.value = playlists.some((playlist) => playlist.name === selectedName)
      ? selectedName
      : fallback;
  };
  context.openMusicTracks = function openMusicTracks(name) {
    const playlist = context.state.musicPlaylists.find((item) => item.name === name);
    if (!playlist) return;
    context.state.activeMusicPlaylistName = playlist.name;
    context.$('#music-tracks-dialog-title').textContent = playlist.name;
    context.renderMusic();
    context.$('#music-tracks-dialog')?.showModal();
  };
  context.openMusicTrackDialog = function openMusicTrackDialog(index = -1) {
    const form = context.$('#music-form');
    const dialog = context.$('#music-track-dialog');
    if (!form || !dialog) return;
    form.reset();
    delete form.dataset.editingIndex;
    const song = index >= 0 ? context.state.music[index] : null;
    context.syncMusicPlaylistOptions(
      song ? context.musicPlaylistName(song) : context.state.activeMusicPlaylistName,
    );
    if (song) {
      form.dataset.editingIndex = String(index);
      form.elements.namedItem('title').value = song.title || '';
      form.elements.namedItem('artist').value = song.artist || '';
      form.elements.namedItem('playlist').value = context.musicPlaylistName(song);
      form.elements.namedItem('url').value = song.url || '';
      form.elements.namedItem('cover').value = song.cover || '';
      form.elements.namedItem('lyrics').value = song.lyrics || '';
      form.elements.namedItem('article_id').value = song.article_id || '';
      form.elements.namedItem('photo_id').value = song.photo_id || '';
    }
    context.$('#music-track-dialog-title').textContent = song ? '编辑歌曲' : '新增歌曲';
    window.updateAdminFieldPreview?.('music-form', 'url');
    window.updateAdminFieldPreview?.('music-form', 'cover');
    dialog.showModal();
    context.scope.timeout(() => form.elements.namedItem('title')?.focus(), 0);
  };
  context.openMusicPlaylistDialog = function openMusicPlaylistDialog(playlist = null) {
    const form = context.$('#music-playlist-form');
    const dialog = context.$('#music-playlist-dialog');
    if (!form || !dialog) return;
    context.resetMusicPlaylistForm(false);
    if (playlist) {
      form.elements.namedItem('id').value = playlist.id;
      form.elements.namedItem('name').value = playlist.name || '';
      form.elements.namedItem('description').value = playlist.description || '';
      form.elements.namedItem('cover').value = playlist.cover || '';
      form.elements.namedItem('sort_order').value = playlist.sort_order || 0;
      form.elements.namedItem('is_active').checked = playlist.is_active !== 0;
    }
    context.$('#music-playlist-dialog-title').textContent = playlist ? '编辑歌单' : '新建歌单';
    window.updateAdminFieldPreview?.('music-playlist-form', 'cover');
    dialog.showModal();
    context.scope.timeout(() => form.elements.namedItem('name')?.focus(), 0);
  };
  context.batchRemoveMusic = async function batchRemoveMusic() {
    const indexes = Array.from(context.scope.queryAll('[data-music-select]:checked'))
      .map((input) => Number(input.value))
      .filter(Number.isInteger)
      .sort((a, b) => b - a);
    if (!indexes.length) {
      context.notify('请先勾选要移除的歌曲', true);
      return;
    }
    if (!window.confirm(`确认从配置中移除 ${indexes.length} 首歌曲吗？保存配置后生效。`)) return;
    indexes.forEach((index) => context.state.music.splice(index, 1));
    context.renderMusic();
    await context.saveMusic();
  };
  context.addMusic = async function addMusic(event) {
    event.preventDefault();
    const fields = event.currentTarget.elements;
    const song = {
      title: fields.namedItem('title').value.trim(),
      artist: fields.namedItem('artist').value.trim(),
      playlist: fields.namedItem('playlist')?.value.trim() || '默认歌单',
      url: fields.namedItem('url').value.trim(),
      cover: fields.namedItem('cover').value.trim(),
      lyrics: fields.namedItem('lyrics').value.trim(),
      article_id: Number(fields.namedItem('article_id').value) || null,
      photo_id: Number(fields.namedItem('photo_id').value) || null,
    };
    if (!song.title || !song.url) return;
    const editingIndex = Number(event.currentTarget.dataset.editingIndex ?? -1);
    const isEditing = Number.isInteger(editingIndex) && editingIndex >= 0;
    if (isEditing) {
      context.state.music[editingIndex] = { ...context.state.music[editingIndex], ...song };
    } else {
      context.state.music.push(song);
      event.currentTarget.dataset.editingIndex = String(context.state.music.length - 1);
    }
    context.renderMusic();
    const saved = await context.saveMusic();
    if (!saved) return;
    delete event.currentTarget.dataset.editingIndex;
    event.currentTarget.reset();
    window.updateAdminFieldPreview?.('music-form', 'url');
    window.updateAdminFieldPreview?.('music-form', 'cover');
    context.$('#music-track-dialog')?.close();
  };
  context.saveMusic = async function saveMusic() {
    context.$('#music-message').textContent = '正在保存音乐...';
    try {
      await context.request('/admin/music', {
        method: 'PUT',
        body: JSON.stringify({ tracks: context.state.music }),
      });
      const playlistJson = await context.request('/admin/music/playlists');
      context.state.musicPlaylists = playlistJson.data || [];
      context.renderMusicPlaylists();
      context.renderMusic();
      context.$('#music-message').textContent = '音乐已保存';
      context.notify('音乐已保存');
      return true;
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#music-message').textContent = error.message || '音乐保存失败';
      context.notify(error.message || '音乐保存失败', true);
      return false;
    }
  };
  context.saveMusicPlaylist = async function saveMusicPlaylist(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = form.elements;
    const id = fields.namedItem('id').value;
    const previousName = id
      ? context.state.musicPlaylists.find((playlist) => String(playlist.id) === String(id))?.name ||
        ''
      : '';
    const payload = {
      name: fields.namedItem('name').value.trim(),
      description: fields.namedItem('description').value.trim(),
      cover: fields.namedItem('cover').value.trim(),
      sort_order: Number(fields.namedItem('sort_order').value || 0),
      is_active: fields.namedItem('is_active').checked,
    };
    if (!payload.name) {
      context.$('#music-playlist-message').textContent = '请填写歌单名称';
      return;
    }
    try {
      await context.request(id ? `/admin/music/playlists/${id}` : '/admin/music/playlists', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify(payload),
      });
      context.$('#music-playlist-message').textContent = id ? '歌单已更新' : '歌单已创建';
      context.notify(id ? '歌单已更新' : '歌单已创建');
      context.resetMusicPlaylistForm(false);
      const [musicJson, playlistJson] = await Promise.all([
        context.request('/admin/music'),
        context.request('/admin/music/playlists'),
      ]);
      context.state.music = musicJson.data || [];
      context.state.musicPlaylists = playlistJson.data || [];
      if (previousName && context.state.activeMusicPlaylistName === previousName) {
        context.state.activeMusicPlaylistName = payload.name;
        context.$('#music-tracks-dialog-title').textContent = payload.name;
      }
      context.renderMusicPlaylists();
      context.renderMusic();
      context.$('#music-playlist-dialog')?.close();
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#music-playlist-message').textContent = error.message || '歌单保存失败';
      context.notify(error.message || '歌单保存失败', true);
    }
  };
  context.resetMusicPlaylistForm = function resetMusicPlaylistForm(openDialog = true) {
    const form = context.$('#music-playlist-form');
    if (!form) return;
    form.reset();
    form.elements.namedItem('id').value = '';
    form.elements.namedItem('is_active').checked = true;
    context.$('#music-playlist-dialog-title').textContent = '新建歌单';
    context.$('#music-playlist-message').textContent = '';
    window.updateAdminFieldPreview?.('music-playlist-form', 'cover');
    if (openDialog) {
      context.$('#music-playlist-dialog')?.showModal();
      context.scope.timeout(() => form.elements.namedItem('name')?.focus(), 0);
    }
  };
  context.editMusicPlaylist = function editMusicPlaylist(id) {
    const playlist = context.state.musicPlaylists.find((item) => String(item.id) === String(id));
    if (playlist) context.openMusicPlaylistDialog(playlist);
  };
  context.deleteMusicPlaylist = async function deleteMusicPlaylist(id) {
    if (!confirm('确认删除这个歌单吗？歌曲会保留。')) return;
    try {
      await context.request(`/admin/music/playlists/${id}`, { method: 'DELETE' });
      const [musicJson, playlistJson] = await Promise.all([
        context.request('/admin/music'),
        context.request('/admin/music/playlists'),
      ]);
      context.state.music = musicJson.data || [];
      context.state.musicPlaylists = playlistJson.data || [];
      if (
        context.state.activeMusicPlaylistName &&
        !context.state.musicPlaylists.some(
          (playlist) => playlist.name === context.state.activeMusicPlaylistName,
        )
      ) {
        context.state.activeMusicPlaylistName = '';
        context.$('#music-tracks-dialog')?.close();
      }
      context.renderMusic();
      context.renderMusicPlaylists();
      context.$('#music-playlist-message').textContent = '歌单已删除，歌曲已保留';
      context.notify('歌单已删除，歌曲已保留');
    } catch (error) {
      if (context.scope.disposed) return;
      context.$('#music-playlist-message').textContent = error.message || '歌单删除失败';
      context.notify(error.message || '歌单删除失败', true);
    }
  };
}
