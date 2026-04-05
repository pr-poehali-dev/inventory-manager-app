import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import { Item, OperationType, Operation, AppState, Partner, generateId, saveState } from '@/data/store';

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
};

export default function OperationModal({ open, onClose, item, type, performedBy, state, onSave }: Props) {
  const [qty, setQty] = useState('1');
  const [basis, setBasis] = useState('');
  const [comment, setComment] = useState('');
  const [from, setFrom] = useState('');
  const [toLabel, setToLabel] = useState('');
  const [toId, setToId] = useState('');
  const [supplierLabel, setSupplierLabel] = useState('');
  const [supplierId, setSupplierId] = useState('');

  const qtyNum = parseInt(qty) || 0;
  const newQty = type === 'in' ? item.quantity + qtyNum : item.quantity - qtyNum;
  const isIn = type === 'in';

  const isInvalid =
    qtyNum <= 0 ||
    (type === 'out' && qtyNum > item.quantity) ||
    !basis ||
    !comment.trim() ||
    (type === 'out' && !toLabel.trim());

  // Autocomplete options
  const recipientOptions: AutocompleteOption[] = useMemo(() =>
    (state.partners || []).filter(p => p.type === 'recipient').map(p => ({
      id: p.id, label: p.name, sublabel: p.contact || p.note || undefined,
    })), [state.partners]);

  const supplierOptions: AutocompleteOption[] = useMemo(() =>
    (state.partners || []).filter(p => p.type === 'supplier').map(p => ({
      id: p.id, label: p.name, sublabel: p.contact || p.note || undefined,
    })), [state.partners]);

  const basisOptions = (isIn ? IN_BASES : OUT_BASES).map(b => ({ id: b, label: b }));

  const handleSubmit = () => {
    if (isInvalid) return;

    // Auto-add new partner if needed
    let finalState = state;
    if (type === 'out' && toLabel.trim() && !toId) {
      const newPartner: Partner = {
        id: generateId(), name: toLabel.trim(), type: 'recipient',
        createdAt: new Date().toISOString(),
      };
      finalState = { ...state, partners: [...(state.partners || []), newPartner] };
    }
    if (type === 'in' && supplierLabel.trim() && !supplierId) {
      const newPartner: Partner = {
        id: generateId(), name: supplierLabel.trim(), type: 'supplier',
        createdAt: new Date().toISOString(),
      };
      finalState = { ...finalState, partners: [...(finalState.partners || []), newPartner] };
    }

    const op: Operation = {
      id: generateId(),
      itemId: item.id,
      type,
      quantity: qtyNum,
      comment: `[${basis}] ${comment.trim()}`,
      from: isIn ? (supplierLabel.trim() || from) : 'Склад',
      to: isIn ? 'Склад' : toLabel.trim(),
      performedBy,
      date: new Date().toISOString(),
    };

    onSave(op, newQty, finalState !== state ? finalState : undefined);

    // Reset
    setQty('1'); setBasis(''); setComment(''); setFrom('');
    setToLabel(''); setToId(''); setSupplierLabel(''); setSupplierId('');
    onClose();
  };

  const locStocks = (state.locationStocks || [])
    .filter(ls => ls.itemId === item.id && ls.quantity > 0)
    .map(ls => ({ ...ls, location: state.locations.find(l => l.id === ls.locationId) }))
    .filter(ls => ls.location);

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md animate-scale-in">
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
                Всего на складе: <span className="font-semibold text-foreground">{item.quantity} {item.unit}</span>
              </div>
              {locStocks.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {locStocks.map(ls => (
                    <span key={ls.locationId} className="text-[11px] bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                      {ls.location?.name}: <b className="text-foreground">{ls.quantity}</b>
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

          {/* Basis — обязательное */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              Основание <span className="text-destructive">*</span>
            </Label>
            <Autocomplete
              value={basis}
              onChange={v => setBasis(v)}
              onSelect={opt => setBasis(opt.label)}
              options={basisOptions}
              placeholder="Выберите или введите основание..."
              allowCustom
              clearable
            />
          </div>

          {/* Supplier (for in) */}
          {isIn && (
            <div className="space-y-1.5">
              <Label>От кого / поставщик</Label>
              <Autocomplete
                value={supplierLabel}
                onChange={v => { setSupplierLabel(v); setSupplierId(''); }}
                onSelect={opt => { setSupplierLabel(opt.label); setSupplierId(opt.id === '__new__' ? '' : opt.id); }}
                options={supplierOptions}
                placeholder="Выберите поставщика..."
                allowCustom
              />
            </div>
          )}

          {/* Recipient (for out) — обязательное */}
          {!isIn && (
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Кому выдаём <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                value={toLabel}
                onChange={v => { setToLabel(v); setToId(''); }}
                onSelect={opt => { setToLabel(opt.label); setToId(opt.id === '__new__' ? '' : opt.id); }}
                options={recipientOptions}
                placeholder="Выберите получателя..."
                allowCustom
              />
            </div>
          )}

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1">
              Количество ({item.unit}) <span className="text-destructive">*</span>
            </Label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0">
                <Icon name="Minus" size={14} />
              </button>
              <Input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
                className="text-center text-lg font-bold tabular-nums" />
              <button type="button" onClick={() => setQty(String(qtyNum + 1))}
                className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0">
                <Icon name="Plus" size={14} />
              </button>
            </div>
          </div>

          {/* Result preview */}
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm border
            ${qtyNum <= 0 || (type === 'out' && qtyNum > item.quantity)
              ? 'bg-destructive/8 border-destructive/20'
              : isIn ? 'bg-success/8 border-success/20' : 'bg-muted border-border'}`}>
            <span className="text-muted-foreground">Будет на складе:</span>
            <span className={`font-bold text-lg tabular-nums
              ${qtyNum <= 0 || (!isIn && qtyNum > item.quantity) ? 'text-destructive' : isIn ? 'text-success' : 'text-foreground'}`}>
              {newQty} <span className="text-sm font-normal text-muted-foreground">{item.unit}</span>
            </span>
          </div>

          {/* Comment — обязательный */}
          <div className="space-y-1.5">
            <Label htmlFor="op-comment" className="flex items-center gap-1">
              Комментарий <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="op-comment"
              placeholder="Обязательно укажите причину или детали операции..."
              rows={2}
              value={comment}
              onChange={e => setComment(e.target.value)}
              className={`resize-none ${!comment.trim() && basis ? 'border-warning/60' : ''}`}
            />
          </div>

          {/* Validation hints */}
          {(!basis || (!isIn && !toLabel.trim()) || !comment.trim()) && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Icon name="Info" size={12} className="shrink-0" />
              <span>
                Обязательны: {[
                  !basis && 'основание',
                  !isIn && !toLabel.trim() && 'получатель',
                  !comment.trim() && 'комментарий',
                ].filter(Boolean).join(', ')}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button
              onClick={handleSubmit}
              disabled={isInvalid}
              className={`flex-1 font-semibold
                ${isIn ? 'bg-success hover:bg-success/90 text-success-foreground' : 'bg-destructive hover:bg-destructive/90 text-destructive-foreground'}`}
            >
              <Icon name={isIn ? 'ArrowDownToLine' : 'ArrowUpFromLine'} size={15} className="mr-1.5" />
              {isIn ? 'Принять' : 'Списать'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
