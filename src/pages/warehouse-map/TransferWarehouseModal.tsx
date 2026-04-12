import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Operation, Warehouse, crudAction, generateId, updateWarehouseStock } from '@/data/store';

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

export default TransferWarehouseModal;
