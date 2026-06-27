import Link from 'next/link';
import { Home, ScanLine, FileText, Package } from 'lucide-react';

export function MobileNav() {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-xl border-t border-border/50 flex justify-around p-3 pb-6 md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_-4px_20px_rgba(0,0,0,0.3)]">
      <Link href="/" className="text-muted-foreground hover:text-primary flex flex-col items-center gap-1 transition-colors">
        <Home className="w-5 h-5" />
        <span className="text-[10px] font-medium">Home</span>
      </Link>
      <Link href="/sale" className="text-primary flex flex-col items-center gap-1 -mt-4">
        <div className="bg-gradient-to-br from-primary to-primary/80 text-primary-foreground p-3 rounded-full shadow-[0_4px_15px_var(--color-primary)] border border-white/10 transition-transform active:scale-95">
          <ScanLine className="w-6 h-6" />
        </div>
        <span className="text-[10px] font-medium mt-1">Scan</span>
      </Link>
      <Link href="/tp" className="text-muted-foreground hover:text-primary flex flex-col items-center gap-1 transition-colors">
        <FileText className="w-5 h-5" />
        <span className="text-[10px] font-medium">TP</span>
      </Link>
      <Link href="/inventory" className="text-muted-foreground hover:text-primary flex flex-col items-center gap-1 transition-colors">
        <Package className="w-5 h-5" />
        <span className="text-[10px] font-medium">Stock</span>
      </Link>
    </div>
  );
}
