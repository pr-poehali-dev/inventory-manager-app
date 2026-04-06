import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { AppState, saveState } from '@/data/store';
import QRScanner from '@/components/QRScanner';

export type Page = 'catalog' | 'nomenclature' | 'assembly' | 'warehouse' | 'receipts' | 'technician' | 'partners' | 'history' | 'settings';

type LayoutProps = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  activePage: Page;
  onPageChange: (p: Page) => void;
  children: React.ReactNode;
};

export default function Layout({ state, onStateChange, activePage, onPageChange, children, onQRResult }: LayoutProps & {
  onQRResult?: (type: string, id: string) => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.darkMode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
  }, [state.darkMode]);

  // Close "More" popup on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggleDark = () => {
    const next = { ...state, darkMode: !state.darkMode };
    onStateChange(next); saveState(next);
  };

  const lowStockCount = state.items.filter(i => i.quantity <= i.lowStockThreshold).length;
  const activeOrdersCount = (state.workOrders || []).filter(o => ['active', 'draft', 'pending_stock'].includes(o.status)).length;

  const navItems: { id: Page; label: string; icon: string; badge?: number; badgeColor?: string }[] = [
    { id: 'catalog',       label: 'Каталог',        icon: 'LayoutGrid',  badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'destructive' },
    { id: 'nomenclature',  label: 'Номенклатура',    icon: 'List' },
    { id: 'assembly',      label: 'Сборка',           icon: 'PackageCheck', badge: activeOrdersCount > 0 ? activeOrdersCount : undefined, badgeColor: 'blue' },
    { id: 'warehouse',     label: 'Карта складов',    icon: 'Map' },
    { id: 'receipts',      label: 'Оприходование',   icon: 'PackagePlus' },
    { id: 'technician',    label: 'Техник',           icon: 'Wrench' },
    { id: 'partners',      label: 'Партнёры',         icon: 'Users2' },
    { id: 'history',       label: 'История',          icon: 'History' },
    { id: 'settings',      label: 'Настройки',        icon: 'Settings' },
  ];

  // Mobile bottom nav — 4 primary + "Ещё" button
  const mobileNavPrimary = navItems.slice(0, 4);
  const mobileNavMore = navItems.slice(4);

  // "Ещё" is active if current page is in the "more" group
  const moreIsActive = mobileNavMore.some(n => n.id === activePage);

  const navigate = (page: Page) => {
    onPageChange(page);
    setMobileMenuOpen(false);
    setMoreMenuOpen(false);
  };

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
              <button key={n.id} onClick={() => navigate(n.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all
                  ${activePage === n.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Icon name={n.icon} size={14} />
                {n.label}
                {n.badge !== undefined && (
                  <span className={`ml-0.5 text-[11px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none
                    ${n.badgeColor === 'blue' ? 'bg-blue-500 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                    {n.badge > 9 ? '9+' : n.badge}
                  </span>
                )}
              </button>
            ))}
          </nav>

          {/* Right */}
          <div className="flex items-center gap-2 shrink-0">
            {/* QR Scanner button */}
            <button onClick={() => setQrOpen(true)}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
              title="Сканировать QR-код">
              <Icon name="ScanLine" size={16} />
            </button>
            <button onClick={toggleDark}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <Icon name={state.darkMode ? 'Sun' : 'Moon'} size={15} />
            </button>
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-sm font-medium text-muted-foreground">
              <Icon name="User" size={13} />
              <span className="max-w-20 truncate">{state.currentUser}</span>
            </div>
            {/* Hamburger for tablet (shown between sm and xl) */}
            <button className="xl:hidden w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:bg-muted"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
              <Icon name={mobileMenuOpen ? 'X' : 'Menu'} size={18} />
            </button>
          </div>
        </div>

        {/* Tablet dropdown menu (hamburger) — full grid */}
        {mobileMenuOpen && (
          <div className="xl:hidden border-t border-border bg-card px-3 py-2 grid grid-cols-4 sm:grid-cols-8 gap-0.5 animate-fade-in">
            {navItems.map(n => (
              <button key={n.id} onClick={() => navigate(n.id)}
                className={`relative flex flex-col items-center gap-1 px-1 py-2.5 rounded-lg text-[10px] font-medium transition-all
                  ${activePage === n.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}>
                <Icon name={n.icon} size={17} />
                <span className="leading-tight text-center">{n.label}</span>
                {n.badge !== undefined && (
                  <span className={`absolute top-1 right-0.5 text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center
                    ${n.badgeColor === 'blue' ? 'bg-blue-500 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                    {n.badge > 9 ? '9+' : n.badge}
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
            <button onClick={() => navigate('nomenclature')} className="ml-auto text-destructive/70 hover:text-destructive text-xs underline underline-offset-2">
              Посмотреть
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-24 xl:pb-6 relative">
        {/* Floating boxes — catalog only */}
        {activePage === 'catalog' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            {([
              { s: 56, x: 4,  y: 4,  d: 0,   dr: 7.0, r: 18  },
              { s: 32, x: 80, y: 3,  d: 1.2, dr: 5.8, r: -22 },
              { s: 68, x: 88, y: 45, d: 0.5, dr: 8.2, r: 32  },
              { s: 24, x: 50, y: 72, d: 2.1, dr: 5.0, r: -12 },
              { s: 42, x: 14, y: 58, d: 0.9, dr: 7.4, r: 25  },
              { s: 28, x: 66, y: 14, d: 1.7, dr: 6.1, r: -38 },
              { s: 76, x: 36, y: 30, d: 0.3, dr: 9.0, r: 10  },
              { s: 22, x: 92, y: 22, d: 2.6, dr: 5.3, r: 48  },
              { s: 36, x: 24, y: 82, d: 1.4, dr: 7.6, r: -20 },
              { s: 20, x: 74, y: 80, d: 0.7, dr: 4.7, r: 30  },
              { s: 46, x: 54, y: 42, d: 1.9, dr: 6.5, r: -5  },
              { s: 30, x: 2,  y: 42, d: 0.1, dr: 8.8, r: 42  },
            ] as {s:number;x:number;y:number;d:number;dr:number;r:number}[]).map((b, i) => (
              <div key={i} style={{
                position: 'absolute',
                left: `${b.x}%`, top: `${b.y}%`,
                width: b.s, height: b.s,
                animation: `catalogFloat ${b.dr}s ease-in-out ${b.d}s infinite`,
                rotate: `${b.r}deg`,
              }}>
                <svg viewBox="0 0 40 40" fill="none" width={b.s} height={b.s} style={{ opacity: 0.18 }}>
                  <rect x="8" y="18" width="24" height="18" rx="2" fill="#6366f1"/>
                  <path d="M8 18 L20 10 L32 18 L20 26 Z" fill="#818cf8"/>
                  <path d="M32 18 L32 36 L20 32 L20 26 Z" fill="#4338ca"/>
                  <line x1="8"  y1="27" x2="32" y2="27" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
                  <line x1="20" y1="18" x2="20" y2="36" stroke="white" strokeWidth="1.5" strokeOpacity="0.45"/>
                </svg>
              </div>
            ))}
            <style>{`
              @keyframes catalogFloat {
                0%,100% { translate: 0 0px;   }
                50%     { translate: 0 -18px; }
              }
            `}</style>
          </div>
        )}
        {children}
      </main>

      {/* QR Scanner Modal */}
      <QRScanner
        open={qrOpen}
        onClose={() => setQrOpen(false)}
        onResult={result => {
          setQrOpen(false);
          if (result.type === 'item')     { onPageChange('catalog');    onQRResult?.(result.type, result.id); }
          if (result.type === 'location') { onPageChange('warehouse');  onQRResult?.(result.type, result.id); }
          if (result.type === 'order')    { onPageChange('assembly');   onQRResult?.(result.type, result.id); }

          if (result.type === 'unknown')  { onQRResult?.(result.type, result.raw); }
        }}
      />

      {/* Mobile bottom nav — fixed, only on non-xl screens */}
      <nav className="xl:hidden fixed bottom-0 left-0 right-0 bg-card/95 border-t border-border z-40 backdrop-blur-md safe-bottom">
        <div className="flex h-16">
          {/* Primary 4 items */}
          {mobileNavPrimary.map(n => (
            <button key={n.id} onClick={() => navigate(n.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all relative
                ${activePage === n.id ? 'text-primary' : 'text-muted-foreground'}`}>
              {activePage === n.id && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <Icon name={n.icon} size={20} />
              <span className="leading-tight mt-0.5">{n.label}</span>
              {n.badge !== undefined && (
                <span className={`absolute top-2 right-[calc(50%-14px)] text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center
                  ${n.badgeColor === 'blue' ? 'bg-blue-500 text-white' : 'bg-destructive text-destructive-foreground'}`}>
                  {n.badge > 9 ? '9+' : n.badge}
                </span>
              )}
            </button>
          ))}

          {/* "Ещё" — opens popup with remaining pages */}
          <div ref={moreRef} className="relative flex-1">
            <button
              onClick={() => setMoreMenuOpen(!moreMenuOpen)}
              className={`w-full h-full flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-all relative
                ${moreIsActive ? 'text-primary' : 'text-muted-foreground'}`}
            >
              {moreIsActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary rounded-full" />
              )}
              <Icon name={moreMenuOpen ? 'X' : 'MoreHorizontal'} size={20} />
              <span className="leading-tight mt-0.5">Ещё</span>
              {/* Badge if any "more" item has a badge */}
              {mobileNavMore.some(n => n.badge) && !moreMenuOpen && (
                <span className="absolute top-2 right-[calc(50%-14px)] text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center bg-destructive text-destructive-foreground">
                  !
                </span>
              )}
            </button>

            {/* "Ещё" dropdown popup — opens upward */}
            {moreMenuOpen && (
              <div className="absolute bottom-full right-0 mb-2 w-52 bg-card border border-border rounded-2xl shadow-modal overflow-hidden animate-scale-in">
                <div className="p-1">
                  {mobileNavMore.map(n => (
                    <button
                      key={n.id}
                      onClick={() => navigate(n.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                        ${activePage === n.id ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted'}`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                        ${activePage === n.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                        <Icon name={n.icon} size={15} />
                      </div>
                      <span>{n.label}</span>
                      {n.badge !== undefined && (
                        <span className={`ml-auto text-[11px] font-bold px-1.5 py-0.5 rounded-full
                          ${n.badgeColor === 'blue' ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-destructive/15 text-destructive'}`}>
                          {n.badge}
                        </span>
                      )}
                      {activePage === n.id && <Icon name="Check" size={14} className="ml-auto text-primary" />}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </nav>
    </div>
  );
}