import { createEffectScope } from '../browser/effect-scope';
export function mountController() {
  const scope = createEffectScope();
  const musicStateKey = 'boke_music_state';
  function readMusicState() {
    try {
      return JSON.parse(sessionStorage.getItem(musicStateKey) || 'null');
    } catch {
      return null;
    }
  }
  function writeMusicState(state) {
    sessionStorage.setItem(musicStateKey, JSON.stringify({ ...state, updatedAt: Date.now() }));
  }
  function formatMusicTime(value) {
    if (!Number.isFinite(value) || value < 0) return '00:00';
    const minutes = Math.floor(value / 60);
    const seconds = Math.floor(value % 60);
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  function initMusicPlayers() {
    document.querySelectorAll('[data-music-player]').forEach((node) => {
      const root = node;
      if (root.dataset.ready === 'true') return;
      root.dataset.ready = 'true';
      const tracks = JSON.parse(root.getAttribute('data-tracks') || '[]');
      const audio = root.querySelector('[data-music-audio]');
      const title = root.querySelector('[data-music-title]');
      const artist = root.querySelector('[data-music-artist]');
      const cover = root.querySelector('[data-music-cover]');
      const seek = root.querySelector('[data-music-seek]');
      const currentTime = root.querySelector('[data-music-current]');
      const durationTime = root.querySelector('[data-music-duration]');
      const toggles = Array.from(root.querySelectorAll('[data-music-toggle]'));
      const toggleIcons = Array.from(root.querySelectorAll('[data-music-toggle-icon]'));
      const detail = root.querySelector('[data-music-detail]');
      const panel = root.querySelector('[data-music-panel]');
      const panelToggle = root.querySelector('[data-music-panel-toggle]');
      let current = 0;
      let isSeeking = false;
      let loggedTrackId = null;
      let panelTimer = 0;
      const stored = readMusicState();
      let wantsPlayback = Boolean(stored?.playing);
      if (stored && tracks[stored.index]?.url === stored.url) {
        current = Math.max(0, Math.min(stored.index, tracks.length - 1));
      }
      const setResumePending = (pending) => {
        root.classList.toggle('is-resume-pending', pending);
        if (panelToggle) {
          panelToggle.setAttribute('aria-label', pending ? '继续播放音乐' : '展开音乐播放器');
          panelToggle.title = pending ? '点击从上次进度继续播放' : '展开音乐播放器';
        }
      };
      const setPlaying = (playing) => {
        root.classList.toggle('is-playing', playing);
        if (playing) setResumePending(false);
        toggleIcons.forEach((icon) => {
          icon.textContent = playing ? 'Ⅱ' : '▶';
        });
        toggles.forEach((button) => {
          button.setAttribute('aria-label', playing ? '暂停音乐' : '播放音乐');
        });
      };
      const setPanelOpen = (open) => {
        if (panelTimer) window.clearTimeout(panelTimer);
        root.dataset.panelOpen = String(open);
        if (panel) panel.hidden = !open;
        panelToggle?.setAttribute('aria-expanded', String(open));
        if (open) panelTimer = scope.timeout(() => setPanelOpen(false), 6000);
      };
      scope.listen(root.querySelector('[data-music-panel-close]'), 'click', () =>
        setPanelOpen(false),
      );
      scope.listen(root, 'pointerdown', () => {
        if (root.dataset.panelOpen === 'true') setPanelOpen(true);
      });
      scope.listen(root, 'input', () => {
        if (root.dataset.panelOpen === 'true') setPanelOpen(true);
      });
      scope.listen(root, 'keydown', (event) => {
        if (event.key === 'Escape') setPanelOpen(false);
      });
      const save = () => {
        if (!audio || !tracks[current]) return;
        writeMusicState({
          index: current,
          time: audio.currentTime || 0,
          playing: wantsPlayback,
          url: tracks[current].url,
          updatedAt: Date.now(),
        });
      };
      scope.defer(save);
      const updateProgress = () => {
        if (!audio || !seek) return;
        const duration = audio.duration || 0;
        if (!isSeeking) {
          seek.value = duration ? String(Math.round((audio.currentTime / duration) * 1000)) : '0';
        }
        if (currentTime) currentTime.textContent = formatMusicTime(audio.currentTime || 0);
        if (durationTime) durationTime.textContent = formatMusicTime(duration);
      };
      const render = (restoreTime = false) => {
        const track = tracks[current];
        if (!track || !audio) return;
        audio.src = track.url;
        if (title) title.textContent = track.title || '暂无音乐';
        if (artist) artist.textContent = track.artist || '未知歌手';
        if (cover) cover.src = track.cover || '/image2.webp';
        if (detail) detail.href = `/music/${current}`;
        if (seek) seek.value = '0';
        setPlaying(false);
        if ('mediaSession' in navigator) {
          navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title || '暂无音乐',
            artist: track.artist || '未知歌手',
            artwork: track.cover ? [{ src: track.cover }] : [],
          });
        }
        const state = readMusicState();
        if (restoreTime && state && state.url === track.url) {
          const restore = () => {
            audio.currentTime = Math.max(0, state.time || 0);
            updateProgress();
            if (state.playing) {
              wantsPlayback = true;
              audio
                .play()
                .then(() => setPlaying(true))
                .catch(() => {
                  setPlaying(false);
                  setResumePending(true);
                });
            }
            audio.removeEventListener('loadedmetadata', restore);
          };
          scope.listen(audio, 'loadedmetadata', restore);
        }
      };
      const play = async () => {
        if (!tracks.length || !audio) return;
        wantsPlayback = true;
        try {
          await audio.play();
          setPlaying(true);
          save();
        } catch {
          setPlaying(false);
          if (wantsPlayback) setResumePending(true);
        }
      };
      scope.listen(panelToggle, 'click', () => {
        if (wantsPlayback && audio?.paused) {
          play();
          return;
        }
        setPanelOpen(root.dataset.panelOpen !== 'true');
      });
      const move = (step) => {
        if (!tracks.length) return;
        current = (current + step + tracks.length) % tracks.length;
        render(false);
        play();
      };
      toggles.forEach((toggle) =>
        scope.listen(toggle, 'click', () => {
          if (!tracks.length || !audio) return;
          if (audio.paused) play();
          else {
            wantsPlayback = false;
            setResumePending(false);
            audio.pause();
            setPlaying(false);
            save();
          }
        }),
      );
      scope.listen(root.querySelector('[data-music-prev]'), 'click', () => move(-1));
      scope.listen(root.querySelector('[data-music-next]'), 'click', () => move(1));
      scope.listen(detail, 'click', save);
      scope.listen(seek, 'input', () => {
        if (!audio || !audio.duration) return;
        isSeeking = true;
        audio.currentTime = (Number(seek.value) / 1000) * audio.duration;
        updateProgress();
      });
      scope.listen(seek, 'change', () => {
        isSeeking = false;
        save();
      });
      scope.listen(audio, 'loadedmetadata', updateProgress);
      scope.listen(audio, 'timeupdate', () => {
        updateProgress();
        save();
      });
      scope.listen(audio, 'play', () => {
        setPlaying(true);
        const trackId = Number(tracks[current]?.id || 0);
        if (trackId && loggedTrackId !== trackId) {
          loggedTrackId = trackId;
          const apiBase = window.__PUBLIC_API_BASE__ || '/api';
          fetch(`${apiBase}/music/${trackId}/play`, { method: 'POST', keepalive: true }).catch(
            () => {},
          );
        }
        save();
      });
      scope.listen(audio, 'pause', () => {
        setPlaying(false);
        save();
      });
      scope.listen(audio, 'ended', () => move(1));
      const persistState = () => save();
      scope.listen(window, 'pagehide', persistState);
      scope.listen(window, 'pagehide', persistState);
      scope.listen(window, 'boke:play-track', (event) => {
        const trackId = Number(event.detail?.trackId || 0);
        const index = tracks.findIndex((track) => Number(track.id) === trackId);
        if (index < 0) return;
        current = index;
        render(false);
        play();
      });
      if ('mediaSession' in navigator) {
        try {
          navigator.mediaSession.setActionHandler('play', play);
          navigator.mediaSession.setActionHandler('pause', () => {
            wantsPlayback = false;
            setResumePending(false);
            audio?.pause();
            save();
          });
          navigator.mediaSession.setActionHandler('previoustrack', () => move(-1));
          navigator.mediaSession.setActionHandler('nexttrack', () => move(1));
        } catch {
          // 部分浏览器只实现了部分 Media Session 操作。
        }
      }
      if (!tracks.length)
        toggles.forEach((button) => {
          button.disabled = true;
        });
      render(true);
    });
  }

  initMusicPlayers();
  return () => {
    scope.dispose();
    document.querySelectorAll('[data-music-player]').forEach((node) => {
      delete node.dataset.ready;
      node.querySelector('audio')?.pause();
    });
    if ('mediaSession' in navigator)
      for (const action of ['play', 'pause', 'previoustrack', 'nexttrack']) {
        try {
          navigator.mediaSession.setActionHandler(action, null);
        } catch {}
      }
  };
}
