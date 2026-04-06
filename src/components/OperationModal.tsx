import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import ScannerModal, { ScannedCode } from '@/components/ScannerModal';
import {
  Item, OperationType, Operation, AppState, Partner, Warehouse,
  generateId, saveState, getWarehouseStock, updateWarehouseStock, getItemBarcodes,
} from '@/data/store';

const IN_BASES = [
  'Поступление от поставщика',
  'Возврат от получателя',
  'Инвентаризация (излишек)',
  'Перемещение между складами',
  'Производство / сборка',
  'Прочее',
];

const OUT_BASES = [
  'Выдача по заявке',
  'Выдача сотруднику',
  'Списание (брак/потеря)',
  'Перемещение между складами',
  'Инвентаризация (недостача)',
  'Возврат поставщику',
  'Прочее',
];

type Props = {
  open: boolean;
  onClose: () => void;
  item: Item;
  type: OperationType;
  performedBy: string;
  state: AppState;
  onSave: (op: Operation, newQty: number, updatedState?: AppState) => void;
  defaultWarehouseId?: string;
};

export default function OperationModal({ open, onClose, item, type, performedBy, state, onSave, defaultWarehouseId }: Props) {
  const [qty, setQty] = useState('1');
  const [basis, setBasis] = useState('');
  const [comment, setComment] = useState('');
  const [toLabel, setToLabel] = useState('');
  const [toId, setToId] = useState('');
  const [supplierLabel, setSupplierLabel] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState<string>(defaultWarehouseId || (state.warehouses?.[0]?.id || ''));
  const [scannedCodes, setScannedCodes] = useState<ScannedCode[]>([]);
  const [showScanner, setShowScanner] = useState(false);

  const isIn = type === 'in';
  const warehouses: Warehouse[] = state.warehouses || [];
  const selectedWarehouse = warehouses.find(w => w.id === warehouseId);
  const whStock = warehouseId ? getWarehouseStock(state, item.id, warehouseId) : 0;

  // Qty from scanned + manual
  const scannedQty = scannedCodes.length;
  const manualQty = parseInt(qty) || 0;
  const totalQty = scannedQty + manualQty;

  const newQty = isIn ? item.quantity + totalQty : item.quantity - totalQty;
  const newWhQty = isIn ? whStock + totalQty : whStock - totalQty;

  const itemBarcodes = useMemo(() => getItemBarcodes(state, item.id).map(b => b.code), [state, item.id]);

  const isInvalid =
    totalQty <= 0 ||
    (!isIn && totalQty > item.quantity) ||
    (!isIn && warehouseId && totalQty > whStock) ||
    !basis ||
    !comment.trim() ||
    (!isIn && !toLabel.trim()) ||
    !warehouseId;

  const recipientOptions: AutocompleteOption[] = useMemo(() =>
    (state.partners || []).filter(p => p.type === 'recipient').map(p => ({
      id: p.id, label: p.name, sublabel: p.contact || p.note || undefined,
    })), [state.partners]);

  const supplierOptions: AutocompleteOption[] = useMemo(() =>
    (state.partners || []).filter(p => p.type === 'supplier').map(p => ({
      id: p.id, label: p.name, sublabel: p.contact || p.note || undefined,
    })), [state.partners]);

  const basisOptions = (isIn ? IN_BASES : OUT_BASES).map(b => ({ id: b, label: b }));

  const handleScanConfirm = (codes: ScannedCode[]) => {
    // Auto-register new barcodes for this item
    let newState = state;
    for (const sc of codes) {
      const alreadyKnown = (state.barcodes || []).some(b => b.code === sc.code);
      if (!alreadyKnown) {
        newState = {
          ...newState,
          barcodes: [...(newState.barcodes || []), {
            id: generateId(),
            itemId: item.id,
            code: sc.code,
            format: sc.format,
            label: '',
            createdAt: new Date().toISOString(),
          }],
        };
      }
    }
    if (newState !== state) saveState(newState);
    setScannedCodes(prev => [...prev, ...codes]);
  };

  const removeScanned = (idx: number) => {
    setScannedCodes(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = () => {
    if (isInvalid) return;

    let finalState = state;

    // Auto-add new partner
    if (type === 'out' && toLabel.trim() && !toId) {
      const newPartner: Partner = { id: generateId(), name: toLabel.trim(), type: 'recipient', createdAt: new Date().toISOString() };
      finalState = { ...finalState, partners: [...(finalState.partners || []), newPartner] };
    }
    if (type === 'in' && supplierLabel.trim() && !supplierId) {
      const newPartner: Partner = { id: generateId(), name: supplierLabel.trim(), type: 'supplier', createdAt: new Date().toISOString() };
      finalState = { ...finalState, partners: [...(finalState.partners || []), newPartner] };
    }

    // Auto-register scanned barcodes
    for (const sc of scannedCodes) {
      const alreadyKnown = (finalState.barcodes || []).some(b => b.code === sc.code);
      if (!alreadyKnown) {
        finalState = {
          ...finalState,
          barcodes: [...(finalState.barcodes || []), {
            id: generateId(),
            itemId: item.id,
            code: sc.code,
            format: sc.format,
            label: '',
            createdAt: new Date().toISOString(),
          }],
        };
      }
    }

    // Update warehouse stock
    finalState = updateWarehouseStock(finalState, item.id, warehouseId, isIn ? totalQty : -totalQty);

    const op: Operation = {
      id: generateId(),
      itemId: item.id,
      type,
      quantity: totalQty,
      comment: `[${basis}] ${comment.trim()}`,
      from: isIn ? (supplierLabel.trim() || 'Поставщик') : selectedWarehouse?.name || 'Склад',
      to: isIn ? (selectedWarehouse?.name || 'Склад') : toLabel.trim(),
      performedBy,
      date: new Date().toISOString(),
      warehouseId,
      scannedCodes: scannedCodes.map(s => s.code),
    };

    // newQty is already updated via updateWarehouseStock → items
    const updatedItem = finalState.items.find(it => it.id === item.id);
    onSave(op, updatedItem?.quantity ?? newQty, finalState !== state ? finalState : undefined);

    // Reset
    setQty('1');
    setBasis('');
    setComment('');
    setToLabel(''); setToId('');
    setSupplierLabel(''); setSupplierId('');
    setScannedCodes([]);
    onClose();
  };

  const whStocks = (state.warehouseStocks || [])
    .filter(ws => ws.itemId === item.id && ws.quantity > 0)
    .map(ws => ({ ...ws, warehouse: warehouses.find(w => w.id === ws.warehouseId) }))
    .filter(ws => ws.warehouse);

  return (
    <>
      <Dialog open={open} onOpenChange={onClose}>
        <DialogContent className="max-w-md animate-scale-in max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                ${isIn ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                <Icon name={isIn ? 'ArrowDownToLine' : 'ArrowUpFromLine'} size={16} />
              </div>
              <span>{isIn ? 'Приход товара' : 'Расход товара'}</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            {/* Item info */}
            <div className="p-3 bg-muted rounded-lg flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">{item.name}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Всего: <span className="font-semibold text-foreground">{item.quantity} {item.unit}</span>
                </div>
                {whStocks.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {whStocks.map(ws => (
                      <span key={ws.warehouseId}
                        className={`text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer
                          ${ws.warehouseId === warehouseId
                            ? 'bg-primary/10 border-primary/40 text-primary font-semibold'
                            : 'bg-background border-border text-muted-foreground hover:border-primary/30'}`}
                        onClick={() => setWarehouseId(ws.warehouseId)}>
                        {ws.warehouse?.name}: <b>{ws.quantity}</b>
                      </span>
                    ))}
                  </div>
                )}
              </div>
              <div className={`text-2xl font-bold tabular-nums shrink-0 ${item.quantity === 0 ? 'text-destructive' : item.quantity <= item.lowStockThreshold ? 'text-warning' : 'text-foreground'}`}>
                {item.quantity}
                <span className="text-xs font-normal text-muted-foreground ml-1">{item.unit}</span>
              </div>
            </div>

            {/* Warehouse select */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Склад <span className="text-destructive">*</span>
              </Label>
              {warehouses.length === 0 ? (
                <div className="text-sm text-muted-foreground">Нет складов. Добавьте склады в настройках.</div>
              ) : (
                <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(warehouses.length, 3)}, 1fr)` }}>
                  {warehouses.map(wh => {
                    const stock = getWarehouseStock(state, item.id, wh.id);
                    const isSelected = wh.id === warehouseId;
                    return (
                      <button key={wh.id} type="button" onClick={() => setWarehouseId(wh.id)}
                        className={`p-2.5 rounded-xl border text-left transition-all
                          ${isSelected
                            ? 'border-primary bg-primary/8 ring-1 ring-primary/30'
                            : 'border-border bg-card hover:border-primary/40'}`}>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <Icon name="Warehouse" size={12} className={isSelected ? 'text-primary' : 'text-muted-foreground'} />
                          <span className={`text-xs font-semibold truncate ${isSelected ? 'text-primary' : 'text-foreground'}`}>{wh.name}</span>
                        </div>
                        <div className={`text-lg font-bold tabular-nums ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                          {stock}
                          <span className="text-[11px] font-normal text-muted-foreground ml-1">{item.unit}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Basis */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Основание <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                value={basis} onChange={v => setBasis(v)} onSelect={opt => setBasis(opt.label)}
                options={basisOptions} placeholder="Выберите или введите основание..." allowCustom clearable
              />
            </div>

            {/* Supplier */}
            {isIn && (
              <div className="space-y-1.5">
                <Label>От кого / поставщик</Label>
                <Autocomplete
                  value={supplierLabel}
                  onChange={v => { setSupplierLabel(v); setSupplierId(''); }}
                  onSelect={opt => { setSupplierLabel(opt.label); setSupplierId(opt.id === '__new__' ? '' : opt.id); }}
                  options={supplierOptions} placeholder="Выберите поставщика..." allowCustom
                />
              </div>
            )}

            {/* Recipient */}
            {!isIn && (
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Кому выдаём <span className="text-destructive">*</span>
                </Label>
                <Autocomplete
                  value={toLabel}
                  onChange={v => { setToLabel(v); setToId(''); }}
                  onSelect={opt => { setToLabel(opt.label); setToId(opt.id === '__new__' ? '' : opt.id); }}
                  options={recipientOptions} placeholder="Выберите получателя..." allowCustom
                />
              </div>
            )}

            {/* Quantity block */}
            <div className="space-y-2">
              <Label>Количество ({item.unit})</Label>

              {/* Scanner button */}
              <button
                type="button"
                onClick={() => setShowScanner(true)}
                className="w-full flex items-center justify-between p-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/4 hover:bg-primary/8 hover:border-primary/60 transition-all group">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                    <Icon name="ScanLine" size={18} />
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-semibold text-foreground">
                      {isIn ? 'Сканировать приход' : 'Сканировать расход'}
                    </div>
                    <div className="text-xs text-muted-foreground">QR-код и штрих-код, пакетное сканирование</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {scannedQty > 0 && (
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                      +{scannedQty}
                    </span>
                  )}
                  <Icon name="ChevronRight" size={16} className="text-muted-foreground group-hover:text-primary transition-colors" />
                </div>
              </button>

              {/* Scanned codes list */}
              {scannedCodes.length > 0 && (
                <div className="bg-muted/40 rounded-xl p-2.5 space-y-1.5">
                  <div className="flex items-center justify-between px-0.5">
                    <span className="text-xs font-medium text-muted-foreground">Отсканировано: {scannedQty} шт</span>
                    <button onClick={() => setScannedCodes([])}
                      className="text-xs text-destructive hover:underline">очистить</button>
                  </div>
                  <div className="max-h-28 overflow-y-auto space-y-1">
                    {scannedCodes.map((sc, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-background rounded-lg px-2.5 py-1.5 border border-border">
                        <Icon name={sc.format === 'qr_code' ? 'QrCode' : 'Barcode'} size={12} className="text-muted-foreground shrink-0" />
                        <span className="font-mono flex-1 truncate">{sc.code}</span>
                        <button onClick={() => removeScanned(i)}
                          className="w-5 h-5 rounded hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground shrink-0">
                          <Icon name="X" size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Manual qty */}
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {scannedQty > 0 ? 'Добавить вручную сверху:' : 'Количество вручную:'}
                </div>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty(String(Math.max(0, manualQty - 1)))}
                    className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0">
                    <Icon name="Minus" size={14} />
                  </button>
                  <Input
                    type="number" min="0" value={qty}
                    onChange={e => setQty(e.target.value)}
                    className="text-center text-lg font-bold"
                  />
                  <button type="button" onClick={() => setQty(String(manualQty + 1))}
                    className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0">
                    <Icon name="Plus" size={14} />
                  </button>
                </div>
              </div>

              {/* Total preview */}
              {(scannedQty > 0 || manualQty > 0) && (
                <div className={`flex items-center justify-between p-2.5 rounded-xl text-sm font-semibold
                  ${isIn ? 'bg-success/10 text-success' : newWhQty < 0 ? 'bg-destructive/10 text-destructive' : 'bg-destructive/8 text-destructive'}`}>
                  <div className="flex items-center gap-2">
                    <Icon name={isIn ? 'TrendingUp' : 'TrendingDown'} size={15} />
                    <span>
                      Итого: {isIn ? '+' : '-'}{totalQty} {item.unit}
                      {scannedQty > 0 && manualQty > 0 && (
                        <span className="text-xs font-normal opacity-70 ml-1">({scannedQty} скан + {manualQty} вручную)</span>
                      )}
                    </span>
                  </div>
                  <span className="text-xs opacity-80">
                    {selectedWarehouse?.name}: {whStock} → {Math.max(0, newWhQty)}
                  </span>
                </div>
              )}

              {!isIn && warehouseId && totalQty > whStock && (
                <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/8 px-3 py-2 rounded-lg">
                  <Icon name="AlertTriangle" size={13} />
                  Недостаточно на складе «{selectedWarehouse?.name}»: есть {whStock}, нужно {totalQty}
                </div>
              )}
            </div>

            {/* Comment */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Комментарий <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={comment} onChange={e => setComment(e.target.value)}
                placeholder="Кратко опишите операцию..."
                rows={2} className="resize-none"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
              <Button
                onClick={handleSubmit}
                disabled={isInvalid}
                className={`flex-1 font-semibold ${isIn ? 'bg-success hover:bg-success/90 text-success-foreground' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}`}>
                <Icon name={isIn ? 'ArrowDownToLine' : 'ArrowUpFromLine'} size={15} className="mr-1.5" />
                {isIn ? 'Оприходовать' : 'Выдать'} {totalQty > 0 ? `${totalQty} ${item.unit}` : ''}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onConfirm={handleScanConfirm}
        title={isIn ? 'Сканировать приход' : 'Сканировать расход'}
        itemBarcodes={itemBarcodes}
      />
    </>
  );
}