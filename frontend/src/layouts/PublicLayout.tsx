import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { ChevronDown, Menu, Moon, Search, Sun, X } from 'lucide-react';
import ChmWordmarkOption2 from '../components/brand/ChmWordmarkOption2';
import { ClosingBand } from '../components/home/HomeSkinSections';
import { useTheme } from '../contexts/ThemeContext';
import { isTestappHost } from '../config/app-urls';
import DISEASE_AREAS from '../data/disease-areas';
import { CHM_PODCAST_PLATFORM_LINKS, PODCAST_SHOWS } from '../data/podcastsCatalog';

/* Mirrors the live platform's information architecture. */
const nav = [
  { to: '/catalog', label: 'Content Library' },
  { to: '/kols', label: 'KOL Network' },
  { to: '/podcast-network', label: 'Podcasts' },
  { to: '/live', label: 'Live' },
];

/* Everything the search dialog can jump to that is not a disease state. */
const destinations = [
  ...nav,
  { to: '/about', label: 'About CHM' },
  { to: '/about', label: 'What we do' },
  { to: '/contact', label: 'Contact' },
];

/* The suggestions are the real tokens /catalog matches on, taken from
   the disease areas themselves. A hand-written list would drift the
   moment a new area is added. */
const suggestions = DISEASE_AREAS.flatMap((d) => d.searchTags.slice(0, 2));

const FOCUSABLE =
  'a[href], button:not(:disabled), input, select, textarea, [tabindex]:not([tabindex="-1"])';

