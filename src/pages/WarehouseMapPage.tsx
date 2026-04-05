import { useState, useMemo, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Location, saveState, generateId, LocationStock } from '@/data/store';
import ItemDetailModal from '@/components/ItemDetailModal';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

// ─── Types for map layout ─────────────────────────────────────────────────────
type MapCell = {
  locationId: string;
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  color?: string;
};

type WarehouseLayout = {
  cols: number;
  rows: number;
  cells: MapCell[];
};

const ZONE_COLORS = [
  '#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#64748b', '#84cc16',
];

const DEFAULT_LAYOUT: WarehouseLayout = {
  cols: 6,
  rows: 4,
  cells: [
    { locationId: 'loc-1', col: 0, row: 0, colSpan: 2, color: '#6366f1' },
    { locationId: 'loc-2', col: 2, row: 0, colSpan: 2, color: '#0ea5e9' },
    { locationId: 'loc-3', col: 4, row: 0, colSpan: 2, color: '#f59e0b' },
    { locationId: 'loc-4', col: 0, row: 1, colSpan: 1, color: '#6366f1' },
    { locationId: 'loc-5', col: 1, row: 1, colSpan: 1, color: '#6366f1' },
    { locationId: 'loc-6', col: 2, row: 1, colSpan: 2, color: '#0ea5e9' },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getStockLevel(qty: number, threshold: number): 'ok' | 'low' | 'critical' {
  if (qty === 0) return 'critical';
  if (qty <= threshold) return 'low';
  return 'ok';
}

function stockLevelColor(level: 'ok' | 'low' | 'critical') {
  if (level === 'ok') return 'bg-success/15 text-success border-success/30';
  if (level === 'low') return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
}

function stockDotColor(level: 'ok' | 'low' | 'critical') {
  if (level === 'ok') return 'bg-success';
  if (level === 'low') return 'bg-warning';
  return 'bg-destructive';
}

// ─── Add Location Modal ───────────────────────────────────────────────────────
function AddLocationModal({
  state, onStateChange, onClose, editLocation,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  editLocation?: Location;
}) {
  const [name, setName] = useState(editLocation?.name || '');
  const [description, setDescription] = useState(editLocation?.description || '');
  const [parentId, setParentId] = useState(editLocation?.parentId || '');

  const handleSave = () => {
    if (!name.trim()) return;
    if (editLocation) {
      const next = {
        ...state,
        locations: state.locations.map(l =>
          l.id === editLocation.id
            ? { ...l, name: name.trim(), description: description.trim() || undefined, parentId: parentId || undefined }
            : l
        ),
      };
      onStateChange(next); saveState(next);
    } else {
      const newLoc: Location = {
        id: generateId(),
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
      };
      const next = { ...state, locations: [...state.locations, newLoc] };
      onStateChange(next); saveState(next);
    }
    onClose();
  };

  const topLevel = state.locations.filter(l => !l.parentId);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm animate-scale-in">
        <DialogHeader>
          <DialogTitle>{editLocation ? 'Редактировать локацию' : 'Новая локация'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Название *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="Стеллаж А / Полка 1..." autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Описание</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Ряд 1, левая сторона..." />
          </div>
          <div className="space-y-1.5">
            <Label>Родительская локация</Label>
            <select value={parentId} onChange={e => setParentId(e.target.value)}
              className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
              <option value="">— Верхний уровень —</option>
              {topLevel.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleSave} disabled={!name.trim()} className="flex-1">
              {editLocation ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Move Item Modal (drag result) ────────────────────────────────────────────
function MoveItemModal({
  itemId, fromLocationId, toLocationId, state, onStateChange, onClose,
}: {
  itemId: string;
  fromLocationId: string;
  toLocationId: string;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
}) {
  const item = state.items.find(i => i.id === itemId);
  const fromLoc = state.locations.find(l => l.id === fromLocationId);
  const toLoc = state.locations.find(l => l.id === toLocationId);
  const fromStock = (state.locationStocks || []).find(ls => ls.itemId === itemId && ls.locationId === fromLocationId)?.quantity || 0;
  const [qty, setQty] = useState(String(fromStock));

  if (!item || !fromLoc || !toLoc) return null;
  const qtyNum = parseInt(qty) || 0;

  const handleMove = () => {
    if (qtyNum <= 0 || qtyNum > fromStock) return;

    // Update locationStocks
    let newStocks = [...(state.locationStocks || [])];

    // Deduct from source
    const srcIdx = newStocks.findIndex(ls => ls.itemId === itemId && ls.locationId === fromLocationId);
    if (srcIdx >= 0) {
      const newQty = newStocks[srcIdx].quantity - qtyNum;
      if (newQty <= 0) newStocks = newStocks.filter((_, i) => i !== srcIdx);
      else newStocks[srcIdx] = { ...newStocks[srcIdx], quantity: newQty };
    }

    // Add to destination
    const dstIdx = newStocks.findIndex(ls => ls.itemId === itemId && ls.locationId === toLocationId);
    if (dstIdx >= 0) {
      newStocks[dstIdx] = { ...newStocks[dstIdx], quantity: newStocks[dstIdx].quantity + qtyNum };
    } else {
      newStocks.push({ itemId, locationId: toLocationId, quantity: qtyNum });
    }

    // Update item's primary location if all stock moved
    const remainingInSrc = newStocks.find(ls => ls.itemId === itemId && ls.locationId === fromLocationId);
    let updatedItems = state.items;
    if (!remainingInSrc && item.locationId === fromLocationId) {
      updatedItems = state.items.map(i => i.id === itemId ? { ...i, locationId: toLocationId } : i);
    }

    const next = { ...state, locationStocks: newStocks, items: updatedItems };
    onStateChange(next); saveState(next);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="ArrowRight" size={16} />
            </div>
            Переместить товар
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-muted rounded-lg">
            <div className="font-semibold text-sm">{item.name}</div>
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Icon name="MapPin" size={11} />{fromLoc.name}</span>
              <Icon name="ArrowRight" size={11} />
              <span className="flex items-center gap-1 text-primary font-medium"><Icon name="MapPin" size={11} />{toLoc.name}</span>
            </div>
            <div className="text-xs text-muted-foreground mt-1">Доступно на {fromLoc.name}: <b className="text-foreground">{fromStock} {item.unit}</b></div>
          </div>

          <div className="space-y-1.5">
            <Label>Количество для перемещения</Label>
            <div className="flex items-center gap-2">
              <button onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                <Icon name="Minus" size={14} />
              </button>
              <Input type="number" min="1" max={fromStock} value={qty} onChange={e => setQty(e.target.value)} className="text-center text-lg font-bold" />
              <button onClick={() => setQty(String(Math.min(fromStock, qtyNum + 1)))}
                className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                <Icon name="Plus" size={14} />
              </button>
            </div>
            {qtyNum > fromStock && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Icon name="AlertCircle" size={11} />Недостаточно на {fromLoc.name}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleMove} disabled={qtyNum <= 0 || qtyNum > fromStock} className="flex-1">
              <Icon name="ArrowRight" size={14} className="mr-1.5" />
              Переместить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Location Card (on map) ───────────────────────────────────────────────────
function LocationCard({
  location, state, isSelected, isDragOver,
  onSelect, onDragOver, onDragLeave, onDrop, onItemDragStart,
  color, search, categoryFilter,
}: {
  location: Location;
  state: AppState;
  isSelected: boolean;
  isDragOver: boolean;
  onSelect: () => void;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onItemDragStart: (e: React.DragEvent, itemId: string, fromLocationId: string) => void;
  color: string;
  search: string;
  categoryFilter: string;
}) {
  const locStocks = (state.locationStocks || [])
    .filter(ls => ls.locationId === location.id && ls.quantity > 0);

  const itemsHere = locStocks
    .map(ls => ({ ...ls, item: state.items.find(i => i.id === ls.itemId) }))
    .filter(ls => ls.item)
    .filter(ls => {
      if (categoryFilter !== 'all' && ls.item!.categoryId !== categoryFilter) return false;
      if (search && !ls.item!.name.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });

  const worstLevel = itemsHere.reduce<'ok' | 'low' | 'critical'>((worst, ls) => {
    const lvl = getStockLevel(ls.quantity, ls.item!.lowStockThreshold);
    if (lvl === 'critical') return 'critical';
    if (lvl === 'low' && worst !== 'critical') return 'low';
    return worst;
  }, 'ok');

  const hasHighlight = search || categoryFilter !== 'all';
  const dimmed = hasHighlight && itemsHere.length === 0;

  return (
    <div
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onClick={onSelect}
      className={`relative rounded-xl border-2 cursor-pointer transition-all duration-150 select-none overflow-hidden
        ${isSelected ? 'border-primary shadow-card-hover' : isDragOver ? 'border-primary/60 bg-accent/30' : 'border-border hover:border-primary/40 hover:shadow-card'}
        ${dimmed ? 'opacity-35' : ''}
        bg-card shadow-card`}
      style={{ minHeight: '120px' }}
    >
      {/* Color bar */}
      <div className="h-1 w-full" style={{ backgroundColor: color }} />

      <div className="p-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-1 mb-2">
          <div>
            <div className="font-semibold text-xs text-foreground leading-tight">{location.name}</div>
            {location.description && (
              <div className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{location.description}</div>
            )}
          </div>
          {itemsHere.length > 0 && (
            <div className={`w-2 h-2 rounded-full shrink-0 mt-0.5 ${stockDotColor(worstLevel)}`} />
          )}
        </div>

        {/* Items */}
        {isDragOver ? (
          <div className="flex flex-col items-center justify-center py-2 gap-1 text-primary">
            <Icon name="PackagePlus" size={18} />
            <span className="text-[10px] font-medium">Переместить сюда</span>
          </div>
        ) : itemsHere.length === 0 ? (
          <div className="text-[10px] text-muted-foreground/50 italic text-center py-2">пусто</div>
        ) : (
          <div className="space-y-1">
            {itemsHere.slice(0, 4).map(ls => {
              const level = getStockLevel(ls.quantity, ls.item!.lowStockThreshold);
              const cat = state.categories.find(c => c.id === ls.item!.categoryId);
              return (
                <div
                  key={ls.itemId}
                  draggable
                  onDragStart={e => { e.stopPropagation(); onItemDragStart(e, ls.itemId, location.id); }}
                  onClick={e => e.stopPropagation()}
                  className="flex items-center gap-1.5 cursor-grab active:cursor-grabbing group/item"
                  title={`${ls.item!.name} — перетащите для перемещения`}
                >
                  <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${stockDotColor(level)}`} />
                  <span className="text-[10px] text-foreground flex-1 truncate leading-tight">{ls.item!.name}</span>
                  <span className={`text-[10px] font-bold tabular-nums shrink-0
                    ${level === 'critical' ? 'text-destructive' : level === 'low' ? 'text-warning' : 'text-muted-foreground'}`}>
                    {ls.quantity}
                    <span className="font-normal ml-0.5">{ls.item!.unit}</span>
                  </span>
                </div>
              );
            })}
            {itemsHere.length > 4 && (
              <div className="text-[10px] text-muted-foreground text-center">+{itemsHere.length - 4} ещё...</div>
            )}
          </div>
        )}
      </div>

      {/* Drag overlay hint */}
      {isDragOver && (
        <div className="absolute inset-0 bg-primary/5 border-2 border-dashed border-primary rounded-xl pointer-events-none" />
      )}
    </div>
  );
}

// ─── Location Detail Panel ────────────────────────────────────────────────────
function LocationDetailPanel({
  location, state, onStateChange, onClose, onItemSelect, onItemDragStart,
}: {
  location: Location;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  onItemSelect: (itemId: string) => void;
  onItemDragStart: (e: React.DragEvent, itemId: string, fromLocationId: string) => void;
}) {
  const locStocks = (state.locationStocks || [])
    .filter(ls => ls.locationId === location.id && ls.quantity > 0)
    .map(ls => ({ ...ls, item: state.items.find(i => i.id === ls.itemId) }))
    .filter(ls => ls.item)
    .sort((a, b) => a.item!.name.localeCompare(b.item!.name, 'ru'));

  const totalItems = locStocks.length;
  const totalUnits = locStocks.reduce((s, ls) => s + ls.quantity, 0);

  const handleQR = () => {
    const url = `${window.location.origin}/?location=${location.id}`;
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`, '_blank');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-lg text-foreground">{location.name}</h3>
          {location.description && <p className="text-sm text-muted-foreground mt-0.5">{location.description}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{totalItems} позиций</span>
            <span>{totalUnits} единиц</span>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground shrink-0">
          <Icon name="X" size={15} />
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 mb-4">
        <Button variant="outline" size="sm" onClick={handleQR} className="flex items-center gap-1.5 flex-1">
          <Icon name="QrCode" size={13} />QR-код
        </Button>
      </div>

      {/* Items */}
      {locStocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Icon name="Package" size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-0.5">Локация пуста</p>
          <p className="text-xs text-muted-foreground">Перетащите сюда товар с другой локации</p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {locStocks.map(ls => {
            const level = getStockLevel(ls.quantity, ls.item!.lowStockThreshold);
            const cat = state.categories.find(c => c.id === ls.item!.categoryId);
            const otherLocs = (state.locationStocks || [])
              .filter(s => s.itemId === ls.itemId && s.locationId !== location.id && s.quantity > 0)
              .map(s => ({ ...s, loc: state.locations.find(l => l.id === s.locationId) }));

            return (
              <div
                key={ls.itemId}
                draggable
                onDragStart={e => onItemDragStart(e, ls.itemId, location.id)}
                className={`group p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-card
                  ${level === 'critical' ? 'border-destructive/30 bg-destructive/4' : level === 'low' ? 'border-warning/30 bg-warning/4' : 'border-border bg-card hover:bg-muted/30'}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${stockDotColor(level)}`} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onItemSelect(ls.itemId)}
                      className="font-semibold text-sm text-foreground hover:text-primary transition-colors text-left w-full truncate"
                    >
                      {ls.item!.name}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {cat && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: cat.color + '18', color: cat.color }}>
                          {cat.name}
                        </span>
                      )}
                      {level !== 'ok' && (
                        <span className={`text-[11px] font-semibold ${level === 'critical' ? 'text-destructive' : 'text-warning'}`}>
                          {level === 'critical' ? 'Нет в наличии' : 'Мало'}
                        </span>
                      )}
                    </div>
                    {otherLocs.length > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Ещё: {otherLocs.map(ol => `${ol.loc?.name} (${ol.quantity})`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-base font-bold tabular-nums
                      ${level === 'critical' ? 'text-destructive' : level === 'low' ? 'text-warning' : 'text-foreground'}`}>
                      {ls.quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">{ls.item!.unit}</div>
                  </div>
                </div>

                <div className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                  <Icon name="GripHorizontal" size={11} />
                  <span>Перетащите для перемещения · </span>
                  <button onClick={() => onItemSelect(ls.itemId)} className="text-primary hover:underline">открыть карточку</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function WarehouseMapPage({ state, onStateChange }: Props) {
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [editLocation, setEditLocation] = useState<Location | undefined>();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ itemId: string; fromLocationId: string } | null>(null);
  const [dragOverLocationId, setDragOverLocationId] = useState<string | null>(null);
  const [moveModal, setMoveModal] = useState<{ itemId: string; fromLocationId: string; toLocationId: string } | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [layout, setLayout] = useState<WarehouseLayout>(() => {
    try {
      const saved = localStorage.getItem('warehouse_layout_v1');
      if (saved) return JSON.parse(saved);
    } catch (e) { /* ignore */ }
    return DEFAULT_LAYOUT;
  });

  const saveLayout = (l: WarehouseLayout) => {
    setLayout(l);
    localStorage.setItem('warehouse_layout_v1', JSON.stringify(l));
  };

  const selectedLocation = selectedLocationId ? state.locations.find(l => l.id === selectedLocationId) : null;
  const selectedItem = selectedItemId ? state.items.find(i => i.id === selectedItemId) || null : null;

  // Stats
  const totalLocations = state.locations.length;
  const occupiedLocations = state.locations.filter(loc =>
    (state.locationStocks || []).some(ls => ls.locationId === loc.id && ls.quantity > 0)
  ).length;
  const lowItems = state.items.filter(i => i.quantity > 0 && i.quantity <= i.lowStockThreshold).length;
  const criticalItems = state.items.filter(i => i.quantity === 0).length;

  // Color map for locations
  const locationColors = useMemo(() => {
    const map: Record<string, string> = {};
    // Use layout cell colors first
    layout.cells.forEach(cell => {
      if (cell.color) map[cell.locationId] = cell.color;
    });
    // Fill rest from ZONE_COLORS
    state.locations.forEach((loc, i) => {
      if (!map[loc.id]) map[loc.id] = ZONE_COLORS[i % ZONE_COLORS.length];
    });
    return map;
  }, [layout, state.locations]);

  // Search highlight: which locations have matching items
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

  // Drag handlers
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
    onStateChange(next); saveState(next);
    if (selectedLocationId === locId) setSelectedLocationId(null);

    // Also remove from layout
    const newLayout = { ...layout, cells: layout.cells.filter(c => c.locationId !== locId) };
    saveLayout(newLayout);
  };

  // Top-level locations (shelving units/zones)
  const topLocations = state.locations.filter(l => !l.parentId);
  const childLocations = (parentId: string) => state.locations.filter(l => l.parentId === parentId);

  return (
    <div className="space-y-5 pb-24 md:pb-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Карта склада</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {totalLocations} локаций · {occupiedLocations} занято
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setViewMode(v => v === 'grid' ? 'list' : 'grid')} className="flex items-center gap-1.5">
            <Icon name={viewMode === 'grid' ? 'List' : 'LayoutGrid'} size={14} />
            {viewMode === 'grid' ? 'Список' : 'Сетка'}
          </Button>
          <Button onClick={() => { setEditLocation(undefined); setShowAddLocation(true); }} className="flex items-center gap-2">
            <Icon name="Plus" size={15} />
            Локация
          </Button>
        </div>
      </div>

      {/* Stats */}
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

      {/* Search + filter */}
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

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-success" />В норме</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning" />Мало</span>
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-destructive" />Нет</span>
        <span className="flex items-center gap-1.5 ml-auto"><Icon name="GripHorizontal" size={12} />Перетащите товар между локациями</span>
      </div>

      {/* Main content: map + detail panel */}
      <div className={`flex gap-4 ${selectedLocation ? 'items-start' : ''}`}>

        {/* Map area */}
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
            /* Grid view — hierarchical (top-level + children) */
            <div className="space-y-5">
              {topLocations.map(topLoc => {
                const children = childLocations(topLoc.id);
                const allLocs = children.length > 0 ? [topLoc, ...children] : [topLoc];

                return (
                  <div key={topLoc.id} className="space-y-2">
                    {/* Zone header */}
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

                    {/* Grid of locations */}
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
                      {/* Add child location button */}
                      <button
                        onClick={() => {
                          setEditLocation({ id: '', name: '', parentId: topLoc.id });
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

              {/* Add top-level zone */}
              <button
                onClick={() => { setEditLocation(undefined); setShowAddLocation(true); }}
                className="w-full rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex items-center justify-center gap-2 py-6 text-muted-foreground hover:text-foreground"
              >
                <Icon name="Plus" size={16} />
                <span className="text-sm font-medium">Добавить зону / стеллаж</span>
              </button>
            </div>
          ) : (
            /* List view */
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
                  {state.locations.map((loc, idx) => {
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

        {/* Detail panel */}
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

      {/* Modals */}
      {showAddLocation && (
        <AddLocationModal
          state={state}
          onStateChange={onStateChange}
          onClose={() => { setShowAddLocation(false); setEditLocation(undefined); }}
          editLocation={editLocation?.id ? editLocation : undefined}
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
    </div>
  );
}
