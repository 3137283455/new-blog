'use client';

import { useEffect, useState } from 'react';
import type { BookDetail, BookVolume } from './contracts';

interface CommentItem { id?: number; author_name?: string; content?: string; created_at?: string; }

export function BookVolumePage({ book, volume }: { book: BookDetail; volume: BookVolume }) {
  const [comments, setComments] = useState<CommentItem[]>([]);
  const [status, setStatus] = useState('');
  const [form, setForm] = useState({ author_name: '', author_email: '', content: '' });
  const chapters = volume.chapters || [];
  const reload = async () => {
    try { const response = await fetch(`/api/book-volumes/${volume.id}/comments`); const json = await response.json(); setComments(Array.isArray(json.data) ? json.data : []); }
    catch { setStatus('评论暂时无法加载'); }
  };
  useEffect(() => { void reload(); }, [volume.id]);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setStatus('提交中…');
    try { const response = await fetch(`/api/book-volumes/${volume.id}/comments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) }); const json = await response.json(); if (!response.ok) throw new Error(json.message || '提交失败'); setForm({ author_name: '', author_email: '', content: '' }); setStatus(json.message || '评论已提交'); void reload(); }
    catch (error) { setStatus(error instanceof Error ? error.message : '提交失败'); }
  };
  return <section className="volume-page"><nav><a href={`/books/${encodeURIComponent(book.slug)}`}>← {book.title}</a><a href={`/books/${encodeURIComponent(book.slug)}#contents`}>全书目录</a></nav><header><small>VOLUME</small><h1>{volume.title}</h1><p>{volume.description || '选择章节开始阅读。每一卷拥有独立评论。'}</p>{chapters[0] && <a className="start" href={`/books/${encodeURIComponent(book.slug)}/${encodeURIComponent(volume.slug)}/${encodeURIComponent(chapters[0].slug)}`}>开始阅读 →</a>}</header><ol>{chapters.map((chapter, index) => <li key={chapter.id}><a href={`/books/${encodeURIComponent(book.slug)}/${encodeURIComponent(volume.slug)}/${encodeURIComponent(chapter.slug)}`}><span>{String(index + 1).padStart(2, '0')}</span><b>{chapter.title}</b><i>阅读 →</i></a></li>)}</ol><section className="volume-comments" data-volume-comments={volume.id}><header><h2>本卷评论</h2><button type="button" onClick={() => void reload()}>刷新</button></header><div>{comments.length ? comments.map((comment) => <article className="comment-item" key={comment.id}><b>{comment.author_name || '匿名'}</b><small> · {comment.created_at || ''}</small><p>{comment.content}</p></article>) : <p>还没有评论。</p>}</div><form onSubmit={submit}><div><input value={form.author_name} onChange={(event) => setForm({ ...form, author_name: event.target.value })} placeholder="昵称" required maxLength={40} /><input value={form.author_email} onChange={(event) => setForm({ ...form, author_email: event.target.value })} type="email" placeholder="邮箱，可选" /></div><textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="写下对这一卷的想法…" required maxLength={2000} /><button type="submit">提交评论</button><p>{status}</p></form></section></section>;
}