export default function PublicLayout() {
  // The bar starts flush to the top edge and detaches into the floating
  // pill once the page moves. The threshold is 8px rather than 0 so a
  // single pixel of scroll or an elastic bounce cannot make it flicker.
  const [detached, setDetached] = useState(false);
  useEffect(() => {
    const onScroll = () => setDetached(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const { pathname } = useLocation();
  const navigate = useNavigate();

  const [diseaseOpen, setDiseaseOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerQuery, setHeaderQuery] = useState('');

  /* Auth pages are a single decision on one screen. A footer under
     them adds a scroll to a page that is meant to fit the frame, and
     offers twenty exits from a form we just asked someone to finish. */
  const AUTH_ROUTES = [
    '/login', '/join', '/admin/login', '/forgot-password',
    '/reset-password/confirm', '/mfa/setup', '/verify-email',
    '/complete-profile', '/auth/callback',
  ];
  const isAuthRoute = AUTH_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + '/'),
  );

  /* Platform (testapp / app.) auth chrome: hold marketing IA until homepage ships. */
  const hidePrelaunchNav = isTestappHost() && isAuthRoute;

  /* One navigation closes every transient surface. Adjusting during
     render rather than in an effect means the panel is never painted
     open on the page it just left. */
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setDiseaseOpen(false);
    setSearchOpen(false);
    setDrawerOpen(false);
  }

  useEffect(() => {
    if (hidePrelaunchNav) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hidePrelaunchNav]);

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setDrawerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  /* The one search behaviour this site has: a query lands on the
     library with the query applied. The dialog is new chrome around
     the same navigation. */
  const submitBrowse = (e: FormEvent) => {
    e.preventDefault();
    const q = headerQuery.trim();
    setDrawerOpen(false);
    setSearchOpen(false);
    if (q) navigate(`/catalog?q=${encodeURIComponent(q)}`);
    else navigate('/catalog');
  };

  const primaryNav = hidePrelaunchNav ? [] : nav;

  const drawerLinks = hidePrelaunchNav
    ? [
        { to: '/login', label: 'Log in' },
        { to: '/join', label: 'Get started' },
      ]
    : [
        ...nav,
        { to: '/for-hcps', label: 'For HCPs' },
        { to: '/contact', label: 'Contact' },
        { to: '/login', label: 'Log in' },
        { to: '/join', label: 'Get started' },
      ];

  return (
    <div className="flex min-h-screen min-w-0 flex-col bg-ground text-text">
      <a
        href="#main"
        className="press eyebrow sr-only rounded-[6px] bg-text px-5 py-3 text-ground focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-[70]"
      >
        Skip to content
      </a>

      <header
        className={`sticky top-0 z-50 transition-[padding] duration-300 ease-[var(--ease-out-soft)] ${
          detached ? 'pt-3 md:pt-4' : 'pt-0'
        }`}
      >
        {/* At rest the wrapper carries no gutter, so the bar's own
            background reaches both viewport edges and it reads as part
            of the page rather than as a floating sticky element. The
            gutter moves onto the bar instead, at the rail's own values,
            so the wordmark stays aligned with the content below it. */}
        <div className={detached ? 'rail' : 'w-full'}>
          <div
            className={`relative flex h-16 flex-nowrap items-center gap-3 whitespace-nowrap backdrop-blur-2xl backdrop-saturate-150 xl:gap-5 transition-[background-color,border-radius,box-shadow,padding] duration-300 ease-[var(--ease-out-soft)] ${
              detached ? 'px-4 md:px-5' : 'px-5 md:px-10'
            } ${
              detached
                ? 'rounded-[6px] bg-[color-mix(in_oklab,var(--color-surface)_78%,transparent)] shadow-[var(--shadow-nav)] ring-1 ring-[color-mix(in_oklab,var(--color-text)_10%,transparent)]'
                : 'rounded-none bg-[color-mix(in_oklab,var(--color-surface)_88%,transparent)] shadow-none ring-0'
            }`}
          >
            {/* A hairline only while flush: at the top edge there is no
                shadow to separate the bar from the page behind it. */}
            {!detached && (
              <span aria-hidden className="absolute inset-x-0 bottom-0 h-px bg-hairline" />
            )}
            <Link
              to="/"
              className="press shrink-0 rounded-[6px] py-1 text-text"
              aria-label="Community Health Media, home"
            >
              <ChmWordmarkOption2 className="h-auto w-[4.75rem] sm:w-[5.25rem]" />
            </Link>

            {!isAuthRoute && (
            <nav aria-label="Primary" className="hidden shrink-0 items-center gap-0.5 lg:flex">
              {primaryNav.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  className={({ isActive }) =>
                    `press rounded-[6px] px-3 py-2 text-body-s ${
                      isActive ? 'text-text' : 'text-dim hover:text-text'
                    }`
                  }
                >
                  {n.label}
                </NavLink>
              ))}
              {!hidePrelaunchNav ? (
                <DiseaseMenu
                  open={diseaseOpen}
                  setOpen={setDiseaseOpen}
                  active={pathname.startsWith('/catalog/')}
                />
              ) : null}
            </nav>
            )}

            <div className="ms-auto flex shrink-0 items-center gap-2">
              {!hidePrelaunchNav ? (
                <button
                  type="button"
                  onClick={() => setSearchOpen(true)}
                  aria-label="Search the library"
                  className="press grid size-9 place-items-center rounded-[6px] text-dim hover:text-text"
                >
                  <Search className="size-[18px]" strokeWidth={1.5} />
                </button>
              ) : null}

              <ThemeControl />

              {!isAuthRoute && (<>
              {/* Two plain controls. A chevron here read as a dropdown but
                  only linked to sign-in, so the icon lied about the action. */}
              <Link
                to="/login"
                className="press hidden h-9 shrink-0 items-center rounded-[6px] px-3 text-[0.8125rem] text-dim hover:text-text sm:inline-flex"
              >
                Log in
              </Link>
              <Link
                to="/join"
                className="press hidden h-9 shrink-0 items-center rounded-[6px] bg-cta px-4 text-[0.8125rem] font-medium text-white hover:bg-cta-deep sm:inline-flex"
              >
                Get started
              </Link>
            </>)}

              {!isAuthRoute && (
              <button
                type="button"
                onClick={() => setDrawerOpen((v) => !v)}
                aria-expanded={drawerOpen}
                aria-controls="mobile-nav"
                aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
                className="press grid size-10 shrink-0 place-items-center rounded-[6px] text-text lg:hidden"
              >
                {drawerOpen ? (
                  <X className="size-5" strokeWidth={1.75} />
                ) : (
                  <Menu className="size-5" strokeWidth={1.75} />
                )}
              </button>
              )}
            </div>
          </div>

          {drawerOpen ? (
            /* The panel needs its own ground. Open over the hero it was
               previously transparent, so the links sat on the artwork
               and could not be read. Frosted, not opaque, so it still
               reads as floating above the page. */
            <div className="mt-2 lg:hidden">
              <nav
                id="mobile-nav"
                aria-label="Mobile"
                className="rise max-h-[calc(100dvh-6rem)] overflow-y-auto overscroll-contain rounded-[6px] bg-[color-mix(in_oklab,var(--color-surface)_92%,transparent)] p-2 shadow-[var(--shadow-pop)] ring-1 ring-[color-mix(in_oklab,var(--color-text)_10%,transparent)] backdrop-blur-2xl backdrop-saturate-150"
              >
                {drawerLinks.map((n) => (
                  <Link
                    key={n.to}
                    to={n.to}
                    onClick={() => setDrawerOpen(false)}
                    className="press block rounded-[6px] px-3 py-3 text-body-m text-dim hover:bg-surface-2 hover:text-text"
                  >
                    {n.label}
                  </Link>
                ))}
                {!hidePrelaunchNav ? (
                  <>
                    <p className="eyebrow px-3 pb-2 pt-4 text-faint">Disease states</p>
                    <div className="flex flex-wrap gap-2 px-1 pb-1">
                      {DISEASE_AREAS.map((a) => (
                        <Link
                          key={a.slug}
                          to={`/catalog/${a.slug}`}
                          onClick={() => setDrawerOpen(false)}
                          className="press rounded-[6px] bg-surface-2 px-4 py-2 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text"
                        >
                          {a.title}
                        </Link>
                      ))}
                    </div>
                  </>
                ) : null}
              </nav>
            </div>
          ) : null}
        </div>
      </header>

      {/* `overflow-x: clip`, not hidden. `hidden` computes overflow-y to
          `auto`, which makes this a scroll container -- any sticky
          descendant then sticks to <main> instead of the viewport and
          never engages, because the page scrolls on the body. `clip`
          clips the same overflow without creating that container. */}
      <main id="main" className="min-w-0 flex-1 overflow-x-clip">
        <Outlet />
      </main>

      {!isAuthRoute && <SiteFooter />}

      {searchOpen && !hidePrelaunchNav ? (
        <SearchDialog
          q={headerQuery}
          setQ={setHeaderQuery}
          onSubmit={submitBrowse}
          onClose={() => setSearchOpen(false)}
        />
      ) : null}
    </div>
  );
}

