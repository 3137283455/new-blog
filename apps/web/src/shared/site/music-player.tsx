'use client';
import { useEffect } from 'react';
import { mountController } from './music-controller';
export interface MusicTrack {
  id?: number;
  title: string;
  artist?: string;
  url: string;
  cover?: string;
}
export function MusicPlayer({ tracks: input = [] }: { tracks?: MusicTrack[] }) {
  const tracks = input
    .filter((track) => track?.title && track?.url)
    .map((track) => ({ ...track, cover: track.cover || '/image2.webp' }));
  const payload = JSON.stringify(tracks);
  useEffect(() => mountController(), [payload]);
  return (
    <section
      className="floating-music-player"
      data-music-player=""
      data-tracks={payload}
      data-panel-open="false"
      aria-label="全站音乐播放器"
    >
      <div className="floating-music-dock">
        <button
          className="floating-music-record"
          type="button"
          data-music-panel-toggle=""
          aria-expanded="false"
          aria-controls="floating-music-panel"
          aria-label="展开音乐播放器"
          title="展开音乐播放器"
        >
          <span className="floating-music-vinyl" aria-hidden="true">
            <img
              data-music-cover=""
              src={tracks[0]?.cover || '/image2.webp'}
              alt=""
              loading="eager"
            />
          </span>
          <span className="floating-music-state" data-music-toggle-icon="" aria-hidden="true">
            ▶
          </span>
        </button>
      </div>

      <div id="floating-music-panel" className="floating-music-panel" data-music-panel="" hidden>
        <header>
          <div className="music-player-meta">
            <p className="music-player-kicker">NOW PLAYING</p>
            <h3 data-music-title="">{tracks[0]?.title || '暂无音乐'}</h3>
            <p data-music-artist="">
              {tracks[0]?.artist || (tracks.length ? '未知歌手' : '请在后台音乐管理添加')}
            </p>
          </div>
          <button
            type="button"
            data-music-panel-close=""
            aria-label="收起播放器"
            title="收起播放器"
          >
            ×
          </button>
        </header>
        <audio data-music-audio="" src={tracks[0]?.url || undefined} preload="metadata"></audio>
        <div className="music-player-time">
          <span data-music-current="">00:00</span>
          <span data-music-duration="">00:00</span>
        </div>
        <input
          className="music-player-range"
          data-music-seek=""
          type="range"
          min="0"
          max="1000"
          defaultValue="0"
          step="1"
          aria-label="播放进度"
        />
        <div className="music-player-actions">
          <button type="button" data-music-prev="" aria-label="上一首" title="上一首">
            ‹
          </button>
          <button type="button" data-music-toggle="" aria-label="播放音乐" title="播放或暂停">
            <span data-music-toggle-icon="">▶</span>
          </button>
          <button type="button" data-music-next="" aria-label="下一首" title="下一首">
            ›
          </button>
          <a
            data-music-detail=""
            href={tracks[0] ? `/music/0` : '/admin'}
            aria-label="音乐详情"
            title="音乐详情"
          >
            详情
          </a>
        </div>
      </div>
    </section>
  );
}
