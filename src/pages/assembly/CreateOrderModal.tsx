import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import {
  AppState, crudAction, generateId,
  WorkOrder, OrderItem, OrderStatus, Partner,
  getReservedQty, getFreeQty,
} from '@/data/store';
import { ConflictModal, ConflictInfo } from './ConflictModal';

type OrderLine = { id: string; itemId: string; itemLabel: string; qty: string };

export function CreateOrderModal({
  state, onStateChange, onClose, editOrder,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  editOrder?: WorkOrder;
}) {
  const isEdit = !!editOrder;
  const [number, setNumber] = useState(editOrder?.number || `ЗС-${String(state.orderCounter).padStart(3, '0')}`);
  const [comment, setComment] = useState(editOrder?.comment || '');
  const [recipientLabel, setRecipientLabel] = useState(editOrder?.recipientName || '');
  const [recipientId, setRecipientId] = useState(editOrder?.recipientId || '');
  const [receiverRank, setReceiverRank] = useState(editOrder?.receiverRank || '');
  const [receiverName, setReceiverName] = useState(editOrder?.receiverName || '');
  const [requesterRank, setRequesterRank] = useState(editOrder?.requesterRank || '');
  const [requesterName, setRequesterName] = useState(editOrder?.requesterName || '');
  const [selectedWarehouseId, setSelectedWarehouseId] = useState(
    editOrder?.warehouseId || (state.warehouses?.length === 1 ? state.warehouses[0].id : '')
  );
  const [lines, setLines] = useState<OrderLine[]>(
    editOrder && editOrder.items.length > 0
      ? editOrder.items.map(oi => {
          const it = state.items.find(i => i.id === oi.itemId);
          return { id: oi.id, itemId: oi.itemId, itemLabel: it?.name || '', qty: String(oi.requiredQty) };
        })
      : [{ id: generateId(), itemId: '', itemLabel: '', qty: '1' }]
  );
  const [showConflict, setShowConflict] = useState(false);

  const recipientOptions: AutocompleteOption[] = useMemo(() =>
    state.partners.filter(p => p.type === 'recipient').map(p => ({
      id: p.id,
      label: p.name,
      sublabel: [p.rank, p.fullName].filter(Boolean).join(' · ') || p.contact || p.note || undefined,
    })), [state.partners]);

  const itemOptions: AutocompleteOption[] = useMemo(() => {
    const warehouseItemIds = selectedWarehouseId
      ? new Set(
          (state.warehouseStocks || [])
            .filter(ws => ws.warehouseId === selectedWarehouseId && ws.quantity > 0)
            .map(ws => ws.itemId)
        )
      : null;

    return state.items
      .filter(item => !warehouseItemIds || warehouseItemIds.has(item.id))
      .map(item => {
        const cat = state.categories.find(c => c.id === item.categoryId);
        const whStock = selectedWarehouseId
          ? (state.warehouseStocks || []).find(ws => ws.warehouseId === selectedWarehouseId && ws.itemId === item.id)?.quantity ?? 0
          : getFreeQty(state, item.id);
        return {
          id: item.id,
          label: item.name,
          sublabel: cat?.name,
          badge: `${whStock} ${item.unit}`,
          badgeColor: whStock === 0 ? '#ef4444' : whStock <= item.lowStockThreshold ? '#f59e0b' : '#10b981',
        };
      });
  }, [state, selectedWarehouseId]);

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

  const canCreate = validLines.length > 0 && duplicates.size === 0;

  const doCreate = (status: OrderStatus = 'draft') => {
    const orderItems: OrderItem[] = validLines
      .filter(ln => !duplicates.has(ln.itemId))
      .map(ln => {
        const existing = isEdit ? editOrder!.items.find(oi => oi.id === ln.id) : null;
        return {
          id: existing?.id || generateId(),
          itemId: ln.itemId,
          requiredQty: parseInt(ln.qty),
          pickedQty: existing?.pickedQty || 0,
          status: existing?.status || 'pending',
        };
      });

    let finalRecipientId = recipientId;
    let newPartners = [...state.partners];
    let partnerToSync: Partner | null = null;
    const trimmedDept = recipientLabel.trim();
    const trimmedRank = receiverRank.trim();
    const trimmedFullName = receiverName.trim();
    if (trimmedDept && !recipientId) {
      // Создаём нового получателя
      const newPartner: Partner = {
        id: generateId(),
        name: trimmedDept,
        type: 'recipient',
        department: trimmedDept || undefined,
        rank: trimmedRank || undefined,
        fullName: trimmedFullName || undefined,
        createdAt: new Date().toISOString(),
      };
      newPartners = [...state.partners, newPartner];
      finalRecipientId = newPartner.id;
      partnerToSync = newPartner;
    } else if (recipientId) {
      // Обновляем существующего получателя если поля изменились
      const existing = state.partners.find(p => p.id === recipientId);
      if (existing) {
        const needsUpdate =
          (trimmedDept && existing.department !== trimmedDept) ||
          (trimmedRank && existing.rank !== trimmedRank) ||
          (trimmedFullName && existing.fullName !== trimmedFullName);
        if (needsUpdate) {
          const updated: Partner = {
            ...existing,
            name: trimmedDept || existing.name,
            department: trimmedDept || existing.department,
            rank: trimmedRank || existing.rank,
            fullName: trimmedFullName || existing.fullName,
          };
          newPartners = state.partners.map(p => p.id === recipientId ? updated : p);
          partnerToSync = updated;
        }
      }
    }

    if (isEdit && editOrder) {
      const updated: WorkOrder = {
        ...editOrder,
        number: number.trim() || editOrder.number,
        title: editOrder.title || '',
        status,
        warehouseId: selectedWarehouseId || undefined,
        recipientId: finalRecipientId || undefined,
        recipientName: recipientLabel.trim() || undefined,
        receiverRank: receiverRank.trim() || undefined,
        receiverName: receiverName.trim() || undefined,
        issuerRank: undefined,
        issuerName: undefined,
        requesterRank: requesterRank.trim() || undefined,
        requesterName: requesterName.trim() || undefined,
        comment: comment.trim() || undefined,
        updatedAt: new Date().toISOString(),
        items: orderItems,
      };
      const next = {
        ...state,
        partners: newPartners,
        workOrders: state.workOrders.map(o => o.id === updated.id ? updated : o),
      };
      onStateChange(next);
      crudAction('upsert_work_order', { workOrder: updated, orderItems: updated.items });
      if (partnerToSync) {
        crudAction('upsert_partner', { partner: partnerToSync });
      }
      onClose();
      return;
    }

    const order: WorkOrder = {
      id: generateId(),
      number: number.trim() || `ЗС-${String(state.orderCounter).padStart(3, '0')}`,
      title: '',
      status,
      createdBy: state.currentUser,
      warehouseId: selectedWarehouseId || undefined,
      recipientId: finalRecipientId || undefined,
      recipientName: recipientLabel.trim() || undefined,
      receiverRank: receiverRank.trim() || undefined,
      receiverName: receiverName.trim() || undefined,
      requesterRank: requesterRank.trim() || undefined,
      requesterName: requesterName.trim() || undefined,
      comment: comment.trim() || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: orderItems,
    };
    const newCounter = state.orderCounter + 1;
    const next = {
      ...state,
      partners: newPartners,
      workOrders: [order, ...state.workOrders],
      orderCounter: newCounter,
    };
    onStateChange(next);
    crudAction('upsert_work_order', { workOrder: order, orderItems: order.items });
    crudAction('update_setting', { key: 'orderCounter', value: String(newCounter) });
    if (partnerToSync) {
      crudAction('upsert_partner', { partner: partnerToSync });
    }
    onClose();
  };

  const handleSubmit = () => {
    if (!canCreate) return;
    if (conflicts.length > 0) { setShowConflict(true); return; }
    doCreate(isEdit ? editOrder!.status : 'draft');
  };

  return (
    <>
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="max-w-2xl xl:max-w-4xl max-h-[94vh] overflow-y-auto animate-scale-in">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon name={isEdit ? 'Pencil' : 'ClipboardPlus'} size={16} />
              </div>
              {isEdit ? 'Редактировать заявку' : 'Новая сборочная заявка'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Number */}
            <div className="space-y-1.5 max-w-[200px]">
              <Label>Номер</Label>
              <Input value={number} onChange={e => setNumber(e.target.value)} placeholder="ЗС-001" />
            </div>

            {/* Warehouse selector */}
            {(state.warehouses || []).length > 0 && (
              <div className="space-y-1.5">
                <Label>Склад-отправитель</Label>
                <div className="flex flex-wrap gap-2">
                  {(state.warehouses || []).map(wh => (
                    <button
                      key={wh.id}
                      type="button"
                      onClick={() => setSelectedWarehouseId(wh.id === selectedWarehouseId ? '' : wh.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all
                        ${selectedWarehouseId === wh.id
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                        }`}
                    >
                      <Icon name="Warehouse" size={14} />
                      {wh.name}
                    </button>
                  ))}
                </div>
                {!selectedWarehouseId && (
                  <p className="text-xs text-warning">Выберите склад — список товаров будет ограничен его остатками</p>
                )}
                {selectedWarehouseId && (
                  <p className="text-xs text-muted-foreground">Показаны только товары с остатком на выбранном складе</p>
                )}
              </div>
            )}

            {/* Recipient autocomplete */}
            <div className="space-y-1.5">
              <Label>Структурное подразделение — получатель</Label>
              <Autocomplete
                value={recipientLabel}
                onChange={v => { setRecipientLabel(v); setRecipientId(''); }}
                onSelect={opt => {
                  setRecipientLabel(opt.label);
                  const pid = opt.id === '__new__' ? '' : opt.id;
                  setRecipientId(pid);
                  if (pid) {
                    const partner = state.partners.find(p => p.id === pid);
                    if (partner) {
                      if (partner.rank && !receiverRank.trim()) setReceiverRank(partner.rank);
                      if (partner.fullName && !receiverName.trim()) setReceiverName(partner.fullName);
                    }
                  }
                }}
                options={recipientOptions}
                placeholder="Введите получателя..."
                allowCustom
              />
              <p className="text-xs text-muted-foreground">Структурное подразделение — получатель (для накладной)</p>
            </div>

            {/* Requester for invoice */}
            <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <Icon name="UserPlus" size={12} />
                Затребовал (кто запросил ТМЦ)
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Должность</Label>
                  <Input value={requesterRank} onChange={e => setRequesterRank(e.target.value)} placeholder="Напр.: командир взвода" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ФИО</Label>
                  <Input value={requesterName} onChange={e => setRequesterName(e.target.value)} placeholder="Сидоров С.С." />
                </div>
              </div>
            </div>

            {/* Receiver for invoice */}
            <div className="rounded-xl border-2 border-success/30 bg-success/5 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-success uppercase tracking-wide">
                <Icon name="UserCheck" size={12} />
                Получил — кто фактически забирает ТМЦ
              </div>
              <p className="text-[11px] text-muted-foreground -mt-1">
                Подразделение укажи выше в «Кому выдаём». Здесь — должность и ФИО того, кто расписывается.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Должность / звание</Label>
                  <Input value={receiverRank} onChange={e => setReceiverRank(e.target.value)} placeholder="Напр.: кладовщик" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">ФИО (расшифровка подписи)</Label>
                  <Input value={receiverName} onChange={e => setReceiverName(e.target.value)} placeholder="Иванов И.И." />
                </div>
              </div>
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
                <Icon name={isEdit ? 'Save' : 'Plus'} size={15} className="mr-1.5" />
                {isEdit ? 'Сохранить' : 'Создать заявку'}
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