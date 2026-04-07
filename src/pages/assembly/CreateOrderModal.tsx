import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import {
  AppState, saveState, generateId,
  WorkOrder, OrderItem, OrderStatus, Partner,
  getReservedQty, getFreeQty,
} from '@/data/store';
import { ConflictModal, ConflictInfo } from './ConflictModal';

type OrderLine = { id: string; itemId: string; itemLabel: string; qty: string };

export function CreateOrderModal({
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

  const duplicates = useMemo(() => {
    const seen = new Set<string>();
    const dups = new Set<string>();
    for (const ln of validLines) {
      if (seen.has(ln.itemId)) dups.add(ln.itemId);
      seen.add(ln.itemId);
    }
    return dups;
  }, [validLines]);

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

                  return (
                    <div key={ln.id} className={`rounded-xl border p-3 space-y-2 transition-colors
                      ${isDup ? 'border-destructive/40 bg-destructive/4' : warn?.type === 'error' ? 'border-warning/40 bg-warning/4' : 'border-border bg-muted/30'}`}>
                      <div className="flex items-center gap-2">
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

                      {/* Stock info row with warehouse + location breakdown */}
                      {item && (
                        <div className="space-y-1.5 px-1">
                          <div className="flex items-center gap-3 text-xs">
                            <span className="text-muted-foreground">Всего: <b className={item.quantity === 0 ? 'text-destructive' : 'text-foreground'}>{item.quantity} {item.unit}</b></span>
                            <span className="text-muted-foreground">Свободно: <b className={getFreeQty(state, item.id) <= 0 ? 'text-destructive' : 'text-success'}>{getFreeQty(state, item.id)} {item.unit}</b></span>
                          </div>
                          {(() => {
                            const whStocks = (state.warehouseStocks || [])
                              .filter(ws => ws.itemId === item.id && ws.quantity > 0)
                              .map(ws => ({ ...ws, wh: (state.warehouses || []).find(w => w.id === ws.warehouseId) }))
                              .filter(ws => ws.wh);
                            const locs = (state.locationStocks || [])
                              .filter(ls => ls.itemId === item.id && ls.quantity > 0)
                              .map(ls => ({ ...ls, loc: state.locations.find(l => l.id === ls.locationId) }))
                              .filter(ls => ls.loc);
                            if (whStocks.length === 0 && locs.length === 0) return null;
                            return (
                              <div className="flex flex-wrap gap-1">
                                {whStocks.length > 0 ? whStocks.map(ws => (
                                  <span key={ws.warehouseId} className="text-[11px] bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full text-primary flex items-center gap-1">
                                    <span className="opacity-60">⬛</span>{ws.wh?.name}: <b>{ws.quantity}</b>
                                  </span>
                                )) : locs.map(ls => (
                                  <span key={ls.locationId} className="text-[11px] bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                                    {ls.loc?.name}: <b className="text-foreground">{ls.quantity}</b>
                                  </span>
                                ))}
                              </div>
                            );
                          })()}
                        </div>
                      )}

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
