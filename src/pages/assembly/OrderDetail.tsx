import { useState } from 'react';
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
    crudAction('delete_operations_by_order', { orderId: order.id });
    crudAction('upsert_work_order', { workOrder: updatedOrder, orderItems: updatedOrder.items });
    for (const op of orderOps) {
      const updatedItem = next.items.find(i => i.id === op.itemId);
      const wsArr = (next.warehouseStocks || []).filter(w => w.itemId === op.itemId);
      const lsArr = (next.locationStocks || []).filter(ls => ls.itemId === op.itemId);
      if (updatedItem) {
        crudAction('upsert_item', { item: updatedItem, warehouseStocks: wsArr, locationStocks: lsArr });
      }
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

      {showPrint && (
        <div className="fixed inset-0 z-50 bg-background">
          <InvoicePreviewPage
            order={liveOrder}
            state={state}
            onClose={() => setShowPrint(false)}
          />
        </div>
      )}
    </div>
  );
}

type InvoiceFields = {
  docNumber: string;
  docDate: string;
  okpo: string;
  institution: string;
  senderDept: string;
  receiverDept: string;
  requestedByRank: string;
  requestedByName: string;
  approvedByRole: string;
  approvedBySignature: string;
  approvedByName: string;
  releasedByRank: string;
  releasedBySignature: string;
  releasedByName: string;
  responsibleRole: string;
  responsibleSignature: string;
  receivedByRank: string;
  receivedBySignature: string;
  receivedByName: string;
  releasedDate: string;
  receivedDate: string;
  accountingNote: string;
};

