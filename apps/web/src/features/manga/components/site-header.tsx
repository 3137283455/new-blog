export function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

export function MangaSiteHeader({
  active = 'discover',
}: {
  active?: 'discover' | 'latest' | 'rank' | 'library';
}) {
  const links = [
    { key: 'discover', label: '发现', href: '/manga' },
    { key: 'latest', label: '最新', href: '/manga/latest' },
    { key: 'rank', label: '排行', href: '/manga/rank' },
    { key: 'library', label: '书架', href: '/manga/library' },
  ];
  return (
    <header className="manga-site-header">
      <a className="manga-site-brand" href="/manga" aria-label="返回漫画站首页">
        <span>漫</span>
        <strong>漫画站</strong>
      </a>
      <nav aria-label="漫画站导航">
        {links.map((link) => (
          <a key={link.key} className={active === link.key ? 'active' : ''} href={link.href}>
            {link.label}
          </a>
        ))}
      </nav>
      <div className="manga-site-actions">
        <a
          className="manga-site-search"
          href="/manga/search"
          aria-label="搜索漫画"
          title="搜索漫画"
        >
          <SearchIcon />
          <span>搜索漫画</span>
        </a>
        <a className="manga-site-reading" href="/reading">
          阅读记录 <span>↗</span>
        </a>
      </div>
    </header>
  );
}
