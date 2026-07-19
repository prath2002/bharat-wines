"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Role } from '@/types/auth';

type NavLink = {
  href: string;
  label: string;
  muted?: boolean;
  /** When set, the link is only visible to these roles. */
  roles?: Role[];
};

const FINANCE_ROLES = [Role.ADMIN, Role.FINANCE];

export function Sidebar() {
  const pathname = usePathname();
  const role = useAuthStore((state) => state.user?.role);

  const links: NavLink[] = [
    { href: '/', label: 'Dashboard' },
    { href: '/sale', label: 'Sale Scanner' },
    { href: '/tp', label: 'TP Receipts' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/products', label: 'Products' },
    { href: '/finance/bills', label: 'Bills' },
    { href: '/finance', label: 'Finance', roles: FINANCE_ROLES },
    { href: '/imports', label: 'Imports', muted: true },
    { href: '/movements', label: 'Movements', muted: true },
    { href: '/reports', label: 'Reports' },
    { href: '/scm', label: 'State Excise (SCM)' },
  ];

  const visibleLinks = links.filter(
    (link) => !link.roles || (role && link.roles.includes(role))
  );

  return (
    <aside className="w-64 bg-secondary/30 backdrop-blur-md border-r border-border/50 text-foreground min-h-screen hidden md:flex flex-col">
      <div className="p-6 text-2xl font-heading font-bold border-b border-border/50 tracking-tight flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_15px_var(--color-primary)]"></div>
        Cask & Cellar
      </div>
      <nav className="p-4 space-y-1.5 flex-1">
        {visibleLinks.map((link) => {
          const isActive =
            pathname === link.href ||
            (link.href !== '/' &&
              pathname?.startsWith(link.href) &&
              // Don't light up "Finance" while browsing /finance/bills
              !(link.href === '/finance' && pathname?.startsWith('/finance/bills')));

          return (
            <Link
              key={link.href}
              href={link.href}
              className={`block p-2.5 rounded-lg transition-all font-medium text-sm ${
                isActive
                  ? 'bg-primary/10 text-primary hover:bg-primary/20 shadow-[inset_2px_0_0_var(--color-primary)]'
                  : `hover:bg-primary/10 hover:text-primary ${link.muted ? 'text-muted-foreground' : ''}`
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
