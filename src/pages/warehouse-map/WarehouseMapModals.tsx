import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Location, Operation, Warehouse, crudAction, generateId, updateLocationStock, updateWarehouseStock } from '@/data/store';

export function AddItemToLocationModal({
  locationId, state, onStateChange, onClose,
}: {
  locationId: string;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
}) {
  const location = state.locations.find(l => l.id === locationId);
  const warehouseId = location?.warehouseId;

  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [search, setSearch] = useState('');

  const warehouseItems = useMemo(() => {
    const whStocks = (state.warehouseStocks || []).filter(ws =>
      ws.warehouseId === warehouseId && ws.quantity > 0
    );
    return whStocks
      .map(ws => ({
        ...ws,
        item: state.items.find(i => i.id === ws.itemId),
      }))
      .filter(ws => ws.item)
      .filter(ws => !search.trim() || ws.item!.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 30);
  }, [state.warehouseStocks, state.items, warehouseId, search]);

  const selectedItem = itemId ? state.items.find(i => i.id === itemId) : null;
  const whAvailable = itemId
    ? (state.warehouseStocks || []).find(ws => ws.itemId === itemId && ws.warehouseId === warehouseId)?.quantity || 0
    : 0;
  const alreadyHere = itemId
    ? (state.locationStocks || []).find(ls => ls.itemId === itemId && ls.locationId === locationId)?.quantity || 0
    : 0;
  const distributedOnShelf = itemId
    ? (state.locationStocks || [])
        .filter(ls => ls.itemId === itemId)
        .reduce((s, ls) => s + ls.quantity, 0)
    : 0;
  const freeToPlace = Math.max(0, whAvailable - distributedOnShelf + alreadyHere);

  const qtyNum = parseInt(qty) || 0;
  const isInvalid = !itemId || qtyNum <= 0 || qtyNum > freeToPlace;

  const handleAdd = () => {
    if (isInvalid) return;
    const next = updateLocationStock(state, itemId, locationId, qtyNum);
    onStateChange(next);
    const updatedLocationStock = (next.locationStocks || []).find(ls => ls.itemId === itemId && ls.locationId === locationId);
    if (updatedLocationStock) crudAction('upsert_location_stock', { locationStock: updatedLocationStock });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="MapPin" size={16} className="text-primary" />
            Разместить товар: {location?.name}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {!warehouseId ? (
            <div className="p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-warning flex items-center gap-2">
              <Icon name="AlertTriangle" size={14} />
              Стеллаж не привязан к складу. Отредактируйте локацию.
            </div>
          ) : warehouseItems.length === 0 && !search.trim() ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Icon name="Package" size={24} className="mx-auto mb-2 opacity-40" />
              На этом складе нет товаров для размещения
            </div>
          ) : (<>
            <div className="space-y-1.5">
              <Label>Товар со склада</Label>
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setItemId(''); }}
                placeholder="Начните вводить название..."
                autoFocus
              />
            </div>

            {(search.trim() || warehouseItems.length > 0) && (
              <div className="border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                {warehouseItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Не найдено</p>
                ) : warehouseItems.map(ws => {
                  const cat = state.categories.find(c => c.id === ws.item!.categoryId);
                  const onShelf = (state.locationStocks || []).find(ls => ls.itemId === ws.itemId && ls.locationId === locationId)?.quantity || 0;
                  const distributed = (state.locationStocks || []).filter(ls => ls.itemId === ws.itemId).reduce((s, ls) => s + ls.quantity, 0);
                  const free = Math.max(0, ws.quantity - distributed + onShelf);
                  return (
                    <button key={ws.itemId}
                      onClick={() => { setItemId(ws.itemId); setSearch(ws.item!.name); setQty('1'); }}
                      disabled={free <= 0}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm transition-colors border-b border-border/50 last:border-0
                        ${itemId === ws.itemId ? 'bg-accent' : free <= 0 ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}`}>
                      <div>
                        <div className="font-medium">{ws.item!.name}</div>
                        {cat && <div className="text-xs" style={{ color: cat.color }}>{cat.name}</div>}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className={`text-xs font-semibold ${free <= 0 ? 'text-destructive' : 'text-foreground'}`}>
                          {free > 0 ? `свободно: ${free}` : 'всё размещено'}
                        </div>
                        {onShelf > 0 && <div className="text-xs text-primary">здесь: {onShelf}</div>}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {selectedItem && (
              <div className="p-3 bg-muted/50 rounded-xl text-sm space-y-1">
                <div className="font-semibold">{selectedItem.name}</div>
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>На складе: <b className="text-foreground">{whAvailable} {selectedItem.unit}</b></span>
                  <span>Свободно: <b className="text-foreground">{freeToPlace} {selectedItem.unit}</b></span>
                </div>
                {alreadyHere > 0 && <div className="text-xs text-primary">Уже на этом стеллаже: {alreadyHere} {selectedItem.unit}</div>}
              </div>
            )}

            {itemId && (
              <div className="space-y-1.5">
                <Label>Количество (из {freeToPlace} {selectedItem?.unit} свободных)</Label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                    className="w-9 h-9 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center">
                    <Icon name="Minus" size={13} />
                  </button>
                  <Input type="number" min="1" max={freeToPlace} value={qty}
                    onChange={e => setQty(e.target.value)} className="text-center font-bold" />
                  <button type="button" onClick={() => setQty(String(Math.min(freeToPlace, qtyNum + 1)))}
                    className="w-9 h-9 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center">
                    <Icon name="Plus" size={13} />
                  </button>
                </div>
                <button onClick={() => setQty(String(freeToPlace))} className="text-xs text-primary hover:underline">
                  Всё ({freeToPlace} {selectedItem?.unit})
                </button>
                {qtyNum > freeToPlace && (
                  <p className="text-xs text-destructive flex items-center gap-1">
                    <Icon name="AlertCircle" size={11} />Превышает доступное количество
                  </p>
                )}
              </div>
            )}
          </>)}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleAdd} disabled={isInvalid || !warehouseId}
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold">
              <Icon name="MapPin" size={14} className="mr-1.5" />Разместить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function AddLocationModal({
  state, onStateChange, onClose, editLocation, activeWarehouseId,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  editLocation?: Location;
  activeWarehouseId?: string;
}) {
  const [name, setName] = useState(editLocation?.name || '');
  const [description, setDescription] = useState(editLocation?.description || '');
  const [parentId, setParentId] = useState(editLocation?.parentId || '');
  const [warehouseId, setWarehouseId] = useState(editLocation?.warehouseId || activeWarehouseId || (state.warehouses?.[0]?.id || ''));

  const handleSave = () => {
    if (!name.trim()) return;
    if (editLocation && editLocation.id) {
      const next = {
        ...state,
        locations: state.locations.map(l =>
          l.id === editLocation.id
            ? { ...l, name: name.trim(), description: description.trim() || undefined, parentId: parentId || undefined, warehouseId: warehouseId || undefined }
            : l
        ),
      };
      const updatedLocation = { ...editLocation, name: name.trim(), description: description.trim() || undefined, parentId: parentId || undefined, warehouseId: warehouseId || undefined };
      onStateChange(next); crudAction('upsert_location', { location: updatedLocation });
    } else {
      const newLoc: Location = {
        id: generateId(),
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: parentId || undefined,
        warehouseId: warehouseId || undefined,
      };
      const next = { ...state, locations: [...state.locations, newLoc] };
      onStateChange(next); crudAction('upsert_location', { location: newLoc });
    }
    onClose();
  };

  const topLevel = state.locations.filter(l => !l.parentId && (!l.warehouseId || l.warehouseId === warehouseId));

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
          {(state.warehouses || []).length > 1 && (
            <div className="space-y-1.5">
              <Label>Склад *</Label>
              <select value={warehouseId} onChange={e => { setWarehouseId(e.target.value); setParentId(''); }}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {(state.warehouses || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          )}
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

export function MoveItemModal({
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

    let newStocks = [...(state.locationStocks || [])];

    const srcIdx = newStocks.findIndex(ls => ls.itemId === itemId && ls.locationId === fromLocationId);
    if (srcIdx >= 0) {
      const newQty = newStocks[srcIdx].quantity - qtyNum;
      if (newQty <= 0) newStocks = newStocks.filter((_, i) => i !== srcIdx);
      else newStocks[srcIdx] = { ...newStocks[srcIdx], quantity: newQty };
    }

    const dstIdx = newStocks.findIndex(ls => ls.itemId === itemId && ls.locationId === toLocationId);
    if (dstIdx >= 0) {
      newStocks[dstIdx] = { ...newStocks[dstIdx], quantity: newStocks[dstIdx].quantity + qtyNum };
    } else {
      newStocks.push({ itemId, locationId: toLocationId, quantity: qtyNum });
    }

    const remainingInSrc = newStocks.find(ls => ls.itemId === itemId && ls.locationId === fromLocationId);
    let updatedItems = state.items;
    if (!remainingInSrc && item.locationId === fromLocationId) {
      updatedItems = state.items.map(i => i.id === itemId ? { ...i, locationId: toLocationId } : i);
    }

    const next = { ...state, locationStocks: newStocks, items: updatedItems };
    onStateChange(next);
    const fromLS = newStocks.find(ls => ls.itemId === itemId && ls.locationId === fromLocationId);
    const toLS = newStocks.find(ls => ls.itemId === itemId && ls.locationId === toLocationId);
    const affectedStocks = [fromLS, toLS].filter(Boolean);
    for (const ls of affectedStocks) {
      crudAction('upsert_location_stock', { locationStock: ls });
    }
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

export function TransferWarehouseModal({
  state, onStateChange, onClose, defaultFromId,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  defaultFromId?: string;
}) {
  const warehouses: Warehouse[] = state.warehouses || [];
  const [fromWhId, setFromWhId] = useState(defaultFromId || warehouses[0]?.id || '');
  const [toWhId, setToWhId] = useState(warehouses.find(w => w.id !== fromWhId)?.id || '');
  const [itemId, setItemId] = useState('');
  const [qty, setQty] = useState('1');
  const [search, setSearch] = useState('');
  const [comment, setComment] = useState('');

  const fromWh = warehouses.find(w => w.id === fromWhId);
  const toWh = warehouses.find(w => w.id === toWhId);

  const availableItems = (state.warehouseStocks || [])
    .filter(ws => ws.warehouseId === fromWhId && ws.quantity > 0)
    .map(ws => ({ ...ws, item: state.items.find(i => i.id === ws.itemId) }))
    .filter(ws => ws.item)
    .filter(ws => !search.trim() || ws.item!.name.toLowerCase().includes(search.toLowerCase()));

  const selectedStock = itemId ? (state.warehouseStocks || []).find(ws => ws.itemId === itemId && ws.warehouseId === fromWhId)?.quantity || 0 : 0;
  const selectedItem = itemId ? state.items.find(i => i.id === itemId) : null;
  const qtyNum = parseInt(qty) || 0;

  const isValid = fromWhId && toWhId && fromWhId !== toWhId && itemId && qtyNum > 0 && qtyNum <= selectedStock;

  const handleTransfer = () => {
    if (!isValid || !selectedItem) return;

    let next = updateWarehouseStock(state, itemId, fromWhId, -qtyNum);
    next = updateWarehouseStock(next, itemId, toWhId, qtyNum);

    const op: Operation = {
      id: generateId(),
      itemId,
      type: 'out',
      quantity: qtyNum,
      comment: `[Перемещение] ${fromWh?.name} → ${toWh?.name}${comment ? ': ' + comment : ''}`,
      from: fromWh?.name,
      to: toWh?.name,
      performedBy: state.currentUser,
      date: new Date().toISOString(),
      warehouseId: fromWhId,
    };
    const opIn: Operation = {
      id: generateId(),
      itemId,
      type: 'in',
      quantity: qtyNum,
      comment: `[Перемещение] ${fromWh?.name} → ${toWh?.name}${comment ? ': ' + comment : ''}`,
      from: fromWh?.name,
      to: toWh?.name,
      performedBy: state.currentUser,
      date: new Date().toISOString(),
      warehouseId: toWhId,
    };
    next = { ...next, operations: [opIn, op, ...next.operations] };
    onStateChange(next);
    const updatedItem = next.items.find(i => i.id === itemId);
    const wsArr = (next.warehouseStocks || []).filter(w => w.itemId === itemId);
    crudAction('upsert_operation', { operation: op, item: updatedItem, warehouseStocks: wsArr });
    crudAction('upsert_operation', { operation: opIn, item: updatedItem, warehouseStocks: wsArr });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="ArrowLeftRight" size={16} />
            </div>
            Перемещение между складами
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2">
            <div className="space-y-1">
              <Label className="text-xs">Откуда</Label>
              <select value={fromWhId} onChange={e => { setFromWhId(e.target.value); setItemId(''); setSearch(''); }}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="pt-5">
              <Icon name="ArrowRight" size={18} className="text-muted-foreground" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Куда</Label>
              <select value={toWhId} onChange={e => setToWhId(e.target.value)}
                className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                {warehouses.filter(w => w.id !== fromWhId).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Товар</Label>
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setItemId(''); }}
              placeholder="Найти товар..."
              autoFocus
            />
            {(search.trim() || !itemId) && availableItems.length > 0 && (
              <div className="border border-border rounded-xl overflow-hidden max-h-44 overflow-y-auto">
                {availableItems.map(ws => (
                  <button key={ws.itemId} onClick={() => { setItemId(ws.itemId); setSearch(ws.item!.name); setQty('1'); }}
                    className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm transition-colors border-b border-border/50 last:border-0
                      ${itemId === ws.itemId ? 'bg-accent' : 'hover:bg-muted'}`}>
                    <span className="font-medium truncate">{ws.item!.name}</span>
                    <span className="text-xs text-muted-foreground ml-2 shrink-0">{ws.quantity} {ws.item!.unit}</span>
                  </button>
                ))}
              </div>
            )}
            {search.trim() && availableItems.length === 0 && (
              <p className="text-xs text-muted-foreground px-1">На складе «{fromWh?.name}» таких товаров нет</p>
            )}
          </div>

          {selectedItem && (
            <div className="p-3 bg-muted/50 rounded-xl text-sm">
              <div className="font-semibold">{selectedItem.name}</div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Доступно на «{fromWh?.name}»: <b className="text-foreground">{selectedStock} {selectedItem.unit}</b>
              </div>
            </div>
          )}

          {itemId && (
            <div className="space-y-1.5">
              <Label>Количество ({selectedItem?.unit})</Label>
              <div className="flex items-center gap-2">
                <button onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                  className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                  <Icon name="Minus" size={14} />
                </button>
                <Input type="number" min="1" max={selectedStock} value={qty}
                  onChange={e => setQty(e.target.value)} className="text-center text-lg font-bold" />
                <button onClick={() => setQty(String(Math.min(selectedStock, qtyNum + 1)))}
                  className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                  <Icon name="Plus" size={14} />
                </button>
              </div>
              <button onClick={() => setQty(String(selectedStock))}
                className="text-xs text-primary hover:underline">
                Всё ({selectedStock} {selectedItem?.unit})
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <Label>Комментарий (необязательно)</Label>
            <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Причина перемещения..." />
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleTransfer} disabled={!isValid} className="flex-1">
              <Icon name="ArrowLeftRight" size={14} className="mr-1.5" />
              Переместить {qtyNum > 0 ? `${qtyNum} ${selectedItem?.unit || ''}` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
