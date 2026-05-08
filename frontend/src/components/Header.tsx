import { Github, Moon, Package, Sun } from 'lucide-react';

import { useTheme } from '@/hooks/useTheme';

interface HeaderProps {
  onOpenBatch: () => void;
}

export function Header({ onOpenBatch }: HeaderProps) {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <header className="border-border bg-background/80 sticky top-0 z-30 backdrop-blur">
      <div className="border-border mx-auto flex max-w-7xl items-center justify-between gap-4 border-b px-6 py-3">
        <div className="flex items-baseline gap-3">
          <span className="font-display text-foreground text-[18px] font-[700] tracking-tight">
            Tessera
          </span>
          <span className="text-muted-foreground font-mono text-[10px] uppercase tracking-wider">
            self-hosted · v0.1
          </span>
        </div>

        <nav className="text-muted-foreground hidden items-center gap-5 font-mono text-[11px] tracking-wide md:flex">
          <a
            href="/api/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            /api/docs
          </a>
          <a
            href="https://github.com/nikiomori/tessera"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            github
          </a>
        </nav>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenBatch}
            className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs transition-colors"
          >
            <Package className="h-3.5 w-3.5" />
            Batch
          </button>
          <a
            href="https://github.com/nikiomori/tessera"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded transition-colors md:hidden"
          >
            <Github className="h-3.5 w-3.5" />
          </a>
          <button
            type="button"
            onClick={toggle}
            aria-label={isDark ? 'Light theme' : 'Dark theme'}
            className="text-muted-foreground hover:text-foreground hover:bg-muted inline-flex h-8 w-8 items-center justify-center rounded transition-colors"
          >
            {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </header>
  );
}
