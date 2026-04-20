import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, crudAction } from '@/data/store';

export function MoveItemModal({
  itemId, fromLocationId, toLocationId, state, onStateChange, onClose,
}: {
  itemId: string;
  fromLocationId: string;
  toLocationId?: string;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
}) {
  const item = state.items.find(i => i.id === itemId);
  const fromLoc = state.locations.find(l => l.id === fromLocationId);
  const fromStock = (state.locationStocks || []).find(ls => ls.itemId === itemId && ls.locationId === fromLocationId)?.quantity || 0;
  const [qty, setQty] = useState(String(fromStock));
  const [selectedToId, setSelectedToId] = useState<string>(toLocationId || '');
  const [search, setSearch] = useState('');

  const targetOptions = useMemo(() => {
    const warehouseId = fromLoc?.warehouseId;
    return state.locations
      .filter(l => l.id !== fromLocationId)
      .filter(l => !state.locations.some(ch => ch.parentId === l.id))
      .filter(l => !warehouseId || !l.warehouseId || l.warehouseId === warehouseId)
      .filter(l => !search.trim() || l.name.toLowerCase().includes(search.toLowerCase()))
      .slice(0, 30);
  }, [state.locations, fromLocationId, fromLoc, search]);

  const toLoc = state.locations.find(l => l.id === selectedToId);

  if (!item || !fromLoc) return null;
  const qtyNum = parseInt(qty) || 0;

  const handleMove = () => {
    if (qtyNum <= 0 || qtyNum > fromStock || !selectedToId) return;

    let newStocks = [...(state.locationStocks || [])];

    const srcIdx = newStocks.findIndex(ls => ls.itemId === itemId && ls.locationId === fromLocationId);
    if (srcIdx >= 0) {
      const newQty = newStocks[srcIdx].quantity - qtyNum;
      if (newQty <= 0) newStocks = newStocks.filter((_, i) => i !== srcIdx);
      else newStocks[srcIdx] = { ...newStocks[srcIdx], quantity: newQty };
    }

    const dstIdx = newStocks.findIndex(ls => ls.itemId === itemId && ls.locationId === selectedToId);
    if (dstIdx >= 0) {
      newStocks[dstIdx] = { ...newStocks[dstIdx], quantity: newStocks[dstIdx].quantity + qtyNum };
    } else {
      newStocks.push({ itemId, locationId: selectedToId, quantity: qtyNum });
    }

    const remainingInSrc = newStocks.find(ls => ls.itemId === itemId && ls.locationId === fromLocationId);
    let updatedItems = state.items;
    if (!remainingInSrc && item.locationId === fromLocationId) {
      updatedItems = state.items.map(i => i.id === itemId ? { ...i, locationId: selectedToId } : i);
    }

    const next = { ...state, locationStocks: newStocks, items: updatedItems };
    onStateChange(next);
    const fromLS = newStocks.find(ls => ls.itemId === itemId && ls.locationId === fromLocationId)
      || { itemId, locationId: fromLocationId, quantity: 0 };
    const toLS = newStocks.find(ls => ls.itemId === itemId && ls.locationId === selectedToId);
    crudAction('upsert_location_stock', { locationStock: fromLS });
    if (toLS) crudAction('upsert_location_stock', { locationStock: toLS });
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
            <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1"><Icon name="MapPin" size={11} />{fromLoc.name}</span>
              <Icon name="ArrowRight" size={11} />
              {toLoc ? (
                <span className="flex items-center gap-1 text-primary font-medium"><Icon name="MapPin" size={11} />{toLoc.name}</span>
              ) : (
                <span className="text-muted-foreground italic">выберите локацию ниже</span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-1">Доступно на {fromLoc.name}: <b className="text-foreground">{fromStock} {item.unit}</b></div>
          </div>

          {!toLocationId && (
            <div className="space-y-1.5">
              <Label>Куда переместить</Label>
              <Input
                value={search}
                onChange={e => { setSearch(e.target.value); setSelectedToId(''); }}
                placeholder="Поиск локации..."
                autoFocus
              />
              <div className="border border-border rounded-xl overflow-hidden max-h-48 overflow-y-auto">
                {targetOptions.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">Не найдено</p>
                ) : targetOptions.map(loc => {
                  const stockHere = (state.locationStocks || []).find(ls => ls.itemId === itemId && ls.locationId === loc.id)?.quantity || 0;
                  const isSelected = selectedToId === loc.id;
                  return (
                    <button
                      key={loc.id}
                      type="button"
                      onClick={() => { setSelectedToId(loc.id); setSearch(loc.name); }}
                      className={`w-full text-left flex items-center justify-between px-3 py-2.5 text-sm transition-colors border-b border-border/50 last:border-0
                        ${isSelected ? 'bg-accent' : 'hover:bg-muted'}`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="font-medium truncate flex items-center gap-1.5">
                          <Icon name="MapPin" size={11} className="text-muted-foreground shrink-0" />
                          {loc.name}
                        </div>
                        {loc.description && <div className="text-xs text-muted-foreground truncate">{loc.description}</div>}
                      </div>
                      {stockHere > 0 && (
                        <div className="text-xs text-primary shrink-0 ml-2">уже здесь: {stockHere}</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

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
            <button onClick={() => setQty(String(fromStock))} className="text-xs text-primary hover:underline">
              Всё ({fromStock} {item.unit})
            </button>
            {qtyNum > fromStock && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <Icon name="AlertCircle" size={11} />Недостаточно на {fromLoc.name}
              </p>
            )}
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleMove} disabled={qtyNum <= 0 || qtyNum > fromStock || !selectedToId} className="flex-1">
              <Icon name="ArrowRight" size={14} className="mr-1.5" />
              Переместить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MoveItemModal;