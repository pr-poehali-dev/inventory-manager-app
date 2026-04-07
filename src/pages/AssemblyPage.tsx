import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  AppState, OrderStatus,
  getOrderStatusLabel, getOrderStatusColor,
} from '@/data/store';
import { CreateOrderModal } from './assembly/CreateOrderModal';
import { OrderDetail } from './assembly/OrderDetail';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

export default function AssemblyPage({ state, onStateChange, initialOrderId }: Props & { initialOrderId?: string | null }) {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(initialOrderId ?? null);
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

  const reopenableCount = orders.filter(o => o.status === 'closed' && o.items.some(oi => oi.status !== 'done')).length;

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
      {reopenableCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-destructive/8 border border-destructive/20 rounded-lg text-sm">
          <Icon name="AlertTriangle" size={14} className="text-destructive shrink-0" />
          <span className="text-destructive font-medium">{reopenableCount} закрытых заявок не полностью собраны</span>
          <button onClick={() => setStatusFilter('closed')} className="ml-auto text-xs text-destructive/70 hover:text-destructive underline underline-offset-2">Показать</button>
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
            const isReopenable = order.status === 'closed' && order.items.some(oi => oi.status !== 'done');

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
                      {isReopenable && <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-warning/12 text-warning flex items-center gap-1"><Icon name="RotateCcw" size={10} />Возобновить</span>}
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