/* The appearance control, on the platform's own theme state. Both
   glyphs stay mounted and cross-fade, so the swap animates in and out
   without a motion dependency. */
function ThemeControl() {
  const { resolvedTheme, toggleColorScheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleColorScheme}
      aria-pressed={isDark}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} appearance`}
      className="press grid size-9 shrink-0 place-items-center rounded-[6px] text-dim hover:text-text"
    >
      <span className="relative grid size-[18px] place-items-center">
        <Sun
          strokeWidth={1.5}
          className={`absolute size-[18px] transition-[opacity,scale,filter] duration-300 ease-[var(--ease-cross)] ${
            isDark ? 'scale-[0.25] opacity-0 blur-[4px]' : 'scale-100 opacity-100 blur-0'
          }`}
        />
        <Moon
          strokeWidth={1.5}
          className={`size-[18px] transition-[opacity,scale,filter] duration-300 ease-[var(--ease-cross)] ${
            isDark ? 'scale-100 opacity-100 blur-0' : 'scale-[0.25] opacity-0 blur-[4px]'
          }`}
        />
      </span>
    </button>
  );
}

function DiseaseMenu({
  open,
  setOpen,
  active,
}: {
  open: boolean;
  setOpen: (v: boolean) => void;
  active: boolean;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrapRef.current?.querySelector('button')?.focus();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-controls={panelId}
        className={`press flex items-center gap-1.5 rounded-[6px] px-3 py-2 text-body-s ${
          active ? 'text-text' : 'text-dim hover:text-text'
        }`}
      >
        Disease states
        <ChevronDown
          className={`size-3.5 transition-[rotate] duration-150 ease-[var(--ease-standard)] ${
            open ? 'rotate-180' : ''
          }`}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <div className="absolute start-0 top-full pt-3">
          <div
            id={panelId}
            className="card w-[30rem] origin-top-left p-2 shadow-[var(--shadow-pop)] motion-safe:animate-[fadeSlideUp_150ms_var(--ease-out-soft)_both]"
          >
            <ul className="grid gap-1">
              {DISEASE_AREAS.map((a) => (
                <li key={a.slug}>
                  <Link
                    to={`/catalog/${a.slug}`}
                    className="press block rounded-[6px] p-4 hover:bg-surface-2"
                  >
                    <span className="display block text-body-m text-text">{a.title}</span>
                    <span className="prose-lede mt-1 block text-body-s text-muted2">
                      {a.description}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SearchDialog({
  q,
  setQ,
  onSubmit,
  onClose,
}: {
  q: string;
  setQ: (v: string) => void;
  onSubmit: (e: FormEvent) => void;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();

  useEffect(() => {
    const root = document.getElementById('root');
    const restoreTo = document.activeElement as HTMLElement | null;
    root?.setAttribute('inert', '');
    document.body.style.overflow = 'hidden';
    inputRef.current?.focus();
    return () => {
      root?.removeAttribute('inert');
      document.body.style.overflow = '';
      restoreTo?.focus?.();
    };
  }, []);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const nodes = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [],
      ).filter((n) => n.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  /* The platform has no cross-entity search index, so the dialog
     filters what it can resolve without a round trip and hands the
     query itself to the library. */
  const needle = q.trim().toLowerCase();
  const areas = needle
    ? DISEASE_AREAS.filter((d) =>
        [d.title, d.description, ...d.searchTags].join(' ').toLowerCase().includes(needle),
      )
    : [];
  const pages = needle
    ? destinations.filter((d) => d.label.toLowerCase().includes(needle))
    : [];
  const count = areas.length + pages.length;

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex items-start justify-center px-4 pt-[12vh]"
      onKeyDown={onKeyDown}
    >
      <button
        type="button"
        aria-label="Close search"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="card relative w-full max-w-[40rem] overflow-hidden shadow-[var(--shadow-pop)] motion-safe:animate-[fadeSlideUp_200ms_var(--ease-out-soft)_both]"
      >
        <h2 id={titleId} className="sr-only">
          Search CHM
        </h2>
        <form onSubmit={onSubmit} className="flex items-center gap-3 px-5 py-4">
          <Search className="size-[18px] text-faint" strokeWidth={1.5} />
          <label htmlFor="chm-search" className="sr-only">
            Search the content library
          </label>
          <input
            id="chm-search"
            ref={inputRef}
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="HER2, immunotherapy, office hours"
            autoComplete="off"
            className="w-full bg-transparent text-base text-text outline-none placeholder:text-faint sm:text-body-m"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close search"
            className="press grid size-8 place-items-center rounded-[6px] text-faint hover:text-text"
          >
            <X className="size-4" strokeWidth={1.5} />
          </button>
        </form>

        <div className="max-h-[52vh] overflow-y-auto overscroll-contain p-2">
          <p role="status" className="sr-only">
            {q ? `${count} ${count === 1 ? 'match' : 'matches'} for ${q}` : ''}
          </p>

          {!needle ? (
            <div className="px-3 py-4">
              <p className="eyebrow text-faint">Try</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setQ(s);
                      inputRef.current?.focus();
                    }}
                    className="press rounded-[6px] px-4 py-2 text-body-s text-dim shadow-[var(--shadow-card)] hover:text-text"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <Group label="Library">
                <Row onClick={onSubmit} title={`Search the library for “${q.trim()}”`} meta="Enter" />
              </Group>
              {areas.length > 0 && (
                <Group label="Disease states">
                  {areas.map((a) => (
                    <Row
                      key={a.slug}
                      to={`/catalog/${a.slug}`}
                      title={a.title}
                      meta={a.active ? 'Live' : 'Coming soon'}
                    />
                  ))}
                </Group>
              )}
              {pages.length > 0 && (
                <Group label="Pages">
                  {pages.map((p) => (
                    <Row key={p.to} to={p.to} title={p.label} meta={p.to} />
                  ))}
                </Group>
              )}
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-1">
      <h3 className="eyebrow px-3 py-2 text-faint">{label}</h3>
      <ul>{children}</ul>
    </section>
  );
}

function Row({
  to,
  onClick,
  title,
  meta,
}: {
  to?: string;
  onClick?: (e: FormEvent) => void;
  title: string;
  meta: string;
}) {
  const inner = (
    <>
      <span className="text-body-s text-text">{title}</span>
      <span className="meta shrink-0 text-faint">{meta}</span>
    </>
  );
  const classes =
    'press flex w-full items-center justify-between gap-4 rounded-[6px] px-3 py-2.5 text-start hover:bg-surface-2';

  return (
    <li>
      {to ? (
        <Link to={to} className={classes}>
          {inner}
        </Link>
      ) : (
        <button type="button" onClick={onClick} className={classes}>
          {inner}
        </button>
      )}
    </li>
  );
}

/* ─────────────────────────────────────────────────────────────────
   Footer. Permanently dark in both appearances, so everything inside
   it is fixed light-on-dark and the column heads take the bright
   spectrum rather than the ink variants that deepen on a light
   ground and would vanish here.
   ───────────────────────────────────────────────────────────────── */

type FooterLink = { label: string; to?: string; href?: string };

/* Routes mirror the live platform IA. The header and footer must
   describe the same site. */
const columns: { label: string; links: FooterLink[] }[] = [
  {
    label: 'Content',
    links: [
      { to: '/catalog', label: 'Content library' },
      { to: '/catalog?view=playlists', label: 'Playlists' },
      { to: '/catalog?view=clips', label: 'Clips' },
    ],
  },
  {
    label: 'Disease states',
    links: DISEASE_AREAS.map((d) => ({ to: `/catalog/${d.slug}`, label: d.title })),
  },
  {
    label: 'Shows',
    /* Each show points at its own hub; a series without an override
       falls back to the umbrella CHM listing, which is the contract
       `platformLinks` already documents. */
    links: [
      { to: '/podcast-network', label: 'All shows' },
      ...PODCAST_SHOWS.map((s) => ({
        to: `/podcast-network/${encodeURIComponent(s.id)}`,
        label: s.title,
      })),
    ],
  },
  {
    label: 'Company',
    links: [
      { to: '/about', label: 'About CHM' },
      { to: '/about', label: 'What we do' },
      { to: '/kols', label: 'KOL network' },
      { to: '/podcast-network', label: 'Podcast network' },
      { to: '/contact', label: 'Contact' },
    ],
  },
  {
    label: 'Get started',
    links: [
      { to: '/for-hcps', label: 'For HCPs' },
      { to: '/join', label: 'Create an account' },
      { to: '/login', label: 'Log in' },
    ],
  },
];

function SiteFooter() {
  /* The closing band from the WordPress theme: the CTA and the footer on
     one continuous slate, with the footer columns as a single horizontal
     scroller at every width. The navbar is untouched. */
  return <ClosingBand columns={columns} />;
}
