import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { Item, OperationType, Operation, generateId } from '@/data/store';

type Props = {
  open: boolean;
  onClose: () => void;
  item: Item;
  type: OperationType;
  performedBy: string;
  onSave: (op: Operation, newQty: number) => void;
};

export default function OperationModal({ open, onClose, item, type, performedBy, onSave }: Props) {
  const [qty, setQty] = useState('1');
  const [comment, setComment] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const qtyNum = parseInt(qty) || 0;
  const newQty = type === 'in' ? item.quantity + qtyNum : item.quantity - qtyNum;
  const isInvalid = qtyNum <= 0 || (type === 'out' && qtyNum > item.quantity);

  const handleSubmit = () => {
    if (isInvalid) return;
    const op: Operation = {
      id: generateId(),
      itemId: item.id,
      type,
      quantity: qtyNum,
      comment,
      from,
      to,
      performedBy,
      date: new Date().toISOString(),
    };
    onSave(op, newQty);
    setQty('1');
    setComment('');
    setFrom('');
    setTo('');
    onClose();
  };

  const isIn = type === 'in';

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isIn ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
              <Icon name={isIn ? 'Plus' : 'Minus'} size={16} />
            </div>
            <span>{isIn ? 'Приход товара' : 'Расход товара'}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Item info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-semibold text-foreground">{item.name}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              Текущий остаток: <span className="font-semibold text-foreground">{item.quantity} {item.unit}</span>
            </div>
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label htmlFor="qty">Количество ({item.unit})</Label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setQty(String(Math.max(1, qtyNum - 1)))}
                className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0"
              >
                <Icon name="Minus" size={14} />
              </button>
              <Input
                id="qty"
                type="number"
                min="1"
                value={qty}
                onChange={e => setQty(e.target.value)}
                className="text-center text-lg font-bold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setQty(String(qtyNum + 1))}
                className="w-10 h-10 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors shrink-0"
              >
                <Icon name="Plus" size={14} />
              </button>
            </div>
          </div>

          {/* New qty preview */}
          <div className={`flex items-center justify-between px-3 py-2.5 rounded-lg text-sm
            ${isInvalid ? 'bg-destructive/10 border border-destructive/20' : 'bg-muted'}`}>
            <span className="text-muted-foreground">Будет на складе:</span>
            <span className={`font-bold text-base tabular-nums ${isInvalid ? 'text-destructive' : 'text-foreground'}`}>
              {newQty} {item.unit}
            </span>
          </div>

          {/* From / To */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="from">От кого / откуда</Label>
              <Input id="from" placeholder={isIn ? 'Поставщик' : 'Склад'} value={from} onChange={e => setFrom(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="to">Кому / куда</Label>
              <Input id="to" placeholder={isIn ? 'Склад' : 'Отдел / адрес'} value={to} onChange={e => setTo(e.target.value)} />
            </div>
          </div>

          {/* Comment */}
          <div className="space-y-1.5">
            <Label htmlFor="comment">Комментарий</Label>
            <Textarea
              id="comment"
              placeholder="Причина, заметки..."
              rows={2}
              value={comment}
              onChange={e => setComment(e.target.value)}
              className="resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button
              onClick={handleSubmit}
              disabled={isInvalid}
              className={`flex-1 font-semibold ${isIn ? 'bg-success hover:bg-success/90 text-success-foreground' : 'bg-destructive hover:bg-destructive/90'}`}
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
