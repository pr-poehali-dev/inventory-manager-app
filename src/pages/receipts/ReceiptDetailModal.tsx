import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, Receipt, ReceiptStatus, crudAction, revertPostedReceipt } from '@/data/store';
import QRDialog from '@/components/QRDialog';
import { getReceiptProgress } from './ReceiptsList';

const STATUS_CONFIG: Record<ReceiptStatus, { label: string; color: string; bg: string; icon: string }> = {
  draft:       { label: 'Черновик',                 color: 'text-muted-foreground', bg: 'bg-muted',            icon: 'FileEdit' },
  pending:     { label: 'Заявка на сборку',          color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/12',  icon: 'Clock' },
  confirming:  { label: 'В процессе подтверждения',  color: 'text-blue-600 dark:text-blue-400',   bg: 'bg-blue-500/12',   icon: 'ScanLine' },
  posted:      { label: 'Оприходовано',             color: 'text-success',           bg: 'bg-success/12',      icon: 'CheckCircle2' },
};

export function ReceiptDetailModal({
  receipt, state, onClose, onStartConfirm, onStateChange,
}: {
  receipt: Receipt;
  state: AppState;
  onClose: () => void;
  onStartConfirm?: (r: Receipt) => void;
  onStateChange?: (s: AppState) => void;
}) {
  const liveReceipt = state.receipts.find(r => r.id === receipt.id) || receipt;
  const cfg = STATUS_CONFIG[liveReceipt.status || 'draft'];
  const { total, confirmed, pct } = getReceiptProgress(liveReceipt);

  const totalAmount = liveReceipt.totalAmount ||
    liveReceipt.lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);

  const warehouse = liveReceipt.warehouseId
    ? state.warehouses?.find(w => w.id === liveReceipt.warehouseId)
    : null;

  const canConfirm = liveReceipt.status === 'pending' || liveReceipt.status === 'confirming';

  const handleDelete = () => {
    if (!onStateChange) return;
    let next = { ...state };
    if (liveReceipt.status === 'posted') {
      next = revertPostedReceipt(next, liveReceipt);
    }
    next = {
      ...next,
      receipts: next.receipts.filter(r => r.id !== liveReceipt.id),
    };
    onStateChange(next);
    crudAction('delete_receipt_with_revert', { receiptId: liveReceipt.id });
    onClose();
  };

  const [showQR, setShowQR] = useState(false);
  const qrValue = `${window.location.origin}/?receipt=${liveReceipt.id}`;

  return (
    <>
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg xl:max-w-2xl max-h-[94vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0`}>
              <Icon name={cfg.icon} size={15} />
            </div>
            <div>
              <div>{liveReceipt.number}</div>
              <div className={`text-xs font-normal ${cfg.color}`}>{cfg.label}</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">

          {/* Прогресс подтверждения */}
          {(liveReceipt.status === 'confirming' || liveReceipt.status === 'pending') && total > 0 && (
            <div className={`p-3 rounded-xl ${cfg.bg} border border-amber-500/20`}>
              <div className="flex items-center justify-between text-sm font-semibold mb-2">
                <span>Прогресс подтверждения</span>
                <span>{confirmed} / {total} ({pct}%)</span>
              </div>
              <div className="h-2 bg-black/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-success rounded-full transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )}

          {liveReceipt.status === 'posted' && (
            <div className="p-3 rounded-xl bg-success/10 border border-success/20 flex items-center gap-2 text-success">
              <Icon name="CheckCircle2" size={16} />
              <div>
                <div className="text-sm font-semibold">Оприходовано</div>
                {liveReceipt.postedAt && (
                  <div className="text-xs opacity-80">{new Date(liveReceipt.postedAt).toLocaleString('ru-RU')}</div>
                )}
              </div>
            </div>
          )}

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Поставщик</div>
              <div className="font-semibold">{liveReceipt.supplierName || '—'}</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Дата</div>
              <div className="font-semibold">{new Date(liveReceipt.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
            </div>
            {warehouse && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-0.5">Склад</div>
                <div className="font-semibold">{warehouse.name}</div>
              </div>
            )}
            {liveReceipt.comment && (
              <div className={`${warehouse ? '' : 'col-span-2'} p-3 bg-muted rounded-lg`}>
                <div className="text-xs text-muted-foreground mb-0.5">Комментарий</div>
                <div className="text-sm">{liveReceipt.comment}</div>
              </div>
            )}
          </div>

          {/* Custom fields */}
          {liveReceipt.customFields.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Поля документа</div>
              <div className="grid grid-cols-2 gap-2">
                {liveReceipt.customFields.map((f, i) => (
                  <div key={i} className="p-2.5 bg-muted/60 rounded-lg">
                    <div className="text-[11px] text-muted-foreground">{f.key}</div>
                    <div className="text-sm font-medium">{f.value || '—'}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Lines */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Позиции ({liveReceipt.lines.length})</div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {liveReceipt.lines.map((line, idx) => {
                const item = state.items.find(i => i.id === line.itemId);
                const confirmed = line.confirmedQty || 0;
                const done = liveReceipt.status === 'posted' || confirmed >= line.qty;
                return (
                  <div key={line.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-border/50' : ''}`}>
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                      done ? 'bg-success/15 text-success' : confirmed > 0 ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400' : 'bg-muted text-muted-foreground'
                    }`}>
                      <Icon name={done ? 'CheckCircle2' : line.isNew ? 'Sparkles' : 'Package'} size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item?.name || line.itemName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {line.isNew && <span className="text-primary font-medium">Новый товар</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      {liveReceipt.status === 'posted' ? (
                        <div className="font-bold text-success tabular-nums">+{line.qty} {line.unit}</div>
                      ) : (
                        <div className="text-sm tabular-nums">
                          <span className={`font-bold ${done ? 'text-success' : confirmed > 0 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                            {confirmed}
                          </span>
                          <span className="text-muted-foreground">/{line.qty} {line.unit}</span>
                        </div>
                      )}
                      {line.price && <div className="text-xs text-muted-foreground">{(line.price * line.qty).toLocaleString('ru-RU')} ₽</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Scan history */}
          {(liveReceipt.scanHistory || []).length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Icon name="History" size={12} />История сканирований ({liveReceipt.scanHistory.length})
              </div>
              <div className="bg-muted/40 rounded-xl p-3 max-h-40 overflow-y-auto space-y-1">
                {[...liveReceipt.scanHistory].reverse().map(ev => {
                  const item = state.items.find(i => i.id === ev.itemId);
                  return (
                    <div key={ev.id} className="flex items-center gap-2 text-xs">
                      <Icon name={ev.method === 'camera' ? 'Camera' : 'Keyboard'} size={10} className="text-muted-foreground shrink-0" />
                      <span className="text-muted-foreground">{new Date(ev.scannedAt).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="font-medium truncate">{item?.name || ev.itemId}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Total */}
          {totalAmount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-xl font-semibold text-sm">
              <span className="text-muted-foreground">Итого</span>
              <span className="text-lg">{totalAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 flex-wrap">
            <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="flex items-center gap-1.5">
              <Icon name="QrCode" size={14} />QR
            </Button>

            {onStateChange && (
              <Button variant="outline" size="sm" onClick={handleDelete}
                className="flex items-center gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/10">
                <Icon name="Trash2" size={14} />Удалить
              </Button>
            )}

            {canConfirm && onStartConfirm && (
              <Button
                onClick={() => onStartConfirm(liveReceipt)}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold gap-2"
              >
                <Icon name="ScanLine" size={16} />
                {liveReceipt.status === 'confirming' ? 'Продолжить подтверждение' : 'Начать подтверждение →'}
              </Button>
            )}

            {!canConfirm && (
              <Button variant="outline" onClick={onClose} className="flex-1">Закрыть</Button>
            )}

            {canConfirm && (
              <Button variant="outline" onClick={onClose}>Закрыть</Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <QRDialog open={showQR} onClose={() => setShowQR(false)} value={qrValue} title="QR-код накладной" />
    </>
  );
}