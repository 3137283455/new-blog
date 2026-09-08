'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

const seconds = (value: number) => {
  if (!Number.isFinite(value) || value < 0) return '00:00';
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
};

export function MusicRoom({
  tracks,
  initialIndex = 0,
  settings = {},
}: {
  tracks: any[];
  initialIndex?: number;
  settings?: any;
}) {
  const playlist = useMemo(() => tracks.filter((item) => item?.title && item?.url).map((item, index) => ({ ...item, index, playlist: item.playlist || item.collection || '默认歌单' })), [tracks]);
  const [active, setActive] = useState(Math.min(Math.max(initialIndex, 0), Math.max(playlist.length - 1, 0)));
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tab, setTab] = useState<'playlist' | 'lyrics'>('playlist');
  const audio = useRef<HTMLAudioElement>(null);
  const track = playlist[active];
  const collections = Array.from(new Set(playlist.map((item) => item.playlist)));

  useEffect(() => {
    const element = audio.current;
    if (!element || !track) return;
    element.load();
    setElapsed(0);
    if (playing) void element.play().catch(() => setPlaying(false));
  }, [active, track?.url]);

  if (!track) return <div className="empty-feature ryu-card"><strong>还没有音乐</strong><span>去后台内容中心添加歌曲后再查看详情。</span></div>;

  const select = (index: number) => {
    setActive(index);
    history.replaceState(null, '', `/music/${index}`);
  };
  const toggle = () => {
    const element = audio.current;
    if (!element) return;
    if (element.paused) void element.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    else { element.pause(); setPlaying(false); }
  };

  return (
    <section className="music-stage" data-music-detail>
      <section className="music-cover-wall" aria-label="歌单封面墙">
        <header><div><small>PLAYLIST WALL</small><h2>歌单封面墙</h2></div><span>{playlist.length} 首</span></header>
        <div>{playlist.slice(0, 18).map((item) => <button className={item.index === active ? 'is-active' : ''} type="button" key={item.id || item.index} title={`${item.title} · ${item.artist || '未知歌手'}`} onClick={() => select(item.index)}><img src={item.cover || '/image2.webp'} alt={item.title} /><span><strong>{item.title}</strong><small>{item.artist || item.playlist}</small></span></button>)}</div>
      </section>
      <div className="music-room">
        <aside className="music-profile-panel">
          <img className="music-profile-cover" src={settings.profile_avatar || '/profile.webp'} alt="个人头像" />
          <h2>{settings.profile_name || settings.site_title || '个人博客'}</h2>
          <span />
          <p>{settings.profile_bio || settings.site_description || '记录技术、生活和灵感的个人空间。'}</p>
          <div className="music-profile-icons"><a href="/">⌂</a><a href="/archive">▣</a><a href="/music">♪</a><a href="/search">⌕</a></div>
          <div className="music-profile-stats"><div><small>歌曲数</small><strong>{playlist.length}</strong></div><div><small>合集数</small><strong>{collections.length}</strong></div></div>
        </aside>

        <main className="music-center-panel">
          <div className={`music-turntable${playing ? ' is-playing' : ''}`}><div className="music-record"><img src={track.cover || '/image2.webp'} alt={`${track.title} 封面`} /></div><div className="music-tonearm" /></div>
          <h1>{track.title}</h1>
          <p>{track.artist || '未知歌手'}</p>
          <audio ref={audio} src={track.url} preload="metadata" onTimeUpdate={(event) => setElapsed(event.currentTarget.currentTime)} onLoadedMetadata={(event) => setDuration(event.currentTarget.duration)} onEnded={() => select((active + 1) % playlist.length)} />
          <div className="music-progress-row"><span>{seconds(elapsed)}</span><input className="music-player-range music-stage-range" type="range" min="0" max={Math.max(duration, 1)} value={elapsed} step="0.1" aria-label="播放进度" onChange={(event) => { const value = Number(event.target.value); if (audio.current) audio.current.currentTime = value; setElapsed(value); }} /><span>{seconds(duration)}</span></div>
          <div className="music-playlist-card"><h2>歌单合集</h2><div className="music-collection-grid">{collections.map((name) => <button className={name === track.playlist ? 'is-active' : ''} type="button" key={name} onClick={() => select(playlist.findIndex((item) => item.playlist === name))}><span>{name}</span><small>{playlist.filter((item) => item.playlist === name).length} 首</small></button>)}</div></div>
        </main>

        <aside className="music-lyrics-panel">
          <div className="music-panel-tabs"><button className={tab === 'playlist' ? 'is-active' : ''} type="button" onClick={() => setTab('playlist')}>播放列表</button><button className={tab === 'lyrics' ? 'is-active' : ''} type="button" onClick={() => setTab('lyrics')}>歌词</button></div>
          {tab === 'playlist' ? <div className="music-side-panel"><div className="music-playlist-grid music-side-list">{playlist.map((item) => <button className={`music-detail-track${item.index === active ? ' is-active' : ''}`} type="button" key={item.id || item.index} onClick={() => select(item.index)}><span>{String(item.index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><small>{item.artist || '未知歌手'}</small></div></button>)}</div></div> : <div className="music-side-panel"><div className="music-lyrics"><div className="music-lyrics-inner">{String(track.lyrics || '后台还没有填写歌词。').split(/\r?\n/).filter(Boolean).map((line, index) => <p className="lyric-line-static" key={index}>{line.replace(/\[[^\]]+\]/g, '')}</p>)}</div></div></div>}
          <div className="music-control-card"><button type="button" onClick={() => select((active - 1 + playlist.length) % playlist.length)} aria-label="上一首">‹</button><button type="button" onClick={toggle} aria-label={playing ? '暂停' : '播放'}>{playing ? 'Ⅱ' : '▶'}</button><button type="button" onClick={() => select((active + 1) % playlist.length)} aria-label="下一首">›</button></div>
        </aside>
      </div>
    </section>
  );
}
