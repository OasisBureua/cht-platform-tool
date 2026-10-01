import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useLocation } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import { ChmMark } from '../brand/ChmMark';

/**
 * The shell's labelled rail, shared by the member app and the admin
 * console: a home row, the current page as a filled pill and the collapse
 * control at the foot. Log out lives in the profile menu, top right.
 *
 * The rows share the rail's height evenly rather than packing at the top,
 * so a tall screen doesn't leave a well of empty space at the foot and a
 * short one never scrolls: each row can shrink to 34px and the gaps close
 * first. The rail collapses to icons for more room, which is remembered
 * per browser; with no saved choice it starts collapsed on screens
 * narrower than 1200px.
 *
 * A group (admin Tools) opens in place while the rail is labelled, and as
 * a flyout beside the icon once it's collapsed.
 *
 * The pill is `anchor` with `ground` text, not the lighter `cta`: white on
 * `cta` is 2.6:1, while ground on anchor clears AA in both appearances.
 */
export type RailLeaf = { to: string; label: string; icon: LucideIcon; end?: boolean; title?: string };
export type RailGroup = { id: string; label: string; icon: LucideIcon; children: RailLeaf[] };
export type RailEntry = RailLeaf | RailGroup;

const isGroup = (e: RailEntry): e is RailGroup => 'children' in e;
const leafActive = (leaf: RailLeaf, pathname: string) =>
  leaf.end ? pathname === leaf.to : pathname === leaf.to || pathname.startsWith(`${leaf.to}/`);

const ROW =
  'flex h-[clamp(34px,5vh,42px)] shrink items-center rounded-[8px] text-sm transition-[color,background-color,transform] duration-150 ease-[cubic-bezier(0.2,0,0,1)] active:scale-[0.98]';
const ICON = 'h-[18px] w-[18px] shrink-0';
const idle = 'text-dim hover:bg-surface-2 hover:text-text';
const current = 'bg-anchor font-medium text-ground';

function readCollapsed(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(key);
    if (saved === '1') return true;
    if (saved === '0') return false;
  } catch {
    /* storage blocked: fall through to the width default */
  }
  return window.matchMedia?.('(max-width: 1199px)').matches ?? false;
}

function useNarrow(enabled: boolean): boolean {
  const query = '(max-width: 767px)';
  const [narrow, setNarrow] = useState(() => enabled && typeof window !== 'undefined' && !!window.matchMedia?.(query).matches);
  useEffect(() => {
    if (!enabled || !window.matchMedia) return undefined;
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, [enabled]);
  return narrow;
}

function GroupFlyout({ group, anchor, onClose }: { group: RailGroup; anchor: HTMLElement; onClose: () => void }) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    const update = () => {
      const r = anchor.getBoundingClientRect();
      setPos({ top: Math.max(8, r.top), left: r.right + 8 });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [anchor]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchor.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [anchor, onClose]);

  if (!pos) return null;
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={group.label}
      style={{ top: pos.top, left: pos.left }}
      className="fixed z-[60] w-56 overflow-hidden rounded-card border border-hairline bg-surface p-1.5 shadow-card-hover"
    >
      <p className="meta px-3 py-1.5 text-faint">{group.label}</p>
      {group.children.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          role="menuitem"
          onClick={onClose}
          className={({ isActive }) =>
            ['flex min-h-[40px] items-center gap-2.5 rounded-[6px] px-3 text-sm', isActive ? current : idle].join(' ')
          }
        >
          <Icon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
          <span className="truncate">{label}</span>
        </NavLink>
      ))}
    </div>,
    document.body,
  );
}

