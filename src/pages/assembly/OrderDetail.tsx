import { useState, useMemo, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  AppState, crudAction, saveState,
  WorkOrder, OrderItem, OrderStatus, InvoiceTemplate,
  getOrderStatusLabel, getOrderStatusColor,
  updateLocationStock, updateWarehouseStock,
} from '@/data/store';
import { PickItemModal, CloseWarningModal } from './PickModals';
import InvoiceFiller from '@/pages/documents/InvoiceFiller';
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
          status: 'active' as OrderStatus,
          updatedAt: new Date().toISOString(),
          items: o.items.map(oi => ({ ...oi, pickedQty: 0, status: 'pending' as OrderItem['status'] })),
        };
      }),
    };
    onStateChange(next);
    saveState(next);
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
                    <div className="flex items-center gap-1.5 mt-2 text-[11px] text-warning">
                      <Icon name="AlertTriangle" size={12} />
                      Не хватает {remaining - totalAvailable} {item.unit}
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
        {liveOrder.status === 'assembled' && <Button onClick={handleClose} className="flex-1 bg-muted text-foreground hover:bg-muted/80"><Icon name="Archive" size={14} className="mr-1.5" />Закрыть заявку</Button>}
        {(liveOrder.status === 'assembled' || liveOrder.status === 'closed') && (
          <Button variant="outline" onClick={() => setShowPrint(true)} className="flex items-center gap-1.5">
            <Icon name="Eye" size={14} />Накладная
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
        const templates: InvoiceTemplate[] = state.invoiceTemplates || [];
        const visualTpl = templates.find(t => t.elements && t.elements.length > 0);
        if (visualTpl) {
          return (
            <div className="fixed inset-0 z-50 bg-background">
              <InvoiceFiller template={visualTpl} order={liveOrder} state={state} onClose={() => setShowPrint(false)} />
            </div>
          );
        }
        return (
          <div className="fixed inset-0 z-50 bg-background">
            <InvoicePreviewPage order={liveOrder} state={state} onClose={() => setShowPrint(false)} />
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

type IRow = {
  name: string;
  nomenNum: string;
  passport: string;
  unitName: string;
  unitCode: string;
  price: string;
  qtyReq: string;
  qtyRel: string;
  sum: string;
  debit: string;
  credit: string;
  note: string;
};

function InvoicePreviewPage({ order, state, onClose }: { order: WorkOrder; state: AppState; onClose: () => void }) {
  const templates: InvoiceTemplate[] = state.invoiceTemplates || [];
  const [selId, setSelId] = useState(templates[0]?.id || '');
  const tpl = templates.find(t => t.id === selId);
  const [editing, setEditing] = useState(false);

  const now = new Date();
  const months = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
  const longDate = `${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()} г.`;
  const yearShort = String(now.getFullYear()).slice(-2);

  const [f, setF] = useState<Record<string, string>>(() => ({
    num: order.number, date: longDate, okud: '0504204', dateCode: '', okpo: '', okei: '383',
    institution: tpl?.companyName || '', senderDept: '', receiverDept: order.recipientName || '',
    reqRank: '', reqName: '',
    appRole: order.issuerRank || tpl?.signatoryRole || '', appSign: '', appName: order.issuerName || tpl?.signatory || '',
    relRank: order.issuerRank || '', relSign: '', relName: order.issuerName || '', relFio: '',
    respRole: '', respSign: '', respSignName: '',
    relDay: '', relMonth: '', relYear: yearShort,
    recRank: order.receiverRank || '', recSign: '', recName: order.receiverName || '',
    accJournalMonth: '', accYear: yearShort,
    accExecRole: '', accExecSign: '', accExecName: '',
    accExecDay: '', accExecMonth: '', accExecYear: yearShort,
  }));

  const [rows, setRows] = useState<IRow[]>(() =>
    order.items.map(oi => {
      const it = state.items.find(i => i.id === oi.itemId);
      return { name: it?.name || '', nomenNum: '', passport: '', unitName: it?.unit || 'шт.', unitCode: '', price: '', qtyReq: String(oi.requiredQty), qtyRel: String(oi.pickedQty), sum: '', debit: '', credit: '', note: '' };
    })
  );

  const applyTemplate = (t: InvoiceTemplate | undefined) => {
    setF(p => ({ ...p, institution: t?.companyName || p.institution, appRole: t?.signatoryRole || p.appRole, appName: t?.signatory || p.appName }));
  };

  const uf = (k: string, v: string) => setF(p => ({ ...p, [k]: v }));
  const ur = (i: number, k: keyof IRow, v: string) => setRows(p => p.map((r, idx) => idx === i ? { ...r, [k]: v } : r));

  const totReq = rows.reduce((s, r) => s + (parseFloat(r.qtyReq) || 0), 0);
  const totRel = rows.reduce((s, r) => s + (parseFloat(r.qtyRel) || 0), 0);

  const EF = ({ k, w, a }: { k: string; w?: string; a?: string }) => {
    if (editing) return <input type="text" value={f[k] || ''} onChange={e => uf(k, e.target.value)} className="invoice-input bg-transparent border-b border-transparent outline-none px-0.5 focus:border-gray-400" style={{ width: w || '100%', fontSize: 'inherit', fontFamily: 'inherit', textAlign: (a || 'left') as never }} />;
    return <span className="border-b border-black inline-block align-bottom" style={{ width: w || '100%', minHeight: '1.1em', textAlign: (a || 'left') as never }}>{f[k] || '\u00A0'}</span>;
  };

  const EC = ({ value, onChange, a }: { value: string; onChange: (v: string) => void; a?: string }) => {
    if (editing) return <input type="text" value={value} onChange={e => onChange(e.target.value)} className="invoice-input bg-transparent border-0 outline-none w-full px-0" style={{ fontSize: 'inherit', fontFamily: 'inherit', textAlign: (a || 'center') as never, minWidth: 0 }} />;
    return <span className="block" style={{ textAlign: (a || 'center') as never }}>{value || '\u00A0'}</span>;
  };

  const handlePrint = () => {
    const rh = rows.map(r => `<tr><td>${r.name}</td><td class="c">${r.nomenNum}</td><td class="c">${r.passport}</td><td class="c">${r.unitName}</td><td class="c">${r.unitCode}</td><td class="r">${r.price}</td><td class="r">${r.qtyReq}</td><td class="r">${r.qtyRel}</td><td class="r">${r.sum}</td><td class="c">${r.debit}</td><td class="c">${r.credit}</td><td>${r.note}</td></tr>`).join('');
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Накладная ${f.num}</title>
<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:'Times New Roman',serif;font-size:9pt;padding:6mm 8mm;color:#000}
.u{border-bottom:1px solid #000;min-width:40px;display:inline-block;padding:0 2pt}.hdr{display:flex;justify-content:space-between}
.codes{border-collapse:collapse;font-size:8pt}.codes td{border:1px solid #000;padding:1pt 4pt}
.row{margin:1pt 0;font-size:8.5pt}.lbl{font-size:7pt;color:#555}
table.m{width:100%;border-collapse:collapse;font-size:7.5pt;margin:4pt 0}table.m th,table.m td{border:1px solid #000;padding:1pt 2pt;text-align:center;vertical-align:middle}table.m td.r{text-align:right}
.ft{font-size:8pt;margin-top:3pt}.acc{border:1px solid transparent;padding:4pt;font-size:7.5pt}
@media print{body{padding:4mm 6mm}@page{size:landscape;margin:6mm}}</style></head><body>
<div class="hdr"><div style="flex:1">
<div style="text-align:center;font-weight:bold;font-size:11pt;margin-bottom:2pt">ТРЕБОВАНИЕ-НАКЛАДНАЯ \u2116 <span class="u">${f.num}</span></div>
<div style="text-align:center;font-size:8.5pt;margin-bottom:4pt">от <span class="u" style="min-width:120px">${f.date}</span></div>
<div class="row">Учреждение <span class="u" style="min-width:300px">${f.institution}</span></div>
<div class="row">Структурное подразделение - отправитель <span class="u" style="min-width:200px">${f.senderDept}</span></div>
<div class="row">Структурное подразделение - получатель <span class="u" style="min-width:200px">${f.receiverDept}</span></div>
<div class="row">Единица измерения: руб. (с точностью до второго десятичного знака)</div>
</div>
<div style="display:flex;align-self:flex-start;font-size:8pt"><div style="padding-top:16pt"><div style="padding:1pt 4pt;text-align:right;font-weight:bold;height:18pt">Форма по ОКУД</div><div style="padding:1pt 4pt;text-align:right;font-weight:bold;height:18pt">Дата</div><div style="padding:1pt 4pt;text-align:right;height:18pt">по ОКПО</div><div style="height:4pt"></div><div style="padding:1pt 4pt;text-align:right">по ОКЕИ</div></div><table style="border-collapse:collapse"><tr><td style="border:1px solid #000;padding:1pt 4pt;text-align:center;font-weight:bold">Коды</td></tr><tr><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.okud}</td></tr><tr><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.dateCode}</td></tr><tr><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.okpo}</td></tr><tr><td style="height:4pt"></td></tr><tr><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.okei}</td></tr></table></div></div>
<div style="height:4pt"></div>
<div class="row">Затребовал <span class="u">${f.reqRank}</span> <span class="lbl">(звание)</span> <span class="u" style="min-width:80px">${f.reqName}</span> <span class="lbl">(фамилия, инициалы)</span> <span style="margin-left:16pt">Разрешил</span> <span class="u">${f.appRole}</span> <span class="lbl">(должность)</span> <span class="u">${f.appSign}</span> <span class="lbl">(подпись)</span> <span class="u" style="min-width:80px">${f.appName}</span> <span class="lbl">(расшифровка подписи)</span></div>
<table class="m"><thead>
<tr><th colspan="3">Материальные ценности</th><th colspan="2">номер</th><th colspan="2">Единица измерения</th><th rowspan="3">Цена</th><th colspan="2">Количество</th><th rowspan="3">Сумма<br>(без НДС)</th><th colspan="2">Корреспондирующие счета</th><th rowspan="3">Примечание</th></tr>
<tr><th rowspan="2">наименование</th><th rowspan="2" style="font-size:6.5pt">номенкла-<br>турный</th><th rowspan="2" style="font-size:6.5pt">паспорта (иной)</th><th rowspan="2" style="font-size:6.5pt">наимено-<br>вание</th><th rowspan="2" style="font-size:6.5pt">код по<br>ОКЕИ</th><th style="font-size:6.5pt">затре-<br>бовано</th><th style="font-size:6.5pt">отпу-<br>щено</th><th rowspan="2">дебет</th><th rowspan="2">кредит</th></tr>
<tr></tr>
<tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th></tr>
</thead><tbody>${rh}
<tr style="font-weight:bold"><td colspan="6" style="text-align:right">Итого</td><td class="r">${totReq}</td><td class="r">${totRel}</td><td colspan="4"></td></tr></tbody></table>
<div style="display:flex;gap:8pt;margin-top:8pt;align-items:flex-start">
<div style="flex:1"><div class="ft"><b>Отпустил</b></div>
<div class="ft"><span class="u">${f.relRank}</span> <span class="lbl">(звание)</span> <span class="u">${f.relSign}</span> <span class="lbl">(подпись)</span> <span class="u" style="min-width:80px">${f.relName}</span> <span class="lbl">(расшифровка подписи)</span></div>
<div class="ft" style="margin-left:16pt">${f.date}</div></div>
<div style="flex:1"><div class="ft"><b>Ответственный исполнитель</b></div>
<div class="ft"><span class="u">${f.respRole}</span> <span class="lbl">(должность)</span> <span class="u">${f.respSign}</span> <span class="lbl">(подпись)</span></div>
<div class="ft"><span class="u">${f.respSignName}</span> <span class="lbl">(расшифровка подписи)</span></div>
<div class="ft"><span class="lbl">"</span><span class="u">${f.relDay}</span><span class="lbl">" </span><span class="u">${f.relMonth}</span><span class="lbl"> 20</span><span class="u">${f.relYear}</span><span class="lbl"> г.</span></div></div>
<div class="acc" style="min-width:220px"><div style="text-align:center;font-weight:bold;margin-bottom:2pt">Отметка бухгалтерии</div>
<div>Корреспонденция счетов (графы 10, 11) отражена</div><div>в журнале операций за <span class="u">${f.accJournalMonth}</span> 20<span class="u">${f.accYear}</span> г.</div>
<div style="margin-top:3pt"><b>Исполнитель</b></div>
<div><span class="u">${f.accExecRole}</span> <span class="lbl">(должность)</span> <span class="u">${f.accExecSign}</span> <span class="lbl">(подпись)</span> <span class="u">${f.accExecName}</span> <span class="lbl">(расшифровка подписи)</span></div>
<div><span class="lbl">"</span><span class="u">${f.accExecDay}</span><span class="lbl">" </span><span class="u">${f.accExecMonth}</span><span class="lbl"> 20</span><span class="u">${f.accExecYear}</span><span class="lbl"> г.</span></div></div></div>
<div style="margin-top:8pt"><div class="ft"><b>Получил</b> <span class="u">${f.recRank}</span> <span class="lbl">(звание)</span> <span class="u">${f.recSign}</span> <span class="lbl">(подпись)</span> <span class="u" style="min-width:120px">${f.recName}</span> <span class="lbl">(расшифровка подписи)</span></div>
<div class="ft">${f.date}</div></div>
</body></html>`;
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const bb = 'border border-black';
  const th = `${bb} px-1 py-0.5 text-center`;
  const serif = { fontFamily: "'Times New Roman', 'PT Serif', Georgia, serif" };

  return (
    <div className="h-full flex flex-col bg-gray-200 overflow-hidden" style={serif}>
      <style>{`@media print {
        .invoice-toolbar { display: none !important; }
        .invoice-input, input.invoice-input { border: none !important; background: transparent !important; box-shadow: none !important; }
      }`}</style>
      <div className="invoice-toolbar flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-300 shrink-0" style={{ fontFamily: 'system-ui, sans-serif' }}>
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
          <Icon name="ArrowLeft" size={14} />Назад
        </Button>
        {templates.length > 1 && (
          <select value={selId} onChange={e => { setSelId(e.target.value); applyTemplate(templates.find(t => t.id === e.target.value)); }}
            className="h-8 px-2 text-xs rounded border border-gray-300 bg-white">
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <Button variant={editing ? 'default' : 'outline'} size="sm" onClick={() => setEditing(p => !p)} className="gap-1.5">
          <Icon name={editing ? 'Eye' : 'Pencil'} size={14} />{editing ? 'Просмотр' : 'Редактировать'}
        </Button>
        <Button size="sm" onClick={handlePrint} className="gap-1.5">
          <Icon name="Printer" size={14} />Печать
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div className="bg-white mx-auto shadow-lg border border-gray-300 px-10 py-6" style={{ maxWidth: 1300, minWidth: 1100, fontSize: '9pt', ...serif }}>

          <div className="flex items-start gap-3">
            <div className="flex-1" style={{ fontSize: '8.5pt' }}>
              <div className="text-center font-bold" style={{ fontSize: '12pt' }}>
                ТРЕБОВАНИЕ-НАКЛАДНАЯ {'\u2116'}{' '}<EF k="num" w="90px" a="center" />
              </div>
              <div className="text-center" style={{ fontSize: '8.5pt', marginBottom: 8 }}>
                от{' '}<EF k="date" w="160px" a="center" />
              </div>
              <div className="flex items-end gap-1" style={{ marginBottom: 2 }}>
                <span className="whitespace-nowrap">Учреждение</span><EF k="institution" />
              </div>
              <div className="flex items-end gap-1" style={{ marginBottom: 2 }}>
                <span className="whitespace-nowrap">Структурное подразделение - отправитель</span><EF k="senderDept" />
              </div>
              <div className="flex items-end gap-1" style={{ marginBottom: 2 }}>
                <span className="whitespace-nowrap">Структурное подразделение - получатель</span><EF k="receiverDept" />
              </div>
              <div>Единица измерения: руб. (с точностью до второго десятичного знака)</div>
            </div>
            <div className="shrink-0 self-start flex items-start" style={{ fontSize: '8pt', paddingTop: 2 }}>
              <div className="flex flex-col text-right" style={{ paddingTop: 22 }}>
                <div className="font-bold whitespace-nowrap" style={{ height: 19, lineHeight: '19px', paddingRight: 4 }}>Форма по ОКУД</div>
                <div className="font-bold whitespace-nowrap" style={{ height: 19, lineHeight: '19px', paddingRight: 4 }}>Дата</div>
                <div className="whitespace-nowrap" style={{ height: 19, lineHeight: '19px', paddingRight: 4 }}>по ОКПО</div>
                <div style={{ height: 19 }} />
                <div className="whitespace-nowrap" style={{ height: 19, lineHeight: '19px', paddingRight: 4 }}>по ОКЕИ</div>
              </div>
              <table className="border-collapse" style={{ tableLayout: 'fixed' }}>
                <tbody>
                  <tr><td className="border border-black text-center font-bold" style={{ width: 70, height: 19, padding: 0 }}>Коды</td></tr>
                  <tr><td className="border border-black text-center" style={{ width: 70, height: 19, padding: 0 }}><EC value={f.okud} onChange={v => uf('okud', v)} /></td></tr>
                  <tr><td className="border border-black text-center" style={{ width: 70, height: 19, padding: 0 }}><EC value={f.dateCode} onChange={v => uf('dateCode', v)} /></td></tr>
                  <tr><td className="border border-black text-center" style={{ width: 70, height: 19, padding: 0 }}><EC value={f.okpo} onChange={v => uf('okpo', v)} /></td></tr>
                  <tr><td style={{ height: 19, border: 'none' }} /></tr>
                  <tr><td className="border border-black text-center" style={{ width: 70, height: 19, padding: 0 }}><EC value={f.okei} onChange={v => uf('okei', v)} /></td></tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-end gap-2 flex-nowrap mt-3" style={{ fontSize: '8.5pt' }}>
            <span>Затребовал</span>
            <div className="text-center flex-1 max-w-[140px]"><EF k="reqRank" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(звание)</div></div>
            <div className="text-center flex-1 max-w-[180px]"><EF k="reqName" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(фамилия, инициалы)</div></div>
            <span className="ml-4">Разрешил</span>
            <div className="text-center flex-1 max-w-[140px]"><EF k="appRole" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(должность)</div></div>
            <div className="text-center flex-1 max-w-[120px]"><EF k="appSign" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(подпись)</div></div>
            <div className="text-center flex-1 max-w-[180px]"><EF k="appName" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(расшифровка подписи)</div></div>
          </div>

          <div className="overflow-x-auto mt-3">
            <table className="w-full border-collapse" style={{ fontSize: '7.5pt', border: '1px solid #000' }}>
              <thead>
                <tr>
                  <th colSpan={3} className={`${bb} px-1 py-0.5`}>Материальные ценности</th>
                  <th colSpan={2} className={`${bb} px-1 py-0.5`}>номер</th>
                  <th colSpan={2} className={`${bb} px-1 py-0.5`}>Единица<br/>измерения</th>
                  <th rowSpan={3} className={`${bb} px-1 py-0.5 align-middle`} style={{ width: 46 }}>Цена</th>
                  <th colSpan={2} className={`${bb} px-1 py-0.5`}>Количество</th>
                  <th rowSpan={3} className={`${bb} px-1 py-0.5 align-middle`} style={{ width: 52 }}>Сумма<br/>(без НДС)</th>
                  <th colSpan={2} className={`${bb} px-1 py-0.5`}>Корреспондирующие счета</th>
                  <th rowSpan={3} className={`${bb} px-1 py-0.5 align-middle`} style={{ width: 66 }}>Примечание</th>
                </tr>
                <tr>
                  <th rowSpan={2} className={`${bb} px-1 py-0.5`} style={{ minWidth: 120 }}>наименование</th>
                  <th rowSpan={2} className={`${bb} px-1 py-0.5`} style={{ fontSize: '6.5pt', width: 52 }}>номенкла-<br/>турный</th>
                  <th rowSpan={2} className={`${bb} px-1 py-0.5`} style={{ fontSize: '6.5pt', width: 60 }}>паспорта<br/>(иной)</th>
                  <th rowSpan={2} className={`${bb} px-1 py-0.5`} style={{ fontSize: '6.5pt', width: 44 }}>наимено-<br/>вание</th>
                  <th rowSpan={2} className={`${bb} px-1 py-0.5`} style={{ fontSize: '6.5pt', width: 38 }}>код по<br/>ОКЕИ</th>
                  <th className={`${bb} px-1 py-0.5`} style={{ fontSize: '6.5pt', width: 48 }}>затре-<br/>бовано</th>
                  <th className={`${bb} px-1 py-0.5`} style={{ fontSize: '6.5pt', width: 48 }}>отпу-<br/>щено</th>
                  <th rowSpan={2} className={`${bb} px-1 py-0.5`} style={{ width: 50 }}>дебет</th>
                  <th rowSpan={2} className={`${bb} px-1 py-0.5`} style={{ width: 50 }}>кредит</th>
                </tr>
                <tr></tr>
                <tr>{['1','2','3','4','5','6','7','8','9','10','11','12'].map(n => <th key={n} className={`${bb} px-1 py-0 font-normal text-gray-500`} style={{ fontSize: '6.5pt' }}>{n}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className={`${bb} px-1 py-0.5`} style={{ minWidth: 100 }}><EC value={row.name} onChange={v => ur(i, 'name', v)} a="left" /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 48 }}><EC value={row.nomenNum} onChange={v => ur(i, 'nomenNum', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 56 }}><EC value={row.passport} onChange={v => ur(i, 'passport', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 40 }}><EC value={row.unitName} onChange={v => ur(i, 'unitName', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 36 }}><EC value={row.unitCode} onChange={v => ur(i, 'unitCode', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 46 }}><EC value={row.price} onChange={v => ur(i, 'price', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 46 }}><EC value={row.qtyReq} onChange={v => ur(i, 'qtyReq', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 46 }}><EC value={row.qtyRel} onChange={v => ur(i, 'qtyRel', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 52 }}><EC value={row.sum} onChange={v => ur(i, 'sum', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 50 }}><EC value={row.debit} onChange={v => ur(i, 'debit', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 50 }}><EC value={row.credit} onChange={v => ur(i, 'credit', v)} /></td>
                    <td className={`${bb} px-1 py-0.5`} style={{ width: 66 }}><EC value={row.note} onChange={v => ur(i, 'note', v)} a="left" /></td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={6} className={`${bb} px-1 py-0.5 text-right`}>Итого</td>
                  <td className={`${bb} px-1 py-0.5 text-right`}>{totReq}</td>
                  <td className={`${bb} px-1 py-0.5 text-right`}>{totRel}</td>
                  <td colSpan={4} className={`${bb} px-1 py-0.5`} />
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-4 mt-4 items-start" style={{ fontSize: '8pt' }}>
            <div className="flex-1">
              <div>Отпустил</div>
              <div className="flex items-end gap-2 mt-1">
                <div className="text-center flex-1"><EF k="relRank" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(звание)</div></div>
                <div className="text-center flex-1"><EF k="relSign" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(подпись)</div></div>
                <div className="text-center flex-1"><EF k="relName" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(расшифровка подписи)</div></div>
              </div>
              <div className="mt-0.5"><EF k="date" w="130px" /></div>
            </div>

            <div className="flex-1">
              <div>Ответственный исполнитель</div>
              <div className="flex items-end gap-2 mt-1">
                <div className="text-center flex-1"><EF k="respRole" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(должность)</div></div>
                <div className="text-center flex-1"><EF k="respSign" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(подпись)</div></div>
                <div className="text-center flex-1"><EF k="respSignName" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(расшифровка подписи)</div></div>
              </div>
              <div className="flex items-center gap-0.5 mt-0.5" style={{ fontSize: '7.5pt' }}>
                <span>{'"'}</span><EF k="relDay" w="24px" a="center" /><span>{'"'}</span><EF k="relMonth" w="60px" a="center" /><span>&nbsp;20</span><EF k="relYear" w="20px" a="center" /><span>&nbsp;г.</span>
              </div>
            </div>

            <div className="border border-dashed border-black p-2" style={{ fontSize: '7.5pt', minWidth: 280, maxWidth: 320 }}>
              <div className="text-center font-bold mb-1">Отметка бухгалтерии</div>
              <div>Корреспонденция счетов (графы 10, 11) отражена</div>
              <div className="flex items-end gap-0.5 flex-wrap">
                <span>в журнале операций за</span><EF k="accJournalMonth" w="60px" a="center" /><span>&nbsp;20</span><EF k="accYear" w="24px" a="center" /><span>&nbsp;г.</span>
              </div>
              <div className="flex items-end gap-1 mt-1">
                <span>Исполнитель</span>
                <div className="text-center flex-1"><EF k="accExecRole" a="center" /></div>
                <div className="text-center flex-1"><EF k="accExecSign" a="center" /></div>
                <div className="text-center flex-1"><EF k="accExecName" a="center" /></div>
              </div>
              <div className="flex gap-1" style={{ fontSize: '5.5pt' }}>
                <span className="ml-14">(должность)</span>
                <span className="ml-8">(подпись)</span>
                <span className="ml-6">(расшифровка подписи)</span>
              </div>
              <div className="flex items-center gap-0.5 mt-0.5">
                <span>{'"'}</span><EF k="accExecDay" w="20px" a="center" /><span>{'"'}</span><EF k="accExecMonth" w="50px" a="center" /><span>&nbsp;20</span><EF k="accExecYear" w="18px" a="center" /><span>&nbsp;г.</span>
              </div>
            </div>
          </div>

          <div className="mt-2" style={{ fontSize: '8.5pt' }}>
            <div className="flex items-end gap-2">
              <span>Получил</span>
              <div className="text-center flex-1 max-w-[180px]"><EF k="recRank" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(звание)</div></div>
              <div className="text-center flex-1 max-w-[160px]"><EF k="recSign" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(подпись)</div></div>
              <div className="text-center flex-1 max-w-[240px]"><EF k="recName" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(расшифровка подписи)</div></div>
            </div>
            <div className="mt-0.5"><EF k="date" w="130px" /></div>
          </div>

        </div>
      </div>
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
    const tpl = state.invoiceTemplates?.[0];

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

    const orderWhIds = Array.from(new Set(
      (state.operations || [])
        .filter(op => op.orderId === order.id && op.warehouseId)
        .map(op => op.warehouseId as string)
    ));
    const wh = (state.warehouses || []).find(w => w.id === orderWhIds[0])
      || (state.warehouses || [])[0];

    const values: Record<string, string> = {
      number: order.number || '',
      date: longDate,
      dateShort: shortDate,
      recipient: order.recipientName || '',
      senderDept: wh?.senderDept || '',
      receiverDept: order.recipientName || '',
      institution: wh?.institution || tpl?.companyName || '',
      senderDeptProfile: wh?.senderDept || '',
      issuerRank: wh?.issuerRank || '',
      issuerName: wh?.issuerName || '',
      approverRole: wh?.approverRole || '',
      approverName: wh?.approverName || '',
      signatory: tpl?.signatory || '',
      signatoryRole: tpl?.signatoryRole || '',
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
    w.document.write(filledHtml);
    w.document.close();
    setTimeout(() => w.print(), 300);
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