import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Partner, PartnerType, Operation, crudAction, generateId } from '@/data/store';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

type PartnerTab = 'suppliers' | 'recipients';

// ───── Период ─────
type PeriodPreset = 'all' | 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

function getPeriodDates(preset: PeriodPreset, customFrom?: string, customTo?: string): { from: Date | null; to: Date | null } {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
  switch (preset) {
    case 'today': return { from: todayStart, to: todayEnd };
    case 'week': {
      const d = new Date(todayStart); d.setDate(d.getDate() - 6);
      return { from: d, to: todayEnd };
    }
    case 'month': {
      const d = new Date(todayStart); d.setDate(d.getDate() - 29);
      return { from: d, to: todayEnd };
    }
    case 'quarter': {
      const d = new Date(todayStart); d.setDate(d.getDate() - 89);
      return { from: d, to: todayEnd };
    }
    case 'year': {
      const d = new Date(todayStart); d.setFullYear(d.getFullYear() - 1);
      return { from: d, to: todayEnd };
    }
    case 'custom': {
      const from = customFrom ? new Date(customFrom) : null;
      const to = customTo ? new Date(customTo + 'T23:59:59') : null;
      return { from, to };
    }
    default: return { from: null, to: null };
  }
}

function inPeriod(dateStr: string, from: Date | null, to: Date | null): boolean {
  const t = new Date(dateStr).getTime();
  if (from && t < from.getTime()) return false;
  if (to && t > to.getTime()) return false;
  return true;
}

