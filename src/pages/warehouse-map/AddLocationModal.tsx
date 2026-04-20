import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Location, LocationStock, crudAction, generateId } from '@/data/store';

function migrateParentStocksToChild(state: AppState, parentId: string, childId: string): { state: AppState; affected: LocationStock[] } {
  const parentStocks = (state.locationStocks || []).filter(ls => ls.locationId === parentId && ls.quantity > 0);
  if (parentStocks.length === 0) return { state, affected: [] };
  const others = (state.locationStocks || []).filter(ls => ls.locationId !== parentId);
  const moved: LocationStock[] = parentStocks.map(ls => ({ itemId: ls.itemId, locationId: childId, quantity: ls.quantity }));
  const zeroed: LocationStock[] = parentStocks.map(ls => ({ itemId: ls.itemId, locationId: parentId, quantity: 0 }));
  const updatedItems = state.items.map(it => {
    const wasOnParent = parentStocks.some(ls => ls.itemId === it.id);
    return wasOnParent && it.locationId === parentId ? { ...it, locationId: childId } : it;
  });
  return {
    state: { ...state, items: updatedItems, locationStocks: [...others, ...moved] },
    affected: [...zeroed, ...moved],
  };
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
  const [batchMode, setBatchMode] = useState(false);
  const [batchCount, setBatchCount] = useState(3);
  const [prefix, setPrefix] = useState('');

  const parentHasStockNow = parentId
    ? (state.locationStocks || []).some(ls => ls.locationId === parentId && ls.quantity > 0)
    : false;
  const parentHasChildren = parentId
    ? state.locations.some(l => l.parentId === parentId)
    : false;
  const willMigrate = parentHasStockNow && !parentHasChildren;

  const handleSave = () => {
    if (!editLocation && batchMode && batchCount > 1 && prefix.trim()) {
      const newLocs: Location[] = [];
      for (let i = 1; i <= batchCount; i++) {
        newLocs.push({
          id: generateId(),
          name: `${prefix.trim()}${i}`,
          description: description.trim() || undefined,
          parentId: parentId || undefined,
          warehouseId: warehouseId || undefined,
        });
      }
      let next: AppState = { ...state, locations: [...state.locations, ...newLocs] };
      let migratedStocks: LocationStock[] = [];
      if (willMigrate && newLocs[0]) {
        const migration = migrateParentStocksToChild(next, parentId, newLocs[0].id);
        next = migration.state;
        migratedStocks = migration.affected;
      }
      onStateChange(next);
      newLocs.forEach(loc => crudAction('upsert_location', { location: loc }));
      migratedStocks.forEach(ls => crudAction('upsert_location_stock', { locationStock: ls }));
      onClose();
      return;
    }
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
      let next: AppState = { ...state, locations: [...state.locations, newLoc] };
      let migratedStocks: LocationStock[] = [];
      if (willMigrate) {
        const migration = migrateParentStocksToChild(next, parentId, newLoc.id);
        next = migration.state;
        migratedStocks = migration.affected;
      }
      onStateChange(next);
      crudAction('upsert_location', { location: newLoc });
      migratedStocks.forEach(ls => crudAction('upsert_location_stock', { locationStock: ls }));
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
          {willMigrate && !editLocation && (
            <div className="p-2.5 bg-primary/5 border border-primary/20 rounded-lg text-xs text-foreground flex items-start gap-2">
              <Icon name="ArrowDownToLine" size={13} className="text-primary mt-0.5 shrink-0" />
              <div>
                На стеллаже сейчас лежат товары — они автоматически переедут на {batchMode && prefix.trim() ? `«${prefix.trim()}1»` : 'эту новую полку'}, чтобы не зависнуть.
              </div>
            </div>
          )}
          {!editLocation && (
            <div className="space-y-2 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={batchMode} onChange={e => setBatchMode(e.target.checked)}
                  className="rounded border-border" />
                <span className="text-sm font-medium">Создать несколько</span>
              </label>
              {batchMode && (
                <div className="space-y-2 pl-6">
                  <div className="flex gap-2">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Префикс (сектор)</Label>
                      <Input value={prefix} onChange={e => setPrefix(e.target.value)} placeholder="A" className="h-8 text-sm" />
                    </div>
                    <div className="w-24 space-y-1">
                      <Label className="text-xs">Количество</Label>
                      <Input type="number" min={2} max={20} value={batchCount} onChange={e => setBatchCount(Number(e.target.value))} className="h-8 text-sm" />
                    </div>
                  </div>
                  {prefix.trim() && batchCount > 1 && (
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      Будет создано: {Array.from({length: Math.min(batchCount, 20)}, (_, i) => `${prefix.trim()}${i+1}`).join(', ')}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleSave} disabled={batchMode ? (!prefix.trim() || batchCount < 2) : !name.trim()} className="flex-1">
              {editLocation ? 'Сохранить' : batchMode ? `Добавить ${batchCount} шт` : 'Добавить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default AddLocationModal;