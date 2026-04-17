import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { AppState, crudAction, Category, Location, Warehouse, generateId } from '@/data/store';

const CAT_COLORS = ['#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316'];

type EntityProps = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onDeleteConfirm: (label: string, onConfirm: () => void) => void;
};

export function WarehousesSection({ state, onStateChange, onDeleteConfirm }: EntityProps) {
  const [newWhName, setNewWhName] = useState('');
  const [newWhAddress, setNewWhAddress] = useState('');
  const [newWhDesc, setNewWhDesc] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const addWarehouse = () => {
    if (!newWhName.trim()) return;
    const wh: Warehouse = {
      id: generateId(), name: newWhName.trim(),
      address: newWhAddress.trim() || undefined,
      description: newWhDesc.trim() || undefined,
      createdAt: new Date().toISOString(),
    };
    const next = { ...state, warehouses: [...(state.warehouses || []), wh] };
    onStateChange(next); crudAction('upsert_warehouse', { warehouse: wh });
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
    onStateChange(next); crudAction('delete_warehouse', { warehouseId: id });
  };

  const saveWhProfile = (id: string, patch: Partial<Warehouse>) => {
    const warehouses = (state.warehouses || []).map(w => w.id === id ? { ...w, ...patch } : w);
    const updated = warehouses.find(w => w.id === id);
    onStateChange({ ...state, warehouses });
    if (updated) {
      crudAction('upsert_warehouse', { warehouse: updated }).then(ok => {
        if (ok) toast.success('Профиль склада сохранён');
        else toast.error('Не удалось сохранить профиль');
      });
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
      <h2 className="font-semibold text-foreground">Склады</h2>
      <p className="text-xs text-muted-foreground -mt-2">
        Остатки товаров учитываются отдельно по каждому складу. При операциях (приход/расход) выбирается конкретный склад.
      </p>

      <div className="p-4 bg-muted/50 rounded-lg space-y-3">
        <h3 className="text-sm font-semibold">Добавить склад</h3>
        <Input placeholder="Название склада" value={newWhName} onChange={e => setNewWhName(e.target.value)} />
        <Input placeholder="Адрес (необязательно)" value={newWhAddress} onChange={e => setNewWhAddress(e.target.value)} />
        <Input placeholder="Описание (необязательно)" value={newWhDesc} onChange={e => setNewWhDesc(e.target.value)} />
        <Button onClick={addWarehouse} disabled={!newWhName.trim()} className="w-full">
          <Icon name="Plus" size={14} className="mr-1.5" />Добавить склад
        </Button>
      </div>

      <div className="space-y-2">
        {(state.warehouses || []).map(wh => {
          const totalStock = (state.warehouseStocks || [])
            .filter(ws => ws.warehouseId === wh.id)
            .reduce((s, ws) => s + ws.quantity, 0);
          const isOpen = expandedId === wh.id;
          return (
            <div key={wh.id} className="rounded-xl border border-border bg-card">
              <div className="flex items-center gap-3 p-3 hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="Warehouse" size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">{wh.name}</div>
                  {wh.address && <div className="text-xs text-muted-foreground">{wh.address}</div>}
                  {wh.description && <div className="text-xs text-muted-foreground">{wh.description}</div>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">{totalStock} ед.</span>
                <button
                  onClick={() => setExpandedId(isOpen ? null : wh.id)}
                  className="w-7 h-7 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                  title="Профиль выдачи для накладной"
                >
                  <Icon name={isOpen ? 'ChevronUp' : 'Settings2'} size={13} />
                </button>
                {(state.warehouses || []).length > 1 && (
                  <button onClick={() => onDeleteConfirm(`склад «${wh.name}»`, () => deleteWarehouse(wh.id))}
                    className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                    <Icon name="Trash2" size={13} />
                  </button>
                )}
              </div>
              {isOpen && (
                <WarehouseProfileForm wh={wh} onSave={patch => saveWhProfile(wh.id, patch)} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WarehouseProfileForm({ wh, onSave }: { wh: Warehouse; onSave: (patch: Partial<Warehouse>) => void }) {
  const [institution, setInstitution] = useState(wh.institution || '');
  const [senderDept, setSenderDept] = useState(wh.senderDept || '');
  const [issuerRank, setIssuerRank] = useState(wh.issuerRank || '');
  const [issuerName, setIssuerName] = useState(wh.issuerName || '');
  const [approverRole, setApproverRole] = useState(wh.approverRole || '');
  const [approverName, setApproverName] = useState(wh.approverName || '');

  useEffect(() => {
    setInstitution(wh.institution || '');
    setSenderDept(wh.senderDept || '');
    setIssuerRank(wh.issuerRank || '');
    setIssuerName(wh.issuerName || '');
    setApproverRole(wh.approverRole || '');
    setApproverName(wh.approverName || '');
  }, [wh.id]);

  const dirty =
    institution !== (wh.institution || '') ||
    senderDept !== (wh.senderDept || '') ||
    issuerRank !== (wh.issuerRank || '') ||
    issuerName !== (wh.issuerName || '') ||
    approverRole !== (wh.approverRole || '') ||
    approverName !== (wh.approverName || '');

  const handleSave = () => {
    onSave({
      institution: institution.trim() || undefined,
      senderDept: senderDept.trim() || undefined,
      issuerRank: issuerRank.trim() || undefined,
      issuerName: issuerName.trim() || undefined,
      approverRole: approverRole.trim() || undefined,
      approverName: approverName.trim() || undefined,
    });
  };

  return (
    <div className="px-3 pb-3 pt-1 border-t border-border space-y-3 bg-muted/20">
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-2">
        Профиль выдачи (для накладной)
      </div>
      <div className="grid grid-cols-1 gap-2">
        <label className="text-xs text-muted-foreground">Учреждение
          <Input className="mt-1" value={institution} onChange={e => setInstitution(e.target.value)} placeholder="Название организации" />
        </label>
        <label className="text-xs text-muted-foreground">Структурное подразделение — отправитель
          <Input className="mt-1" value={senderDept} onChange={e => setSenderDept(e.target.value)} placeholder="Например: Склад №1" />
        </label>
      </div>
      <div className="text-xs font-semibold text-muted-foreground pt-1">Отпустил</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">Звание / должность
          <Input className="mt-1" value={issuerRank} onChange={e => setIssuerRank(e.target.value)} placeholder="Напр.: кладовщик" />
        </label>
        <label className="text-xs text-muted-foreground">ФИО (расшифровка)
          <Input className="mt-1" value={issuerName} onChange={e => setIssuerName(e.target.value)} placeholder="Иванов И.И." />
        </label>
      </div>
      <div className="text-xs font-semibold text-muted-foreground pt-1">Разрешил</div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-muted-foreground">Должность
          <Input className="mt-1" value={approverRole} onChange={e => setApproverRole(e.target.value)} placeholder="Напр.: начальник склада" />
        </label>
        <label className="text-xs text-muted-foreground">ФИО (расшифровка)
          <Input className="mt-1" value={approverName} onChange={e => setApproverName(e.target.value)} placeholder="Петров П.П." />
        </label>
      </div>
      <Button onClick={handleSave} disabled={!dirty} className="w-full">
        <Icon name="Save" size={14} className="mr-1.5" />
        {dirty ? 'Сохранить профиль' : 'Сохранено'}
      </Button>
    </div>
  );
}

export function CategoriesSection({ state, onStateChange, onDeleteConfirm }: EntityProps) {
  const [newCatName, setNewCatName] = useState('');
  const [newCatColor, setNewCatColor] = useState(CAT_COLORS[0]);

  const addCategory = () => {
    if (!newCatName.trim()) return;
    const cat: Category = { id: generateId(), name: newCatName.trim(), color: newCatColor };
    const next = { ...state, categories: [...state.categories, cat] };
    onStateChange(next);
    crudAction('upsert_category', { category: cat });
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
    crudAction('delete_category', { categoryId: id, fallbackCategoryId: fallback });
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4 relative overflow-hidden">

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
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width={b.size} height={b.size} style={{ opacity: 0.13 }}>
              <rect x="8" y="16" width="24" height="20" rx="2" fill="currentColor" className="text-primary" />
              <path d="M8 16 L20 8 L32 16 L20 24 Z" fill="currentColor" className="text-primary" style={{ opacity: 0.7 }} />
              <path d="M32 16 L32 36 L20 32 L20 24 Z" fill="currentColor" className="text-primary" style={{ opacity: 0.5 }} />
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

      <div className="space-y-2">
        {state.categories.map(cat => {
          const count = state.items.filter(i => i.categoryId === cat.id).length;
          return (
            <div key={cat.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors">
              <div className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="flex-1 text-sm font-medium">{cat.name}</span>
              <span className="text-xs text-muted-foreground">{count} товаров</span>
              <button
                onClick={() => onDeleteConfirm(`категорию «${cat.name}»`, () => deleteCategory(cat.id))}
                className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
              >
                <Icon name="Trash2" size={13} />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function LocationsSection({ state, onStateChange, onDeleteConfirm }: EntityProps) {
  const [newLocName, setNewLocName] = useState('');
  const [newLocDesc, setNewLocDesc] = useState('');
  const [newLocParent, setNewLocParent] = useState('');

  const addLocation = () => {
    if (!newLocName.trim()) return;
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
    crudAction('upsert_location', { location: loc });
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
    crudAction('delete_location', { locationId: id });
  };

  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5 space-y-4">
      <h2 className="font-semibold text-foreground">Локации (стеллажи, полки)</h2>

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
                <button onClick={() => onDeleteConfirm(`локацию «${loc.name}»`, () => deleteLocation(loc.id))} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
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
                    <button onClick={() => onDeleteConfirm(`локацию «${child.name}»`, () => deleteLocation(child.id))} className="w-7 h-7 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
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
  );
}