"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const navItems = [
  { href: "/", label: "Dashboard" },
  { href: "/settings", label: "Settings" },
  { href: "/account", label: "Account" },
  { href: "/changelog", label: "Changelog" },
];

function titleForPath(pathname: string) {
  if (pathname === "/") return "Dashboard";
  if (pathname === "/settings") return "Settings";
  if (pathname === "/account") return "Account";
  if (pathname === "/changelog") return "Changelog";
  return "Valet Dashboard";
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  const title = useMemo(() => titleForPath(pathname), [pathname]);

  return (
    <div className={`shell ${collapsed ? "shell-collapsed" : ""}`}>
      <button
        className={`shell-backdrop ${mobileOpen ? "shell-backdrop-open" : ""}`}
        type="button"
        aria-label="Close sidebar"
        onClick={() => setMobileOpen(false)}
      />

      <aside className={`sidebar ${mobileOpen ? "sidebar-open" : ""}`}>
        <div className="sidebar-top">
          <div className="brand">
            <div className="brand-mark" aria-hidden="true">
              V
            </div>
            <div className="brand-copy">
              <strong>Valet Ops</strong>
            </div>
          </div>

          <div className="sidebar-actions">
            <button
              className="sidebar-toggle"
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <img
                className={`sidebar-toggle-icon ${collapsed ? "sidebar-toggle-icon-collapsed" : ""}`}
                src="/valet-stand/icons/left-arrow-svgrepo-com.svg"
                alt=""
                aria-hidden="true"
              />
            </button>
            <button
              className="sidebar-toggle mobile-only"
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close sidebar"
            >
              x
            </button>
          </div>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`nav-link ${active ? "nav-link-active" : ""}`}
              >
                <span className="nav-label">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* <div className="sidebar-footer">
          <div className="sidebar-card">
            <span className="sidebar-card-label">Mode</span>
            <strong>Local-first</strong>
            <p>Ready for storage and auth later.</p>
          </div>
        </div> */}
      </aside>

      <div className="shell-main">
        <header className="shell-header">
          <button
            className="mobile-menu-button"
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open sidebar"
          >
            Menu
          </button>
        </header>

        <div className="shell-content">{children}</div>
      </div>
    </div>
  );
}
