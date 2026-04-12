import { useState } from 'react';
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

export default MoveItemModal;
