import { useState, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  AppState, crudAction, saveState,
  WorkOrder, OrderItem, OrderStatus,
  getOrderStatusLabel, getOrderStatusColor,
  updateLocationStock, updateWarehouseStock,
} from '@/data/store';
import { PickItemModal, CloseWarningModal } from './PickModals';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CreateOrderModal } from './CreateOrderModal';

export function OrderDetail({ order, state, onStateChange, onBack }: {
  order: WorkOrder; state: AppState;
  onStateChange: (s: AppState) => void; onBack: () => void;
}) {
  const [pickingItem, setPickingItem] = useState<OrderItem | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [showReassembleConfirm, setShowReassembleConfirm] = useState(false);

  const doneCount = order.items.filter(i => i.status === 'done').length;
  const progress = order.items.length > 0 ? Math.round((doneCount / order.items.length) * 100) : 0;
  const hasUnfinished = order.items.some(i => i.status !== 'done');

  const changeStatus = (status: OrderStatus) => {
    const next = { ...state, workOrders: state.workOrders.map(o => o.id === order.id ? { ...o, status, updatedAt: new Date().toISOString() } : o) };
    onStateChange(next); crudAction('upsert_work_order', { workOrder: { ...order, status, updatedAt: new Date().toISOString() }, orderItems: order.items });
  };

  const patchOrder = (patch: Partial<WorkOrder>) => {
    const updated = { ...order, ...patch, updatedAt: new Date().toISOString() };
    const next = { ...state, workOrders: state.workOrders.map(o => o.id === order.id ? updated : o) };
    onStateChange(next);
    crudAction('upsert_work_order', { workOrder: updated, orderItems: updated.items });
  };

  const handleClose = () => {
    if (hasUnfinished) { setShowCloseWarning(true); return; }
    changeStatus('closed');
  };

  const handleReassemble = () => {
    let next = { ...state };
    const orderOps = next.operations.filter(op => op.orderId === order.id && op.type === 'out');
    for (const op of orderOps) {
      if (op.locationId) {
        next = updateLocationStock(next, op.itemId, op.locationId, op.quantity);
      }
      if (op.warehouseId) {
        next = updateWarehouseStock(next, op.itemId, op.warehouseId, op.quantity);
      } else {
        next = { ...next, items: next.items.map(i => i.id === op.itemId ? { ...i, quantity: i.quantity + op.quantity } : i) };
      }
    }
    next = {
      ...next,
      operations: next.operations.filter(op => op.orderId !== order.id),
      workOrders: next.workOrders.map(o => {
        if (o.id !== order.id) return o;
        return {
          ...o,
          status: 'draft' as OrderStatus,
          updatedAt: new Date().toISOString(),
          items: o.items.map(oi => ({ ...oi, pickedQty: 0, status: 'pending' as OrderItem['status'] })),
        };
      }),
    };
    onStateChange(next);
    saveState(next);
    const updatedOrder = next.workOrders.find(o => o.id === order.id);
    if (updatedOrder) {
      crudAction('upsert_work_order', { workOrder: updatedOrder, orderItems: updatedOrder.items });
    }
  };

  const orderHistory = state.operations.filter(op => op.orderId === order.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const statusFlow: OrderStatus[] = ['draft', 'active', 'assembled', 'closed'];
  const currentIdx = statusFlow.indexOf(order.status === 'pending_stock' ? 'draft' : order.status);

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
          {liveOrder.title && <h2 className="text-xl font-bold mt-0.5">{liveOrder.title}</h2>}
          {liveOrder.comment && <p className="text-sm text-muted-foreground mt-0.5">{liveOrder.comment}</p>}
        </div>
      </div>

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

      <div className="bg-card rounded-xl border border-border p-4 shadow-card space-y-3">
        <div className="flex items-center gap-2">
          <Icon name="FileText" size={14} className="text-muted-foreground" />
          <h3 className="font-semibold text-sm">Данные для накладной</h3>
        </div>
        {(state.warehouses || []).length > 0 && (
          <div className="space-y-1.5">
            <Label className="text-xs">Склад-отправитель</Label>
            <div className="flex flex-wrap gap-1.5">
              {(state.warehouses || []).map(wh => (
                <button
                  key={wh.id}
                  type="button"
                  onClick={() => patchOrder({ warehouseId: wh.id === liveOrder.warehouseId ? undefined : wh.id })}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-all
                    ${liveOrder.warehouseId === wh.id
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-muted/40 border-border text-foreground hover:bg-muted'
                    }`}
                >
                  <Icon name="Warehouse" size={12} />
                  {wh.name}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="space-y-1.5">
          <Label className="text-xs">Структурное подразделение — получатель</Label>
          <Input
            value={liveOrder.recipientName || ''}
            onChange={e => patchOrder({ recipientName: e.target.value })}
            placeholder="Напр.: Отдел снабжения"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Затребовал — звание / должность</Label>
            <Input
              value={liveOrder.requesterRank || ''}
              onChange={e => patchOrder({ requesterRank: e.target.value })}
              placeholder="Напр.: командир взвода"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Затребовал — ФИО</Label>
            <Input
              value={liveOrder.requesterName || ''}
              onChange={e => patchOrder({ requesterName: e.target.value })}
              placeholder="Сидоров С.С."
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Получил — звание / должность</Label>
            <Input
              value={liveOrder.receiverRank || ''}
              onChange={e => patchOrder({ receiverRank: e.target.value })}
              placeholder="Напр.: кладовщик"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Получил — ФИО (расшифровка)</Label>
            <Input
              value={liveOrder.receiverName || ''}
              onChange={e => patchOrder({ receiverName: e.target.value })}
              placeholder="Иванов И.И."
            />
          </div>
        </div>
      </div>

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
        {(liveOrder.status === 'closed' || liveOrder.status === 'assembled') && (
          <button onClick={handleReassemble}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-warning/12 text-warning hover:bg-warning/20 transition-all">
            <Icon name="RotateCcw" size={11} />
            Пересобрать
          </button>
        )}
      </div>

      <div className="space-y-2">
        <h3 className="font-semibold">Позиции к сборке</h3>
        {liveOrder.items.map(oi => {
          const item = state.items.find(i => i.id === oi.itemId);
          if (!item) return null;
          const remaining = oi.requiredQty - oi.pickedQty;
          const orderWhId = liveOrder.warehouseId;
          const allLocStocks = (state.locationStocks || []).filter(ls => ls.itemId === item.id && ls.quantity > 0);
          // Локации только выбранного склада заявки
          const locStocks = orderWhId
            ? allLocStocks.filter(ls => {
                const loc = state.locations.find(l => l.id === ls.locationId);
                return loc?.warehouseId === orderWhId;
              })
            : allLocStocks;
          const totalAvailable = locStocks.reduce((s, ls) => s + ls.quantity, 0);
          const isInsufficient = totalAvailable < remaining && oi.status !== 'done';
          // Подсказка по другим складам
          const otherWarehouseStocks = orderWhId
            ? (state.warehouseStocks || [])
                .filter(ws => ws.itemId === item.id && ws.warehouseId !== orderWhId && ws.quantity > 0)
                .map(ws => {
                  const wh = (state.warehouses || []).find(w => w.id === ws.warehouseId);
                  return wh ? { name: wh.name, qty: ws.quantity } : null;
                })
                .filter((x): x is { name: string; qty: number } => !!x)
            : [];
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
                            <span key={ls.locationId} className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                              <Icon name="MapPin" size={9} className="inline mr-0.5 -mt-0.5" />
                              {loc?.name}: {ls.quantity} {item.unit}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-sm font-bold">{oi.pickedQty}/{oi.requiredQty}</div>
                      <div className="text-[11px] text-muted-foreground">{item.unit}</div>
                    </div>
                  </div>
                  <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
                    <div className={`h-full rounded-full transition-all ${oi.status === 'done' ? 'bg-success' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                  </div>
                  {isInsufficient && (
                    <div className="mt-2 p-2 rounded-lg bg-warning/10 border border-warning/20 text-[11px] text-warning space-y-0.5">
                      <div className="flex items-center gap-1.5 font-semibold">
                        <Icon name="AlertTriangle" size={12} />
                        {orderWhId
                          ? <>На этом складе больше нет · не хватает {remaining - totalAvailable} {item.unit}</>
                          : <>Не хватает {remaining - totalAvailable} {item.unit}</>
                        }
                      </div>
                      {otherWarehouseStocks.length > 0 && (
                        <div className="text-muted-foreground">
                          Есть на других складах: {otherWarehouseStocks.map(s => `${s.name} (${s.qty} ${item.unit})`).join(', ')}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
              {liveOrder.status === 'active' && oi.status !== 'done' && (
                <Button size="sm" onClick={() => setPickingItem(oi)} className="w-full mt-3 gap-1.5">
                  <Icon name="PackageCheck" size={14} />
                  {oi.status === 'partial' ? 'Продолжить сборку' : 'Собрать'}
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {orderHistory.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold">История операций</h3>
          <div className="bg-card rounded-xl border border-border shadow-card divide-y divide-border">
            {orderHistory.slice(0, 10).map(op => {
              const item = state.items.find(i => i.id === op.itemId);
              const loc = op.locationId ? state.locations.find(l => l.id === op.locationId) : null;
              return (
                <div key={op.id} className="px-4 py-2.5 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-medium">{item?.name || '—'}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {loc?.name || 'Общий склад'} · {new Date(op.date).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  <span className="text-sm font-bold text-destructive">−{op.quantity} {item?.unit}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {liveOrder.status === 'active' && progress === 100 && (
          <Button onClick={() => changeStatus('assembled')} className="flex-1 bg-success hover:bg-success/90 text-success-foreground gap-1.5">
            <Icon name="CheckCircle" size={14} />Завершить сборку
          </Button>
        )}
        {liveOrder.status === 'draft' && (
          <>
            <Button variant="outline" onClick={() => setShowEdit(true)} className="flex-1 gap-1.5">
              <Icon name="Pencil" size={14} />Редактировать
            </Button>
            <Button onClick={() => changeStatus('active')} className="flex-1"><Icon name="Play" size={14} className="mr-1.5" />Запустить в работу</Button>
          </>
        )}

        {liveOrder.status === 'pending_stock' && <Button onClick={() => changeStatus('active')} className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground"><Icon name="Play" size={14} className="mr-1.5" />Запустить (поставка пришла)</Button>}
        {liveOrder.status === 'assembled' && (
          <>
            <Button onClick={handleClose} className="flex-1 bg-muted text-foreground hover:bg-muted/80"><Icon name="Archive" size={14} className="mr-1.5" />Закрыть заявку</Button>
            <Button variant="outline" onClick={() => setShowReassembleConfirm(true)} className="flex items-center gap-1.5">
              <Icon name="RotateCcw" size={14} />Пересобрать
            </Button>
          </>
        )}
        {(liveOrder.status === 'assembled' || liveOrder.status === 'closed') && (
          <Button variant="outline" onClick={() => setShowPrint(true)} className="flex items-center gap-1.5">
            <Icon name="Eye" size={14} />Накладная
          </Button>
        )}
        {liveOrder.status === 'closed' && (
          <Button onClick={() => setShowReassembleConfirm(true)} className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground">
            <Icon name="RotateCcw" size={14} className="mr-1.5" />Пересобрать
          </Button>
        )}
      </div>

      {pickingItem && <PickItemModal state={state} onStateChange={onStateChange} order={liveOrder} orderItem={pickingItem} onClose={() => setPickingItem(null)} />}
      {showCloseWarning && (
        <CloseWarningModal
          order={liveOrder}
          state={state}
          onConfirm={() => { setShowCloseWarning(false); changeStatus('closed'); }}
          onCancel={() => setShowCloseWarning(false)}
        />
      )}

      {showReassembleConfirm && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-card rounded-2xl border border-border shadow-2xl max-w-md w-full p-5 animate-scale-in">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-10 h-10 rounded-xl bg-warning/15 text-warning flex items-center justify-center shrink-0">
                <Icon name="RotateCcw" size={18} />
              </div>
              <div className="flex-1">
                <h3 className="font-bold text-base">Пересобрать заявку?</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Все товары вернутся на склад (в места, откуда были взяты). Заявка перейдёт в статус <b className="text-foreground">«Черновик»</b> — её можно будет отредактировать и запустить заново.
                </p>
              </div>
            </div>
            <div className="flex gap-2 mt-4">
              <Button variant="outline" onClick={() => setShowReassembleConfirm(false)} className="flex-1">Отмена</Button>
              <Button
                onClick={() => { setShowReassembleConfirm(false); handleReassemble(); }}
                className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground gap-1.5"
              >
                <Icon name="RotateCcw" size={14} />Пересобрать
              </Button>
            </div>
          </div>
        </div>
      )}

      {showPrint && (() => {
        const htmlTpl = (() => {
          try { return localStorage.getItem('invoice_template_html') || ''; } catch { return ''; }
        })();
        if (htmlTpl) {
          return (
            <div className="fixed inset-0 z-50 bg-background">
              <HtmlInvoiceView html={htmlTpl} order={liveOrder} state={state} onClose={() => setShowPrint(false)} />
            </div>
          );
        }
        return (
          <div className="fixed inset-0 z-50 bg-background flex flex-col">
            <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-300 shrink-0">
              <Button variant="outline" size="sm" onClick={() => setShowPrint(false)} className="gap-1.5">
                <Icon name="ArrowLeft" size={14} />Назад
              </Button>
              <span className="text-sm font-medium">Накладная № {liveOrder.number}</span>
            </div>
            <div className="flex-1 flex items-center justify-center bg-gray-100">
              <div className="bg-white rounded-2xl border border-border shadow-xl max-w-md w-full p-8 text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto">
                  <Icon name="FileText" size={28} className="text-muted-foreground" />
                </div>
                <h3 className="font-bold text-lg">Шаблон накладной не загружен</h3>
                <p className="text-sm text-muted-foreground">
                  Перейдите в раздел <b>«Накладная»</b> в меню, загрузите HTML-файл шаблона и привяжите поля — после этого здесь будет готовая накладная с данными заявки.
                </p>
                <Button variant="outline" onClick={() => setShowPrint(false)}>Закрыть</Button>
              </div>
            </div>
          </div>
        );
      })()}
      {showEdit && (
        <CreateOrderModal
          state={state}
          onStateChange={onStateChange}
          onClose={() => setShowEdit(false)}
          editOrder={liveOrder}
        />
      )}
    </div>
  );
}

function HtmlInvoiceView({ html, order, state, onClose }: {
  html: string; order: WorkOrder; state: AppState; onClose: () => void;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeHeight, setIframeHeight] = useState(1100);
  const [zoom, setZoom] = useState(1);

  const filledHtml = useMemo(() => {
    const now = new Date();
    const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
    const longDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} г.`;
    const shortDate = `${String(now.getDate()).padStart(2, '0')}.${String(now.getMonth() + 1).padStart(2, '0')}.${now.getFullYear()}`;
    const itemRows = order.items.map(oi => {
      const it = state.items.find(i => i.id === oi.itemId);
      return {
        name: it?.name || '',
        unit: it?.unit || 'шт.',
        qtyReq: String(oi.requiredQty),
        qtyRel: String(oi.pickedQty),
      };
    });

    const totalReq = order.items.reduce((s, i) => s + (i.requiredQty || 0), 0);
    const totalRel = order.items.reduce((s, i) => s + (i.pickedQty || 0), 0);

    const wh = (state.warehouses || []).find(w => w.id === order.warehouseId)
      || (() => {
        const orderWhIds = Array.from(new Set(
          (state.operations || [])
            .filter(op => op.orderId === order.id && op.warehouseId)
            .map(op => op.warehouseId as string)
        ));
        return (state.warehouses || []).find(w => w.id === orderWhIds[0])
          || (state.warehouses || [])[0];
      })();

    const values: Record<string, string> = {
      number: order.number || '',
      date: longDate,
      dateShort: shortDate,
      recipient: order.recipientName || '',
      senderDept: wh?.senderDept || '',
      receiverDept: order.recipientName || '',
      institution: wh?.institution || '',
      senderDeptProfile: wh?.senderDept || '',
      issuerRank: wh?.issuerRank || '',
      issuerName: wh?.issuerName || '',
      requesterRank: order.requesterRank || '',
      requesterName: order.requesterName || '',
      receiverRank: order.receiverRank || '',
      receiverName: order.receiverName || '',
      approverRole: wh?.approverRole || '',
      approverName: wh?.approverName || '',
      signatory: '',
      signatoryRole: '',
      okud: '0504204',
      okpo: '',
      okei: '383',
      totalReq: String(totalReq),
      totalRel: String(totalRel),
      totalSum: '',
    };

    let out = html;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');

      // Strip editor-only bind-highlight style that leaks dashed green/blue outlines
      const bindStyle = doc.getElementById('__bind_style');
      if (bindStyle) bindStyle.remove();
      // Strip ONLY outline (editor selection highlight). Keep dashed/dotted borders — they are legit (e.g. "Отметка бухгалтерии" frame)
      doc.querySelectorAll<HTMLElement>('*').forEach(el => {
        const s = el.getAttribute('style');
        if (!s) return;
        const lower = s.toLowerCase();
        if (lower.includes('outline')) {
          let cleaned = s.replace(/outline[^;]*;?/gi, '');
          cleaned = cleaned.trim();
          if (cleaned) el.setAttribute('style', cleaned);
          else el.removeAttribute('style');
        }
      });
      // Inject clean style — kills any remaining dashed/outline visuals in preview & print
      const cleanStyle = doc.createElement('style');
      cleanStyle.id = '__clean_bind_style';
      cleanStyle.textContent = `
        [data-bind], [data-bindable-hover] { background: transparent !important; outline: none !important; }
        *, *::before, *::after {
          outline: none !important;
        }
        /* Перенос только в ячейке наименования номенклатуры — остальные поля не трогаем */
        [data-bind="rowName"] {
          white-space: normal !important;
          word-break: break-word !important;
          overflow-wrap: anywhere !important;
          overflow: visible !important;
          text-overflow: clip !important;
        }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          html, body { margin: 0 !important; background: #fff !important; }
          [data-bind], [data-bindable-hover] { background: transparent !important; outline: none !important; }
          * { outline: none !important; }
          [data-bind="rowName"] {
            white-space: normal !important;
            word-break: break-word !important;
            overflow-wrap: anywhere !important;
            overflow: visible !important;
          }
        }
      `;
      if (doc.head) doc.head.appendChild(cleanStyle);

      const rowKeys = new Set(['rowIndex','rowName','rowUnit','rowQtyReq','rowQtyRel','rowPrice','rowSum']);
      const templateRow = doc.querySelector('tr[data-bind="itemsRows"]') as HTMLElement | null;
      if (templateRow && templateRow.parentElement) {
        const parent = templateRow.parentElement;
        const ref = templateRow.nextSibling;
        parent.removeChild(templateRow);
        itemRows.forEach((r, i) => {
          const row = templateRow.cloneNode(true) as HTMLElement;
          row.removeAttribute('data-bind');
          const rowVals: Record<string, string> = {
            rowIndex: String(i + 1),
            rowName: r.name,
            rowUnit: r.unit,
            rowQtyReq: r.qtyReq,
            rowQtyRel: r.qtyRel,
            rowPrice: '',
            rowSum: '',
          };
          row.querySelectorAll('[data-bind]').forEach(sub => {
            const k = sub.getAttribute('data-bind') || '';
            if (rowKeys.has(k)) {
              sub.textContent = rowVals[k] ?? '';
            }
          });
          parent.insertBefore(row, ref);
        });
      }

      doc.querySelectorAll('[data-bind]').forEach(el => {
        const key = el.getAttribute('data-bind') || '';
        if (key === 'itemsRows' || rowKeys.has(key)) return;
        if (key in values) {
          el.textContent = values[key];
        }
      });

      out = '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
    } catch {
      /* fallback to original */
    }

    Object.entries(values).forEach(([k, v]) => {
      out = out.split(`{{${k}}}`).join(v);
    });

    return out;
  }, [html, order, state]);

  const handleIframeLoad = useCallback(() => {
    const f = iframeRef.current;
    if (!f) return;
    try {
      const doc = f.contentDocument;
      if (!doc) return;
      const measure = () => {
        const h = Math.max(
          doc.body?.scrollHeight || 0,
          doc.documentElement?.scrollHeight || 0,
          800,
        );
        setIframeHeight(h);
      };
      measure();
      setTimeout(measure, 100);
      setTimeout(measure, 400);
    } catch { /* noop */ }
  }, []);

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const docTitle = `Накладная ${order.number}`;
    const printHead = `
<title>${docTitle}</title>
<style id="__print_reset">
  @page { size: A4 landscape; margin: 8mm; }
  @media print {
    html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
    [data-bind] { background: transparent !important; outline: none !important; }
    [data-bindable-hover] { background: transparent !important; outline: none !important; }
    [data-bind="rowName"] {
      white-space: normal !important;
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
      overflow: visible !important;
    }
  }
  [data-bind] { background: transparent !important; outline: none !important; }
  [data-bind="rowName"] {
    white-space: normal !important;
    word-break: break-word !important;
    overflow-wrap: anywhere !important;
  }
</style>`;
    let html = filledHtml;
    // Remove existing title to avoid duplicates
    html = html.replace(/<title>[^<]*<\/title>/i, '');
    if (html.includes('</head>')) {
      html = html.replace('</head>', `${printHead}</head>`);
    } else if (html.includes('<head>')) {
      html = html.replace('<head>', `<head>${printHead}`);
    } else {
      html = `<!DOCTYPE html><html><head>${printHead}</head><body>${html}</body></html>`;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.document.title = docTitle;
    setTimeout(() => { try { w.document.title = docTitle; } catch { /* noop */ } w.print(); }, 400);
  };

  return (
    <div className="h-full flex flex-col bg-gray-200 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2 bg-white border-b border-gray-300 shrink-0" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
          <Icon name="ArrowLeft" size={14} />Назад
        </Button>
        <span className="text-sm font-medium">Накладная № {order.number}</span>
        <div className="flex-1" />
        <div className="flex items-center gap-1">
          <button className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" onClick={() => setZoom(z => Math.max(0.3, +(z - 0.1).toFixed(1)))}>−</button>
          <span className="w-12 text-center text-xs text-gray-600 tabular-nums">{Math.round(zoom * 100)}%</span>
          <button className="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100" onClick={() => setZoom(z => Math.min(2, +(z + 0.1).toFixed(1)))}>+</button>
        </div>
        <Button size="sm" onClick={handlePrint} className="gap-1.5">
          <Icon name="Printer" size={14} />Печать
        </Button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-100">
        <iframe
          ref={iframeRef}
          srcDoc={filledHtml}
          onLoad={handleIframeLoad}
          title="Накладная"
          className="border-0 block bg-white"
          style={{
            width: '100%',
            height: Math.max(iframeHeight, 900),
            transform: zoom !== 1 ? `scale(${zoom})` : undefined,
            transformOrigin: 'top left',
          }}
          sandbox="allow-same-origin allow-scripts"
        />
      </div>
    </div>
  );
}