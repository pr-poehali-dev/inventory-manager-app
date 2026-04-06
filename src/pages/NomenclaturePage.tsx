import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Item, saveState, generateId } from '@/data/store';
import ItemDetailModal from '@/components/ItemDetailModal';

const UNITS = ['шт', 'кг', 'л', 'м', 'м²', 'уп', 'пачка', 'рул', 'упак', 'кор', 'пар'];

function NewItemModal({ state, onStateChange, onClose }: {
  state: AppState; onStateChange: (s: AppState) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [unit, setUnit] = useState('шт');
  const [categoryId, setCategoryId] = useState(state.categories[0]?.id || '');
  const [locationId, setLocationId] = useState('');
  const [description, setDescription] = useState('');
  const [qty, setQty] = useState('0');
  const [threshold, setThreshold] = useState('5');
  const [error, setError] = useState('');

  const handleSave = () => {
    if (!name.trim()) { setError('Введите название'); return; }
    const newItem: Item = {
      id: generateId(),
      name: name.trim(),
      unit,
      categoryId,
      locationId: locationId || (state.locations[0]?.id || ''),
      description: description.trim() || undefined,
      quantity: parseInt(qty) || 0,
      lowStockThreshold: parseInt(threshold) || 5,
      createdAt: new Date().toISOString(),
    };
    const next = { ...state, items: [...state.items, newItem] };
    onStateChange(next); saveState(next); onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="Plus" size={16} />
            </div>
            Новая номенклатура
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <Label>Название <span className="text-destructive">*</span></Label>
            <Input value={name} onChange={e => { setName(e.target.value); setError(''); }}
              placeholder="Например: Болт М8×40..." autoFocus />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Ед. измерения</Label>
              <select value={unit} onChange={e => setUnit(e.target.value)}
                className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Нач. количество</Label>
              <Input type="number" min="0" value={qty} onChange={e => setQty(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Категория</Label>
              <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
                className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Порог минимума</Label>
              <Input type="number" min="0" value={threshold} onChange={e => setThreshold(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Локация</Label>
            <select value={locationId} onChange={e => setLocationId(e.target.value)}
              className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Не указана —</option>
              {state.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label>Описание</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Краткое описание..." />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleSave} className="flex-1 font-semibold">
              <Icon name="Plus" size={14} className="mr-1.5" />Создать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

type SortField = 'name' | 'quantity' | 'category' | 'location' | 'date';
type SortDir = 'asc' | 'desc';

export default function NomenclaturePage({ state, onStateChange }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [locationFilter, setLocationFilter] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'zero' | 'ok'>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [showNewItem, setShowNewItem] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const filtered = useMemo(() => {
    let items = [...state.items];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        i.description?.toLowerCase().includes(q) ||
        i.unit.toLowerCase().includes(q)
      );
    }
    if (categoryFilter !== 'all') items = items.filter(i => i.categoryId === categoryFilter);
    if (locationFilter !== 'all') items = items.filter(i => i.locationId === locationFilter);
    if (stockFilter === 'low') items = items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold);
    if (stockFilter === 'zero') items = items.filter(i => i.quantity === 0);
    if (stockFilter === 'ok') items = items.filter(i => i.quantity > i.lowStockThreshold);

    items.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'name') cmp = a.name.localeCompare(b.name, 'ru');
      else if (sortField === 'quantity') cmp = a.quantity - b.quantity;
      else if (sortField === 'date') cmp = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      else if (sortField === 'category') {
        const ca = state.categories.find(c => c.id === a.categoryId)?.name || '';
        const cb = state.categories.find(c => c.id === b.categoryId)?.name || '';
        cmp = ca.localeCompare(cb, 'ru');
      } else if (sortField === 'location') {
        const la = state.locations.find(l => l.id === a.locationId)?.name || '';
        const lb = state.locations.find(l => l.id === b.locationId)?.name || '';
        cmp = la.localeCompare(lb, 'ru');
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return items;
  }, [state.items, state.categories, state.locations, search, categoryFilter, locationFilter, stockFilter, sortField, sortDir]);

  const selectedItem = selectedItemId ? state.items.find(i => i.id === selectedItemId) || null : null;

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <Icon name="ChevronsUpDown" size={11} className="text-muted-foreground/40 ml-1 shrink-0" />;
    return <Icon name={sortDir === 'asc' ? 'ChevronUp' : 'ChevronDown'} size={11} className="text-primary ml-1 shrink-0" />;
  };

  const zeroCount = state.items.filter(i => i.quantity === 0).length;
  const lowCount = state.items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const okCount = state.items.filter(i => i.quantity > i.lowStockThreshold).length;
  const activeFilters = [categoryFilter !== 'all', locationFilter !== 'all', stockFilter !== 'all', search !== ''].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Номенклатура</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {state.items.length} позиций · {state.categories.length} категорий
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            onClick={() => setShowNewItem(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm active:scale-95"
          >
            <Icon name="Plus" size={16} />
            Добавить номенклатуру
          </button>

          {zeroCount > 0 && (
            <button onClick={() => setStockFilter(stockFilter === 'zero' ? 'all' : 'zero')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${stockFilter === 'zero' ? 'bg-destructive text-destructive-foreground border-destructive' : 'border-destructive/30 text-destructive bg-destructive/8 hover:bg-destructive/15'}`}>
              <span className="w-2 h-2 rounded-full bg-current" />Нет: {zeroCount}
            </button>
          )}
          {lowCount > 0 && (
            <button onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all
                ${stockFilter === 'low' ? 'bg-warning text-warning-foreground border-warning' : 'border-warning/40 text-warning bg-warning/8 hover:bg-warning/15'}`}>
              <span className="w-2 h-2 rounded-full bg-current" />Мало: {lowCount}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Поиск по названию, описанию..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon name="X" size={13} /></button>}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer">
          <option value="all">Все категории</option>
          {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
          className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer">
          <option value="all">Все локации</option>
          {state.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
        {activeFilters > 0 && (
          <button onClick={() => { setSearch(''); setCategoryFilter('all'); setLocationFilter('all'); setStockFilter('all'); }}
            className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors">
            <Icon name="X" size={13} />Сбросить ({activeFilters})
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Всего', value: state.items.length, icon: 'Package', color: 'text-foreground' },
          { label: 'В норме', value: okCount, icon: 'CheckCircle2', color: 'text-success' },
          { label: 'Мало', value: lowCount, icon: 'AlertTriangle', color: 'text-warning' },
          { label: 'Нет', value: zeroCount, icon: 'XCircle', color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={16} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tip */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-accent/50 border border-primary/20 rounded-lg text-sm">
        <Icon name="Paperclip" size={14} className="text-primary shrink-0" />
        <span className="text-muted-foreground">Нажмите на позицию — откроется карточка с <b className="text-foreground">вложениями</b> (Word, PDF, фото), историей и операциями</span>
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon name="PackageSearch" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {state.items.length === 0 ? 'Номенклатура пуста' : 'Позиции не найдены'}
          </h3>
          <p className="text-sm text-muted-foreground mb-4">
            {state.items.length === 0
              ? 'Добавьте первую позицию вручную или через Оприходование'
              : 'Попробуйте изменить фильтры'}
          </p>
          {state.items.length === 0 && (
            <button
              onClick={() => setShowNewItem(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-all shadow-sm"
            >
              <Icon name="Plus" size={16} />
              Добавить первую позицию
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 w-8 text-xs text-muted-foreground/50">#</th>
                  {([['name','Наименование'],['category','Категория'],['location','Локация'],['quantity','Остаток']] as [SortField,string][]).map(([f,l]) => (
                    <th key={f} onClick={() => handleSort(f)}
                      className={`px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer hover:text-foreground select-none ${f === 'quantity' ? 'text-right' : 'text-left'}`}>
                      <span className={`flex items-center ${f === 'quantity' ? 'justify-end' : ''}`}>{l}<SortIcon field={f} /></span>
                    </th>
                  ))}
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Порог</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Статус</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <Icon name="Paperclip" size={12} className="mx-auto" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item, idx) => {
                  const cat = state.categories.find(c => c.id === item.categoryId);
                  const loc = state.locations.find(l => l.id === item.locationId);
                  const isLow = item.quantity > 0 && item.quantity <= item.lowStockThreshold;
                  const isZero = item.quantity === 0;
                  const attCount = item.attachments?.length || 0;
                  // Остатки по складам
                  const whStocks = (state.warehouseStocks || [])
                    .filter(ws => ws.itemId === item.id && ws.quantity > 0)
                    .map(ws => ({ ...ws, wh: (state.warehouses || []).find(w => w.id === ws.warehouseId) }))
                    .filter(ws => ws.wh);

                  return (
                    <tr key={item.id} onClick={() => setSelectedItemId(item.id)}
                      className="border-b border-border/50 hover:bg-muted/30 cursor-pointer group transition-colors animate-fade-in"
                      style={{ animationDelay: `${idx * 12}ms` }}>
                      <td className="px-4 py-3 text-xs text-muted-foreground/30 tabular-nums">{idx + 1}</td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-foreground group-hover:text-primary transition-colors">{item.name}</div>
                        {item.description && <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{item.description}</div>}
                      </td>
                      <td className="px-4 py-3">
                        {cat ? (
                          <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: cat.color + '18', color: cat.color }}>{cat.name}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-sm text-muted-foreground">{loc?.name || '—'}</div>
                      </td>
                      {/* Остаток итого + разбивка по складам */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <div className="text-right">
                            <span className={`font-bold tabular-nums text-base ${isZero ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>{item.quantity}</span>
                            <span className="text-xs text-muted-foreground ml-1">{item.unit}</span>
                          </div>
                        </div>
                        {whStocks.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1 justify-end">
                            {whStocks.map(ws => (
                              <span key={ws.warehouseId}
                                className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/8 border border-primary/20 text-primary font-medium whitespace-nowrap">
                                {ws.wh!.name}: {ws.quantity}
                              </span>
                            ))}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-muted-foreground tabular-nums">{item.lowStockThreshold}</td>
                      <td className="px-4 py-3 text-center">
                        {isZero ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/12 text-destructive"><span className="w-1.5 h-1.5 rounded-full bg-current" />Нет</span>
                        ) : isLow ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/12 text-warning"><span className="w-1.5 h-1.5 rounded-full bg-current" />Мало</span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/12 text-success"><span className="w-1.5 h-1.5 rounded-full bg-current" />Норма</span>
                        )}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {attCount > 0 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-primary font-medium">
                            <Icon name="Paperclip" size={12} />{attCount}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/30">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="px-4 py-2.5 border-t border-border bg-muted/20 text-xs text-muted-foreground">
              Показано {filtered.length} из {state.items.length} · Нажмите на строку для открытия карточки и вложений
            </div>
          </div>

          {/* Mobile */}
          <div className="md:hidden space-y-2">
            {filtered.map((item, idx) => {
              const cat = state.categories.find(c => c.id === item.categoryId);
              const loc = state.locations.find(l => l.id === item.locationId);
              const isLow = item.quantity > 0 && item.quantity <= item.lowStockThreshold;
              const isZero = item.quantity === 0;
              const attCount = item.attachments?.length || 0;
              const whStocks = (state.warehouseStocks || [])
                .filter(ws => ws.itemId === item.id && ws.quantity > 0)
                .map(ws => ({ ...ws, wh: (state.warehouses || []).find(w => w.id === ws.warehouseId) }))
                .filter(ws => ws.wh);
              return (
                <button key={item.id} onClick={() => setSelectedItemId(item.id)}
                  className="w-full text-left bg-card rounded-xl border border-border p-3.5 shadow-card hover:border-primary/30 transition-all animate-fade-in"
                  style={{ animationDelay: `${idx * 20}ms` }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-sm text-foreground">{item.name}</div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {cat && <span className="text-[11px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: cat.color + '18', color: cat.color }}>{cat.name}</span>}
                        {loc && <span className="text-xs text-muted-foreground flex items-center gap-0.5"><Icon name="MapPin" size={10} />{loc.name}</span>}
                        {attCount > 0 && <span className="text-xs text-primary flex items-center gap-0.5"><Icon name="Paperclip" size={10} />{attCount} файл.</span>}
                      </div>
                      {whStocks.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {whStocks.map(ws => (
                            <span key={ws.warehouseId}
                              className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/8 border border-primary/20 text-primary font-medium">
                              {ws.wh!.name}: {ws.quantity} {item.unit}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className={`text-lg font-bold tabular-nums shrink-0 ${isZero ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>
                      {item.quantity} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      <ItemDetailModal item={selectedItem} state={state} onStateChange={onStateChange} onClose={() => setSelectedItemId(null)} />
      {showNewItem && <NewItemModal state={state} onStateChange={onStateChange} onClose={() => setShowNewItem(false)} />}
    </div>
  );
}