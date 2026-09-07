'use client';
import { useEffect, useRef } from 'react';
import { AdminView } from './views/admin-view';
import { createAdminScope } from './admin-scope';
import { mount as core } from './controllers/core';
import { mount as extra } from './controllers/extra';
import { mount as personal } from './controllers/personal';
import { mount as books } from './controllers/books';
import { mount as contentCenter } from './controllers/content-center';
import { mount as manga } from './controllers/manga';
import { mount as sources } from './controllers/search-sources';
export function AdminPage() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const scope = createAdminScope(ref.current);
    try {
      for (const mount of [core, extra, personal, books, contentCenter, manga, sources])
        mount(scope);
    } catch (error) {
      scope.dispose();
      throw error;
    }
    return () => scope.dispose();
  }, []);
  return (
    <div ref={ref} style={{ display: 'contents' }}>
      <AdminView />
    </div>
  );
}
