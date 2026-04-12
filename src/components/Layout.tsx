import { useState, useEffect, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { AppState, crudAction } from '@/data/store';
import QRScanner from '@/components/QRScanner';
import { useAuth } from '@/data/auth';

export type Page = 'catalog' | 'nomenclature' | 'assembly' | 'warehouse' | 'receipts' | 'technician' | 'partners' | 'history' | 'settings' | 'dashboard' | 'inventory' | 'labels' | 'audit';

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
  const { user: authUser, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  const lowStockItems = state.items.filter(i => i.quantity <= i.lowStockThreshold);
  const recentOps = state.operations
    .slice()
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);
  const notifCount = lowStockItems.length;

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setNotifOpen(false);
    };
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

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
    onStateChange(next); crudAction('update_setting', { key: 'darkMode', value: String(!state.darkMode) });
  };

  const lowStockCount = state.items.filter(i => i.quantity <= i.lowStockThreshold).length;
  const activeOrdersCount = (state.workOrders || []).filter(o => ['active', 'draft', 'pending_stock'].includes(o.status)).length;

  const navItems: { id: Page; label: string; icon: string; badge?: number; badgeColor?: string }[] = [
    { id: 'catalog',       label: 'Каталог',         icon: 'LayoutGrid',  badge: lowStockCount > 0 ? lowStockCount : undefined, badgeColor: 'destructive' },
    { id: 'assembly',      label: 'Сборка',          icon: 'PackageCheck', badge: activeOrdersCount > 0 ? activeOrdersCount : undefined, badgeColor: 'blue' },
    { id: 'warehouse',     label: 'Склады',          icon: 'Map' },
    { id: 'receipts',      label: 'Приёмка',         icon: 'PackagePlus' },
    { id: 'dashboard',     label: 'Аналитика',       icon: 'BarChart3' },
    { id: 'nomenclature',  label: 'Номенклатура',    icon: 'List' },
    { id: 'inventory',     label: 'Инвентаризация',  icon: 'ClipboardCheck' },
    { id: 'technician',    label: 'Техник',           icon: 'Wrench' },
    { id: 'partners',      label: 'Партнёры',        icon: 'Users2' },
    { id: 'history',       label: 'История',         icon: 'History' },
    { id: 'labels',        label: 'Этикетки',        icon: 'Printer' },
    { id: 'audit',         label: 'Аудит-лог',       icon: 'Shield' },
    { id: 'settings',      label: 'Настройки',       icon: 'Settings' },
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
            <div ref={notifRef} className="relative">
              <button onClick={() => setNotifOpen(!notifOpen)}
                className="relative w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                title="Уведомления">
                <Icon name="Bell" size={16} />
                {notifCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-destructive ring-2 ring-card" />
                )}
              </button>
              {notifOpen && (
                <div className="absolute right-0 top-10 w-80 bg-card rounded-xl border border-border shadow-lg z-50 overflow-hidden animate-fade-in">
                  <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                    <span className="font-semibold text-sm">Уведомления</span>
                    {notifCount > 0 && <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/15 text-destructive font-bold">{notifCount}</span>}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {lowStockItems.length > 0 && (
                      <div className="px-4 py-2">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Icon name="AlertTriangle" size={11} className="text-warning" />Низкий остаток
                        </div>
                        {lowStockItems.slice(0, 5).map(item => (
                          <div key={item.id} className="flex items-center justify-between py-1.5 text-sm">
                            <span className="truncate text-foreground">{item.name}</span>
                            <span className={`font-bold tabular-nums shrink-0 ml-2 ${item.quantity === 0 ? 'text-destructive' : 'text-warning'}`}>
                              {item.quantity} {item.unit}
                            </span>
                          </div>
                        ))}
                        {lowStockItems.length > 5 && (
                          <div className="text-xs text-muted-foreground mt-1">и ещё {lowStockItems.length - 5}...</div>
                        )}
                      </div>
                    )}
                    {recentOps.length > 0 && (
                      <div className="px-4 py-2 border-t border-border">
                        <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                          <Icon name="ArrowUpDown" size={11} />Последние операции
                        </div>
                        {recentOps.map(op => {
                          const it = state.items.find(i => i.id === op.itemId);
                          return (
                            <div key={op.id} className="flex items-center gap-2 py-1.5 text-sm">
                              <span className={`text-xs font-bold ${op.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                                {op.type === 'in' ? '+' : '−'}{op.quantity}
                              </span>
                              <span className="truncate text-foreground">{it?.name || '—'}</span>
                              <span className="text-xs text-muted-foreground shrink-0 ml-auto">{new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {lowStockItems.length === 0 && recentOps.length === 0 && (
                      <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                        <Icon name="BellOff" size={20} className="mx-auto mb-2 opacity-40" />
                        Нет уведомлений
                      </div>
                    )}
                  </div>
                  <button onClick={() => { setNotifOpen(false); onPageChange('settings'); }}
                    className="w-full px-4 py-2.5 border-t border-border text-xs text-primary hover:bg-muted/50 font-medium transition-colors">
                    Настроить уведомления
                  </button>
                </div>
              )}
            </div>
            <button onClick={toggleDark}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-all">
              <Icon name={state.darkMode ? 'Sun' : 'Moon'} size={15} />
            </button>
            <div className="hidden sm:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted text-sm font-medium text-muted-foreground">
                <Icon name="User" size={13} />
                <span className="max-w-24 truncate">{authUser?.displayName || state.currentUser}</span>
                {authUser?.role === 'admin' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-semibold">Админ</span>}
                {authUser?.role === 'warehouse' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-500/15 text-green-600 dark:text-green-400 font-semibold">Склад</span>}
                {authUser?.role === 'viewer' && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted-foreground/15 text-muted-foreground font-semibold">Просмотр</span>}
              </div>
              <button onClick={() => logout()} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors" title="Выйти">
                <Icon name="LogOut" size={16} />
              </button>
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
            <button onClick={() => navigate('catalog')} className="ml-auto text-destructive/70 hover:text-destructive text-xs underline underline-offset-2">
              Посмотреть
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 pb-24 xl:pb-6 relative">
        {/* Floating objects — catalog only */}
        {activePage === 'catalog' && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
            {([
              { s: 90,  x: 2,   y: 3,   d: 0,   dr: 7.0, r: 14,  t: 'box'      },
              { s: 54,  x: 79,  y: 2,   d: 1.2, dr: 5.8, r: -18, t: 'box'      },
              { s: 110, x: 87,  y: 42,  d: 0.5, dr: 8.2, r: 28,  t: 'box'      },
              { s: 46,  x: 48,  y: 70,  d: 2.1, dr: 5.0, r: -10, t: 'box'      },
              { s: 72,  x: 12,  y: 55,  d: 0.9, dr: 7.4, r: 22,  t: 'box'      },
              { s: 50,  x: 64,  y: 12,  d: 1.7, dr: 6.1, r: -32, t: 'box'      },
              { s: 120, x: 34,  y: 26,  d: 0.3, dr: 9.0, r: 8,   t: 'box'      },
              { s: 40,  x: 91,  y: 20,  d: 2.6, dr: 5.3, r: 44,  t: 'box'      },
              { s: 62,  x: 22,  y: 78,  d: 1.4, dr: 7.6, r: -16, t: 'box'      },
              { s: 38,  x: 73,  y: 78,  d: 0.7, dr: 4.7, r: 26,  t: 'box'      },
              { s: 78,  x: 52,  y: 38,  d: 1.9, dr: 6.5, r: -4,  t: 'box'      },
              { s: 52,  x: 1,   y: 40,  d: 0.1, dr: 8.8, r: 38,  t: 'box'      },
              { s: 64,  x: 43,  y: 88,  d: 0.6, dr: 7.2, r: 16,  t: 'shelf'    },
              { s: 48,  x: 6,   y: 20,  d: 1.5, dr: 6.0, r: -8,  t: 'shelf'    },
              { s: 56,  x: 58,  y: 60,  d: 2.3, dr: 8.5, r: 5,   t: 'barcode'  },
              { s: 44,  x: 17,  y: 8,   d: 0.8, dr: 5.5, r: -25, t: 'barcode'  },
              { s: 50,  x: 95,  y: 60,  d: 1.1, dr: 7.8, r: 20,  t: 'arrow'    },
              { s: 40,  x: 30,  y: 48,  d: 2.8, dr: 6.3, r: -40, t: 'arrow'    },
              { s: 58,  x: 68,  y: 86,  d: 0.4, dr: 9.2, r: 12,  t: 'tag'      },
              { s: 42,  x: 8,   y: 88,  d: 1.8, dr: 5.2, r: -30, t: 'tag'      },
            ] as {s:number;x:number;y:number;d:number;dr:number;r:number;t:string}[]).map((b, i) => {
              const op = 0.13;
              let svgContent: React.ReactNode;
              if (b.t === 'box') {
                svgContent = <>
                  <rect x="4" y="17" width="32" height="21" rx="2" fill="#6366f1"/>
                  <path d="M4 17 L20 8 L36 17 L20 26 Z" fill="#818cf8"/>
                  <path d="M36 17 L36 38 L20 32 L20 26 Z" fill="#4338ca"/>
                  <line x1="4"  y1="27.5" x2="36" y2="27.5" stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
                  <line x1="20" y1="17"   x2="20" y2="38"   stroke="white" strokeWidth="1.5" strokeOpacity="0.4"/>
                </>;
              } else if (b.t === 'shelf') {
                svgContent = <>
                  <rect x="2"  y="32" width="36" height="4" rx="1" fill="#6366f1"/>
                  <rect x="2"  y="18" width="36" height="4" rx="1" fill="#6366f1"/>
                  <rect x="2"  y="4"  width="36" height="4" rx="1" fill="#6366f1"/>
                  <rect x="2"  y="4"  width="3"  height="32" rx="1" fill="#4338ca"/>
                  <rect x="35" y="4"  width="3"  height="32" rx="1" fill="#4338ca"/>
                  <rect x="8"  y="22" width="8"  height="10" rx="1" fill="#818cf8"/>
                  <rect x="20" y="22" width="6"  height="10" rx="1" fill="#818cf8"/>
                  <rect x="10" y="8"  width="10" height="10" rx="1" fill="#818cf8"/>
                </>;
              } else if (b.t === 'barcode') {
                svgContent = <>
                  <rect x="2"  y="6"  width="3" height="28" fill="#4338ca"/>
                  <rect x="7"  y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="11" y="6"  width="4" height="28" fill="#4338ca"/>
                  <rect x="17" y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="21" y="6"  width="3" height="28" fill="#4338ca"/>
                  <rect x="26" y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="30" y="6"  width="4" height="28" fill="#4338ca"/>
                  <rect x="36" y="6"  width="2" height="28" fill="#6366f1"/>
                  <rect x="2"  y="36" width="36" height="3"  rx="1" fill="#818cf8"/>
                </>;
              } else if (b.t === 'arrow') {
                svgContent = <>
                  <circle cx="20" cy="20" r="17" fill="#6366f1"/>
                  <path d="M20 10 L20 28 M12 21 L20 30 L28 21" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
                </>;
              } else {
                svgContent = <>
                  <rect x="4"  y="4"  width="32" height="32" rx="4" fill="#6366f1"/>
                  <rect x="10" y="2"  width="20" height="6"  rx="2" fill="#818cf8"/>
                  <line x1="9"  y1="14" x2="31" y2="14" stroke="white" strokeWidth="2" strokeOpacity="0.5"/>
                  <line x1="9"  y1="20" x2="25" y2="20" stroke="white" strokeWidth="2" strokeOpacity="0.5"/>
                  <line x1="9"  y1="26" x2="28" y2="26" stroke="white" strokeWidth="2" strokeOpacity="0.5"/>
                </>;
              }
              return (
                <div key={i} style={{
                  position: 'absolute',
                  left: `${b.x}%`, top: `${b.y}%`,
                  width: b.s, height: b.s,
                  animation: `catalogFloat ${b.dr}s ease-in-out ${b.d}s infinite`,
                  rotate: `${b.r}deg`,
                  opacity: op,
                }}>
                  <svg viewBox="0 0 40 40" fill="none" width={b.s} height={b.s}>
                    {svgContent}
                  </svg>
                </div>
              );
            })}
            <style>{`
              @keyframes catalogFloat {
                0%,100% { translate: 0 0px;   }
                50%     { translate: 0 -22px; }
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