import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, WorkOrder } from '@/data/store';

export default function CloseWarningModal({ order, state, onConfirm, onCancel }: {
  order: WorkOrder; state: AppState; onConfirm: () => void; onCancel: () => void;
}) {
  const unfinished = order.items.filter(oi => oi.status !== 'done');
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-sm animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-warning/15 text-warning flex items-center justify-center shrink-0">
              <Icon name="AlertTriangle" size={16} />
            </div>
            Закрыть заявку?
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Осталось <b className="text-foreground">{unfinished.length} несобранных позиций</b>. Закрытую заявку можно возобновить позже.
          </p>
          <div className="space-y-1.5">
            {unfinished.slice(0, 4).map(oi => {
              const item = state.items.find(i => i.id === oi.itemId);
              return (
                <div key={oi.id} className="flex items-center justify-between text-sm px-3 py-2 bg-muted rounded-lg gap-2">
                  <span className="text-foreground truncate font-medium">{item?.name || '—'}</span>
                  <span className="font-semibold text-warning shrink-0">{oi.pickedQty}/{oi.requiredQty} {item?.unit}</span>
                </div>
              );
            })}
            {unfinished.length > 4 && <p className="text-xs text-muted-foreground text-center">+{unfinished.length - 4} ещё</p>}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} className="flex-1">Продолжить сборку</Button>
            <Button onClick={onConfirm} className="flex-1 bg-warning hover:bg-warning/90 text-warning-foreground font-semibold">
              <Icon name="Archive" size={14} className="mr-1.5" />
              Закрыть (частично)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
