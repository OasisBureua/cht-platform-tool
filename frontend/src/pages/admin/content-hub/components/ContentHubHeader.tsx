// Local top bar for Reporting (campaign report) pages. Replaces the report generator's
// AppShell chrome. Shows the "Reporting" title + ThemeToggle. (Report document VIEWERS
// keep their own dark toolbars and do not render this header.)
import { Link } from 'react-router-dom';
import ThemeToggle from '../../../../components/ThemeToggle';
import { LogoMark } from './Logo';

export default function ContentHubHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-3">
        <Link to="/admin/content-hub" className="flex items-center gap-2.5">
          <LogoMark size={26} color="#3da4c0" />
          <div className="leading-tight">
            <div className="text-sm font-semibold text-foreground">Reporting</div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Campaign Reports
            </div>
          </div>
        </Link>
        <ThemeToggle />
      </div>
    </header>
  );
}
