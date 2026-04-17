import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Partner, PartnerType, crudAction, generateId } from '@/data/store';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

type PartnerTab = 'suppliers' | 'recipients';

function PartnerHistory({ partner, state, onClose }: {
  partner: Partner; state: AppState; onClose: () => void;
}) {
  const history = useMemo(() => {
    const ops = state.operations.filter(op => {
      if (partner.type === 'supplier') return op.type === 'in' && (op.from === partner.name);
      return op.type === 'out' && (op.to === partner.name);
    });

    const orderOps = partner.type === 'recipient'
      ? state.operations.filter(op => {
          const order = state.workOrders?.find(o => o.id === op.orderId && o.recipientName === partner.name);
          return !!order;
        })
      : [];

    const combined = [...ops, ...orderOps].filter((op, i, arr) => arr.findIndex(x => x.id === op.id) === i);
    return combined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [partner, state]);

  const totalQty = history.reduce((s, op) => s + op.quantity, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto animate-scale-in">
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
          {partner.note && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon name="FileText" size={13} />{partner.note}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold tabular-nums">{history.length}</div>
              <div className="text-xs text-muted-foreground">операций</div>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <div className="text-2xl font-bold tabular-nums">{totalQty}</div>
              <div className="text-xs text-muted-foreground">единиц {partner.type === 'supplier' ? 'поставлено' : 'выдано'}</div>
            </div>
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

function AddPartnerModal({ type, onSave, onClose }: {
  type: PartnerType; onSave: (p: Omit<Partner, 'id' | 'createdAt'>) => void; onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [contact, setContact] = useState('');
  const [note, setNote] = useState('');

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm animate-scale-in">
        <DialogHeader>
          <DialogTitle>Добавить {type === 'supplier' ? 'поставщика' : 'получателя'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-2">
          <div className="space-y-1.5">
            <Label>Название *</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder={type === 'supplier' ? 'ООО Поставщик' : 'Отдел / ФИО'} />
          </div>
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
            <Button disabled={!name.trim()} onClick={() => { onSave({ name, contact, note, type }); onClose(); }} className="flex-1">
              Добавить
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

type RecipientRow = {
  department: string;
  receiverName: string;
  receiverRank: string;
  orderCount: number;
  qty: number;
  lastDate: string;
};

function RecipientsReport({ state }: { state: AppState }) {
  const [deptFilter, setDeptFilter] = useState('');
  const [receiverFilter, setReceiverFilter] = useState('');

  const rows: RecipientRow[] = useMemo(() => {
    const map = new Map<string, RecipientRow>();
    for (const o of state.workOrders || []) {
      const dept = (o.recipientName || '').trim();
      const rName = (o.receiverName || '').trim();
      const rRank = (o.receiverRank || '').trim();
      if (!dept && !rName) continue;
      const key = `${dept}||${rName}`;
      const ops = state.operations.filter(op => op.orderId === o.id && op.type === 'out');
      const qty = ops.reduce((s, op) => s + op.quantity, 0);
      const existing = map.get(key);
      if (existing) {
        existing.orderCount += 1;
        existing.qty += qty;
        if (!existing.receiverRank && rRank) existing.receiverRank = rRank;
        if (new Date(o.updatedAt).getTime() > new Date(existing.lastDate).getTime()) existing.lastDate = o.updatedAt;
      } else {
        map.set(key, {
          department: dept,
          receiverName: rName,
          receiverRank: rRank,
          orderCount: 1,
          qty,
          lastDate: o.updatedAt,
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => new Date(b.lastDate).getTime() - new Date(a.lastDate).getTime());
  }, [state.workOrders, state.operations]);

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

  const totalOrders = filtered.reduce((s, r) => s + r.orderCount, 0);
  const totalQty = filtered.reduce((s, r) => s + r.qty, 0);

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="p-3 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Icon name="Filter" size={14} className="text-muted-foreground" />
          <span className="text-sm font-semibold">Кто и сколько получал</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {filtered.length} записей · {totalOrders} заявок · {totalQty} ед.
          </span>
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
          <p className="text-sm text-muted-foreground">Нет данных по выдачам</p>
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filtered.map((r, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30">
              <div className="w-8 h-8 rounded-lg bg-success/12 text-success flex items-center justify-center shrink-0">
                <Icon name="UserCheck" size={13} />
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
                  Последняя выдача: {new Date(r.lastDate).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-bold tabular-nums">{r.qty} ед.</div>
                <div className="text-[11px] text-muted-foreground">{r.orderCount} заявок</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PartnerTable({ partners, type, state, onStateChange }: {
  partners: Partner[]; type: PartnerType; state: AppState; onStateChange: (s: AppState) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Partner | null>(null);

  const filtered = partners.filter(p =>
    !search.trim() || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const getPartnerStats = (p: Partner) => {
    if (p.type === 'supplier') {
      const ops = state.operations.filter(op => op.type === 'in' && op.from === p.name);
      return { opCount: ops.length, qty: ops.reduce((s, op) => s + op.quantity, 0) };
    }
    const ops = state.operations.filter(op => op.type === 'out' && op.to === p.name);
    const orderOps = state.operations.filter(op => {
      const order = state.workOrders?.find(o => o.id === op.orderId && o.recipientName === p.name);
      return !!order;
    });
    const combined = [...ops, ...orderOps].filter((op, i, arr) => arr.findIndex(x => x.id === op.id) === i);
    return { opCount: combined.length, qty: combined.reduce((s, op) => s + op.quantity, 0) };
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

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input placeholder={`Поиск ${type === 'supplier' ? 'поставщиков' : 'получателей'}...`} value={search}
            onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
        </div>
        <Button size="sm" onClick={() => setShowAdd(true)} className="shrink-0">
          <Icon name="Plus" size={14} className="mr-1" />
          Добавить
        </Button>
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
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-muted-foreground">
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
                    className="w-8 h-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted flex items-center justify-center transition-colors">
                    <Icon name="History" size={14} />
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

      {type === 'recipient' && <RecipientsReport state={state} />}

      {selectedPartner && <PartnerHistory partner={selectedPartner} state={state} onClose={() => setSelectedPartner(null)} />}
      {showAdd && <AddPartnerModal type={type} onSave={handleAdd} onClose={() => setShowAdd(false)} />}
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

  const suppliers = state.partners.filter(p => p.type === 'supplier');
  const recipients = state.partners.filter(p => p.type === 'recipient');

  const totalSupplied = state.operations.filter(o => o.type === 'in').reduce((s, o) => s + o.quantity, 0);
  const totalIssued = state.operations.filter(o => o.type === 'out').reduce((s, o) => s + o.quantity, 0);

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div>
        <h1 className="text-2xl font-bold">Поставщики и Получатели</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{suppliers.length} поставщиков · {recipients.length} получателей</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Поставщиков', value: suppliers.length, icon: 'Truck', color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Получателей', value: recipients.length, icon: 'Users', color: 'text-success' },
          { label: 'Всего принято', value: totalSupplied, icon: 'ArrowDownToLine', color: 'text-success' },
          { label: 'Всего выдано', value: totalIssued, icon: 'ArrowUpFromLine', color: 'text-primary' },
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

      {/* Table */}
      <div className="animate-fade-in">
        {tab === 'suppliers' ? (
          <PartnerTable partners={suppliers} type="supplier" state={state} onStateChange={onStateChange} />
        ) : (
          <PartnerTable partners={recipients} type="recipient" state={state} onStateChange={onStateChange} />
        )}
      </div>
    </div>
  );
}
