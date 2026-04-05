import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import {
  AppState, saveState, generateId,
  WorkOrder, OrderItem, OrderStatus, Partner,
  getOrderStatusLabel, getOrderStatusColor,
  getLocationStock, updateLocationStock, Operation,
  getReservedQty, getFreeQty,
} from '@/data/store';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

// ─── Conflict Resolution Modal ────────────────────────────────────────────────
type ConflictInfo = {
  itemId: string;
  itemName: string;
  unit: string;
  available: number;
  requested: number;
  conflictingOrders: { number: string; title: string; qty: number }[];
};

function ConflictModal({
  conflicts,
  onResolve,
  onForce,
  onCancel,
}: {
  conflicts: ConflictInfo[];
  onResolve: () => void;
  onForce: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
              <Icon name="AlertTriangle" size={16} />
            </div>
            Конфликт остатков
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Остатка не хватает для всех активных заявок. Выберите, как поступить:
          </p>
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className="p-3 bg-destructive/8 border border-destructive/20 rounded-lg text-sm space-y-1">
                <div className="font-semibold text-foreground">{c.itemName}</div>
                <div className="text-muted-foreground">
                  На складе: <b className="text-foreground">{c.available} {c.unit}</b>
                  {' · '}Запрошено: <b className="text-destructive">{c.requested} {c.unit}</b>
                </div>
                {c.conflictingOrders.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Конфликтует с заявками: {c.conflictingOrders.map(o => `${o.number} (${o.qty} ${c.unit})`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-1">
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3" onClick={onCancel}>
              <Icon name="Edit3" size={15} className="shrink-0 text-primary" />
              <div className="text-left">
                <div className="font-semibold text-sm">Редактировать заявку</div>
                <div className="text-xs text-muted-foreground">Уменьшить запрошенное количество</div>
              </div>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3 border-warning/40 hover:bg-warning/8" onClick={onForce}>
              <Icon name="Clock" size={15} className="shrink-0 text-warning" />
              <div className="text-left">
                <div className="font-semibold text-sm text-warning">Создать с пометкой «Ожидает поставки»</div>
                <div className="text-xs text-muted-foreground">Заявка создаётся, товар будет выдан после поступления</div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Create Order Modal ───────────────────────────────────────────────────────
type OrderLine = { id: string; itemId: string; itemLabel: string; qty: string };

function CreateOrderModal({
  state, onStateChange, onClose,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState('');
  const [number, setNumber] = useState(`ЗС-${String(state.orderCounter).padStart(3, '0')}`);
  const [comment, setComment] = useState('');
  const [recipientLabel, setRecipientLabel] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [lines, setLines] = useState<OrderLine[]>([{ id: generateId(), itemId: '', itemLabel: '', qty: '1' }]);
  const [showConflict, setShowConflict] = useState(false);

  // Autocomplete options
  const recipientOptions: AutocompleteOption[] = useMemo(() =>
    state.partners.filter(p => p.type === 'recipient').map(p => ({
      id: p.id, label: p.name, sublabel: p.contact || p.note || undefined,
    })), [state.partners]);

  const itemOptions: AutocompleteOption[] = useMemo(() =>
    state.items.map(item => {
      const cat = state.categories.find(c => c.id === item.categoryId);
      const freeQty = getFreeQty(state, item.id);
      return {
        id: item.id,
        label: item.name,
        sublabel: cat?.name,
        badge: `${freeQty} ${item.unit}`,
        badgeColor: freeQty === 0 ? '#ef4444' : freeQty <= item.lowStockThreshold ? '#f59e0b' : '#10b981',
      };
    }), [state]);

  const addLine = () => setLines(l => [...l, { id: generateId(), itemId: '', itemLabel: '', qty: '1' }]);
  const removeLine = (id: string) => setLines(l => l.filter(ln => ln.id !== id));
  const updateLine = (id: string, patch: Partial<OrderLine>) =>
    setLines(l => l.map(ln => ln.id === id ? { ...ln, ...patch } : ln));

  const validLines = lines.filter(l => l.itemId && parseInt(l.qty) > 0);

  // Duplicate detection
  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const ln of validLines) {
      if (seen.has(ln.itemId)) dups.add(ln.itemId);
      seen.add(ln.itemId);
    }
    return dups;
  }, [validLines]);

  // Stock warnings per line
  const lineWarnings = useMemo(() =>
    lines.map(ln => {
      if (!ln.itemId) return null;
      const item = state.items.find(i => i.id === ln.itemId);
      if (!item) return null;
      const qty = parseInt(ln.qty) || 0;
      const freeQty = getFreeQty(state, ln.itemId);
      if (item.quantity === 0) return { type: 'error' as const, msg: 'Нет в наличии' };
      if (qty > item.quantity) return { type: 'error' as const, msg: `На складе только ${item.quantity} ${item.unit}` };
      if (qty > freeQty && freeQty < qty) return { type: 'warn' as const, msg: `Свободно ${freeQty} ${item.unit} (остальное зарезервировано)` };
      if (item.quantity <= item.lowStockThreshold) return { type: 'info' as const, msg: `Низкий остаток (${item.quantity} ${item.unit})` };
      return null;
    }), [lines, state]);

  // Conflict detection: same item in multiple active orders
  const conflicts = useMemo((): ConflictInfo[] => {
    const result: ConflictInfo[] = [];
    const seenItems = new Set<string>();
    for (const ln of validLines) {
      if (!ln.itemId || seenItems.has(ln.itemId)) continue;
      seenItems.add(ln.itemId);
      const item = state.items.find(i => i.id === ln.itemId);
      if (!item) continue;
      const qty = parseInt(ln.qty) || 0;
      const reserved = getReservedQty(state, ln.itemId);
      if (qty + reserved > item.quantity) {
        const conflictingOrders = state.workOrders
          .filter(o => ['active', 'draft', 'pending_stock'].includes(o.status))
          .flatMap(o => o.items.filter(oi => oi.itemId === ln.itemId && oi.status !== 'done').map(oi => ({
            number: o.number, title: o.title, qty: oi.requiredQty - oi.pickedQty,
          })));
        result.push({
          itemId: ln.itemId,
          itemName: item.name,
          unit: item.unit,
          available: item.quantity,
          requested: qty,
          conflictingOrders,
        });
      }
    }
    return result;
  }, [validLines, state]);

  const canCreate = title.trim() && validLines.length > 0 && duplicates.size === 0;

  const doCreate = (status: OrderStatus = 'draft') => {
    const orderItems: OrderItem[] = validLines
      .filter(ln => !duplicates.has(ln.itemId))
      .map(ln => ({
        id: generateId(),
        itemId: ln.itemId,
        requiredQty: parseInt(ln.qty),
        pickedQty: 0,
        status: 'pending',
      }));

    // Auto-create recipient if new
    let finalRecipientId = recipientId;
    let newPartners = [...state.partners];
    if (recipientLabel.trim() && !recipientId) {
      const newPartner: Partner = {
        id: generateId(), name: recipientLabel.trim(), type: 'recipient',
        createdAt: new Date().toISOString(),
      };
      newPartners = [...state.partners, newPartner];
      finalRecipientId = newPartner.id;
    }

    const order: WorkOrder = {
      id: generateId(),
      number: number.trim() || `ЗС-${String(state.orderCounter).padStart(3, '0')}`,
      title: title.trim(),
      status,
      createdBy: state.currentUser,
      recipientId: finalRecipientId || undefined,
      recipientName: recipientLabel.trim() || undefined,
      comment: comment.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: orderItems,
    };
    const next = {
      ...state,
      partners: newPartners,
      workOrders: [order, ...state.workOrders],
      orderCounter: state.orderCounter + 1,
    };
    onStateChange(next);
    saveState(next);
    onClose();
  };

  const handleSubmit = () => {
    if (!canCreate) return;
    if (conflicts.length > 0) { setShowConflict(true); return; }
    doCreate('draft');
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto animate-scale-in">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon name="ClipboardPlus" size={16} />
              </div>
              Новая сборочная заявка
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Number + Title */}
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label>Номер</Label>
                <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="ЗС-001" />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>Название заявки *</Label>
                <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Комплектация заказа..." />
              </div>
            </div>

            {/* Recipient autocomplete */}
            <div className="space-y-1.5">
              <Label>Кому выдаём</Label>
              <Autocomplete
                value={recipientLabel}
                onChange={v => { setRecipientLabel(v); setRecipientId(''); }}
                onSelect={opt => { setRecipientLabel(opt.label); setRecipientId(opt.id === '__new__' ? '' : opt.id); }}
                options={recipientOptions}
                placeholder="Введите получателя..."
                allowCustom
              />
              <p className="text-xs text-muted-foreground">Выберите из существующих или введите нового — он сохранится автоматически</p>
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <Label>Комментарий</Label>
              <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Примечание, приоритет..." />
            </div>

            {/* Line items */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Позиции ({validLines.length})</Label>
                <button onClick={addLine} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium">
                  <Icon name="Plus" size={14} />
                  Добавить позицию
                </button>
              </div>

              <div className="space-y-2">
                {lines.map((ln, idx) => {
                  const item = state.items.find(i => i.id === ln.itemId);
                  const warn = lineWarnings[idx];
                  const isDup = duplicates.has(ln.itemId);
                  const qty = parseInt(ln.qty) || 0;

                  return (
                    <div key={ln.id} className={`rounded-xl border p-3 space-y-2 transition-colors
                      ${isDup ? 'border-destructive/40 bg-destructive/4' : warn?.type === 'error' ? 'border-warning/40 bg-warning/4' : 'border-border bg-muted/30'}`}>
                      <div className="flex items-center gap-2">
                        {/* Item autocomplete */}
                        <div className="flex-1">
                          <Autocomplete
                            value={ln.itemLabel}
                            onChange={v => updateLine(ln.id, { itemLabel: v, itemId: '' })}
                            onSelect={opt => updateLine(ln.id, { itemId: opt.id, itemLabel: opt.label })}
                            options={itemOptions}
                            placeholder="Начните вводить товар..."
                            allowCustom={false}
                          />
                        </div>
                        {/* Qty */}
                        <div className="relative w-28 shrink-0">
                          <Input
                            type="number" min="1" value={ln.qty}
                            onChange={e => updateLine(ln.id, { qty: e.target.value })}
                            className={`h-9 text-center ${warn?.type === 'error' ? 'border-destructive' : ''}`}
                          />
                          {item && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">{item.unit}</span>}
                        </div>
                        <button onClick={() => removeLine(ln.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                          <Icon name="X" size={15} />
                        </button>
                      </div>

                      {/* Stock info row with location breakdown */}
                      {item && (
                        <div className="space-y-1.5 px-1">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">Всего: <b className={item.quantity === 0 ? 'text-destructive' : 'text-foreground'}>{item.quantity} {item.unit}</b></span>
                            <span className="text-muted-foreground">Свободно: <b className={getFreeQty(state, item.id) <= 0 ? 'text-destructive' : 'text-success'}>{getFreeQty(state, item.id)} {item.unit}</b></span>
                          </div>
                          {(() => {
                            const locs = (state.locationStocks || [])
                              .filter(ls => ls.itemId === item.id && ls.quantity > 0)
                              .map(ls => ({ ...ls, loc: state.locations.find(l => l.id === ls.locationId) }))
                              .filter(ls => ls.loc);
                            if (locs.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1">
                                {locs.map(ls => (
                                  <span key={ls.locationId} className="text-[11px] bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                                    {ls.loc?.name}: <b className="text-foreground">{ls.quantity}</b>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

                      {/* Warnings */}
                      {isDup && (
                        <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                          <Icon name="Copy" size={12} />
                          Дубликат — этот товар уже добавлен в заявку
                        </div>
                      )}
                      {!isDup && warn && (
                        <div className={`flex items-center gap-1.5 text-xs font-medium
                          ${warn.type === 'error' ? 'text-destructive' : warn.type === 'warn' ? 'text-warning' : 'text-muted-foreground'}`}>
                          <Icon name={warn.type === 'error' ? 'AlertCircle' : warn.type === 'warn' ? 'AlertTriangle' : 'Info'} size={12} />
                          {warn.msg}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Global conflict summary */}
            {conflicts.length > 0 && (
              <div className="p-3 bg-destructive/8 border border-destructive/20 rounded-xl space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
                  <Icon name="AlertTriangle" size={14} />
                  Конфликт остатков ({conflicts.length} позиций)
                </div>
                {conflicts.map((c, i) => (
                  <div key={i} className="text-xs text-muted-foreground pl-5">
                    «{c.itemName}» — нужно {c.requested}, свободно {c.available - getReservedQty(state, c.itemId)} {c.unit}
                  </div>
                ))}
                <p className="text-xs text-muted-foreground pl-5 mt-1">При создании можно выбрать режим «Ожидает поставки»</p>
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
              <Button onClick={handleSubmit} disabled={!canCreate} className="flex-1">
                <Icon name="Plus" size={15} className="mr-1.5" />
                Создать заявку
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {showConflict && (
        <ConflictModal
          conflicts={conflicts}
          onResolve={() => setShowConflict(false)}
          onForce={() => { setShowConflict(false); doCreate('pending_stock'); }}
          onCancel={() => setShowConflict(false)}
        />
      )}
    </>
  );
}

// ─── Pick Item Modal ──────────────────────────────────────────────────────────
function PickItemModal({
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

  const locStocks = (state.locationStocks || [])
    .filter(ls => ls.itemId === item.id && ls.quantity > 0)
    .map(ls => ({ ...ls, location: state.locations.find(l => l.id === ls.locationId) }))
    .filter(ls => ls.location);

  const locStock = selectedLocation ? getLocationStock(state, item.id, selectedLocation) : 0;
  const qtyNum = parseInt(qty) || 0;
  const notEnough = selectedLocation && qtyNum > locStock;

  const handlePick = () => {
    if (!selectedLocation || qtyNum <= 0 || notEnough) return;
    const actual = Math.min(qtyNum, remaining);
    let next = { ...state };
    next = updateLocationStock(next, item.id, selectedLocation, -actual);
    next = { ...next, items: next.items.map(i => i.id === item.id ? { ...i, quantity: Math.max(0, i.quantity - actual) } : i) };
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
      comment: `Сборка по заявке ${order.number}`, from: state.locations.find(l => l.id === selectedLocation)?.name,
      to: order.recipientName || order.title, performedBy: state.currentUser,
      date: new Date().toISOString(), orderId: order.id, locationId: selectedLocation,
    };
    next = { ...next, workOrders: updatedOrders, operations: [op, ...next.operations] };
    onStateChange(next); saveState(next); onClose();
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
            <Label>Выберите полку / стеллаж</Label>
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

// ─── Order Detail ─────────────────────────────────────────────────────────────
function OrderDetail({ order, state, onStateChange, onBack }: {
  order: WorkOrder; state: AppState;
  onStateChange: (s: AppState) => void; onBack: () => void;
}) {
  const [pickingItem, setPickingItem] = useState<OrderItem | null>(null);

  const doneCount = order.items.filter(i => i.status === 'done').length;
  const progress = order.items.length > 0 ? Math.round((doneCount / order.items.length) * 100) : 0;

  const changeStatus = (status: OrderStatus) => {
    const next = { ...state, workOrders: state.workOrders.map(o => o.id === order.id ? { ...o, status, updatedAt: new Date().toISOString() } : o) };
    onStateChange(next); saveState(next);
  };

  const orderHistory = state.operations.filter(op => op.orderId === order.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const statusFlow: OrderStatus[] = ['draft', 'active', 'assembled', 'closed'];
  const currentIdx = statusFlow.indexOf(order.status === 'pending_stock' ? 'draft' : order.status);

  // Live order from state (updated after picks)
  const liveOrder = state.workOrders.find(o => o.id === order.id) || order;

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div className="flex items-start gap-3">
        <button onClick={onBack} className="mt-1 w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center shrink-0 transition-colors">
          <Icon name="ArrowLeft" size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs text-muted-foreground">{liveOrder.number}</span>
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getOrderStatusColor(liveOrder.status)}`}>
              {getOrderStatusLabel(liveOrder.status)}
            </span>
            {liveOrder.recipientName && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Icon name="User" size={11} />{liveOrder.recipientName}
              </span>
            )}
          </div>
          <h2 className="text-xl font-bold mt-0.5">{liveOrder.title}</h2>
          {liveOrder.comment && <p className="text-sm text-muted-foreground mt-0.5">{liveOrder.comment}</p>}
        </div>
      </div>

      {/* Progress */}
      <div className="bg-card rounded-xl border border-border p-4 shadow-card space-y-3">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium">Прогресс сборки</span>
          <span className={`font-bold ${progress === 100 ? 'text-success' : 'text-primary'}`}>{progress}%</span>
        </div>
        <div className="h-2.5 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${progress === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${progress}%` }} />
        </div>
        <div className="text-xs text-muted-foreground">{doneCount} из {liveOrder.items.length} позиций собрано</div>
      </div>

      {/* Status flow */}
      <div className="flex gap-1 flex-wrap">
        {statusFlow.map((s, i) => (
          <button key={s} disabled={i <= currentIdx} onClick={() => changeStatus(s)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all
              ${i === currentIdx ? getOrderStatusColor(s) + ' ring-2 ring-offset-1 ring-current/20' :
                i < currentIdx ? 'bg-muted/50 text-muted-foreground/50 cursor-default' :
                'bg-muted text-muted-foreground hover:text-foreground cursor-pointer'}`}>
            {i < currentIdx && <Icon name="Check" size={10} />}
            {getOrderStatusLabel(s)}
          </button>
        ))}
      </div>

      {/* Items */}
      <div className="space-y-2">
        <h3 className="font-semibold">Позиции к сборке</h3>
        {liveOrder.items.map(oi => {
          const item = state.items.find(i => i.id === oi.itemId);
          if (!item) return null;
          const remaining = oi.requiredQty - oi.pickedQty;
          const locStocks = (state.locationStocks || []).filter(ls => ls.itemId === item.id && ls.quantity > 0);
          const totalAvailable = locStocks.reduce((s, ls) => s + ls.quantity, 0);
          const isInsufficient = totalAvailable < remaining && oi.status !== 'done';
          const pct = Math.min(100, Math.round((oi.pickedQty / oi.requiredQty) * 100));
          const cat = state.categories.find(c => c.id === item.categoryId);

          return (
            <div key={oi.id} className={`bg-card rounded-xl border p-4 shadow-card transition-all
              ${oi.status === 'done' ? 'border-success/30 bg-success/4' : 'border-border'}`}>
              <div className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5
                  ${oi.status === 'done' ? 'bg-success text-success-foreground' : oi.status === 'partial' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Icon name={oi.status === 'done' ? 'Check' : oi.status === 'partial' ? 'RefreshCw' : 'Circle'} size={14} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-semibold text-sm">{item.name}</div>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {cat && <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: cat.color + '18', color: cat.color }}>{cat.name}</span>}
                        {locStocks.map(ls => {
                          const loc = state.locations.find(l => l.id === ls.locationId);
                          return (
                            <span key={ls.locationId} className="text-xs text-muted-foreground flex items-center gap-0.5">
                              <Icon name="MapPin" size={10} />{loc?.name}: {ls.quantity} {item.unit}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0 text-lg font-bold tabular-nums">
                      <span className="text-success">{oi.pickedQty}</span>
                      <span className="text-muted-foreground text-sm font-normal">/{oi.requiredQty}</span>
                      <span className="text-xs font-normal text-muted-foreground ml-1">{item.unit}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${oi.status === 'done' ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                  {oi.status !== 'done' && isInsufficient && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-destructive">
                      <Icon name="AlertCircle" size={12} />
                      Недостаточно — нужно {remaining}, есть {totalAvailable} {item.unit}
                    </div>
                  )}
                  {oi.status === 'done' && (
                    <div className="mt-1.5 flex items-center gap-1.5 text-xs text-success font-medium">
                      <Icon name="CheckCircle2" size={12} />Полностью собрано
                    </div>
                  )}
                </div>
              </div>
              {oi.status !== 'done' && liveOrder.status === 'active' && (
                <div className="mt-3 pt-3 border-t border-border/50">
                  <Button size="sm" onClick={() => setPickingItem(oi)} disabled={totalAvailable === 0}
                    className={`w-full font-semibold ${isInsufficient ? 'bg-warning/90 hover:bg-warning text-warning-foreground' : ''}`}>
                    <Icon name="PackageMinus" size={14} className="mr-1.5" />
                    {oi.status === 'partial' ? `Добрать (${remaining} ${item.unit})` : `Собрать ${oi.requiredQty} ${item.unit}`}
                  </Button>
                </div>
              )}
              {liveOrder.status === 'draft' && oi.status !== 'done' && (
                <p className="mt-2 text-xs text-muted-foreground text-center">Запустите заявку для сборки</p>
              )}
            </div>
          );
        })}
      </div>

      {/* History */}
      {orderHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">История операций</h3>
          <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
            {orderHistory.map((op, idx) => {
              const it = state.items.find(i => i.id === op.itemId);
              const loc = op.locationId ? state.locations.find(l => l.id === op.locationId) : null;
              return (
                <div key={op.id} className={`flex items-center gap-3 px-4 py-3 text-sm ${idx > 0 ? 'border-t border-border/50' : ''}`}>
                  <div className="w-7 h-7 rounded-md bg-success/15 text-success flex items-center justify-center shrink-0">
                    <Icon name="ArrowDownToLine" size={12} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium">{it?.name}</div>
                    <div className="text-xs text-muted-foreground">{loc ? `← ${loc.name}` : ''} · {op.performedBy}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-success tabular-nums">−{op.quantity} {it?.unit}</div>
                    <div className="text-xs text-muted-foreground">{new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Footer actions */}
      <div className="flex gap-2 flex-wrap">
        <Button variant="outline" onClick={() => window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/?order=' + liveOrder.id)}`, '_blank')}
          className="flex items-center gap-1.5">
          <Icon name="QrCode" size={14} />QR
        </Button>
        {liveOrder.status === 'draft' && <Button onClick={() => changeStatus('active')} className="flex-1"><Icon name="Play" size={14} className="mr-1.5" />Запустить в работу</Button>}
        {liveOrder.status === 'pending_stock' && <Button onClick={() => changeStatus('active')} className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground"><Icon name="Play" size={14} className="mr-1.5" />Запустить (поставка пришла)</Button>}
        {liveOrder.status === 'assembled' && <Button onClick={() => changeStatus('closed')} className="flex-1 bg-muted text-foreground hover:bg-muted/80"><Icon name="Archive" size={14} className="mr-1.5" />Закрыть заявку</Button>}
      </div>

      {pickingItem && <PickItemModal state={state} onStateChange={onStateChange} order={liveOrder} orderItem={pickingItem} onClose={() => setPickingItem(null)} />}
    </div>
  );
}

// ─── Main Assembly Page ───────────────────────────────────────────────────────
export default function AssemblyPage({ state, onStateChange }: Props) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  const selectedOrder = selectedOrderId ? state.workOrders.find(o => o.id === selectedOrderId) || null : null;

  if (selectedOrder) {
    return <OrderDetail order={selectedOrder} state={state} onStateChange={s => { onStateChange(s); }} onBack={() => setSelectedOrderId(null)} />;
  }

  const orders = state.workOrders || [];
  const filtered = orders
    .filter(o => statusFilter === 'all' || o.status === statusFilter)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

  const counts = {
    draft: orders.filter(o => o.status === 'draft').length,
    active: orders.filter(o => o.status === 'active').length,
    assembled: orders.filter(o => o.status === 'assembled').length,
    closed: orders.filter(o => o.status === 'closed').length,
    pending_stock: orders.filter(o => o.status === 'pending_stock').length,
  };

  const statusCards = [
    { status: 'draft' as const, label: 'Черновики', icon: 'FileEdit' },
    { status: 'active' as const, label: 'В работе', icon: 'Zap' },
    { status: 'assembled' as const, label: 'Собраны', icon: 'PackageCheck' },
    { status: 'closed' as const, label: 'Закрыты', icon: 'Archive' },
  ];

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Сборочные заявки</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{orders.length} заявок · {counts.active} в работе</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2">
          <Icon name="Plus" size={16} />
          Создать заявку
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {statusCards.map(s => (
          <button key={s.status} onClick={() => setStatusFilter(statusFilter === s.status ? 'all' : s.status)}
            className={`p-3 rounded-xl border text-left shadow-card transition-all
              ${statusFilter === s.status ? 'border-primary bg-accent' : 'bg-card border-border hover:border-primary/40'}`}>
            <div className={`flex items-center gap-2 mb-1 text-xs font-semibold ${getOrderStatusColor(s.status)} bg-transparent px-0`}>
              <Icon name={s.icon} size={14} />{s.label}
            </div>
            <div className="text-2xl font-bold tabular-nums">{counts[s.status]}</div>
          </button>
        ))}
      </div>

      {counts.pending_stock > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-warning/10 border border-warning/30 rounded-lg text-sm">
          <Icon name="Clock" size={14} className="text-warning shrink-0" />
          <span className="text-warning font-medium">{counts.pending_stock} заявок ожидают поставки</span>
          <button onClick={() => setStatusFilter('pending_stock')} className="ml-auto text-xs text-warning/70 hover:text-warning underline underline-offset-2">Показать</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit overflow-x-auto">
        <button onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${statusFilter === 'all' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          Все ({orders.length})
        </button>
        {statusCards.filter(s => counts[s.status] > 0).map(s => (
          <button key={s.status} onClick={() => setStatusFilter(statusFilter === s.status ? 'all' : s.status)}
            className={`px-3 py-1.5 rounded-md text-sm font-medium whitespace-nowrap transition-all ${statusFilter === s.status ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
            {getOrderStatusLabel(s.status)} ({counts[s.status]})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon name="ClipboardList" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">Заявок нет</h3>
          <p className="text-sm text-muted-foreground mb-4">Создайте первую сборочную заявку</p>
          <Button onClick={() => setShowCreate(true)}><Icon name="Plus" size={14} className="mr-1.5" />Создать заявку</Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order, idx) => {
            const done = order.items.filter(i => i.status === 'done').length;
            const pct = order.items.length > 0 ? Math.round((done / order.items.length) * 100) : 0;
            const hasShortage = order.items.some(oi => {
              if (oi.status === 'done') return false;
              const item = state.items.find(i => i.id === oi.itemId);
              if (!item) return false;
              const avail = (state.locationStocks || []).filter(ls => ls.itemId === item.id).reduce((s, ls) => s + ls.quantity, 0);
              return avail < (oi.requiredQty - oi.pickedQty);
            });

            return (
              <button key={order.id} onClick={() => setSelectedOrderId(order.id)}
                className="w-full text-left bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary/30 p-4 transition-all group animate-fade-in"
                style={{ animationDelay: `${idx * 40}ms` }}>
                <div className="flex items-start gap-3">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5
                    ${order.status === 'active' ? 'bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-300' :
                      order.status === 'assembled' ? 'bg-success/15 text-success' :
                      order.status === 'pending_stock' ? 'bg-warning/15 text-warning' :
                      'bg-muted text-muted-foreground'}`}>
                    <Icon name={order.status === 'active' ? 'Zap' : order.status === 'assembled' ? 'PackageCheck' : order.status === 'pending_stock' ? 'Clock' : order.status === 'closed' ? 'Archive' : 'FileEdit'} size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-mono text-xs text-muted-foreground">{order.number}</span>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${getOrderStatusColor(order.status)}`}>{getOrderStatusLabel(order.status)}</span>
                      {hasShortage && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-destructive/12 text-destructive flex items-center gap-1"><Icon name="AlertTriangle" size={10} />Нехватка</span>}
                    </div>
                    <div className="font-semibold text-foreground group-hover:text-primary transition-colors">{order.title}</div>
                    {order.recipientName && (
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Icon name="User" size={10} />{order.recipientName}
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-muted-foreground tabular-nums">{done}/{order.items.length}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">{new Date(order.updatedAt).toLocaleDateString('ru-RU')} · {order.items.length} позиций</div>
                  </div>
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground group-hover:text-primary shrink-0 mt-2 transition-colors" />
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showCreate && <CreateOrderModal state={state} onStateChange={onStateChange} onClose={() => setShowCreate(false)} />}
    </div>
  );
}