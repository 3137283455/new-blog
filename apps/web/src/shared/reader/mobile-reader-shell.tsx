'use client';

import { useEffect, type ReactNode } from 'react';
import './mobile-reader-shell.css';

export type MobileReaderAction = {
  label: string;
  icon: ReactNode;
  onClick?: () => void;
  href?: string;
  primary?: boolean;
  disabled?: boolean;
};

export function MobileReaderShell({
  open,
  onOpenChange,
  backHref,
  title,
  subtitle,
  progress,
  actions,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  backHref: string;
  title: string;
  subtitle?: string;
  progress?: string;
  actions: MobileReaderAction[];
}) {
  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => onOpenChange(false), 4500);
    const hide = () => onOpenChange(false);
    window.addEventListener('wheel', hide, { passive: true, once: true });
    window.addEventListener('touchmove', hide, { passive: true, once: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('wheel', hide);
      window.removeEventListener('touchmove', hide);
    };
  }, [open, onOpenChange]);

  return (
    <div className="mobile-reader-shell" data-open={open} onClick={(event) => event.stopPropagation()}>
      <header className="mobile-reader-shell__top">
        <a href={backHref} aria-label="返回目录">‹</a>
        <div><strong>{title}</strong>{subtitle && <small>{subtitle}</small>}</div>
        <span>{progress || ''}</span>
      </header>
      <nav className="mobile-reader-shell__bottom" aria-label="阅读控制">
        {actions.map((action) => {
          const content = <><b aria-hidden="true">{action.icon}</b><small>{action.label}</small></>;
          return action.href ? (
            <a key={action.label} href={action.href} data-primary={action.primary || undefined}>{content}</a>
          ) : (
            <button key={action.label} type="button" disabled={action.disabled} data-primary={action.primary || undefined} onClick={() => { action.onClick?.(); onOpenChange(false); }}>{content}</button>
          );
        })}
      </nav>
    </div>
  );
}
