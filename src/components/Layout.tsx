import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { AppState, loadState, saveState } from '@/data/store';

type Page = 'catalog' | 'history' | 'settings';

type LayoutProps = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  activePage: Page;
  onPageChange: (p: Page) => void;
  children: React.ReactNode;
};

export default function Layout({ state, onStateChange, activePage, onPageChange, children }: LayoutProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (state.darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.darkMode]);

  const toggleDark = () => {
    const next = { ...state, darkMode: !state.darkMode };
    onStateChange(next);
    saveState(next);
  };

  const lowStockCount = state.items.filter(i => i.quantity <= i.lowStockThreshold).length;

  const navItems: { id: Page; label: string; icon: string }[] = [
    { id: 'catalog', label: 'Каталог', icon: 'Package' },
    { id: 'history', label: 'История', icon: 'History' },
    { id: 'settings', label: 'Настройки', icon: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-card border-b border-border backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Icon name="Boxes" size={16} className="text-primary-foreground" />
            </div>
            <span className="font-semibold text-base tracking-tight hidden sm:block">StockBase</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map(n => (
              <button
                key={n.id}
                onClick={() => onPageChange(n.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-all duration-150
                  ${activePage === n.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
              >
                <Icon name={n.icon} size={15} />
                {n.label}
                {n.id === 'catalog' && lowStockCount > 0 && (
                  <span className="ml-0.5 bg-destructive text-destructive-foreground text-xs font-semibold rounded-full w-4 h-4 flex items-center justify-center leading-none">
                    {lowStockCount}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleDark}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Сменить тему"
            >
              <Icon name={state.darkMode ? 'Sun' : 'Moon'} size={15} />
            </button>
            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted text-sm font-medium text-muted-foreground">
              <Icon name="User" size={14} />
              <span>{state.currentUser}</span>
            </div>
            {/* Mobile menu button */}
            <button
              className="md:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <Icon name={mobileMenuOpen ? 'X' : 'Menu'} size={18} />
            </button>
          </div>
        </div>

        {/* Mobile nav */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-border bg-card px-4 py-2 flex gap-1 animate-fade-in">
            {navItems.map(n => (
              <button
                key={n.id}
                onClick={() => { onPageChange(n.id); setMobileMenuOpen(false); }}
                className={`flex-1 flex flex-col items-center gap-1 px-2 py-2.5 rounded-lg text-xs font-medium transition-all
                  ${activePage === n.id
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
              >
                <Icon name={n.icon} size={18} />
                {n.label}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Low stock banner */}
      {lowStockCount > 0 && (
        <div className="bg-destructive/8 border-b border-destructive/20 px-4 py-2.5">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
            <Icon name="AlertTriangle" size={14} className="text-destructive shrink-0" />
            <span className="text-destructive font-medium">
              {lowStockCount} {lowStockCount === 1 ? 'товар' : lowStockCount < 5 ? 'товара' : 'товаров'} с низким остатком
            </span>
            <button
              onClick={() => onPageChange('catalog')}
              className="ml-auto text-destructive/70 hover:text-destructive text-xs underline underline-offset-2"
            >
              Посмотреть
            </button>
          </div>
        </div>
      )}

      {/* Page content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border z-40">
        <div className="flex">
          {navItems.map(n => (
            <button
              key={n.id}
              onClick={() => onPageChange(n.id)}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all relative
                ${activePage === n.id ? 'text-primary' : 'text-muted-foreground'}`}
            >
              <Icon name={n.icon} size={20} />
              <span>{n.label}</span>
              {n.id === 'catalog' && lowStockCount > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-8px)] bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {lowStockCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
