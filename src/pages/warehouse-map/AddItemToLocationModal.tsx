import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, crudAction, updateLocationStock } from '@/data/store';

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
  const hasChildren = state.locations.some(l => l.parentId === locationId);

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
  const whLocationIds = new Set(
    state.locations.filter(l => l.warehouseId === warehouseId).map(l => l.id)
  );
  const distributedOnShelf = itemId
    ? (state.locationStocks || [])
        .filter(ls => ls.itemId === itemId && whLocationIds.has(ls.locationId))
        .reduce((s, ls) => s + ls.quantity, 0)
    : 0;
  const freeToPlace = Math.max(0, whAvailable - distributedOnShelf + alreadyHere);

  const qtyNum = parseInt(qty) || 0;
  const alreadyPlaced = alreadyHere > 0;
  const isInvalid = !itemId || qtyNum <= 0 || qtyNum > freeToPlace || alreadyPlaced;

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
          {hasChildren ? (
            <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm text-foreground flex items-start gap-2">
              <Icon name="Info" size={14} className="text-primary mt-0.5 shrink-0" />
              <div>
                <b>Это стеллаж-контейнер.</b> Товар нельзя класть прямо на стеллаж — выбери конкретную полку внутри него.
              </div>
            </div>
          ) : !warehouseId ? (
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
                  const distributed = (state.locationStocks || []).filter(ls => ls.itemId === ws.itemId && whLocationIds.has(ls.locationId)).reduce((s, ls) => s + ls.quantity, 0);
                  const free = Math.max(0, ws.quantity - distributed + onShelf);
                  const placedHere = onShelf > 0;
                  const disabled = free <= 0 || placedHere;
                  return (
                    <button key={ws.itemId}
                      onClick={() => { if (disabled) return; setItemId(ws.itemId); setSearch(ws.item!.name); setQty('1'); }}
                      disabled={disabled}
                      title={placedHere ? 'Этот товар уже на этом стеллаже' : undefined}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm transition-colors border-b border-border/50 last:border-0
                        ${itemId === ws.itemId ? 'bg-accent' : disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-muted'}`}>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate">{ws.item!.name}</div>
                        {cat && <div className="text-xs" style={{ color: cat.color }}>{cat.name}</div>}
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <div className={`text-xs font-semibold ${placedHere ? 'text-warning' : free <= 0 ? 'text-destructive' : 'text-foreground'}`}>
                          {placedHere ? 'уже здесь' : free > 0 ? `свободно: ${free}` : 'всё размещено'}
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
                <div className="font-semibold break-words">{selectedItem.name}</div>
                <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                  <span>На складе: <b className="text-foreground">{whAvailable} {selectedItem.unit}</b></span>
                  <span>Свободно: <b className="text-foreground">{freeToPlace} {selectedItem.unit}</b></span>
                </div>
                {alreadyPlaced && (
                  <div className="text-xs text-destructive flex items-center gap-1 pt-1">
                    <Icon name="AlertCircle" size={11} />
                    Этот товар уже размещён на этом стеллаже ({alreadyHere} {selectedItem.unit})
                  </div>
                )}
              </div>
            )}

            {itemId && !alreadyPlaced && (
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

export default AddItemToLocationModal;