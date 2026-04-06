import Icon from '@/components/ui/icon';
import { Item, AppState, Operation } from '@/data/store';

export function ItemHistoryTab({ liveItem, itemOps, state }: {
  liveItem: Item;
  itemOps: Operation[];
  state: AppState;
}) {
  if (itemOps.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        <Icon name="History" size={24} className="mx-auto mb-2 opacity-40" />
        Операций пока нет
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      {itemOps.map(op => {
        const wh = op.warehouseId ? (state.warehouses || []).find(w => w.id === op.warehouseId) : null;
        return (
          <div key={op.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 text-sm">
            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
              ${op.type === 'in' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
              <Icon name={op.scannedCodes?.length ? 'ScanLine' : op.type === 'in' ? 'ArrowDown' : 'ArrowUp'} size={12} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  <span className={`font-semibold tabular-nums ${op.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                    {op.type === 'in' ? '+' : '-'}{op.quantity} {liveItem.unit}
                  </span>
                  {wh && (
                    <span className="text-[11px] bg-background border border-border px-1.5 py-0.5 rounded-md text-muted-foreground flex items-center gap-0.5">
                      <Icon name="Warehouse" size={9} />{wh.name}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
              </div>
              {op.comment && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{op.comment}</p>}
              {(op.from || op.to) && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {op.from && `← ${op.from}`}{op.from && op.to ? ' · ' : ''}{op.to && `→ ${op.to}`}
                </p>
              )}
              {op.scannedCodes && op.scannedCodes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {op.scannedCodes.slice(0, 5).map((code, i) => (
                    <span key={i} className="font-mono text-[10px] bg-background border border-border px-1.5 py-0.5 rounded text-muted-foreground">
                      {code}
                    </span>
                  ))}
                  {op.scannedCodes.length > 5 && (
                    <span className="text-[10px] text-muted-foreground py-0.5">+{op.scannedCodes.length - 5} ещё</span>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
