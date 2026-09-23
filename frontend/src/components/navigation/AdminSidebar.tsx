import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import ChmWordmarkOption2 from '../brand/ChmWordmarkOption2';
import {
  ADMIN_NAV_ITEMS,
  adminNavGroupIsActive,
  isAdminNavGroup,
  type AdminNavGroup,
  type AdminNavLeaf,
} from './adminNavItems';

function LeafNavLink({ item }: { item: AdminNavLeaf }) {
  const { to, label, icon: Icon, iconTone, end } = item;
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'flex w-full flex-col items-center justify-center gap-1 rounded-[6px] px-1.5 py-2.5 text-center transition',
          isActive
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-primary dark:hover:text-primary',
        ].join(' ')
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            className={isActive ? 'h-6 w-6 shrink-0' : `h-6 w-6 shrink-0 ${iconTone}`}
            strokeWidth={2}
            aria-hidden
          />
          <span className="max-w-full px-0.5 text-[11px] font-semibold leading-snug [overflow-wrap:anywhere]">
            {label}
          </span>
        </>
      )}
    </NavLink>
  );
}

function ToolsNavGroup({ group }: { group: AdminNavGroup }) {
  const location = useLocation();
  const groupActive = adminNavGroupIsActive(group, location.pathname);
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setOpen(false);
  }, [location.pathname]);

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) {
      setMenuPos(null);
      return;
    }
    const update = () => {
      const rect = buttonRef.current?.getBoundingClientRect();
      if (!rect) return;
      setMenuPos({
        top: Math.max(8, rect.top),
        left: rect.right + 8,
      });
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const Icon = group.icon;
  const highlighted = groupActive || open;

  return (
    <div className="relative w-full">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        aria-controls="admin-tools-menu"
        onClick={() => setOpen((v) => !v)}
        className={[
          'flex w-full flex-col items-center justify-center gap-1 rounded-[6px] px-1.5 py-2.5 text-center transition',
          highlighted
            ? 'bg-primary/10 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-primary dark:hover:text-primary',
        ].join(' ')}
      >
        <Icon
          className={highlighted ? 'h-6 w-6 shrink-0' : `h-6 w-6 shrink-0 ${group.iconTone}`}
          strokeWidth={2}
          aria-hidden
        />
        <span className="inline-flex max-w-full items-center justify-center gap-0.5 px-0.5 text-[11px] font-semibold leading-snug">
          {group.label}
          <ChevronRight
            className={[
              'h-3 w-3 shrink-0 opacity-70 transition-transform duration-200',
              open ? 'translate-x-0.5' : '',
            ].join(' ')}
            aria-hidden
          />
        </span>
      </button>

      {open && menuPos
        ? createPortal(
            <div
              ref={menuRef}
              id="admin-tools-menu"
              role="menu"
              aria-label="Tools"
              style={{ top: menuPos.top, left: menuPos.left }}
              className="fixed z-[60] w-56 overflow-hidden rounded-card border border-border/90 bg-card p-1.5 shadow-[0_1px_0_rgba(0,0,0,0.04),0_16px_40px_-18px_rgba(0,0,0,0.2)] dark:shadow-[0_1px_0_rgba(255,255,255,0.04)_inset,0_16px_40px_-18px_rgba(0,0,0,0.55)]"
            >
              <p className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Tools
              </p>
              {group.children.map((child) => {
                const ChildIcon = child.icon;
                return (
                  <NavLink
                    key={child.to}
                    to={child.to}
                    end={child.end}
                    role="menuitem"
                    onClick={() => setOpen(false)}
                    className={({ isActive }) =>
                      [
                        'flex min-h-[44px] items-center gap-2.5 rounded-[6px] px-3 text-sm font-medium transition-[background-color,color] duration-200',
                        isActive
                          ? 'bg-primary/10 text-primary'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
                      ].join(' ')
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <ChildIcon
                          className={
                            isActive ? 'h-4 w-4 shrink-0' : `h-4 w-4 shrink-0 ${child.iconTone}`
                          }
                          strokeWidth={2}
                          aria-hidden
                        />
                        <span className="truncate">{child.label}</span>
                      </>
                    )}
                  </NavLink>
                );
              })}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

export default function AdminSidebar() {
  return (
    <aside
      className="sticky top-0 flex h-[100dvh] max-h-[100dvh] w-[88px] shrink-0 flex-col self-start overflow-y-auto overflow-x-hidden border-r border-gray-200/80 bg-card sm:w-[120px] dark:border-border"
      aria-label="Admin sidebar"
    >
      <div className="flex h-[82px] w-full shrink-0 items-center justify-center">
        <Link to="/admin" className="flex h-full w-full items-center justify-center">
          <ChmWordmarkOption2 className="h-auto w-[4.5rem]" />
        </Link>
      </div>

      <nav className="flex flex-col items-center gap-2.5 px-1.5 pb-4 pt-2">
        {ADMIN_NAV_ITEMS.map((entry) =>
          isAdminNavGroup(entry) ? (
            <ToolsNavGroup key={entry.id} group={entry} />
          ) : (
            <LeafNavLink key={`${entry.to}-${entry.label}`} item={entry} />
          ),
        )}
      </nav>
    </aside>
  );
}
