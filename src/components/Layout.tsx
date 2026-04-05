import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { AppState, saveState } from '@/data/store';

export type Page = 'catalog' | 'nomenclature' | 'assembly' | 'warehouse' | 'partners' | 'history' | 'settings';

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
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.darkMode]);

  const toggleDark = () => {
    const next = { ...state, darkMode: !state.darkMode };
    onStateChange(next); saveState(next);
  };

  const lowStockCount = state.items.filter(i => i.quantity <= i.lowStockThreshold).length;
  const activeOrdersCount = (state.workOrders || []).filter(o => o.status === 'active').length;

  const navItems: { id: Page; label: string; icon: string; badge?: number; badgeColor?: string }[] = [
    { id: 'catalog',       label: 'Каталог',       icon: 'LayoutGrid',  badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'destructive' },
    { id: 'nomenclature',  label: 'Номенклатура',   icon: 'List' },
    { id: 'assembly',      label: 'Сборка',          icon: 'PackageCheck', badge: activeOrdersCount > 0 ? activeOrdersCount : undefined, badgeColor: 'blue' },
    { id: 'warehouse',     label: 'Карта склада',    icon: 'Map' },
    { id: 'partners',      label: 'Партнёры',        icon: 'Users2' },
    { id: 'history',       label: 'История',         icon: 'History' },
    { id: 'settings',      label: 'Настройки',       icon: 'Settings' },
  ];

  // Mobile bottom nav — first 5 items
  const mobileNavItems = navItems.slice(0, 5);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 border-b border-border backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
          {/* Logo */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Icon name="Boxes" size={16} className="text-primary-foreground" />
            </div>
            <span className="font-bold text-base hidden sm:block tracking-tight">StockBase</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden xl:flex items-center gap-0.5 flex-1 justify-center">
            {navItems.map(n => (
              <button key={n.id} onClick={() => onPageChange(n.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${activePage === n.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Icon name={n.icon} size={14} />
                {n.label}
                {n.badge !== undefined && (
                  <span className={`ml-0.5 text-[11px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none
                    ${n.badgeColor === 'blue' ? 'bg-blue-500 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                    {n.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={toggleDark}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <Icon name={state.darkMode ? 'Sun' : 'Moon'} size={15} />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-sm font-medium text-muted-foreground">
              <Icon name="User" size={13} />
              <span className="max-w-20 truncate">{state.currentUser}</span>
            </div>
            <button className="xl:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Icon name={mobileMenuOpen ? 'X' : 'Menu'} size={18} />
            </button>
          </div>
        </div>

        {/* Tablet/mobile dropdown */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-border bg-card px-3 py-2 grid grid-cols-7 gap-1 animate-fade-in">
            {navItems.map(n => (
              <button key={n.id} onClick={() => { onPageChange(n.id); setMobileMenuOpen(false); }}
                className={`relative flex flex-col items-center gap-1 px-1 py-2.5 rounded-lg text-[10px] font-medium transition-all
                  ${activePage === n.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Icon name={n.icon} size={17} />
                <span className="leading-tight text-center">{n.id === 'warehouse' ? 'Карта' : n.label}</span>
                {n.badge !== undefined && (
                  <span className={`absolute top-1 right-0.5 text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center
                    ${n.badgeColor === 'blue' ? 'bg-blue-500 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                    {n.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* Low stock banner */}
      {lowStockCount > 0 && activePage !== 'catalog' && activePage !== 'nomenclature' && (
        <div className="bg-destructive/8 border-b border-destructive/20 px-4 py-2">
          <div className="max-w-7xl mx-auto flex items-center gap-2 text-sm">
            <Icon name="AlertTriangle" size={13} className="text-destructive shrink-0" />
            <span className="text-destructive font-medium">
              {lowStockCount} {lowStockCount === 1 ? 'товар' : lowStockCount < 5 ? 'товара' : 'товаров'} с низким остатком
            </span>
            <button onClick={() => onPageChange('nomenclature')} className="ml-auto text-destructive/70 hover:text-destructive text-xs underline underline-offset-2">
              Посмотреть
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6">
        {children}
      </main>

      {/* Mobile bottom nav */}
      <nav className="xl:hidden fixed bottom-0 left-0 right-0 bg-card/95 border-t border-border z-40 backdrop-blur-md">
        <div className="flex">
          {mobileNavItems.map(n => (
            <button key={n.id} onClick={() => onPageChange(n.id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all relative
                ${activePage === n.id ? 'text-primary' : 'text-muted-foreground'}`}>
              {activePage === n.id && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />}
              <Icon name={n.icon} size={19} />
              <span className="leading-tight">{n.label}</span>
              {n.badge !== undefined && (
                <span className={`absolute top-1.5 right-[calc(50%-12px)] text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center
                  ${n.badgeColor === 'blue' ? 'bg-blue-500 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                  {n.badge}
                </span>
              )}
            </button>
          ))}
          {/* Settings overflow on mobile */}
          <button onClick={() => onPageChange('settings')}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-all relative
              ${activePage === 'settings' ? 'text-primary' : 'text-muted-foreground'}`}>
            {activePage === 'settings' && <span className="absolute top-0 left-1/2 -translate-x-1/2 w-6 h-0.5 bg-primary rounded-full" />}
            <Icon name="Settings" size={19} />
            <span>Ещё</span>
          </button>
        </div>
      </nav>
    </div>
  );
}