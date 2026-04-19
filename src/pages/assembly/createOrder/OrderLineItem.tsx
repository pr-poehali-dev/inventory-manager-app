import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import { AppState, getFreeQty } from '@/data/store';
import { OrderLine } from './useCreateOrderLogic';

type LineWarning = { type: 'error' | 'warn' | 'info'; msg: string } | null;

type Props = {
  state: AppState;
  line: OrderLine;
  itemOptions: AutocompleteOption[];
  warn: LineWarning;
  isDup: boolean;
  onUpdate: (id: string, patch: Partial<OrderLine>) => void;
  onRemove: (id: string) => void;
};

export function OrderLineItem({ state, line, itemOptions, warn, isDup, onUpdate, onRemove }: Props) {
  const item = state.items.find(i => i.id === line.itemId);

  return (
    <div className={`rounded-xl border p-3 space-y-2 transition-colors
      ${isDup ? 'border-destructive/40 bg-destructive/4' : warn?.type === 'error' ? 'border-warning/40 bg-warning/4' : 'border-border bg-muted/30'}`}>
      <div className="flex items-center gap-2">
        <div className="flex-1">
          <Autocomplete
            value={line.itemLabel}
            onChange={v => onUpdate(line.id, { itemLabel: v, itemId: '' })}
            onSelect={opt => onUpdate(line.id, { itemId: opt.id, itemLabel: opt.label })}
            options={itemOptions}
            placeholder="Начните вводить товар..."
            allowCustom={false}
          />
        </div>
        <div className="relative w-28 shrink-0">
          <Input
            type="number" min="1" value={line.qty}
            onChange={e => onUpdate(line.id, { qty: e.target.value })}
            className={`h-9 text-center ${warn?.type === 'error' ? 'border-destructive' : ''}`}
          />
          {item && <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">{item.unit}</span>}
        </div>
        <button onClick={() => onRemove(line.id)} className="text-muted-foreground hover:text-destructive shrink-0">
          <Icon name="X" size={15} />
        </button>
      </div>

      {/* Stock info row with warehouse + location breakdown */}
      {item && (
        <div className="space-y-1.5 px-1">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-muted-foreground">Всего: <b className={item.quantity === 0 ? 'text-destructive' : 'text-foreground'}>{item.quantity} {item.unit}</b></span>
            <span className="text-muted-foreground">Свободно: <b className={getFreeQty(state, item.id) <= 0 ? 'text-destructive' : 'text-success'}>{getFreeQty(state, item.id)} {item.unit}</b></span>
          </div>
          {(() => {
            const whStocks = (state.warehouseStocks || [])
              .filter(ws => ws.itemId === item.id && ws.quantity > 0)
              .map(ws => ({ ...ws, wh: (state.warehouses || []).find(w => w.id === ws.warehouseId) }))
              .filter(ws => ws.wh);
            const locs = (state.locationStocks || [])
              .filter(ls => ls.itemId === item.id && ls.quantity > 0)
              .map(ls => ({ ...ls, loc: state.locations.find(l => l.id === ls.locationId) }))
              .filter(ls => ls.loc);
            if (whStocks.length === 0 && locs.length === 0) return null;
            return (
              <div className="flex flex-wrap gap-1">
                {whStocks.length > 0 ? whStocks.map(ws => (
                  <span key={ws.warehouseId} className="text-[11px] bg-primary/8 border border-primary/20 px-2 py-0.5 rounded-full text-primary flex items-center gap-1">
                    <span className="opacity-60">⬛</span>{ws.wh?.name}: <b>{ws.quantity}</b>
                  </span>
                )) : locs.map(ls => (
                  <span key={ls.locationId} className="text-[11px] bg-background border border-border px-2 py-0.5 rounded-full text-muted-foreground">
                    {ls.loc?.name}: <b className="text-foreground">{ls.quantity}</b>
                  </span>
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {isDup && (
        <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
          <Icon name="Copy" size={12} />
          Дубликат — этот товар уже добавлен в заявку
        </div>
      )}
      {!isDup && warn && (
        <div className={`flex items-center gap-1.5 text-xs font-medium
          ${warn.type === 'error' ? 'text-destructive' : warn.type === 'warn' ? 'text-warning' : 'text-muted-foreground'}`}>
          <Icon name={warn.type === 'error' ? 'AlertCircle' : warn.type === 'warn' ? 'AlertTriangle' : 'Info'} size={12} />
          {warn.msg}
        </div>
      )}
    </div>
  );
}
