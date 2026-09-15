'use client';

import { useEffect, useState } from 'react';

const volumeKey = 'boke_reader_music_volume';

function player() {
  return document.querySelector<HTMLElement>('[data-music-player]');
}

function trigger(selector: string) {
  player()?.querySelector<HTMLElement>(selector)?.click();
}

export function MobileReaderMusic() {
  const [title, setTitle] = useState('暂无音乐');
  const [artist, setArtist] = useState('请先在后台添加音乐');
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(80);

  useEffect(() => {
    const root = player();
    const audio = root?.querySelector<HTMLAudioElement>('[data-music-audio]');
    if (!root || !audio) return;
    const stored = Number(localStorage.getItem(volumeKey));
    const initialVolume = Number.isFinite(stored) ? Math.max(0, Math.min(100, stored)) : 80;
    audio.volume = initialVolume / 100;
    setVolume(initialVolume);
    const sync = () => {
      setTitle(root.querySelector('[data-music-title]')?.textContent?.trim() || '暂无音乐');
      setArtist(root.querySelector('[data-music-artist]')?.textContent?.trim() || '未知歌手');
      setPlaying(!audio.paused);
    };
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, childList: true, subtree: true, characterData: true });
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);
    audio.addEventListener('loadedmetadata', sync);
    sync();
    return () => {
      observer.disconnect();
      audio.removeEventListener('play', sync);
      audio.removeEventListener('pause', sync);
      audio.removeEventListener('loadedmetadata', sync);
    };
  }, []);

  function changeVolume(value: number) {
    const next = Math.max(0, Math.min(100, value));
    setVolume(next);
    localStorage.setItem(volumeKey, String(next));
    const audio = player()?.querySelector<HTMLAudioElement>('[data-music-audio]');
    if (audio) audio.volume = next / 100;
  }

  return (
    <section className="mobile-reader-music" aria-label="阅读音乐">
      <header><span>阅读音乐</span><small>{playing ? '播放中' : '已暂停'}</small></header>
      <div className="mobile-reader-music__track"><strong>{title}</strong><span>{artist}</span></div>
      <div className="mobile-reader-music__controls">
        <button type="button" onClick={() => trigger('[data-music-prev]')} aria-label="上一首">‹</button>
        <button type="button" className="primary" onClick={() => trigger('[data-music-toggle]')} aria-label={playing ? '暂停' : '播放'}>{playing ? 'Ⅱ' : '▶'}</button>
        <button type="button" onClick={() => trigger('[data-music-next]')} aria-label="下一首">›</button>
      </div>
      <label className="mobile-reader-music__volume">
        <span>音量</span>
        <input type="range" min="0" max="100" step="5" value={volume} onChange={(event) => changeVolume(Number(event.target.value))} />
        <output>{volume}%</output>
      </label>
    </section>
  );
}
