import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import {
  AppState, crudAction, generateId,
  WorkOrder, OrderItem, OrderStatus, Operation,
  getLocationStock, updateLocationStock, updateWarehouseStock,
} from '@/data/store';

export default function PickItemModal({
  state, onStateChange, order, orderItem, onClose,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  order: WorkOrder;
  orderItem: OrderItem;
  onClose: () => void;
}) {
  const item = state.items.find(i => i.id === orderItem.itemId)!;
  const remaining = orderItem.requiredQty - orderItem.pickedQty;
  const [selectedLocation, setSelectedLocation] = useState('');
  const [qty, setQty] = useState(String(remaining));

  const locStocksReal = (state.locationStocks || [])
    .filter(ls => ls.itemId === item.id && ls.quantity > 0)
    .map(ls => ({ ...ls, location: state.locations.find(l => l.id === ls.locationId) }))
    .filter(ls => ls.location);

  const hasStocksInLocations = locStocksReal.length > 0;
  const itemDefaultLoc = item.locationId ? state.locations.find(l => l.id === item.locationId) : null;
  const locStocks = hasStocksInLocations
    ? locStocksReal
    : (item.quantity > 0 && itemDefaultLoc)
      ? [{ itemId: item.id, locationId: item.locationId, quantity: item.quantity, location: itemDefaultLoc }]
      : [];

  const locStock = selectedLocation
    ? (hasStocksInLocations ? getLocationStock(state, item.id, selectedLocation) : item.quantity)
    : 0;
  const qtyNum = parseInt(qty) || 0;
  const notEnough = selectedLocation && qtyNum > locStock;

  const handlePick = () => {
    if (!selectedLocation || qtyNum <= 0 || notEnough) return;
    const actual = Math.min(qtyNum, remaining);
    let next = { ...state };
    next = updateLocationStock(next, item.id, selectedLocation, -actual);
    const loc = state.locations.find(l => l.id === selectedLocation);
    const whId = loc?.warehouseId || '';
    if (whId) {
      next = updateWarehouseStock(next, item.id, whId, -actual);
    } else {
      next = { ...next, items: next.items.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - actual) } : i) };
    }
    const newPicked = orderItem.pickedQty + actual;
    const newStatus: OrderItem['status'] = newPicked >= orderItem.requiredQty ? 'done' : 'partial';
    const updatedOrders = next.workOrders.map(o => {
      if (o.id !== order.id) return o;
      const updatedItems = o.items.map(oi => oi.id === orderItem.id ? { ...oi, pickedQty: newPicked, status: newStatus } : oi);
      const allDone = updatedItems.every(oi => oi.status === 'done');
      return { ...o, items: updatedItems, status: allDone ? 'assembled' as OrderStatus : o.status, updatedAt: new Date().toISOString() };
    });
    const op: Operation = {
      id: generateId(), itemId: item.id, type: 'out', quantity: actual,
      comment: `Сборка по заявке ${order.number}`, from: loc?.name,
      to: order.recipientName || order.title, performedBy: state.currentUser,
      date: new Date().toISOString(), orderId: order.id, locationId: selectedLocation,
      warehouseId: whId || undefined,
    };
    next = { ...next, workOrders: updatedOrders, operations: [op, ...next.operations] };
    onStateChange(next);
    const updatedOrder = updatedOrders.find(o => o.id === order.id)!;
    const updatedItem = next.items.find(i => i.id === item.id);
    const updatedLocationStocks = (next.locationStocks || []).filter(ls => ls.itemId === item.id);
    const updatedWarehouseStocks = (next.warehouseStocks || []).filter(ws => ws.itemId === item.id);
    crudAction('upsert_work_order', { workOrder: updatedOrder, orderItems: updatedOrder.items });
    crudAction('upsert_operation', { operation: op, item: updatedItem, locationStocks: updatedLocationStocks, warehouseStocks: updatedWarehouseStocks });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Icon name="ScanLine" size={16} />
            </div>
            Собрать позицию
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-muted rounded-lg">
            <div className="font-semibold text-foreground">{item.name}</div>
            <div className="text-sm text-muted-foreground mt-0.5">
              Нужно: <b className="text-foreground">{orderItem.requiredQty} {item.unit}</b>
              {' · '}Собрано: <b className="text-success">{orderItem.pickedQty}</b>
              {' · '}Осталось: <b className="text-primary">{remaining}</b>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Выберите склад и стеллаж</Label>
            {(state.warehouseStocks || []).filter(ws => ws.itemId === item.id && ws.quantity > 0).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {(state.warehouseStocks || [])
                  .filter(ws => ws.itemId === item.id && ws.quantity > 0)
                  .map(ws => {
                    const wh = (state.warehouses || []).find(w => w.id === ws.warehouseId);
                    return wh ? (
                      <span key={ws.warehouseId} className="text-[11px] bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full text-primary font-medium">
                        {wh.name}: {ws.quantity} {item.unit}
                      </span>
                    ) : null;
                  })}
              </div>
            )}
            {locStocks.length === 0 ? (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive flex items-center gap-2">
                <Icon name="AlertCircle" size={14} />Нет в наличии на складе
              </div>
            ) : (
              <div className="space-y-2">
                {locStocks.map(ls => {
                  const isSelected = selectedLocation === ls.locationId;
                  const insufficient = ls.quantity < remaining;
                  return (
                    <button key={ls.locationId} type="button" onClick={() => { setSelectedLocation(ls.locationId); setQty(String(Math.min(ls.quantity, remaining))); }}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border-2 text-sm transition-all
                        ${isSelected ? 'border-primary bg-accent' : 'border-border bg-card hover:border-primary/40 hover:bg-muted/50'}`}>
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'border-primary bg-primary' : 'border-border'}`}>
                          {isSelected && <Icon name="Check" size={10} className="text-primary-foreground" />}
                        </div>
                        <div className="text-left">
                          <div className="font-medium">{ls.location?.name}</div>
                          {ls.location?.description && <div className="text-xs text-muted-foreground">{ls.location.description}</div>}
                        </div>
                      </div>
                      <div className={`text-right font-bold tabular-nums ${insufficient ? 'text-warning' : 'text-success'}`}>
                        {ls.quantity} {item.unit}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {selectedLocation && (
            <>
              {notEnough && (
                <div className="flex items-start gap-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
                  <Icon name="AlertCircle" size={14} className="shrink-0 mt-0.5" />
                  На этой локации только {locStock} {item.unit}
                </div>
              )}
              <div className="space-y-1.5">
                <Label>Количество (из {locStock} {item.unit})</Label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                    className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                    <Icon name="Minus" size={14} />
                  </button>
                  <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="text-center text-lg font-bold" />
                  <button type="button" onClick={() => setQty(String(Math.min(locStock, qtyNum + 1)))}
                    className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center shrink-0">
                    <Icon name="Plus" size={14} />
                  </button>
                </div>
              </div>
            </>
          )}

          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handlePick} disabled={!selectedLocation || qtyNum <= 0 || !!notEnough || locStocks.length === 0}
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold">
              <Icon name="PackageCheck" size={15} className="mr-1.5" />
              Собрать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
