import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

export type ConflictInfo = {
  itemId: string;
  itemName: string;
  unit: string;
  available: number;
  requested: number;
  conflictingOrders: { number: string; title: string; qty: number }[];
};

export function ConflictModal({
  conflicts,
  onResolve,
  onForce,
  onCancel,
}: {
  conflicts: ConflictInfo[];
  onResolve: () => void;
  onForce: () => void;
  onCancel: () => void;
}) {
  return (
    <Dialog open onOpenChange={onCancel}>
      <DialogContent className="max-w-lg animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-destructive/15 text-destructive flex items-center justify-center shrink-0">
              <Icon name="AlertTriangle" size={16} />
            </div>
            Конфликт остатков
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <p className="text-sm text-muted-foreground">
            Остатка не хватает для всех активных заявок. Выберите, как поступить:
          </p>
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <div key={i} className="p-3 bg-destructive/8 border border-destructive/20 rounded-lg text-sm space-y-1">
                <div className="font-semibold text-foreground">{c.itemName}</div>
                <div className="text-muted-foreground">
                  На складе: <b className="text-foreground">{c.available} {c.unit}</b>
                  {' · '}Запрошено: <b className="text-destructive">{c.requested} {c.unit}</b>
                </div>
                {c.conflictingOrders.length > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">
                    Конфликтует с заявками: {c.conflictingOrders.map(o => `${o.number} (${o.qty} ${c.unit})`).join(', ')}
                  </div>
                )}
              </div>
            ))}
          </div>
          <div className="space-y-2 pt-1">
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3" onClick={onCancel}>
              <Icon name="Edit3" size={15} className="shrink-0 text-primary" />
              <div className="text-left">
                <div className="font-semibold text-sm">Редактировать заявку</div>
                <div className="text-xs text-muted-foreground">Уменьшить запрошенное количество</div>
              </div>
            </Button>
            <Button variant="outline" className="w-full justify-start gap-2 h-auto py-3 border-warning/40 hover:bg-warning/8" onClick={onForce}>
              <Icon name="Clock" size={15} className="shrink-0 text-warning" />
              <div className="text-left">
                <div className="font-semibold text-sm text-warning">Создать с пометкой «Ожидает поставки»</div>
                <div className="text-xs text-muted-foreground">Заявка создаётся, товар будет выдан после поступления</div>
              </div>
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
