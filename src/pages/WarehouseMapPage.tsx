import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Location, Warehouse, crudAction } from '@/data/store';
import ItemDetailModal from '@/components/ItemDetailModal';
import { ZONE_COLORS, DEFAULT_LAYOUT, WarehouseLayout, getStockLevel } from './warehouse-map/WarehouseMapHelpers';
import { AddLocationModal, MoveItemModal, TransferWarehouseModal } from './warehouse-map/WarehouseMapModals';
import LocationCard from './warehouse-map/LocationCard';
import LocationDetailPanel from './warehouse-map/LocationDetailPanel';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  initialLocationId?: string | null;
};

export default function WarehouseMapPage({ state, onStateChange, initialLocationId }: Props) {
  const warehouses: Warehouse[] = state.warehouses || [];
  const [activeWarehouseId, setActiveWarehouseId] = useState<string>(() => warehouses[0]?.id || '');
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(initialLocationId ?? null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | undefined>();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ itemId: string; fromLocationId: string } | null>(null);
  const [dragOverLocationId, setDragOverLocationId] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{ itemId: string; fromLocationId: string; toLocationId: string } | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [layout, setLayout] = useState<WarehouseLayout>(() => {
    try {
      const saved = localStorage.getItem('warehouse_layout_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return DEFAULT_LAYOUT;
  });

  const activeWarehouse = warehouses.find(w => w.id === activeWarehouseId) || warehouses[0];

  const saveLayout = (l: WarehouseLayout) => {
    setLayout(l);
    localStorage.setItem('warehouse_layout_v1', JSON.stringify(l));
  };

  const selectedLocation = selectedLocationId ? state.locations.find(l => l.id === selectedLocationId) : null;
  const selectedItem = selectedItemId ? state.items.find(i => i.id === selectedItemId) || null : null;

  const whLocations = state.locations.filter(l => !l.warehouseId || l.warehouseId === activeWarehouseId);
  const totalLocations = whLocations.length;
  const occupiedLocations = whLocations.filter(loc =>
    (state.locationStocks || []).some(ls => ls.locationId === loc.id && ls.quantity > 0)
  ).length;
  const whItemIds = new Set(
    (state.warehouseStocks || []).filter(ws => ws.warehouseId === activeWarehouseId && ws.quantity > 0).map(ws => ws.itemId)
  );
  const whItems = state.items.filter(i => whItemIds.has(i.id));
  const lowItems = whItems.filter(i => {
    const qty = (state.warehouseStocks || []).find(ws => ws.warehouseId === activeWarehouseId && ws.itemId === i.id)?.quantity ?? i.quantity;
    return qty > 0 && qty <= i.lowStockThreshold;
  }).length;
  const criticalItems = whItems.filter(i => {
    const qty = (state.warehouseStocks || []).find(ws => ws.warehouseId === activeWarehouseId && ws.itemId === i.id)?.quantity ?? i.quantity;
    return qty === 0;
  }).length;

  const locationColors = useMemo(() => {
    const map: Record<string, string> = {};
    layout.cells.forEach(cell => {
      if (cell.color) map[cell.locationId] = cell.color;
    });
    state.locations.forEach((loc, i) => {
      if (!map[loc.id]) map[loc.id] = ZONE_COLORS[i % ZONE_COLORS.length];
    });
    return map;
  }, [layout, state.locations]);

  const locationsWithMatches = useMemo(() => {
    if (!search && categoryFilter === 'all') return new Set(state.locations.map(l => l.id));
    return new Set(
      (state.locationStocks || [])
        .filter(ls => {
          const item = state.items.find(i => i.id === ls.itemId);
          if (!item) return false;
          if (categoryFilter !== 'all' && item.categoryId !== categoryFilter) return false;
          if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
          return ls.quantity > 0;
        })
        .map(ls => ls.locationId)
    );
  }, [search, categoryFilter, state]);

  const handleItemDragStart = (e: React.DragEvent, itemId: string, fromLocationId: string) => {
    setDragState({ itemId, fromLocationId });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', `${itemId}::${fromLocationId}`);
  };

  const handleDragOver = (e: React.DragEvent, locationId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverLocationId(locationId);
  };

  const handleDragLeave = () => setDragOverLocationId(null);

  const handleDrop = (e: React.DragEvent, toLocationId: string) => {
    e.preventDefault();
    setDragOverLocationId(null);
    if (!dragState || dragState.fromLocationId === toLocationId) { setDragState(null); return; }
    setMoveModal({ itemId: dragState.itemId, fromLocationId: dragState.fromLocationId, toLocationId });
    setDragState(null);
  };

  const handleDeleteLocation = (locId: string) => {
    const hasStock = (state.locationStocks || []).some(ls => ls.locationId === locId && ls.quantity > 0);
    if (hasStock) {
      alert('Нельзя удалить локацию, в которой есть товары. Сначала переместите или спишите все товары.');
      return;
    }
    const next = {
      ...state,
      locations: state.locations.filter(l => l.id !== locId),
      locationStocks: (state.locationStocks || []).filter(ls => ls.locationId !== locId),
    };
    onStateChange(next); crudAction('delete_location', { locationId: locId });
    if (selectedLocationId === locId) setSelectedLocationId(null);

    const newLayout = { ...layout, cells: layout.cells.filter(c => c.locationId !== locId) };
    saveLayout(newLayout);
  };

  const topLocations = state.locations.filter(l => !l.parentId && (!l.warehouseId || l.warehouseId === activeWarehouseId));
  const childLocations = (parentId: string) => state.locations.filter(l => l.parentId === parentId);

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Карта складов</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {warehouses.length} склад{warehouses.length !== 1 ? 'а' : ''} · {totalLocations} локаций на этом складе
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {warehouses.length > 1 && (
            <Button variant="outline" size="sm" onClick={() => setShowTransferModal(true)} className="flex items-center gap-1.5">
              <Icon name="ArrowLeftRight" size={14} />
              Переместить
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')} className="flex items-center gap-1.5">
            <Icon name={viewMode === 'grid' ? 'List' : 'LayoutGrid'} size={14} />
            {viewMode === 'grid' ? 'Список' : 'Сетка'}
          </Button>
          <Button onClick={() => { setEditLocation(undefined); setShowAddLocation(true); }} className="flex items-center gap-2">
            <Icon name="Plus" size={15} />
            Стеллаж
          </Button>
        </div>
      </div>

      {warehouses.length > 1 && (
        <div className="flex gap-1 p-1 bg-muted rounded-xl overflow-x-auto">
          {warehouses.map(wh => {
            const whTotal = (state.warehouseStocks || [])
              .filter(ws => ws.warehouseId === wh.id)
              .reduce((s, ws) => s + ws.quantity, 0);
            const isActive = wh.id === activeWarehouseId;
            return (
              <button
                key={wh.id}
                onClick={() => { setActiveWarehouseId(wh.id); setSelectedLocationId(null); }}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all shrink-0
                  ${isActive ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Icon name="Warehouse" size={14} />
                {wh.name}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? 'bg-primary/15 text-primary' : 'bg-muted-foreground/15 text-muted-foreground'}`}>
                  {whTotal}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {activeWarehouse && (
        <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-xl">
          <Icon name="Warehouse" size={18} className="text-primary shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-foreground text-sm">{activeWarehouse.name}</div>
            {activeWarehouse.address && <div className="text-xs text-muted-foreground">{activeWarehouse.address}</div>}
          </div>
          {warehouses.length > 1 && (
            <button onClick={() => setShowTransferModal(true)}
              className="text-xs text-primary hover:underline flex items-center gap-1 shrink-0">
              <Icon name="ArrowLeftRight" size={12} />Переместить товар
            </button>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Локаций', value: totalLocations, icon: 'MapPin', color: 'text-primary' },
          { label: 'Занято', value: occupiedLocations, icon: 'Package', color: 'text-foreground' },
          { label: 'Мало', value: lowItems, icon: 'AlertTriangle', color: 'text-warning' },
          { label: 'Нет', value: criticalItems, icon: 'XCircle', color: 'text-destructive' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={15} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder="Найти товар на карте..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon name="X" size={13} /></button>}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
          className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer">
          <option value="all">Все категории</option>
          {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" />В норме</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" />Мало</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" />Нет</span>
        <span className="flex items-center gap-1.5 ml-auto"><Icon name="GripHorizontal" size={12} />Перетащите товар между локациями</span>
      </div>

      <div className={`flex gap-4 ${selectedLocation ? 'items-start' : ''}`}>
        <div className={`flex-1 min-w-0 transition-all ${selectedLocation ? 'hidden lg:block' : ''}`}>
          {state.locations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-border rounded-2xl">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Icon name="Map" size={28} className="text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold mb-1">Карта склада пуста</h3>
              <p className="text-sm text-muted-foreground mb-4">Добавьте первую локацию для начала работы</p>
              <Button onClick={() => setShowAddLocation(true)}>
                <Icon name="Plus" size={14} className="mr-1.5" />
                Добавить локацию
              </Button>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="space-y-5">
              {topLocations.map(topLoc => {
                const children = childLocations(topLoc.id);

                return (
                  <div key={topLoc.id} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: locationColors[topLoc.id] }} />
                      <span className="text-sm font-semibold text-foreground">{topLoc.name}</span>
                      {topLoc.description && <span className="text-xs text-muted-foreground">· {topLoc.description}</span>}
                      <div className="flex-1 h-px bg-border" />
                      <button
                        onClick={() => { setEditLocation(topLoc); setShowAddLocation(true); }}
                        className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
                      >
                        <Icon name="Pencil" size={11} />
                      </button>
                      <button
                        onClick={() => handleDeleteLocation(topLoc.id)}
                        className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                      >
                        <Icon name="Trash2" size={11} />
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2">
                      {(children.length > 0 ? children : [topLoc]).map(loc => (
                        <LocationCard
                          key={loc.id}
                          location={loc}
                          state={state}
                          isSelected={selectedLocationId === loc.id}
                          isDragOver={dragOverLocationId === loc.id}
                          onSelect={() => setSelectedLocationId(selectedLocationId === loc.id ? null : loc.id)}
                          onDragOver={e => handleDragOver(e, loc.id)}
                          onDragLeave={handleDragLeave}
                          onDrop={e => handleDrop(e, loc.id)}
                          onItemDragStart={handleItemDragStart}
                          color={locationColors[loc.id]}
                          search={search}
                          categoryFilter={categoryFilter}
                        />
                      ))}
                      <button
                        onClick={() => {
                          setEditLocation({ id: '', name: '', parentId: topLoc.id, warehouseId: activeWarehouseId });
                          setShowAddLocation(true);
                        }}
                        className="rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex flex-col items-center justify-center gap-2 py-8 text-muted-foreground hover:text-foreground"
                        style={{ minHeight: '120px' }}
                      >
                        <Icon name="Plus" size={18} />
                        <span className="text-[11px] font-medium">Добавить полку</span>
                      </button>
                    </div>
                  </div>
                );
              })}

              <button
                onClick={() => { setEditLocation(undefined); setShowAddLocation(true); }}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex items-center justify-center gap-2 py-6 text-muted-foreground hover:text-foreground"
              >
                <Icon name="Plus" size={16} />
                <span className="text-sm font-medium">Добавить зону / стеллаж</span>
              </button>
            </div>
          ) : (
            <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Локация</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Позиций</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Единиц</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Статус</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {state.locations.map(loc => {
                    const stocks = (state.locationStocks || []).filter(ls => ls.locationId === loc.id && ls.quantity > 0);
                    const items = stocks.map(ls => ({ ...ls, item: state.items.find(i => i.id === ls.itemId) })).filter(x => x.item);
                    const units = stocks.reduce((s, ls) => s + ls.quantity, 0);
                    const worstLevel = items.reduce<'ok' | 'low' | 'critical'>((w, ls) => {
                      const lvl = getStockLevel(ls.quantity, ls.item!.lowStockThreshold);
                      return lvl === 'critical' ? 'critical' : lvl === 'low' && w !== 'critical' ? 'low' : w;
                    }, 'ok');
                    const hasItems = items.length > 0;
                    const highlight = locationsWithMatches.has(loc.id);

                    return (
                      <tr key={loc.id}
                        className={`border-b border-border/50 cursor-pointer hover:bg-muted/30 transition-colors ${!highlight && (search || categoryFilter !== 'all') ? 'opacity-40' : ''}`}
                        onClick={() => setSelectedLocationId(selectedLocationId === loc.id ? null : loc.id)}>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: locationColors[loc.id] }} />
                            <div>
                              <div className="font-medium">{loc.name}</div>
                              {loc.description && <div className="text-xs text-muted-foreground">{loc.description}</div>}
                              {loc.parentId && <div className="text-xs text-muted-foreground">↳ {state.locations.find(l => l.id === loc.parentId)?.name}</div>}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{items.length}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{units}</td>
                        <td className="px-4 py-3 text-center">
                          {!hasItems ? (
                            <span className="text-xs text-muted-foreground">пусто</span>
                          ) : worstLevel === 'critical' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-destructive/12 text-destructive"><span className="w-1.5 h-1.5 rounded-full bg-current" />Критично</span>
                          ) : worstLevel === 'low' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-warning/12 text-warning"><span className="w-1.5 h-1.5 rounded-full bg-current" />Мало</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-success/12 text-success"><span className="w-1.5 h-1.5 rounded-full bg-current" />Норма</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={e => { e.stopPropagation(); setEditLocation(loc); setShowAddLocation(true); }}
                              className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                              <Icon name="Pencil" size={12} />
                            </button>
                            <button onClick={e => { e.stopPropagation(); handleDeleteLocation(loc.id); }}
                              className="w-7 h-7 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                              <Icon name="Trash2" size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedLocation && (
          <div className="w-full lg:w-80 xl:w-96 shrink-0 bg-card border border-border rounded-2xl shadow-card p-4 animate-slide-up lg:animate-fade-in sticky top-20 max-h-[calc(100vh-100px)] flex flex-col">
            <LocationDetailPanel
              location={selectedLocation}
              state={state}
              onStateChange={onStateChange}
              onClose={() => setSelectedLocationId(null)}
              onItemSelect={id => setSelectedItemId(id)}
              onItemDragStart={handleItemDragStart}
            />
          </div>
        )}
      </div>

      {showAddLocation && (
        <AddLocationModal
          state={state}
          onStateChange={onStateChange}
          onClose={() => { setShowAddLocation(false); setEditLocation(undefined); }}
          editLocation={editLocation?.id ? editLocation : undefined}
          activeWarehouseId={activeWarehouseId}
        />
      )}

      {moveModal && (
        <MoveItemModal
          itemId={moveModal.itemId}
          fromLocationId={moveModal.fromLocationId}
          toLocationId={moveModal.toLocationId}
          state={state}
          onStateChange={onStateChange}
          onClose={() => setMoveModal(null)}
        />
      )}

      {selectedItem && (
        <ItemDetailModal
          item={selectedItem}
          state={state}
          onStateChange={onStateChange}
          onClose={() => setSelectedItemId(null)}
        />
      )}

      {showTransferModal && (
        <TransferWarehouseModal
          state={state}
          onStateChange={onStateChange}
          onClose={() => setShowTransferModal(false)}
          defaultFromId={activeWarehouseId}
        />
      )}
    </div>
  );
}
