'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast, type ToastItem } from './toast';

const labels = { success: '成功', error: '错误', warning: '提醒', info: '提示' };

export function ToastProvider() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const [items, setItems] = useState<ToastItem[]>([]);
  useEffect(() => toast.subscribe(setItems), []);
  useEffect(() => {
    if (previousPath.current !== pathname) toast.clear();
    previousPath.current = pathname;
  }, [pathname]);
  return (
    <section className="global-toast-stack" aria-label="操作反馈" aria-live="polite">
      {items.map((item) => (
        <article className={`global-toast global-toast--${item.kind}`} key={item.id} role={item.kind === 'error' ? 'alert' : 'status'}>
          <span className="global-toast__mark" aria-hidden="true" />
          <div className="global-toast__copy"><strong>{labels[item.kind]}</strong><span>{item.message}</span></div>
          <button className="global-toast__close" type="button" aria-label="关闭提示" onClick={() => toast.dismiss(item.id)}>×</button>
        </article>
      ))}
    </section>
  );
}