function PeriodFilter({ preset, onPresetChange, customFrom, customTo, onCustomChange }: {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customFrom: string;
  customTo: string;
  onCustomChange: (from: string, to: string) => void;
}) {
  const presets: { id: PeriodPreset; label: string }[] = [
    { id: 'all', label: 'Всё время' },
    { id: 'today', label: 'Сегодня' },
    { id: 'week', label: 'Неделя' },
    { id: 'month', label: 'Месяц' },
    { id: 'quarter', label: '3 месяца' },
    { id: 'year', label: 'Год' },
    { id: 'custom', label: 'Период' },
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon name="Calendar" size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Период:</span>
        {presets.map(p => (
          <button
            key={p.id}
            onClick={() => onPresetChange(p.id)}
            className={`text-xs px-2.5 py-1 rounded-md font-medium transition-all
              ${preset === p.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
          >{p.label}</button>
        ))}
      </div>
      {preset === 'custom' && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-[11px]">С</Label>
            <Input
              type="date"
              value={customFrom}
              onChange={e => onCustomChange(e.target.value, customTo)}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label className="text-[11px]">По</Label>
            <Input
              type="date"
              value={customTo}
              onChange={e => onCustomChange(customFrom, e.target.value)}
              className="h-8 text-sm"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ───── Разбивка по номенклатурам ─────
type NomenRow = {
  itemId: string;
  itemName: string;
  unit: string;
  qty: number;
  opCount: number;
};

function aggregateByItem(ops: Operation[], state: AppState): NomenRow[] {
  const map = new Map<string, NomenRow>();
  for (const op of ops) {
    const it = state.items.find(i => i.id === op.itemId);
    const key = op.itemId;
    const existing = map.get(key);
    if (existing) {
      existing.qty += op.quantity;
      existing.opCount += 1;
    } else {
      map.set(key, {
        itemId: op.itemId,
        itemName: it?.name || '—',
        unit: it?.unit || '',
        qty: op.quantity,
        opCount: 1,
      });
    }
  }
  return Array.from(map.values()).sort((a, b) => b.qty - a.qty);
}

function PartnerHistory({ partner, state, periodFrom, periodTo, onClose }: {
  partner: Partner; state: AppState;
  periodFrom: Date | null; periodTo: Date | null;
  onClose: () => void;
}) {
  const { history, byItem } = useMemo(() => {
    const ops = state.operations.filter(op => {
      if (!inPeriod(op.date, periodFrom, periodTo)) return false;
      if (partner.type === 'supplier') return op.type === 'in' && op.from === partner.name;
      return op.type === 'out' && op.to === partner.name;
    });
    const orderOps = partner.type === 'recipient'
      ? state.operations.filter(op => {
          if (!inPeriod(op.date, periodFrom, periodTo)) return false;
          const order = state.workOrders?.find(o => o.id === op.orderId && o.recipientName === partner.name);
          return !!order;
        })
      : [];
    const combined = [...ops, ...orderOps].filter((op, i, arr) => arr.findIndex(x => x.id === op.id) === i);
    const sorted = combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { history: sorted, byItem: aggregateByItem(combined, state) };
  }, [partner, state, periodFrom, periodTo]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
              ${partner.type === 'supplier' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300' : 'bg-success/15 text-success'}`}>
              <Icon name={partner.type === 'supplier' ? 'Truck' : 'UserCheck'} size={15} />
            </div>
            <span>{partner.name}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          {partner.contact && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="Phone" size={13} />{partner.contact}
            </div>
          )}

          <div className="bg-muted/50 rounded-lg p-3">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="Package" size={13} />
              <span className="text-sm font-semibold">
                {partner.type === 'supplier' ? 'Что поставлено' : 'Что получено'}
              </span>
              <span className="ml-auto text-xs text-muted-foreground">{byItem.length} позиций</span>
            </div>
            {byItem.length === 0 ? (
              <div className="text-center py-3 text-xs text-muted-foreground">За выбранный период нет операций</div>
            ) : (
              <div className="space-y-1">
                {byItem.map(r => (
                  <div key={r.itemId} className="flex items-center gap-2 py-1.5 px-2 rounded-md bg-card text-sm">
                    <Icon name="Box" size={12} className="text-muted-foreground shrink-0" />
                    <span className="flex-1 truncate">{r.itemName}</span>
                    <span className="text-xs text-muted-foreground">{r.opCount} оп.</span>
                    <span className="font-bold tabular-nums">{r.qty} {r.unit}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-1">
            <h3 className="text-sm font-semibold">История операций</h3>
            {history.length === 0 ? (
              <div className="text-center py-6 text-muted-foreground text-sm">
                <Icon name="Clock" size={20} className="mx-auto mb-2 opacity-40" />
                Операций пока нет
              </div>
            ) : (
              <div className="space-y-1.5">
                {history.map(op => {
                  const item = state.items.find(i => i.id === op.itemId);
                  const order = op.orderId ? state.workOrders?.find(o => o.id === op.orderId) : null;
                  return (
                    <div key={op.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 text-sm">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0
                        ${op.type === 'in' ? 'bg-success/15 text-success' : 'bg-primary/15 text-primary'}`}>
                        <Icon name={op.type === 'in' ? 'ArrowDownToLine' : 'ArrowUpFromLine'} size={12} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{item?.name || '—'}</div>
                        <div className="text-xs text-muted-foreground">
                          {order ? `Заявка ${order.number}` : op.comment || '—'}
                          {order?.receiverName && <span> · {order.receiverRank ? `${order.receiverRank} ` : ''}{order.receiverName}</span>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="font-bold tabular-nums">{op.quantity} {item?.unit}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function AddPartnerModal({ type, partner, onSave, onClose }: {
  type: PartnerType; partner?: Partner; onSave: (p: Omit<Partner, 'id' | 'createdAt'>) => void; onClose: () => void;
}) {
  const isRecipient = type === 'recipient';
  const isEdit = !!partner;

  // Для поставщика работаем с "name". Для получателя — три отдельных поля.
  const [supplierName, setSupplierName] = useState(partner?.name || '');
  const [department, setDepartment] = useState(
    partner?.department || (isRecipient ? partner?.name || '' : '')
  );
  const [rank, setRank] = useState(partner?.rank || '');
  const [fullName, setFullName] = useState(partner?.fullName || '');
  const [contact, setContact] = useState(partner?.contact || '');
  const [note, setNote] = useState(partner?.note || '');

  const canSave = isRecipient ? department.trim().length > 0 : supplierName.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    if (isRecipient) {
      const dept = department.trim();
      const rk = rank.trim();
      const fn = fullName.trim();
      // Название = подразделение + ФИО (для удобного поиска и печати)
      const composedName = [dept, fn].filter(Boolean).join(' — ') || dept;
      onSave({
        name: composedName,
        department: dept || undefined,
        rank: rk || undefined,
        fullName: fn || undefined,
        contact: contact.trim() || undefined,
        note: note.trim() || undefined,
        type,
      });
    } else {
      onSave({
        name: supplierName.trim(),
        contact: contact.trim() || undefined,
        note: note.trim() || undefined,
        type,
      });
    }
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Редактировать' : 'Добавить'} {type === 'supplier' ? 'поставщика' : 'получателя'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          {isRecipient ? (
            <>
              <div className="space-y-1.5">
                <Label>Структурное подразделение *</Label>
                <Input value={department} onChange={e => setDepartment(e.target.value)} placeholder="Напр.: 8-я рота" autoFocus />
              </div>
              <div className="space-y-1.5">
                <Label>Должность / звание</Label>
                <Input value={rank} onChange={e => setRank(e.target.value)} placeholder="Напр.: кладовщик, ст. сержант" />
              </div>
              <div className="space-y-1.5">
                <Label>ФИО получателя</Label>
                <Input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Иванов И.И." />
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <Label>Название *</Label>
              <Input value={supplierName} onChange={e => setSupplierName(e.target.value)} placeholder="ООО Поставщик" autoFocus />
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Контакт</Label>
            <Input value={contact} onChange={e => setContact(e.target.value)} placeholder="Телефон, email..." />
          </div>
          <div className="space-y-1.5">
            <Label>Примечание</Label>
            <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Доп. информация..." />
          </div>
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button disabled={!canSave} onClick={handleSave} className="flex-1">
              {isEdit ? 'Сохранить' : 'Добавить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ───── Отчёт получателей с разбивкой по номенклатурам ─────
type RecipientGroupRow = {
  department: string;
  receiverName: string;
  receiverRank: string;
  items: NomenRow[];
  totalQty: number;
  orderCount: number;
  lastDate: string;
};

function RecipientsReport({ state, periodFrom, periodTo }: {
  state: AppState;
  periodFrom: Date | null;
  periodTo: Date | null;
}) {
  const [deptFilter, setDeptFilter] = useState('');
  const [receiverFilter, setReceiverFilter] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const rows: RecipientGroupRow[] = useMemo(() => {
    const map = new Map<string, { dept: string; name: string; rank: string; ops: Operation[]; orders: Set<string>; lastDate: string }>();
    for (const o of state.workOrders || []) {
      const dept = (o.recipientName || '').trim();
      const rName = (o.receiverName || '').trim();
      const rRank = (o.receiverRank || '').trim();
      if (!dept && !rName) continue;
      const key = `${dept}||${rName}`;
      const ops = state.operations.filter(op => op.orderId === o.id && op.type === 'out' && inPeriod(op.date, periodFrom, periodTo));
      if (ops.length === 0) continue;
      const existing = map.get(key);
      if (existing) {
        existing.ops.push(...ops);
        existing.orders.add(o.id);
        if (!existing.rank && rRank) existing.rank = rRank;
        if (new Date(o.updatedAt).getTime() > new Date(existing.lastDate).getTime()) existing.lastDate = o.updatedAt;
      } else {
        map.set(key, { dept, name: rName, rank: rRank, ops: [...ops], orders: new Set([o.id]), lastDate: o.updatedAt });
      }
    }
    return Array.from(map.entries()).map(([, v]) => {
      const items = aggregateByItem(v.ops, state);
      return {
        department: v.dept,
        receiverName: v.name,
        receiverRank: v.rank,
        items,
        totalQty: items.reduce((s, i) => s + i.qty, 0),
        orderCount: v.orders.size,
        lastDate: v.lastDate,
      };
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [state.workOrders, state.operations, state.items, periodFrom, periodTo]);

  const departments = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.department && s.add(r.department));
    return Array.from(s).sort();
  }, [rows]);

  const receivers = useMemo(() => {
    const s = new Set<string>();
    rows.forEach(r => r.receiverName && s.add(r.receiverName));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = rows.filter(r => {
    const matchDept = !deptFilter || r.department.toLowerCase().includes(deptFilter.toLowerCase());
    const matchRcv = !receiverFilter || r.receiverName.toLowerCase().includes(receiverFilter.toLowerCase());
    return matchDept && matchRcv;
  });

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="Filter" size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Кто и что получал (по номенклатурам)</span>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} записей</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Input
              list="dept-list"
              value={deptFilter}
              onChange={e => setDeptFilter(e.target.value)}
              placeholder="Подразделение..."
              className="h-8 text-sm"
            />
            <datalist id="dept-list">
              {departments.map(d => <option key={d} value={d} />)}
            </datalist>
          </div>
          <div>
            <Input
              list="rcv-list"
              value={receiverFilter}
              onChange={e => setReceiverFilter(e.target.value)}
              placeholder="ФИО получателя..."
              className="h-8 text-sm"
            />
            <datalist id="rcv-list">
              {receivers.map(r => <option key={r} value={r} />)}
            </datalist>
          </div>
        </div>
        {(deptFilter || receiverFilter) && (
          <button
            onClick={() => { setDeptFilter(''); setReceiverFilter(''); }}
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Icon name="X" size={11} />Сбросить фильтры
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Icon name="Inbox" size={22} className="text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">Нет данных по выдачам за выбранный период</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filtered.map((r, i) => {
            const key = `${r.department}||${r.receiverName}`;
            const isOpen = expandedKey === key;
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandedKey(isOpen ? null : key)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-success/12 text-success flex items-center justify-center shrink-0">
                    <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {r.department && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/12 text-primary">
                          {r.department}
                        </span>
                      )}
                      <span className="font-medium text-sm">
                        {r.receiverRank && <span className="text-muted-foreground font-normal">{r.receiverRank} </span>}
                        {r.receiverName || <span className="text-muted-foreground italic">без ФИО</span>}
                      </span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.items.length} позиций · {r.orderCount} заявок · последняя: {new Date(r.lastDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{r.totalQty} ед.</div>
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-muted/30 px-4 py-2 space-y-1 border-t border-border/30">
                    {r.items.map(it => (
                      <div key={it.itemId} className="flex items-center gap-2 py-1 text-sm">
                        <Icon name="Box" size={11} className="text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{it.itemName}</span>
                        <span className="text-xs text-muted-foreground">{it.opCount} оп.</span>
                        <span className="font-bold tabular-nums">{it.qty} {it.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ───── Отчёт поставщиков с разбивкой по номенклатурам ─────
type SupplierGroupRow = {
  supplierName: string;
  items: NomenRow[];
  totalQty: number;
  opCount: number;
  lastDate: string;
};

function SuppliersReport({ state, periodFrom, periodTo }: {
  state: AppState;
  periodFrom: Date | null;
  periodTo: Date | null;
}) {
  const [supplierFilter, setSupplierFilter] = useState('');
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  const rows: SupplierGroupRow[] = useMemo(() => {
    const map = new Map<string, { name: string; ops: Operation[]; lastDate: string }>();
    for (const op of state.operations) {
      if (op.type !== 'in') continue;
      if (!inPeriod(op.date, periodFrom, periodTo)) continue;
      const name = (op.from || '').trim();
      if (!name) continue;
      const existing = map.get(name);
      if (existing) {
        existing.ops.push(op);
        if (new Date(op.date).getTime() > new Date(existing.lastDate).getTime()) existing.lastDate = op.date;
      } else {
        map.set(name, { name, ops: [op], lastDate: op.date });
      }
    }
    return Array.from(map.values()).map(v => {
      const items = aggregateByItem(v.ops, state);
      return {
        supplierName: v.name,
        items,
        totalQty: items.reduce((s, i) => s + i.qty, 0),
        opCount: v.ops.length,
        lastDate: v.lastDate,
      };
    }).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [state.operations, state.items, periodFrom, periodTo]);

  const suppliers = useMemo(() => rows.map(r => r.supplierName).sort(), [rows]);

  const filtered = rows.filter(r => !supplierFilter || r.supplierName.toLowerCase().includes(supplierFilter.toLowerCase()));

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="Filter" size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Кто и что поставил (по номенклатурам)</span>
          <span className="ml-auto text-xs text-muted-foreground">{filtered.length} записей</span>
        </div>
        <div>
          <Input
            list="sup-list"
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
            placeholder="Поиск поставщика..."
            className="h-8 text-sm"
          />
          <datalist id="sup-list">
            {suppliers.map(s => <option key={s} value={s} />)}
          </datalist>
        </div>
        {supplierFilter && (
          <button onClick={() => setSupplierFilter('')} className="text-xs text-primary hover:underline flex items-center gap-1">
            <Icon name="X" size={11} />Сбросить
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <Icon name="Inbox" size={22} className="text-muted-foreground mb-2 opacity-50" />
          <p className="text-sm text-muted-foreground">Нет данных о поставках за выбранный период</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filtered.map((r, i) => {
            const isOpen = expandedKey === r.supplierName;
            return (
              <div key={i}>
                <button
                  onClick={() => setExpandedKey(isOpen ? null : r.supplierName)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300 flex items-center justify-center shrink-0">
                    <Icon name={isOpen ? 'ChevronDown' : 'ChevronRight'} size={13} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{r.supplierName}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {r.items.length} позиций · {r.opCount} операций · последняя: {new Date(r.lastDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{r.totalQty} ед.</div>
                  </div>
                </button>
                {isOpen && (
                  <div className="bg-muted/30 px-4 py-2 space-y-1 border-t border-border/30">
                    {r.items.map(it => (
                      <div key={it.itemId} className="flex items-center gap-2 py-1 text-sm">
                        <Icon name="Box" size={11} className="text-muted-foreground shrink-0" />
                        <span className="flex-1 truncate">{it.itemName}</span>
                        <span className="text-xs text-muted-foreground">{it.opCount} оп.</span>
                        <span className="font-bold tabular-nums">{it.qty} {it.unit}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PartnerTable({ partners, type, state, onStateChange, periodFrom, periodTo }: {
  partners: Partner[]; type: PartnerType; state: AppState; onStateChange: (s: AppState) => void;
  periodFrom: Date | null; periodTo: Date | null;
}) {
  const [search, setSearch] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [fullNameFilter, setFullNameFilter] = useState<string>('all');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editPartner, setEditPartner] = useState<Partner | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Partner | null>(null);

  const isRecipient = type === 'recipient';

  const departments = useMemo(() => {
    if (!isRecipient) return [] as string[];
    const set = new Set<string>();
    partners.forEach(p => {
      const d = (p.department || p.name || '').trim();
      if (d) set.add(d);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [partners, isRecipient]);

  const fullNamesForDept = useMemo(() => {
    if (!isRecipient) return [] as string[];
    const set = new Set<string>();
    partners
      .filter(p => departmentFilter === 'all' || (p.department || p.name) === departmentFilter)
      .forEach(p => { if (p.fullName) set.add(p.fullName); });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [partners, isRecipient, departmentFilter]);

  const filtered = partners.filter(p => {
    const q = search.trim().toLowerCase();
    if (q) {
      const hay = `${p.name} ${p.department || ''} ${p.rank || ''} ${p.fullName || ''} ${p.contact || ''} ${p.note || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    if (isRecipient && departmentFilter !== 'all' && (p.department || p.name) !== departmentFilter) return false;
    if (isRecipient && fullNameFilter !== 'all' && (p.fullName || '') !== fullNameFilter) return false;
    return true;
  });

  const getPartnerStats = (p: Partner) => {
    const allOps = p.type === 'supplier'
      ? state.operations.filter(op => op.type === 'in' && op.from === p.name)
      : (() => {
          const direct = state.operations.filter(op => op.type === 'out' && op.to === p.name);
          const byOrder = state.operations.filter(op => {
            const order = state.workOrders?.find(o => o.id === op.orderId && o.recipientName === p.name);
            return !!order;
          });
          return [...direct, ...byOrder].filter((op, i, arr) => arr.findIndex(x => x.id === op.id) === i);
        })();
    const ops = allOps.filter(op => inPeriod(op.date, periodFrom, periodTo));
    return { opCount: ops.length, qty: ops.reduce((s, op) => s + op.quantity, 0) };
  };

  const handleDelete = (id: string) => {
    const next = { ...state, partners: state.partners.filter(p => p.id !== id) };
    onStateChange(next); crudAction('delete_partner', { partnerId: id });
  };

  const handleAdd = (data: Omit<Partner, 'id' | 'createdAt'>) => {
    const p: Partner = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    const next = { ...state, partners: [...state.partners, p] };
    onStateChange(next); crudAction('upsert_partner', { partner: p });
  };

  const handleEdit = (data: Omit<Partner, 'id' | 'createdAt'>) => {
    if (!editPartner) return;
    const updated: Partner = { ...editPartner, ...data };
    const next = { ...state, partners: state.partners.map(p => p.id === updated.id ? updated : p) };
    onStateChange(next);
    crudAction('upsert_partner', { partner: updated });
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input placeholder={`Поиск ${type === 'supplier' ? 'поставщиков' : 'получателей'} (название, ФИО, звание)...`} value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <Button size="sm" onClick={() => setShowAdd(true)} className="shrink-0">
            <Icon name="Plus" size={14} className="mr-1" />
            Добавить
          </Button>
        </div>

        {isRecipient && (departments.length > 0 || fullNamesForDept.length > 0) && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Icon name="Filter" size={12} />Фильтр:
            </div>
            <select
              value={departmentFilter}
              onChange={e => { setDepartmentFilter(e.target.value); setFullNameFilter('all'); }}
              className="h-8 text-xs rounded-md border border-border bg-background px-2 hover:border-primary/40 focus:border-primary focus:outline-none"
            >
              <option value="all">Все подразделения</option>
              {departments.map(d => (<option key={d} value={d}>{d}</option>))}
            </select>
            {fullNamesForDept.length > 0 && (
              <select
                value={fullNameFilter}
                onChange={e => setFullNameFilter(e.target.value)}
                className="h-8 text-xs rounded-md border border-border bg-background px-2 hover:border-primary/40 focus:border-primary focus:outline-none"
              >
                <option value="all">Все ФИО</option>
                {fullNamesForDept.map(n => (<option key={n} value={n}>{n}</option>))}
              </select>
            )}
            {(departmentFilter !== 'all' || fullNameFilter !== 'all') && (
              <button
                onClick={() => { setDepartmentFilter('all'); setFullNameFilter('all'); }}
                className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
              >
                <Icon name="X" size={11} />Сбросить
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Icon name={type === 'supplier' ? 'Truck' : 'Users'} size={22} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-semibold mb-0.5">{search ? 'Не найдено' : `${type === 'supplier' ? 'Поставщиков' : 'Получателей'} пока нет`}</p>
          {!search && <p className="text-xs text-muted-foreground">Добавьте первого</p>}
        </div>
      ) : (
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {filtered.map((p, idx) => {
            const stats = getPartnerStats(p);
            return (
              <div key={p.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${idx > 0 ? 'border-t border-border/50' : ''}`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0
                  ${type === 'supplier' ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-300' : 'bg-success/15 text-success'}`}>
                  <Icon name={type === 'supplier' ? 'Truck' : 'UserCheck'} size={15} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground">{p.name}</div>
                  <div className="flex items-center gap-x-2 gap-y-0.5 mt-0.5 flex-wrap text-xs text-muted-foreground">
                    {isRecipient && p.fullName && (
                      <span className="flex items-center gap-1 text-foreground/80">
                        <Icon name="UserCheck" size={10} />
                        {p.rank ? `${p.rank} · ` : ''}{p.fullName}
                      </span>
                    )}
                    {isRecipient && p.department && p.department !== p.name && (
                      <span className="flex items-center gap-0.5"><Icon name="Building2" size={10} />{p.department}</span>
                    )}
                    {p.contact && <span className="flex items-center gap-0.5"><Icon name="Phone" size={10} />{p.contact}</span>}
                    {p.note && <span className="truncate max-w-32">{p.note}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0 text-xs text-muted-foreground">
                  <div className="font-semibold text-foreground tabular-nums">{stats.qty} ед.</div>
                  <div>{stats.opCount} операций</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => setSelectedPartner(p)}
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors"
                    title="Разбивка по номенклатурам">
                    <Icon name="Package" size={14} />
                  </button>
                  <button onClick={() => setEditPartner(p)}
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-primary hover:bg-primary/10 flex items-center justify-center transition-colors"
                    title="Редактировать">
                    <Icon name="Pencil" size={13} />
                  </button>
                  <button onClick={() => setDeleteConfirm(p)}
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                    <Icon name="Trash2" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {type === 'recipient' && <RecipientsReport state={state} periodFrom={periodFrom} periodTo={periodTo} />}
      {type === 'supplier' && <SuppliersReport state={state} periodFrom={periodFrom} periodTo={periodTo} />}

      {selectedPartner && (
        <PartnerHistory
          partner={selectedPartner}
          state={state}
          periodFrom={periodFrom}
          periodTo={periodTo}
          onClose={() => setSelectedPartner(null)}
        />
      )}
      {showAdd && <AddPartnerModal type={type} onSave={handleAdd} onClose={() => setShowAdd(false)} />}
      {editPartner && <AddPartnerModal type={type} partner={editPartner} onSave={handleEdit} onClose={() => setEditPartner(null)} />}
      {deleteConfirm && (
        <Dialog open onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm animate-scale-in">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
                  <Icon name="Trash2" size={16} />
                </div>
                Удалить {type === 'supplier' ? 'поставщика' : 'получателя'}?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 pt-1">
              <p className="text-sm text-muted-foreground">
                <b className="text-foreground">«{deleteConfirm.name}»</b> будет удалён из справочника. История операций сохранится.
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setDeleteConfirm(null)} className="flex-1">Отмена</Button>
                <Button onClick={() => { handleDelete(deleteConfirm.id); setDeleteConfirm(null); }}
                  className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold">
                  <Icon name="Trash2" size={14} className="mr-1.5" />Удалить
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

export default function PartnersPage({ state, onStateChange }: Props) {
  const [tab, setTab] = useState<PartnerTab>('suppliers');
  const [periodPreset, setPeriodPreset] = useState<PeriodPreset>('all');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const { from: periodFrom, to: periodTo } = useMemo(
    () => getPeriodDates(periodPreset, customFrom, customTo),
    [periodPreset, customFrom, customTo]
  );

  const suppliers = state.partners.filter(p => p.type === 'supplier');
  const recipients = state.partners.filter(p => p.type === 'recipient');

  const opsInPeriod = useMemo(
    () => state.operations.filter(op => inPeriod(op.date, periodFrom, periodTo)),
    [state.operations, periodFrom, periodTo]
  );
  const totalSupplied = opsInPeriod.filter(o => o.type === 'in').reduce((s, o) => s + o.quantity, 0);
  const totalIssued = opsInPeriod.filter(o => o.type === 'out').reduce((s, o) => s + o.quantity, 0);

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Поставщики и Получатели</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{suppliers.length} поставщиков · {recipients.length} получателей</p>
      </div>

      <div className="bg-card border border-border rounded-xl p-3 shadow-card">
        <PeriodFilter
          preset={periodPreset}
          onPresetChange={setPeriodPreset}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(f, t) => { setCustomFrom(f); setCustomTo(t); }}
        />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Поставщиков', value: suppliers.length, icon: 'Truck', color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Получателей', value: recipients.length, icon: 'Users', color: 'text-success' },
          { label: 'Принято за период', value: totalSupplied, icon: 'ArrowDownToLine', color: 'text-success' },
          { label: 'Выдано за период', value: totalIssued, icon: 'ArrowUpFromLine', color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={16} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button onClick={() => setTab('suppliers')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${tab === 'suppliers' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Icon name="Truck" size={14} />
          Поставщики
          <span className={`text-xs px-1.5 rounded-full ${tab === 'suppliers' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{suppliers.length}</span>
        </button>
        <button onClick={() => setTab('recipients')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all
            ${tab === 'recipients' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Icon name="Users" size={14} />
          Получатели
          <span className={`text-xs px-1.5 rounded-full ${tab === 'recipients' ? 'bg-primary text-primary-foreground' : 'bg-muted-foreground/20 text-muted-foreground'}`}>{recipients.length}</span>
        </button>
      </div>

      <div className="animate-fade-in">
        {tab === 'suppliers' ? (
          <PartnerTable partners={suppliers} type="supplier" state={state} onStateChange={onStateChange} periodFrom={periodFrom} periodTo={periodTo} />
        ) : (
          <PartnerTable partners={recipients} type="recipient" state={state} onStateChange={onStateChange} periodFrom={periodFrom} periodTo={periodTo} />
        )}
      </div>
    </div>
  );
}