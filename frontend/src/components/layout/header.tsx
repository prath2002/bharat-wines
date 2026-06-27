import { ThemeToggle } from "@/components/theme-toggle";

export function Header() {
  return (
    <header className="sticky top-0 z-40 bg-background/60 backdrop-blur-xl border-b border-border/50 h-16 flex items-center px-6 justify-between shadow-sm transition-all">
      <h1 className="text-xl font-heading font-semibold md:hidden text-foreground">Bharat Wines</h1>
      <div className="hidden md:block"></div>
      <div className="flex items-center space-x-4">
        <ThemeToggle />
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/20 text-primary font-medium text-sm border border-primary/30 shadow-[0_0_10px_var(--color-primary)]">
          A
        </div>
      </div>
    </header>
  );
}