type InvoiceRow = {
  name: string;
  nomenclatureNum: string;
  passport: string;
  unitName: string;
  unitCode: string;
  price: string;
  requiredQty: string;
  releasedQty: string;
  sumNoVat: string;
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
  const dateStr = now.toLocaleDateString('ru-RU');

  const initFields = (): InvoiceFields => ({
    docNumber: order.number,
    docDate: dateStr,
    okpo: '',
    institution: tpl?.companyName || '',
    senderDept: '',
    receiverDept: order.recipientName || '',
    requestedByRank: '',
    requestedByName: '',
    approvedByRole: tpl?.signatoryRole || '',
    approvedBySignature: '',
    approvedByName: tpl?.signatory || '',
    releasedByRank: '',
    releasedBySignature: '',
    releasedByName: '',
    responsibleRole: '',
    responsibleSignature: '',
    receivedByRank: '',
    receivedBySignature: '',
    receivedByName: order.recipientName || '',
    releasedDate: dateStr,
    receivedDate: dateStr,
    accountingNote: '',
  });

  const initRows = (): InvoiceRow[] =>
    order.items.map(oi => {
      const it = state.items.find(i => i.id === oi.itemId);
      return {
        name: it?.name || '',
        nomenclatureNum: '',
        passport: '',
        unitName: it?.unit || 'шт',
        unitCode: '',
        price: '',
        requiredQty: String(oi.requiredQty),
        releasedQty: String(oi.pickedQty),
        sumNoVat: '',
        debit: '',
        credit: '',
        note: '',
      };
    });

  const [fields, setFields] = useState<InvoiceFields>(initFields);
  const [rows, setRows] = useState<InvoiceRow[]>(initRows);

  const applyTemplate = (t: InvoiceTemplate | undefined) => {
    setFields(prev => ({
      ...prev,
      institution: t?.companyName || prev.institution,
      approvedByRole: t?.signatoryRole || prev.approvedByRole,
      approvedByName: t?.signatory || prev.approvedByName,
    }));
  };

  const updateField = (key: keyof InvoiceFields, value: string) => {
    setFields(prev => ({ ...prev, [key]: value }));
  };

  const updateRow = (idx: number, key: keyof InvoiceRow, value: string) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, [key]: value } : r));
  };

  const totalRequired = rows.reduce((s, r) => s + (parseFloat(r.requiredQty) || 0), 0);
  const totalReleased = rows.reduce((s, r) => s + (parseFloat(r.releasedQty) || 0), 0);

  const renderField = (value: string, onChange: (v: string) => void, width?: string) => {
    if (editing) {
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-xs w-full outline-none focus:border-blue-400"
          style={width ? { width } : undefined}
        />
      );
    }
    return (
      <span
        className="border-b border-dotted border-gray-400 min-w-[40px] inline-block text-xs cursor-default"
        style={width ? { width } : undefined}
      >
        {value || '\u00A0'}
      </span>
    );
  };

  const renderCell = (value: string, onChange: (v: string) => void) => {
    if (editing) {
      return (
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          className="bg-blue-50 border-0 text-xs w-full outline-none text-center px-0.5 py-0"
          style={{ minWidth: 0 }}
        />
      );
    }
    return <span className="text-xs">{value || '\u00A0'}</span>;
  };

  const buildPrintHtml = () => {
    const rowsHtml = rows.map((r, i) => `
      <tr>
        <td class="c">${i + 1}</td>
        <td>${r.name}</td>
        <td class="c">${r.nomenclatureNum}</td>
        <td class="c">${r.passport}</td>
        <td class="c">${r.unitName}</td>
        <td class="c">${r.unitCode}</td>
        <td class="r">${r.price}</td>
        <td class="r">${r.requiredQty}</td>
        <td class="r">${r.releasedQty}</td>
        <td class="r">${r.sumNoVat}</td>
        <td class="c">${r.debit}</td>
        <td class="c">${r.credit}</td>
        <td>${r.note}</td>
      </tr>
    `).join('');

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Требование-накладная ${fields.docNumber}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Times New Roman',serif;font-size:10pt;padding:8mm 10mm;color:#000}
.top{display:flex;justify-content:space-between;margin-bottom:6pt}
.title{text-align:center;font-size:12pt;font-weight:bold;margin:8pt 0 4pt}
.codes{border:1px solid #000;font-size:8pt;width:180px}
.codes td,.codes th{border:1px solid #000;padding:1pt 4pt;text-align:center}
.field-row{font-size:9pt;margin:2pt 0}
.field-row .underline{border-bottom:1px solid #000;min-width:100px;display:inline-block;padding:0 4pt}
.auth{font-size:9pt;margin:6pt 0}
table.main{width:100%;border-collapse:collapse;margin:6pt 0;font-size:8pt}
table.main th,table.main td{border:1px solid #000;padding:2pt 3pt;text-align:left}
table.main th{text-align:center;font-weight:bold;background:#f5f5f5}
table.main td.c{text-align:center}
table.main td.r{text-align:right}
.footer-section{font-size:9pt;margin-top:10pt}
.sign-line{display:inline-flex;align-items:flex-end;margin:0 4pt}
.sign-line .line{border-bottom:1px solid #000;min-width:120px;display:inline-block}
.sign-line .label{font-size:7pt;text-align:center;display:block}
.accounting{border:1px dashed #000;padding:6pt;margin:8pt 0;min-height:40pt;font-size:9pt}
@media print{body{padding:5mm 8mm}}
</style></head><body>
<div class="top">
  <div style="flex:1">
    <div class="field-row">Учреждение: <span class="underline">${fields.institution}</span></div>
  </div>
  <div>
    <table class="codes">
      <tr><td colspan="2" style="font-size:7pt">Коды</td></tr>
      <tr><td style="text-align:left">Форма по ОКУД</td><td>0504204</td></tr>
      <tr><td style="text-align:left">Дата</td><td>${fields.docDate}</td></tr>
      <tr><td style="text-align:left">по ОКПО</td><td>${fields.okpo}</td></tr>
    </table>
  </div>
</div>
<div class="title">ТРЕБОВАНИЕ-НАКЛАДНАЯ ${'\u2116'} ${fields.docNumber}</div>
<div style="text-align:center;font-size:9pt;margin-bottom:6pt">от ${fields.docDate}</div>
<div class="field-row">Структурное подразделение - отправитель: <span class="underline">${fields.senderDept}</span></div>
<div class="field-row">Структурное подразделение - получатель: <span class="underline">${fields.receiverDept}</span></div>
<div class="field-row">Единица измерения: руб. (с точностью до второго десятичного знака) -- по ОКЕИ: 383</div>
<div class="auth">
  Затребовал: (звание) <span class="underline">${fields.requestedByRank}</span> (фамилия, инициалы) <span class="underline">${fields.requestedByName}</span>
</div>
<div class="auth">
  Разрешил: (должность) <span class="underline">${fields.approvedByRole}</span> (подпись) <span class="underline">${fields.approvedBySignature}</span> (расшифровка подписи) <span class="underline">${fields.approvedByName}</span>
</div>
<table class="main">
  <thead>
    <tr>
      <th rowspan="2" style="width:20px">${'\u2116'}</th>
      <th colspan="3">Материальные ценности</th>
      <th colspan="2">Единица измерения</th>
      <th rowspan="2">Цена</th>
      <th colspan="2">Количество</th>
      <th rowspan="2">Сумма<br>(без НДС)</th>
      <th colspan="2">Корреспондирующие счета</th>
      <th rowspan="2">Примечание</th>
    </tr>
    <tr>
      <th>наименование</th>
      <th>номенкл.<br>номер</th>
      <th>паспорта<br>(иной)</th>
      <th>наимен.</th>
      <th>код по<br>ОКЕИ</th>
      <th>затребо-<br>вано</th>
      <th>отпу-<br>щено</th>
      <th>дебет</th>
      <th>кредит</th>
    </tr>
    <tr><th>1</th><th>2</th><th>3</th><th>4</th><th>5</th><th>6</th><th>7</th><th>8</th><th>9</th><th>10</th><th>11</th><th>12</th><th>13</th></tr>
  </thead>
  <tbody>
    ${rowsHtml}
    <tr style="font-weight:bold">
      <td colspan="7" style="text-align:right">Итого</td>
      <td class="r">${totalRequired}</td>
      <td class="r">${totalReleased}</td>
      <td colspan="4"></td>
    </tr>
  </tbody>
</table>
<div class="footer-section">
  Отпустил: (звание) <span class="underline">${fields.releasedByRank}</span> (подпись) <span class="underline">${fields.releasedBySignature}</span> (расшифровка подписи) <span class="underline">${fields.releasedByName}</span>
</div>
<div class="footer-section" style="margin-top:6pt">
  Ответственный исполнитель: (должность) <span class="underline">${fields.responsibleRole}</span> (подпись) <span class="underline">${fields.responsibleSignature}</span>
</div>
<div class="accounting">Отметка бухгалтерии: ${fields.accountingNote}</div>
<div class="footer-section">
  Получил: (звание) <span class="underline">${fields.receivedByRank}</span> (подпись) <span class="underline">${fields.receivedBySignature}</span> (расшифровка подписи) <span class="underline">${fields.receivedByName}</span>
</div>
<div class="footer-section" style="margin-top:4pt">
  <span style="font-size:8pt">Дата отпуска: ${fields.releasedDate}</span>
  <span style="font-size:8pt;margin-left:40pt">Дата получения: ${fields.receivedDate}</span>
</div>
</body></html>`;
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintHtml());
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200 shrink-0">
        <Button variant="outline" size="sm" onClick={onClose} className="gap-1.5">
          <Icon name="ArrowLeft" size={14} />
          Назад
        </Button>
        {templates.length > 1 && (
          <select
            value={selId}
            onChange={e => { setSelId(e.target.value); applyTemplate(templates.find(t => t.id === e.target.value)); }}
            className="h-8 px-2 text-xs rounded border border-gray-300 bg-white"
          >
            {templates.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
        )}
        <div className="flex-1" />
        <Button
          variant={editing ? 'default' : 'outline'}
          size="sm"
          onClick={() => setEditing(prev => !prev)}
          className="gap-1.5"
        >
          <Icon name="Pencil" size={14} />
          {editing ? 'Просмотр' : 'Редактировать'}
        </Button>
        <Button size="sm" onClick={handlePrint} className="gap-1.5">
          <Icon name="Printer" size={14} />
          Печать
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-4">
        <div
          className="bg-white mx-auto shadow-lg border border-gray-300 p-8 min-w-[900px]"
          style={{ maxWidth: 1100, fontFamily: "'Times New Roman', 'PT Serif', Georgia, serif" }}
        >
          <div className="flex justify-between items-start mb-2">
            <div className="flex-1 space-y-1">
              <div className="flex items-center gap-2 text-xs">
                <span>Учреждение:</span>
                {renderField(fields.institution, v => updateField('institution', v), '300px')}
              </div>
            </div>
            <div className="shrink-0">
              <table className="border-collapse text-[9px]" style={{ border: '1px solid #000' }}>
                <tbody>
                  <tr>
                    <td colSpan={2} className="text-center border border-black px-2 py-0.5 font-bold">Коды</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-0.5 text-left">Форма по ОКУД</td>
                    <td className="border border-black px-2 py-0.5 text-center font-mono">0504204</td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-0.5 text-left">Дата</td>
                    <td className="border border-black px-2 py-0.5 text-center">
                      {renderField(fields.docDate, v => updateField('docDate', v))}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-black px-2 py-0.5 text-left">по ОКПО</td>
                    <td className="border border-black px-2 py-0.5 text-center">
                      {renderField(fields.okpo, v => updateField('okpo', v))}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-center font-bold text-sm my-3">
            ТРЕБОВАНИЕ-НАКЛАДНАЯ {'\u2116'} {renderField(fields.docNumber, v => updateField('docNumber', v), '60px')}
          </div>
          <div className="text-center text-xs mb-3">
            от {renderField(fields.docDate, v => updateField('docDate', v), '80px')}
          </div>

          <div className="space-y-1 text-xs mb-3">
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap">Структурное подразделение - отправитель:</span>
              {renderField(fields.senderDept, v => updateField('senderDept', v), '400px')}
            </div>
            <div className="flex items-center gap-1">
              <span className="whitespace-nowrap">Структурное подразделение - получатель:</span>
              {renderField(fields.receiverDept, v => updateField('receiverDept', v), '400px')}
            </div>
            <div>Единица измерения: руб. (с точностью до второго десятичного знака) -- по ОКЕИ: 383</div>
          </div>

          <div className="space-y-1 text-xs mb-3">
            <div className="flex items-center gap-1 flex-wrap">
              <span>Затребовал:</span>
              <span className="text-[10px] text-gray-500">(звание)</span>
              {renderField(fields.requestedByRank, v => updateField('requestedByRank', v), '150px')}
              <span className="text-[10px] text-gray-500">(фамилия, инициалы)</span>
              {renderField(fields.requestedByName, v => updateField('requestedByName', v), '200px')}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span>Разрешил:</span>
              <span className="text-[10px] text-gray-500">(должность)</span>
              {renderField(fields.approvedByRole, v => updateField('approvedByRole', v), '150px')}
              <span className="text-[10px] text-gray-500">(подпись)</span>
              {renderField(fields.approvedBySignature, v => updateField('approvedBySignature', v), '120px')}
              <span className="text-[10px] text-gray-500">(расшифровка подписи)</span>
              {renderField(fields.approvedByName, v => updateField('approvedByName', v), '180px')}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[9px]" style={{ border: '1px solid #000' }}>
              <thead>
                <tr>
                  <th rowSpan={2} className="border border-black px-1 py-0.5 text-center align-middle" style={{ width: 24 }}>{'\u2116'}</th>
                  <th colSpan={3} className="border border-black px-1 py-0.5 text-center">Материальные ценности</th>
                  <th colSpan={2} className="border border-black px-1 py-0.5 text-center">Единица измерения</th>
                  <th rowSpan={2} className="border border-black px-1 py-0.5 text-center align-middle">Цена</th>
                  <th colSpan={2} className="border border-black px-1 py-0.5 text-center">Количество</th>
                  <th rowSpan={2} className="border border-black px-1 py-0.5 text-center align-middle">Сумма<br/>(без НДС)</th>
                  <th colSpan={2} className="border border-black px-1 py-0.5 text-center">Корресп. счета</th>
                  <th rowSpan={2} className="border border-black px-1 py-0.5 text-center align-middle">Примечание</th>
                </tr>
                <tr>
                  <th className="border border-black px-1 py-0.5 text-center">наименование</th>
                  <th className="border border-black px-1 py-0.5 text-center">номенкл.<br/>номер</th>
                  <th className="border border-black px-1 py-0.5 text-center">паспорта<br/>(иной)</th>
                  <th className="border border-black px-1 py-0.5 text-center">наимен.</th>
                  <th className="border border-black px-1 py-0.5 text-center">код по<br/>ОКЕИ</th>
                  <th className="border border-black px-1 py-0.5 text-center">затребо-<br/>вано</th>
                  <th className="border border-black px-1 py-0.5 text-center">отпу-<br/>щено</th>
                  <th className="border border-black px-1 py-0.5 text-center">дебет</th>
                  <th className="border border-black px-1 py-0.5 text-center">кредит</th>
                </tr>
                <tr>
                  {['1','2','3','4','5','6','7','8','9','10','11','12','13'].map(n => (
                    <th key={n} className="border border-black px-1 py-0.5 text-center text-[8px] text-gray-500">{n}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => (
                  <tr key={idx}>
                    <td className="border border-black px-1 py-0.5 text-center">{idx + 1}</td>
                    <td className="border border-black px-1 py-0.5">{renderCell(row.name, v => updateRow(idx, 'name', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{renderCell(row.nomenclatureNum, v => updateRow(idx, 'nomenclatureNum', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{renderCell(row.passport, v => updateRow(idx, 'passport', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{renderCell(row.unitName, v => updateRow(idx, 'unitName', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{renderCell(row.unitCode, v => updateRow(idx, 'unitCode', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-right">{renderCell(row.price, v => updateRow(idx, 'price', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-right">{renderCell(row.requiredQty, v => updateRow(idx, 'requiredQty', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-right">{renderCell(row.releasedQty, v => updateRow(idx, 'releasedQty', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-right">{renderCell(row.sumNoVat, v => updateRow(idx, 'sumNoVat', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{renderCell(row.debit, v => updateRow(idx, 'debit', v))}</td>
                    <td className="border border-black px-1 py-0.5 text-center">{renderCell(row.credit, v => updateRow(idx, 'credit', v))}</td>
                    <td className="border border-black px-1 py-0.5">{renderCell(row.note, v => updateRow(idx, 'note', v))}</td>
                  </tr>
                ))}
                <tr className="font-bold">
                  <td colSpan={7} className="border border-black px-1 py-0.5 text-right">Итого</td>
                  <td className="border border-black px-1 py-0.5 text-right">{totalRequired}</td>
                  <td className="border border-black px-1 py-0.5 text-right">{totalReleased}</td>
                  <td colSpan={4} className="border border-black px-1 py-0.5"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-3 mt-5 text-xs">
            <div className="flex items-center gap-1 flex-wrap">
              <span>Отпустил:</span>
              <span className="text-[10px] text-gray-500">(звание)</span>
              {renderField(fields.releasedByRank, v => updateField('releasedByRank', v), '150px')}
              <span className="text-[10px] text-gray-500">(подпись)</span>
              {renderField(fields.releasedBySignature, v => updateField('releasedBySignature', v), '120px')}
              <span className="text-[10px] text-gray-500">(расшифровка подписи)</span>
              {renderField(fields.releasedByName, v => updateField('releasedByName', v), '180px')}
            </div>
            <div className="flex items-center gap-1 flex-wrap">
              <span>Ответственный исполнитель:</span>
              <span className="text-[10px] text-gray-500">(должность)</span>
              {renderField(fields.responsibleRole, v => updateField('responsibleRole', v), '180px')}
              <span className="text-[10px] text-gray-500">(подпись)</span>
              {renderField(fields.responsibleSignature, v => updateField('responsibleSignature', v), '180px')}
            </div>

            <div className="border border-dashed border-gray-400 rounded p-3 min-h-[50px]">
              <div className="text-[10px] text-gray-500 mb-1">Отметка бухгалтерии:</div>
              {editing ? (
                <textarea
                  value={fields.accountingNote}
                  onChange={e => updateField('accountingNote', e.target.value)}
                  className="w-full bg-blue-50 border border-blue-200 rounded px-1 py-0.5 text-xs outline-none resize-none"
                  rows={2}
                />
              ) : (
                <span className="text-xs">{fields.accountingNote || '\u00A0'}</span>
              )}
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              <span>Получил:</span>
              <span className="text-[10px] text-gray-500">(звание)</span>
              {renderField(fields.receivedByRank, v => updateField('receivedByRank', v), '150px')}
              <span className="text-[10px] text-gray-500">(подпись)</span>
              {renderField(fields.receivedBySignature, v => updateField('receivedBySignature', v), '120px')}
              <span className="text-[10px] text-gray-500">(расшифровка подписи)</span>
              {renderField(fields.receivedByName, v => updateField('receivedByName', v), '180px')}
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500">Дата отпуска:</span>
                {renderField(fields.releasedDate, v => updateField('releasedDate', v), '80px')}
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-gray-500">Дата получения:</span>
                {renderField(fields.receivedDate, v => updateField('receivedDate', v), '80px')}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}