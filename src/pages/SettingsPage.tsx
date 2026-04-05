import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { AppState, saveState, Category, Location, generateId } from '@/data/store';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

const CAT_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

export default function SettingsPage({ state, onStateChange }: Props) {
  const [activeSection, setActiveSection] = useState<'profile' | 'alerts' | 'categories' | 'locations'>('profile');
  const [userName, setUserName] = useState(state.currentUser);
  const [threshold, setThreshold] = useState(String(state.defaultLowStockThreshold));
  const [saved, setSaved] = useState(false);

  // Category add
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CAT_COLORS[0]);

  // Location add
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocParent, setNewLocParent] = useState('');

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
    const next = { ...state, categories: state.categories.filter(c => c.id !== id) };
    onStateChange(next);
    saveState(next);
  };

  const addLocation = () => {
    if (!newLocName.trim()) return;
    const loc: Location = {
      id: generateId(),
      name: newLocName.trim(),
      description: newLocDesc || undefined,
      parentId: newLocParent || undefined,
    };
    const next = { ...state, locations: [...state.locations, loc] };
    onStateChange(next);
    saveState(next);
    setNewLocName('');
    setNewLocDesc('');
    setNewLocParent('');
  };

  const deleteLocation = (id: string) => {
    const next = { ...state, locations: state.locations.filter(l => l.id !== id) };
    onStateChange(next);
    saveState(next);
  };

  const sections = [
    { id: 'profile', label: 'Профиль', icon: 'User' },
    { id: 'alerts', label: 'Уведомления', icon: 'Bell' },
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

          {activeSection === 'categories' && (
            <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
              <h2 className="font-semibold text-foreground">Категории товаров</h2>

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
                      {count === 0 && (
                        <button
                          onClick={() => deleteCategory(cat.id)}
                          className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
                        >
                          <Icon name="Trash2" size={13} />
                        </button>
                      )}
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
                        {locItemCount === 0 && children.length === 0 && (
                          <button onClick={() => deleteLocation(loc.id)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                            <Icon name="Trash2" size={13} />
                          </button>
                        )}
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
                            {childCount === 0 && (
                              <button onClick={() => deleteLocation(child.id)} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                                <Icon name="Trash2" size={13} />
                              </button>
                            )}
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
    </div>
  );
}
