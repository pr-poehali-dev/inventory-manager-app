import { useState } from 'react';
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
            <Button variant="outline" onClick={() => changeStatus('draft')} disabled className="flex-1 opacity-50">
              <Icon name="Pencil" size={14} />Черновик
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
    appRole: tpl?.signatoryRole || '', appSign: '', appName: tpl?.signatory || '',
    relRank: '', relSign: '', relName: '', relFio: '',
    respRole: '', respSign: '', respSignName: '',
    relDay: '', relMonth: '', relYear: yearShort,
    recRank: '', recSign: '', recName: '',
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
    if (editing) return <input type="text" value={f[k] || ''} onChange={e => uf(k, e.target.value)} className="bg-blue-50/70 border-b border-blue-300 outline-none px-0.5" style={{ width: w || '100%', fontSize: 'inherit', fontFamily: 'inherit', textAlign: (a || 'left') as never }} />;
    return <span className="border-b border-black inline-block align-bottom" style={{ width: w || '100%', minHeight: '1.1em', textAlign: (a || 'left') as never }}>{f[k] || '\u00A0'}</span>;
  };

  const EC = ({ value, onChange, a }: { value: string; onChange: (v: string) => void; a?: string }) => {
    if (editing) return <input type="text" value={value} onChange={e => onChange(e.target.value)} className="bg-blue-50/70 border-0 outline-none w-full px-0" style={{ fontSize: 'inherit', fontFamily: 'inherit', textAlign: (a || 'center') as never, minWidth: 0 }} />;
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
.ft{font-size:8pt;margin-top:3pt}.acc{border:1px dashed #000;padding:4pt;font-size:7.5pt}
@media print{body{padding:4mm 6mm}@page{size:landscape;margin:6mm}}</style></head><body>
<div class="hdr"><div style="flex:1">
<div style="text-align:center;font-weight:bold;font-size:11pt;margin-bottom:2pt">ТРЕБОВАНИЕ-НАКЛАДНАЯ \u2116 <span class="u">${f.num}</span></div>
<div style="text-align:center;font-size:8.5pt;margin-bottom:4pt">от <span class="u" style="min-width:120px">${f.date}</span></div>
<div class="row">Учреждение <span class="u" style="min-width:300px">${f.institution}</span></div>
<div class="row">Структурное подразделение - отправитель <span class="u" style="min-width:200px">${f.senderDept}</span></div>
<div class="row">Структурное подразделение - получатель <span class="u" style="min-width:200px">${f.receiverDept}</span></div>
<div class="row">Единица измерения: руб. (с точностью до второго десятичного знака)</div>
</div>
<table style="border-collapse:collapse;font-size:8pt;align-self:flex-start"><tr><td colspan="2" style="border:1px solid #000;padding:1pt 4pt;text-align:center;font-weight:bold">Коды</td></tr><tr><td style="padding:1pt 4pt;text-align:right;border-left:1px solid #000;border-top:1px solid #000;border-bottom:1px solid #000">Форма по ОКУД</td><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.okud}</td></tr><tr><td style="padding:1pt 4pt;text-align:right;border-left:1px solid #000;border-top:1px solid #000;border-bottom:1px solid #000">Дата</td><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.dateCode}</td></tr><tr><td style="padding:1pt 4pt;text-align:right;border-left:1px solid #000;border-top:1px solid #000;border-bottom:1px solid #000">по ОКПО</td><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.okpo}</td></tr><tr><td style="height:4pt"></td><td></td></tr><tr><td style="padding:1pt 4pt;text-align:right">по ОКЕИ</td><td style="border:1px solid #000;padding:1pt 4pt;text-align:center">${f.okei}</td></tr></table></div>
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
      <div className="flex items-center gap-3 px-4 py-2 bg-white border-b border-gray-300 shrink-0" style={{ fontFamily: 'system-ui, sans-serif' }}>
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
        <div className="bg-white mx-auto shadow-lg border border-gray-300 px-10 py-6" style={{ maxWidth: 1200, minWidth: 1000, fontSize: '9pt', ...serif }}>

          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-0.5" style={{ fontSize: '8.5pt' }}>
              <div className="text-center font-bold mb-0.5" style={{ fontSize: '12pt' }}>
                ТРЕБОВАНИЕ-НАКЛАДНАЯ {'\u2116'}{' '}<EF k="num" w="70px" a="center" />
              </div>
              <div className="text-center mb-2" style={{ fontSize: '8.5pt' }}>
                от{' '}<EF k="date" w="150px" a="center" />
              </div>
              <div className="flex items-end gap-1">
                <span className="whitespace-nowrap">Учреждение</span><EF k="institution" />
              </div>
              <div className="flex items-end gap-1">
                <span className="whitespace-nowrap">Структурное подразделение - отправитель</span><EF k="senderDept" />
              </div>
              <div className="flex items-end gap-1">
                <span className="whitespace-nowrap">Структурное подразделение - получатель</span><EF k="receiverDept" />
              </div>
              <div>Единица измерения: руб. (с точностью до второго десятичного знака)</div>
            </div>
            <table className="border-collapse shrink-0 self-start" style={{ fontSize: '8pt' }}>
              <tbody>
                <tr><td colSpan={2} className={`${bb} px-2 py-0.5 text-center font-bold`}>Коды</td></tr>
                <tr><td className="px-2 py-0.5 text-right border-l border-t border-b border-black" style={{ borderRight: 0 }}>Форма по ОКУД</td><td className={th}><EF k="okud" w="60px" a="center" /></td></tr>
                <tr><td className="px-2 py-0.5 text-right border-l border-t border-b border-black" style={{ borderRight: 0 }}>Дата</td><td className={th}><EF k="dateCode" w="60px" a="center" /></td></tr>
                <tr><td className="px-2 py-0.5 text-right border-l border-t border-b border-black" style={{ borderRight: 0 }}>по ОКПО</td><td className={th}><EF k="okpo" w="60px" a="center" /></td></tr>
                <tr><td /><td style={{ height: 4 }} /></tr>
                <tr><td className="px-2 py-0.5 text-right" style={{ border: 'none' }}>по ОКЕИ</td><td className={th}><EF k="okei" w="60px" a="center" /></td></tr>
              </tbody>
            </table>
          </div>

          <div className="flex items-end gap-1 flex-wrap mt-3" style={{ fontSize: '8.5pt' }}>
            <span className="font-semibold">Затребовал</span>
            <div className="text-center"><EF k="reqRank" w="100px" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(звание)</div></div>
            <div className="text-center"><EF k="reqName" w="120px" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(фамилия, инициалы)</div></div>
            <span className="font-semibold ml-4">Разрешил</span>
            <div className="text-center"><EF k="appRole" w="100px" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(должность)</div></div>
            <div className="text-center"><EF k="appSign" w="80px" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(подпись)</div></div>
            <div className="text-center"><EF k="appName" w="120px" a="center" /><div className="text-gray-500" style={{ fontSize: '6.5pt' }}>(расшифровка подписи)</div></div>
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
            <div className="flex-1 space-y-1.5">
              <div className="font-bold" style={{ fontSize: '9pt' }}>Отпустил</div>
              <div className="flex items-end gap-1.5 flex-wrap">
                <div className="text-center"><EF k="relRank" w="90px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(звание)</div></div>
                <div className="text-center"><EF k="relSign" w="80px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(подпись)</div></div>
                <div className="text-center"><EF k="relName" w="110px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(расшифровка подписи)</div></div>
              </div>
              <div className="pl-4"><EF k="date" w="130px" /></div>
            </div>

            <div className="flex-1 space-y-1.5">
              <div className="font-bold" style={{ fontSize: '9pt' }}>Ответственный исполнитель</div>
              <div className="flex items-end gap-1.5 flex-wrap">
                <div className="text-center"><EF k="respRole" w="90px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(должность)</div></div>
                <div className="text-center"><EF k="respSign" w="80px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(подпись)</div></div>
              </div>
              <div className="flex items-end gap-1.5">
                <div className="text-center"><EF k="respSignName" w="140px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(расшифровка подписи)</div></div>
              </div>
              <div className="flex items-center gap-0.5" style={{ fontSize: '7.5pt' }}>
                <span>{'" '}</span><EF k="relDay" w="24px" a="center" /><span>{' " '}</span><EF k="relMonth" w="60px" a="center" /><span> 20</span><EF k="relYear" w="20px" a="center" /><span> г.</span>
              </div>
            </div>

            <div className="border border-dashed border-black p-2.5" style={{ fontSize: '7.5pt', minWidth: 250, maxWidth: 290 }}>
              <div className="text-center font-bold mb-1">Отметка бухгалтерии</div>
              <div>Корреспонденция счетов (графы 10, 11) отражена</div>
              <div className="flex items-end gap-0.5 flex-wrap">
                <span>в журнале операций за</span><EF k="accJournalMonth" w="50px" a="center" /><span>20</span><EF k="accYear" w="20px" a="center" /><span> г.</span>
              </div>
              <div className="font-bold mt-1.5">Исполнитель</div>
              <div className="flex items-end gap-0.5 flex-wrap mt-0.5">
                <div className="text-center"><EF k="accExecRole" w="55px" a="center" /><div className="text-gray-500" style={{ fontSize: '5.5pt' }}>(должность)</div></div>
                <div className="text-center"><EF k="accExecSign" w="50px" a="center" /><div className="text-gray-500" style={{ fontSize: '5.5pt' }}>(подпись)</div></div>
                <div className="text-center"><EF k="accExecName" w="65px" a="center" /><div className="text-gray-500" style={{ fontSize: '5.5pt' }}>(расшифровка подписи)</div></div>
              </div>
              <div className="flex items-center gap-0.5 mt-0.5">
                <span>{'" '}</span><EF k="accExecDay" w="18px" a="center" /><span>{' " '}</span><EF k="accExecMonth" w="45px" a="center" /><span> 20</span><EF k="accExecYear" w="16px" a="center" /><span> г.</span>
              </div>
            </div>
          </div>

          <div className="mt-2 space-y-1" style={{ fontSize: '8.5pt' }}>
            <div className="flex items-end gap-1.5">
              <span className="font-bold">Получил</span>
              <div className="text-center"><EF k="recRank" w="110px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(звание)</div></div>
              <div className="text-center"><EF k="recSign" w="100px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(подпись)</div></div>
              <div className="text-center"><EF k="recName" w="160px" a="center" /><div className="text-gray-500" style={{ fontSize: '6pt' }}>(расшифровка подписи)</div></div>
            </div>
            <div className="pl-14"><EF k="date" w="130px" /></div>
          </div>

        </div>
      </div>
    </div>
  );
}