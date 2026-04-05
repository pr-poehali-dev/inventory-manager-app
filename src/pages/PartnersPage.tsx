import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Partner, PartnerType, saveState, generateId } from '@/data/store';

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

function PartnerTable({ partners, type, state, onStateChange }: {
  partners: Partner[]; type: PartnerType; state: AppState; onStateChange: (s: AppState) => void;
}) {
  const [search, setSearch] = useState('');
  const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
  const [showAdd, setShowAdd] = useState(false);

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
    onStateChange(next); saveState(next);
  };

  const handleAdd = (data: Omit<Partner, 'id' | 'createdAt'>) => {
    const p: Partner = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    const next = { ...state, partners: [...state.partners, p] };
    onStateChange(next); saveState(next);
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
                  {stats.opCount === 0 && (
                    <button onClick={() => handleDelete(p.id)}
                      className="w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors">
                      <Icon name="Trash2" size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selectedPartner && <PartnerHistory partner={selectedPartner} state={state} onClose={() => setSelectedPartner(null)} />}
      {showAdd && <AddPartnerModal type={type} onSave={handleAdd} onClose={() => setShowAdd(false)} />}
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
