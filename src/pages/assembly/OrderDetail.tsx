import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  AppState, crudAction,
  WorkOrder, OrderItem, OrderStatus, InvoiceTemplate,
  getOrderStatusLabel, getOrderStatusColor,
  updateLocationStock, updateWarehouseStock,
} from '@/data/store';
import { PickItemModal, CloseWarningModal } from './PickModals';

export function OrderDetail({ order, state, onStateChange, onBack }: {
  order: WorkOrder; state: AppState;
  onStateChange: (s: AppState) => void; onBack: () => void;
}) {
  const [pickingItem, setPickingItem] = useState<OrderItem | null>(null);
  const [showPrint, setShowPrint] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);

  const doneCount = order.items.filter(i => i.status === 'done').length;
  const progress = order.items.length > 0 ? Math.round((doneCount / order.items.length) * 100) : 0;
  const hasUnfinished = order.items.some(i => i.status !== 'done');

  const changeStatus = (status: OrderStatus) => {
    const next = { ...state, workOrders: state.workOrders.map(o => o.id === order.id ? { ...o, status, updatedAt: new Date().toISOString() } : o) };
    onStateChange(next); crudAction('upsert_work_order', { workOrder: { ...order, status, updatedAt: new Date().toISOString() }, orderItems: order.items });
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
          status: 'active' as OrderStatus,
          updatedAt: new Date().toISOString(),
          items: o.items.map(oi => ({ ...oi, pickedQty: 0, status: 'pending' as OrderItem['status'] })),
        };
      }),
    };
    onStateChange(next);
    const updatedOrder = next.workOrders.find(o => o.id === order.id)!;
    crudAction('upsert_work_order', { workOrder: updatedOrder, orderItems: updatedOrder.items });
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
        {(liveOrder.status === 'closed' || liveOrder.status === 'assembled') && (
          <button onClick={handleReassemble}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-warning/12 text-warning hover:bg-warning/20 transition-all">
            <Icon name="RotateCcw" size={11} />
            Пересобрать
          </button>
        )}
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
        {liveOrder.status === 'draft' && (
          <>
            <Button variant="outline" onClick={() => {}} className="flex items-center gap-1.5">
              <Icon name="Pencil" size={14} />Черновик
            </Button>
            <Button onClick={() => changeStatus('active')} className="flex-1"><Icon name="Play" size={14} className="mr-1.5" />Запустить в работу</Button>
          </>
        )}

        {liveOrder.status === 'pending_stock' && <Button onClick={() => changeStatus('active')} className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground"><Icon name="Play" size={14} className="mr-1.5" />Запустить (поставка пришла)</Button>}
        {liveOrder.status === 'assembled' && <Button onClick={handleClose} className="flex-1 bg-muted text-foreground hover:bg-muted/80"><Icon name="Archive" size={14} className="mr-1.5" />Закрыть заявку</Button>}
        {(liveOrder.status === 'assembled' || liveOrder.status === 'closed') && (
          <Button variant="outline" onClick={() => setShowPrint(true)} className="flex items-center gap-1.5">
            <Icon name="Printer" size={14} />Накладная
          </Button>
        )}
        {liveOrder.status === 'closed' && (
          <Button onClick={() => changeStatus('active')} className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground">
            <Icon name="RotateCcw" size={14} className="mr-1.5" />Возобновить сборку
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

      {showPrint && (
        <PrintInvoiceModal
          order={liveOrder}
          state={state}
          onClose={() => setShowPrint(false)}
        />
      )}
    </div>
  );
}

function PrintInvoiceModal({ order, state, onClose }: { order: WorkOrder; state: AppState; onClose: () => void }) {
  const templates: InvoiceTemplate[] = state.invoiceTemplates || [];
  const [selId, setSelId] = useState(templates[0]?.id || '');
  const tpl = templates.find(t => t.id === selId);

  const handlePrint = () => {
    if (!tpl) return;
    const items = order.items.map(oi => {
      const it = state.items.find(i => i.id === oi.itemId);
      return { name: it?.name || '—', unit: it?.unit || 'шт', qty: oi.pickedQty, required: oi.requiredQty };
    });
    const now = new Date().toLocaleDateString('ru-RU');
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Накладная ${order.number}</title>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      body { font-family: 'Times New Roman', serif; font-size: 12pt; padding: 20mm; color: #000; }
      .header { text-align: center; margin-bottom: 16pt; }
      .header h1 { font-size: 14pt; font-weight: bold; margin-bottom: 4pt; }
      .meta { display: flex; justify-content: space-between; margin-bottom: 12pt; font-size: 10pt; }
      .meta-col { max-width: 48%; }
      table { width: 100%; border-collapse: collapse; margin: 12pt 0; }
      th, td { border: 1px solid #000; padding: 4pt 6pt; text-align: left; font-size: 10pt; }
      th { background: #f0f0f0; font-weight: bold; text-align: center; }
      td.num { text-align: center; }
      td.qty { text-align: right; }
      .footer { margin-top: 24pt; font-size: 10pt; }
      .sign-row { display: flex; justify-content: space-between; margin-top: 40pt; }
      .sign-col { text-align: center; min-width: 200px; }
      .sign-line { border-top: 1px solid #000; margin-top: 30pt; padding-top: 4pt; }
      @media print { body { padding: 10mm; } }
    </style></head><body>
    <div class="header">
      <h1>${tpl.headerText || 'ТОВАРНАЯ НАКЛАДНАЯ'}</h1>
      <div>№ ${order.number} от ${now}</div>
    </div>
    <div class="meta">
      <div class="meta-col">
        <b>Отправитель:</b><br>${tpl.companyName}
        ${tpl.companyAddress ? '<br>' + tpl.companyAddress : ''}
        ${tpl.companyInn ? '<br>ИНН: ' + tpl.companyInn : ''}${tpl.companyKpp ? ' КПП: ' + tpl.companyKpp : ''}
      </div>
      <div class="meta-col">
        <b>Получатель:</b><br>${order.recipientName || '—'}
        ${order.comment ? '<br>' + order.comment : ''}
      </div>
    </div>
    <table>
      <thead><tr><th style="width:30px">№</th><th>Наименование</th><th style="width:50px">Ед.</th><th style="width:60px">Кол-во</th></tr></thead>
      <tbody>
        ${items.map((it, i) => `<tr><td class="num">${i+1}</td><td>${it.name}</td><td class="num">${it.unit}</td><td class="qty">${it.qty}</td></tr>`).join('')}
      </tbody>
    </table>
    <div><b>Итого позиций:</b> ${items.length}, <b>единиц:</b> ${items.reduce((s, it) => s + it.qty, 0)}</div>
    ${tpl.footerText ? '<div class="footer">' + tpl.footerText + '</div>' : ''}
    ${tpl.bankDetails ? '<div class="footer" style="margin-top:8pt;font-size:9pt;color:#555">' + tpl.bankDetails.replace(/\n/g, '<br>') + '</div>' : ''}
    <div class="sign-row">
      <div class="sign-col">
        <div class="sign-line">Отпустил${tpl.signatory ? ': ' + tpl.signatory : ''}</div>
        ${tpl.signatoryRole ? '<div style="font-size:9pt;color:#555">' + tpl.signatoryRole + '</div>' : ''}
      </div>
      <div class="sign-col">
        <div class="sign-line">Получил</div>
      </div>
    </div>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Printer" size={16} className="text-primary" />Печать накладной
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {templates.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              <Icon name="FileText" size={28} className="mx-auto mb-2 opacity-30" />
              <p>Нет шаблонов накладных</p>
              <p className="mt-1">Создайте шаблон во вкладке <b>Документы → Шаблоны накладных</b></p>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className="text-sm font-medium">Шаблон</label>
                <select value={selId} onChange={e => setSelId(e.target.value)}
                  className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  {templates.map(t => <option key={t.id} value={t.id}>{t.name} — {t.companyName}</option>)}
                </select>
              </div>
              {tpl && (
                <div className="p-3 bg-muted/50 rounded-lg text-xs text-muted-foreground space-y-0.5">
                  <div><b className="text-foreground">{tpl.companyName}</b></div>
                  {tpl.companyAddress && <div>{tpl.companyAddress}</div>}
                  {tpl.companyInn && <div>ИНН: {tpl.companyInn}</div>}
                  {tpl.signatory && <div>Подписант: {tpl.signatory}</div>}
                </div>
              )}
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <div className="font-semibold">Заявка {order.number}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {order.items.length} позиций · получатель: {order.recipientName || '—'}
                </div>
              </div>
            </>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handlePrint} disabled={!tpl} className="flex-1 gap-1.5">
              <Icon name="Printer" size={14} />Печать
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}