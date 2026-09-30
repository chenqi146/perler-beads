export const APP_NAV_LINKS = [
  {
    href: '/dashboard',
    label: '我的图纸',
    match: (path: string) =>
      path.startsWith('/dashboard') ||
      path.startsWith('/patterns') ||
      path === '/' ||
      path.startsWith('/editor') ||
      path.startsWith('/bead'),
  },
  {
    href: '/explore',
    label: '公开浏览',
    match: (path: string) => path.startsWith('/explore') || path.startsWith('/pattern/'),
  },
  {
    href: '/works',
    label: '我的作品',
    match: (path: string) => path.startsWith('/works') || path.startsWith('/work/'),
  },
  {
    href: '/inventory',
    label: '豆仓',
    match: (path: string) => path.startsWith('/inventory'),
  },
] as const;
