"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function Sidebar() {
  const pathname = usePathname();

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/sale', label: 'Sale Scanner' },
    { href: '/tp', label: 'TP Receipts' },
    { href: '/inventory', label: 'Inventory' },
    { href: '/products', label: 'Products' },
    { href: '/imports', label: 'Imports', muted: true },
    { href: '/movements', label: 'Movements', muted: true },
    { href: '/reports', label: 'Reports' },
    { href: '/scm', label: 'State Excise (SCM)' },
  ];

  return (
    <aside className="w-64 bg-secondary/30 backdrop-blur-md border-r border-border/50 text-foreground min-h-screen hidden md:flex flex-col">
      <div className="p-6 text-2xl font-heading font-bold border-b border-border/50 tracking-tight flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-[0_0_15px_var(--color-primary)]"></div>
        Cask & Cellar
      </div>
      <nav className="p-4 space-y-1.5 flex-1">
        {links.map((link) => {
          const isActive = pathname === link.href || (link.href !== '/' && pathname?.startsWith(link.href));
          
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
