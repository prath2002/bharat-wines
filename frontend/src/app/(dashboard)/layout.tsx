"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth-store';
import { Sidebar } from '@/components/layout/sidebar';
import { Header } from '@/components/layout/header';
import { MobileNav } from '@/components/layout/mobile-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (!isAuthenticated && !token) {
      router.push('/login');
    }
  }, [isAuthenticated, router]);

  // Prevent hydration mismatch or flash of content
  if (!isMounted) {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>;
  }
  
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (!isAuthenticated && !token) {
    return <div className="flex h-screen w-full items-center justify-center">Redirecting to login...</div>;
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-background pb-16 md:pb-0">
          {children}
        </main>
        <MobileNav />
      </div>
    </div>
  );
}