function GroupRow({ group, collapsed }: { group: RailGroup; collapsed: boolean }) {
  const { pathname } = useLocation();
  const active = group.children.some((c) => leafActive(c, pathname));
  const [open, setOpen] = useState(active);
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const Icon = group.icon;

  // Landing on one of the group's pages opens it; leaving closes the flyout.
  const [seen, setSeen] = useState(pathname);
  if (seen !== pathname) {
    setSeen(pathname);
    setAnchor(null);
    if (active) setOpen(true);
  }

  if (collapsed) {
    return (
      <>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={!!anchor}
          aria-label={group.label}
          title={group.label}
          onClick={(e) => {
            const el = e.currentTarget;
            setAnchor((a) => (a ? null : el));
          }}
          className={[ROW, 'w-10 justify-center self-center', active || anchor ? current : idle].join(' ')}
        >
          <Icon className={ICON} strokeWidth={1.9} aria-hidden />
        </button>
        {anchor ? <GroupFlyout group={group} anchor={anchor} onClose={() => setAnchor(null)} /> : null}
      </>
    );
  }

  return (
    <div className="flex min-h-0 shrink flex-col">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={[ROW, 'gap-3 px-3 text-left', active && !open ? 'font-medium text-text' : idle].join(' ')}
      >
        <Icon className={ICON} strokeWidth={1.9} aria-hidden />
        <span className="min-w-0 flex-1 truncate">{group.label}</span>
        <ChevronDown
          className={['size-4 shrink-0 text-faint transition-transform duration-150', open ? '' : '-rotate-90'].join(' ')}
          aria-hidden
        />
      </button>
      {open ? (
        <div className="ms-[21px] flex flex-col gap-0.5 border-s border-hairline ps-2 pt-0.5">
          {group.children.map(({ to, label, icon: ChildIcon, end, title }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              title={title ?? label}
              className={({ isActive }) =>
                [
                  'flex h-[clamp(30px,4.2vh,36px)] items-center gap-2.5 rounded-[7px] px-2.5 text-[13px] transition-[color,background-color] duration-150',
                  isActive ? current : idle,
                ].join(' ')
              }
            >
              <ChildIcon className="size-4 shrink-0" strokeWidth={1.9} aria-hidden />
              <span className="truncate">{label}</span>
            </NavLink>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function RailSidebar({
  homeTo,
  homeLabel,
  items,
  storageKey,
  ariaLabel = 'Primary',
  alwaysVisible = false,
}: {
  homeTo: string;
  homeLabel: string;
  items: RailEntry[];
  storageKey: string;
  ariaLabel?: string;
  /** Keep the rail on phones too (as icons), for shells with no bottom bar. */
  alwaysVisible?: boolean;
}) {
  const [saved, setSaved] = useState(() => readCollapsed(storageKey));
  const narrow = useNarrow(alwaysVisible);
  const collapsed = narrow || saved;

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, saved ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, [saved, storageKey]);

  const rowLayout = collapsed ? 'w-10 justify-center self-center' : 'gap-3 px-3';

  return (
    <aside
      data-collapsed={collapsed || undefined}
      aria-label={ariaLabel === 'Primary' ? undefined : ariaLabel}
      className={[
        'sticky top-0 h-[100dvh] shrink-0 self-start flex-col overflow-hidden border-r border-hairline bg-surface transition-[width] duration-200 ease-[cubic-bezier(0.2,0,0,1)] motion-reduce:transition-none',
        alwaysVisible ? 'flex' : 'hidden md:flex',
        collapsed ? (narrow ? 'w-[60px]' : 'w-[72px]') : 'w-[216px]',
      ].join(' ')}
    >
      <div className={['flex h-16 w-full shrink-0 items-center sm:h-[72px]', collapsed ? 'justify-center' : 'px-5'].join(' ')}>
        <Link
          to={homeTo}
          className="flex items-center rounded-[6px] text-text transition-[opacity,transform] duration-150 hover:opacity-80 active:scale-[0.97]"
          aria-label={homeLabel}
        >
          {collapsed ? (
            <ChmMark className="size-8 text-[hsl(var(--signature))]" />
          ) : (
            <ChmWordmarkOption2 className="h-auto w-[5.25rem]" />
          )}
        </Link>
      </div>

      <nav
        className={['flex min-h-0 flex-1 flex-col justify-evenly overflow-hidden py-2', collapsed ? 'px-2' : 'px-3'].join(' ')}
        aria-label={ariaLabel}
      >
        {items.map((entry) =>
          isGroup(entry) ? (
            <GroupRow key={entry.id} group={entry} collapsed={collapsed} />
          ) : (
            <NavLink
              key={entry.to}
              to={entry.to}
              end={entry.end}
              title={entry.title ?? entry.label}
              aria-label={collapsed ? (entry.title ?? entry.label) : undefined}
              className={({ isActive }) => [ROW, rowLayout, isActive ? current : idle].join(' ')}
            >
              <entry.icon className={ICON} strokeWidth={1.9} aria-hidden />
              {collapsed ? null : <span className="truncate">{entry.label}</span>}
            </NavLink>
          ),
        )}
      </nav>

      <div className={['flex shrink-0 flex-col gap-1 pb-4 pt-2', collapsed ? 'px-2' : 'px-3'].join(' ')}>
        {narrow ? null : (
          <button
            type="button"
            onClick={() => setSaved((c) => !c)}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className={[ROW, rowLayout, 'text-left text-muted2 hover:bg-surface-2 hover:text-text'].join(' ')}
          >
            {collapsed ? (
              <PanelLeftOpen className={ICON} strokeWidth={1.9} aria-hidden />
            ) : (
              <>
                <PanelLeftClose className={ICON} strokeWidth={1.9} aria-hidden />
                Collapse
              </>
            )}
          </button>
        )}
      </div>
    </aside>
  );
}

