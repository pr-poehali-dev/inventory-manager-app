import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { AppState, saveState, Category, Location, Warehouse, generateId } from '@/data/store';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

const CAT_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function SettingsPage({ state, onStateChange }: Props) {
  const [activeSection, setActiveSection] = useState<'profile' | 'alerts' | 'categories' | 'locations' | 'warehouses'>('profile');
  const [userName, setUserName] = useState(state.currentUser);
  const [threshold, setThreshold] = useState(String(state.defaultLowStockThreshold));
  const [saved, setSaved] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ label: string; onConfirm: () => void } | null>(null);

  // Category add
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CAT_COLORS[0]);

  // Location add
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocParent, setNewLocParent] = useState('');

  // Warehouse add
  const [newWhName, setNewWhName] = useState('');
  const [newWhAddress, setNewWhAddress] = useState('');
  const [newWhDesc, setNewWhDesc] = useState('');

  const saveProfile = () => {
    const next = { ...state, currentUser: userName, defaultLowStockThreshold: parseInt(threshold) || 5 };
    onStateChange(next);
    saveState(next);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const cat: Category = { id: generateId(), name: newCatName.trim(), color: newCatColor };
    const next = { ...state, categories: [...state.categories, cat] };
    onStateChange(next);
    saveState(next);
    setNewCatName('');
  };

  const deleteCategory = (id: string) => {
    const fallback = state.categories.find(c => c.id !== id)?.id || '';
    const next = {
      ...state,
      categories: state.categories.filter(c => c.id !== id),
      items: state.items.map(i => i.categoryId === id ? { ...i, categoryId: fallback } : i),
    };
    onStateChange(next);
    saveState(next);
  };

  const addLocation = () => {
    if (!newLocName.trim()) return;
    // Find parent's warehouseId if parentId is set, else use first warehouse
    const parentLoc = newLocParent ? state.locations.find(l => l.id === newLocParent) : null;
    const defaultWhId = (state.warehouses || [])[0]?.id;
    const loc: Location = {
      id: generateId(),
      name: newLocName.trim(),
      description: newLocDesc || undefined,
      parentId: newLocParent || undefined,
      warehouseId: parentLoc?.warehouseId || defaultWhId,
    };
    const next = { ...state, locations: [...state.locations, loc] };
    onStateChange(next);
    saveState(next);
    setNewLocName('');
    setNewLocDesc('');
    setNewLocParent('');
  };

  const deleteLocation = (id: string) => {
    const fallback = state.locations.find(l => l.id !== id)?.id || '';
    const children = state.locations.filter(l => l.parentId === id);
    const idsToRemove = [id, ...children.map(c => c.id)];
    const next = {
      ...state,
      locations: state.locations.filter(l => !idsToRemove.includes(l.id)),
      items: state.items.map(i => idsToRemove.includes(i.locationId) ? { ...i, locationId: fallback } : i),
      locationStocks: state.locationStocks.filter(ls => !idsToRemove.includes(ls.locationId)),
    };
    onStateChange(next);
    saveState(next);
  };

  const addWarehouse = () => {
    if (!newWhName.trim()) return;
    const wh: Warehouse = {
      id: generateId(), name: newWhName.trim(),
      address: newWhAddress.trim() || undefined,
      description: newWhDesc.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = { ...state, warehouses: [...(state.warehouses || []), wh] };
    onStateChange(next); saveState(next);
    setNewWhName(''); setNewWhAddress(''); setNewWhDesc('');
  };

  const deleteWarehouse = (id: string) => {
    const fallbackWh = (state.warehouses || []).find(w => w.id !== id)?.id;
    const next = {
      ...state,
      warehouses: (state.warehouses || []).filter(w => w.id !== id),
      warehouseStocks: (state.warehouseStocks || []).filter(ws => ws.warehouseId !== id),
      locations: state.locations.map(l => l.warehouseId === id ? { ...l, warehouseId: fallbackWh } : l),
    };
    onStateChange(next); saveState(next);
  };

  const sections = [
    { id: 'profile', label: 'Профиль', icon: 'User' },
    { id: 'alerts', label: 'Уведомления', icon: 'Bell' },
    { id: 'warehouses', label: 'Склады', icon: 'Warehouse' },
    { id: 'categories', label: 'Категории', icon: 'Tag' },
    { id: 'locations', label: 'Локации', icon: 'MapPin' },
  ] as const;

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Настройки</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Управление приложением</p>
      </div>

      <div className="flex flex-col md:flex-row gap-5">
        {/* Sidebar nav */}
        <div className="md:w-48 shrink-0">
          <nav className="flex md:flex-col gap-1 overflow-x-auto pb-1 md:pb-0">
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-3.5 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                  ${activeSection === s.id ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-muted'}`}
              >
                <Icon name={s.icon} size={15} />
                {s.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 animate-fade-in">
          {activeSection === 'profile' && (
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Профиль пользователя</h2>
              <div className="space-y-1.5">
                <Label>Имя пользователя</Label>
                <Input value={userName} onChange={e => setUserName(e.target.value)} placeholder="Администратор" />
                <p className="text-xs text-muted-foreground">Отображается в записях операций</p>
              </div>
              <div className="space-y-1.5">
                <Label>Тема оформления</Label>
                <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                  <div className="flex items-center gap-2">
                    <Icon name={state.darkMode ? 'Moon' : 'Sun'} size={16} className="text-muted-foreground" />
                    <span className="text-sm font-medium">{state.darkMode ? 'Тёмная тема' : 'Светлая тема'}</span>
                  </div>
                  <Switch
                    checked={state.darkMode}
                    onCheckedChange={v => {
                      const next = { ...state, darkMode: v };
                      onStateChange(next);
                      saveState(next);
                    }}
                  />
                </div>
              </div>
              <Button onClick={saveProfile} className={saved ? 'bg-success hover:bg-success text-success-foreground' : ''}>
                {saved ? <><Icon name="Check" size={15} className="mr-1.5" />Сохранено!</> : 'Сохранить'}
              </Button>
            </div>
          )}

          {activeSection === 'alerts' && (
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Уведомления об остатках</h2>
              <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-lg">
                <div className="flex items-start gap-2">
                  <Icon name="Bell" size={16} className="text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                  <div className="text-sm text-amber-700 dark:text-amber-300">
                    <span className="font-semibold">Индикатор низкого остатка</span> — при остатке ≤ порога товар отображается красным и появляется предупреждение в шапке.
                  </div>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Порог низкого остатка по умолчанию</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">единиц</span>
                </div>
                <p className="text-xs text-muted-foreground">Применяется к новым товарам. Для каждого товара можно задать индивидуальный порог.</p>
              </div>

              {/* Current low stock items */}
              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-foreground">Сейчас на низком остатке</h3>
                {state.items.filter(i => i.quantity <= i.lowStockThreshold).length === 0 ? (
                  <div className="flex items-center gap-2 p-3 bg-success/8 border border-success/20 rounded-lg text-sm text-success font-medium">
                    <Icon name="CheckCircle" size={15} />
                    Все товары в норме
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {state.items.filter(i => i.quantity <= i.lowStockThreshold).map(item => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-destructive/8 border border-destructive/20 rounded-lg">
                        <span className="text-sm font-medium text-foreground">{item.name}</span>
                        <span className={`text-sm font-bold tabular-nums ${item.quantity === 0 ? 'text-destructive' : 'text-warning'}`}>
                          {item.quantity} {item.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button onClick={saveProfile} className={saved ? 'bg-success hover:bg-success text-success-foreground' : ''}>
                {saved ? <><Icon name="Check" size={15} className="mr-1.5" />Сохранено!</> : 'Сохранить'}
              </Button>
            </div>
          )}

          {activeSection === 'warehouses' && (
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Склады</h2>
              <p className="text-xs text-muted-foreground -mt-2">
                Остатки товаров учитываются отдельно по каждому складу. При операциях (приход/расход) выбирается конкретный склад.
              </p>

              {/* Add */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h3 className="text-sm font-semibold">Добавить склад</h3>
                <Input placeholder="Название склада" value={newWhName} onChange={e => setNewWhName(e.target.value)} />
                <Input placeholder="Адрес (необязательно)" value={newWhAddress} onChange={e => setNewWhAddress(e.target.value)} />
                <Input placeholder="Описание (необязательно)" value={newWhDesc} onChange={e => setNewWhDesc(e.target.value)} />
                <Button onClick={addWarehouse} disabled={!newWhName.trim()} className="w-full">
                  <Icon name="Plus" size={14} className="mr-1.5" />Добавить склад
                </Button>
              </div>

              {/* List */}
              <div className="space-y-2">
                {(state.warehouses || []).map(wh => {
                  const totalStock = (state.warehouseStocks || [])
                    .filter(ws => ws.warehouseId === wh.id)
                    .reduce((s, ws) => s + ws.quantity, 0);
                  const hasStock = totalStock > 0;
                  return (
                    <div key={wh.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon name="Warehouse" size={16} className="text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{wh.name}</div>
                        {wh.address && <div className="text-xs text-muted-foreground">{wh.address}</div>}
                        {wh.description && <div className="text-xs text-muted-foreground">{wh.description}</div>}
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0">{totalStock} ед.</span>
                      {(state.warehouses || []).length > 1 && (
                        <button onClick={() => setDeleteConfirm({ label: `склад «${wh.name}»`, onConfirm: () => deleteWarehouse(wh.id) })}
                          className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                          <Icon name="Trash2" size={13} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === 'categories' && (
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4 relative overflow-hidden">

              {/* Floating 2D boxes background */}
              <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
                {[
                  { size: 38, x: 8,  y: 12, delay: 0,    dur: 6.2, rot: 15  },
                  { size: 26, x: 78, y: 8,  delay: 1.1,  dur: 5.4, rot: -20 },
                  { size: 44, x: 88, y: 55, delay: 0.4,  dur: 7.1, rot: 30  },
                  { size: 20, x: 55, y: 70, delay: 2.0,  dur: 4.8, rot: -10 },
                  { size: 32, x: 18, y: 65, delay: 0.8,  dur: 6.6, rot: 22  },
                  { size: 22, x: 65, y: 18, delay: 1.6,  dur: 5.9, rot: -35 },
                  { size: 50, x: 42, y: 40, delay: 0.2,  dur: 8.0, rot: 8   },
                  { size: 18, x: 92, y: 28, delay: 2.5,  dur: 5.1, rot: 45  },
                  { size: 28, x: 30, y: 85, delay: 1.3,  dur: 6.8, rot: -18 },
                  { size: 16, x: 72, y: 82, delay: 0.6,  dur: 4.5, rot: 28  },
                ].map((b, i) => (
                  <div
                    key={i}
                    className="absolute"
                    style={{
                      left: `${b.x}%`,
                      top: `${b.y}%`,
                      width: b.size,
                      height: b.size,
                      animation: `floatBox ${b.dur}s ease-in-out ${b.delay}s infinite`,
                      rotate: `${b.rot}deg`,
                    }}
                  >
                    {/* Box face */}
                    <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width={b.size} height={b.size} style={{ opacity: 0.13 }}>
                      {/* Front */}
                      <rect x="8" y="16" width="24" height="20" rx="2" fill="currentColor" className="text-primary" />
                      {/* Top */}
                      <path d="M8 16 L20 8 L32 16 L20 24 Z" fill="currentColor" className="text-primary" style={{ opacity: 0.7 }} />
                      {/* Right side */}
                      <path d="M32 16 L32 36 L20 32 L20 24 Z" fill="currentColor" className="text-primary" style={{ opacity: 0.5 }} />
                      {/* Tape line */}
                      <line x1="8" y1="26" x2="32" y2="26" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" />
                      <line x1="20" y1="16" x2="20" y2="36" stroke="white" strokeWidth="1.5" strokeOpacity="0.4" />
                    </svg>
                  </div>
                ))}
              </div>

              <style>{`
                @keyframes floatBox {
                  0%   { translate: 0 0px;   }
                  50%  { translate: 0 -14px; }
                  100% { translate: 0 0px;   }
                }
              `}</style>

              <h2 className="font-semibold text-foreground relative">Категории товаров</h2>

              {/* Add new */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h3 className="text-sm font-semibold">Добавить категорию</h3>
                <div className="flex gap-2">
                  <Input placeholder="Название" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="flex-1" />
                  <Button onClick={addCategory} disabled={!newCatName.trim()}>
                    <Icon name="Plus" size={14} className="mr-1" />
                    Добавить
                  </Button>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {CAT_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setNewCatColor(c)}
                      className="w-7 h-7 rounded-full transition-all"
                      style={{ backgroundColor: c, outline: newCatColor === c ? `3px solid ${c}` : 'none', outlineOffset: '2px' }}
                    />
                  ))}
                </div>
              </div>

              {/* List */}
              <div className="space-y-2">
                {state.categories.map(cat => {
                  const count = state.items.filter(i => i.categoryId === cat.id).length;
                  return (
                    <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                      <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                      <span className="flex-1 text-sm font-medium">{cat.name}</span>
                      <span className="text-xs text-muted-foreground">{count} товаров</span>
                      <button
                        onClick={() => setDeleteConfirm({ label: `категорию «${cat.name}»`, onConfirm: () => deleteCategory(cat.id) })}
                        className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                      >
                        <Icon name="Trash2" size={13} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeSection === 'locations' && (
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Локации (стеллажи, полки)</h2>

              {/* Add new */}
              <div className="p-4 bg-muted/50 rounded-lg space-y-3">
                <h3 className="text-sm font-semibold">Добавить локацию</h3>
                <div className="grid grid-cols-2 gap-2">
                  <Input placeholder="Название (Стеллаж А)" value={newLocName} onChange={e => setNewLocName(e.target.value)} className="col-span-2" />
                  <Input placeholder="Описание (необязательно)" value={newLocDesc} onChange={e => setNewLocDesc(e.target.value)} />
                  <select
                    value={newLocParent}
                    onChange={e => setNewLocParent(e.target.value)}
                    className="h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  >
                    <option value="">Нет родителя (верхний уровень)</option>
                    {state.locations.filter(l => !l.parentId).map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                </div>
                <Button onClick={addLocation} disabled={!newLocName.trim()} className="w-full">
                  <Icon name="Plus" size={14} className="mr-1.5" />
                  Добавить локацию
                </Button>
              </div>

              {/* Tree list */}
              <div className="space-y-1.5">
                {state.locations.filter(l => !l.parentId).map(loc => {
                  const children = state.locations.filter(l => l.parentId === loc.id);
                  const locItemCount = state.items.filter(i => i.locationId === loc.id).length;
                  return (
                    <div key={loc.id}>
                      <div className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
                        <Icon name="Warehouse" size={15} className="text-muted-foreground shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-semibold">{loc.name}</div>
                          {loc.description && <div className="text-xs text-muted-foreground">{loc.description}</div>}
                        </div>
                        <span className="text-xs text-muted-foreground">{locItemCount} тов.</span>
                        <button onClick={() => setDeleteConfirm({ label: `локацию «${loc.name}»`, onConfirm: () => deleteLocation(loc.id) })} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                          <Icon name="Trash2" size={13} />
                        </button>
                      </div>
                      {children.map(child => {
                        const childCount = state.items.filter(i => i.locationId === child.id).length;
                        return (
                          <div key={child.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 ml-6 mt-1 hover:bg-muted/50 transition-colors">
                            <Icon name="Layers" size={13} className="text-muted-foreground shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium">{child.name}</div>
                              {child.description && <div className="text-xs text-muted-foreground">{child.description}</div>}
                            </div>
                            <span className="text-xs text-muted-foreground">{childCount} тов.</span>
                            <button onClick={() => setDeleteConfirm({ label: `локацию «${child.name}»`, onConfirm: () => deleteLocation(child.id) })} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                              <Icon name="Trash2" size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {deleteConfirm && (
        <Dialog open onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm animate-scale-in">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                  <Icon name="Trash2" size={16} />
                </div>
                Удалить?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                Удалить <b className="text-foreground">{deleteConfirm.label}</b>? Это действие нельзя отменить.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Отмена</Button>
                <Button onClick={() => { deleteConfirm.onConfirm(); setDeleteConfirm(null); }}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold">
                  <Icon name="Trash2" size={14} className="mr-1.5" />Удалить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}