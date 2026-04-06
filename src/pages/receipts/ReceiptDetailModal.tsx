import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, Receipt } from '@/data/store';

export function ReceiptDetailModal({ receipt, state, onClose }: {
  receipt: Receipt; state: AppState; onClose: () => void;
}) {
  const handleQR = () => {
    const url = `${window.location.origin}/?receipt=${receipt.id}`;
    window.open(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}`, '_blank');
  };

  const totalAmount = receipt.totalAmount ||
    receipt.lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
              <Icon name="FileText" size={15} />
            </div>
            {receipt.number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Поставщик</div>
              <div className="font-semibold">{receipt.supplierName || '—'}</div>
            </div>
            <div className="p-3 bg-muted rounded-lg">
              <div className="text-xs text-muted-foreground mb-0.5">Дата</div>
              <div className="font-semibold">{new Date(receipt.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })}</div>
            </div>
            {receipt.comment && (
              <div className="col-span-2 p-3 bg-muted rounded-lg">
                <div className="text-xs text-muted-foreground mb-0.5">Комментарий</div>
                <div className="text-sm">{receipt.comment}</div>
              </div>
            )}
          </div>

          {/* Custom fields */}
          {receipt.customFields.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Поля документа</div>
              <div className="grid grid-cols-2 gap-2">
                {receipt.customFields.map((f, i) => (
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
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Позиции ({receipt.lines.length})</div>
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              {receipt.lines.map((line, idx) => {
                const item = state.items.find(i => i.id === line.itemId);
                const loc = line.locationId ? state.locations.find(l => l.id === line.locationId) : null;
                return (
                  <div key={line.id} className={`flex items-center gap-3 px-4 py-3 ${idx > 0 ? 'border-t border-border/50' : ''}`}>
                    <div className="w-7 h-7 rounded-md bg-success/15 text-success flex items-center justify-center shrink-0">
                      <Icon name={line.isNew ? 'Sparkles' : 'Package'} size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm truncate">{item?.name || line.itemName}</div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        {loc && <span className="flex items-center gap-0.5"><Icon name="MapPin" size={9} />{loc.name}</span>}
                        {line.isNew && <span className="text-primary font-medium">Новый товар</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="font-bold text-success tabular-nums">+{line.qty} {line.unit}</div>
                      {line.price && <div className="text-xs text-muted-foreground">{(line.price * line.qty).toLocaleString('ru-RU')} ₽</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Total */}
          {totalAmount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-xl font-semibold text-sm">
              <span className="text-muted-foreground">Итого</span>
              <span className="text-lg">{totalAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}

          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleQR} className="flex items-center gap-1.5">
              <Icon name="QrCode" size={14} />QR
            </Button>
            <Button variant="outline" onClick={onClose} className="flex-1">Закрыть</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
