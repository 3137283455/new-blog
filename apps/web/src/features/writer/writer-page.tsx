'use client';
import { useLayoutEffect, useRef } from 'react';
import { createAdminScope } from '../admin/admin-scope';
import { WriterView } from './writer-view';
import { writerScopeAttribute } from './scope-attribute';
import { mount } from './controller';
export function WriterPage() {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (!ref.current) return;
    const scope = createAdminScope(ref.current);
    const bodyClass = document.body.className;
    document.body.className = '';
    const oldFontStyle = document.getElementById('writer-font-library-style');
    const oldFontText = oldFontStyle?.textContent || '';
    document.body.dataset.apiBase = '/api';
    for (const element of [document.documentElement, document.body])
      element.setAttribute(writerScopeAttribute, '');
    scope.defer(() => {
      document.body.className = bodyClass;
      delete document.body.dataset.apiBase;
      for (const element of [document.documentElement, document.body])
        element.removeAttribute(writerScopeAttribute);
      document.documentElement.style.removeProperty('--preview-split');
      if (oldFontStyle) oldFontStyle.textContent = oldFontText;
      else document.getElementById('writer-font-library-style')?.remove();
    });
    mount(scope);
    return () => scope.dispose();
  }, []);
  return (
    <div ref={ref} style={{ display: 'contents' }}>
      <WriterView />
    </div>
  );
}
