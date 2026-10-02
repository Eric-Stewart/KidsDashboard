"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  CalendarDays,
  ChartNoAxesCombined,
  Settings2,
  LockKeyhole,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
export function Shell({
  children,
  demo,
  logout,
}: {
  children: React.ReactNode;
  demo: boolean;
  logout: () => Promise<void>;
}) {
  const pathname = usePathname();
  const nav = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/calendar", label: "Calendar", icon: CalendarDays },
    { href: "/grades", label: "Grades", icon: ChartNoAxesCombined },
    { href: "/settings", label: "Settings", icon: Settings2 },
  ];
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link href="/dashboard" className="brand">
          <span className="brand-mark">
            <BookOpen size={22} />
          </span>
          <span>
            Family<span className="brand-sub">SCHOOL DASHBOARD</span>
          </span>
        </Link>
        <form className="mobile-sign-out" action={logout}>
          <button aria-label="Sign out">
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        </form>
        <div className="sidebar-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn("nav-item", pathname === item.href && "active")}
              aria-current={pathname === item.href ? "page" : undefined}
            >
              <item.icon size={19} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="family-pair">
            <span className="avatar e">Eric</span>
            <span className="avatar a">Ada</span>
            <div>
              <strong>Our family</strong>
              <span>One school day at a time</span>
            </div>
          </div>
          <div className="private-label">
            <LockKeyhole size={14} /> Private family workspace
          </div>
          <form action={logout}>
            <button className="sign-out">
              <LogOut size={15} /> Sign out
            </button>
          </form>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <span className="topbar-title">A little more in the loop.</span>
          <span className="topbar-right">
            <span className="private-tag">
              <LockKeyhole size={13} /> Private
            </span>
            <span className="parent-avatar">P</span>
          </span>
        </header>
        {demo && (
          <div className="demo-banner">
            <span className="demo-dot" />
            <strong>Sample preview</strong>
            <span>Fictional school data. Accounts are not connected.</span>
            <Link href="/settings">View setup</Link>
          </div>
        )}
        <main id="main" className="main-content">
          {children}
        </main>
        <footer className="workspace-footer">
          <BookOpen size={14} /> Family School{" "}
          <span>School dates & times in Eastern Time</span>
        </footer>
      </div>
    </div>
  );
}
