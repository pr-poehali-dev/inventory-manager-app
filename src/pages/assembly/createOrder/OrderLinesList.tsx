import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AutocompleteOption } from '@/components/Autocomplete';
import { AppState, getReservedQty } from '@/data/store';
import { ConflictInfo } from '../ConflictModal';
import { OrderLine } from './useCreateOrderLogic';
import { OrderLineItem } from './OrderLineItem';

type LineWarning = { type: 'error' | 'warn' | 'info'; msg: string } | null;

type Props = {
  state: AppState;
  lines: OrderLine[];
  validLinesCount: number;
  duplicates: Set<string>;
  lineWarnings: LineWarning[];
  itemOptions: AutocompleteOption[];
  conflicts: ConflictInfo[];
  onAddLine: () => void;
  onUpdateLine: (id: string, patch: Partial<OrderLine>) => void;
  onRemoveLine: (id: string) => void;
};

export function OrderLinesList({
  state,
  lines,
  validLinesCount,
  duplicates,
  lineWarnings,
  itemOptions,
  conflicts,
  onAddLine,
  onUpdateLine,
  onRemoveLine,
}: Props) {
  return (
    <>
      {/* Line items */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Позиции ({validLinesCount})</Label>
          <button onClick={onAddLine} className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium">
            <Icon name="Plus" size={14} />
            Добавить позицию
          </button>
        </div>

        <div className="space-y-2">
          {lines.map((ln, idx) => (
            <OrderLineItem
              key={ln.id}
              state={state}
              line={ln}
              itemOptions={itemOptions}
              warn={lineWarnings[idx]}
              isDup={duplicates.has(ln.itemId)}
              onUpdate={onUpdateLine}
              onRemove={onRemoveLine}
            />
          ))}
        </div>
      </div>

      {/* Global conflict summary */}
      {conflicts.length > 0 && (
        <div className="p-3 bg-destructive/8 border border-destructive/20 rounded-xl space-y-1.5">
          <div className="flex items-center gap-2 text-sm font-semibold text-destructive">
            <Icon name="AlertTriangle" size={14} />
            Конфликт остатков ({conflicts.length} позиций)
          </div>
          {conflicts.map((c, i) => (
            <div key={i} className="text-xs text-muted-foreground pl-5">
              «{c.itemName}» — нужно {c.requested}, свободно {c.available - getReservedQty(state, c.itemId)} {c.unit}
            </div>
          ))}
          <p className="text-xs text-muted-foreground pl-5 mt-1">При создании можно выбрать режим «Ожидает поставки»</p>
        </div>
      )}
    </>
  );
}
