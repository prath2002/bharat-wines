"use client";

import { useEffect, useRef, useState } from "react";
import { LogOut } from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuthStore } from "@/store/auth-store";
import { useAuth } from "@/hooks/use-auth";

export function Header() {
  const user = useAuthStore((state) => state.user);
  const { logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const initial = user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? "A";

  return (
    <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/50 h-16 flex items-center px-6 justify-between shadow-sm transition-all">
      <h1 className="text-xl font-heading font-semibold md:hidden text-foreground">Bharat Wines</h1>
      <div className="hidden md:block"></div>
      <div className="flex items-center space-x-4">
        <ThemeToggle />
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-medium text-sm border border-primary/30 shadow-[0_0_10px_var(--color-primary)] cursor-pointer"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
          >
            {initial}
          </button>
          {isMenuOpen && (
            <div
              role="menu"
              className="absolute right-0 mt-2 w-56 rounded-lg border border-border/50 bg-popover text-popover-foreground shadow-lg overflow-hidden"
            >
              <div className="px-3 py-2 border-b border-border/50">
                <p className="text-sm font-medium truncate">{user?.name || "Account"}</p>
                <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setIsMenuOpen(false);
                  logout();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
