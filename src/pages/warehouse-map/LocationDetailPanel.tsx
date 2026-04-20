import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState, Location } from '@/data/store';
import QRDialog from '@/components/QRDialog';
import { AddItemToLocationModal } from './WarehouseMapModals';
import { MoveItemModal } from './MoveItemModal';
import { getStockLevel, stockDotColor } from './WarehouseMapHelpers';

type Props = {
  location: Location;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  onItemSelect: (itemId: string) => void;
  onItemDragStart: (e: React.DragEvent, itemId: string, fromLocationId: string) => void;
};

export default function LocationDetailPanel({
  location, state, onStateChange, onClose, onItemSelect, onItemDragStart,
}: Props) {
  const [showAddItem, setShowAddItem] = useState(false);
  const [moveItemId, setMoveItemId] = useState<string | null>(null);
  const locStocks = (state.locationStocks || [])
    .filter(ls => ls.locationId === location.id && ls.quantity > 0)
    .map(ls => ({ ...ls, item: state.items.find(i => i.id === ls.itemId) }))
    .filter(ls => ls.item)
    .sort((a, b) => a.item!.name.localeCompare(b.item!.name, 'ru'));

  const totalItems = locStocks.length;
  const totalUnits = locStocks.reduce((s, ls) => s + ls.quantity, 0);

  const [showQR, setShowQR] = useState(false);
  const qrValue = `${window.location.origin}/?location=${location.id}`;

  return (
    <>
    <div className="flex flex-col h-full">
      <div className="flex items-start justify-between gap-2 mb-4">
        <div>
          <h3 className="font-bold text-lg text-foreground">{location.name}</h3>
          {location.description && <p className="text-sm text-muted-foreground mt-0.5">{location.description}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span>{totalItems} позиций</span>
            <span>{totalUnits} единиц</span>
          </div>
        </div>
        <button onClick={onClose} className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground shrink-0">
          <Icon name="X" size={15} />
        </button>
      </div>

      <div className="flex gap-2 mb-4">
        <Button size="sm" onClick={() => setShowAddItem(true)} className="flex items-center gap-1.5 flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold">
          <Icon name="PackagePlus" size={14} />Добавить товар
        </Button>
        <Button variant="outline" size="sm" onClick={() => setShowQR(true)} className="flex items-center gap-1.5">
          <Icon name="QrCode" size={13} />QR
        </Button>
      </div>
      {showAddItem && (
        <AddItemToLocationModal
          locationId={location.id}
          state={state}
          onStateChange={onStateChange}
          onClose={() => setShowAddItem(false)}
        />
      )}

      {locStocks.length === 0 ? (
        <div className="flex flex-col items-center justify-center flex-1 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Icon name="Package" size={20} className="text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-0.5">Локация пуста</p>
          <p className="text-xs text-muted-foreground">Перетащите сюда товар с другой локации</p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto flex-1">
          {locStocks.map(ls => {
            const level = getStockLevel(ls.quantity, ls.item!.lowStockThreshold);
            const cat = state.categories.find(c => c.id === ls.item!.categoryId);
            const otherLocs = (state.locationStocks || [])
              .filter(s => s.itemId === ls.itemId && s.locationId !== location.id && s.quantity > 0)
              .map(s => ({ ...s, loc: state.locations.find(l => l.id === s.locationId) }));

            return (
              <div
                key={ls.itemId}
                draggable
                onDragStart={e => onItemDragStart(e, ls.itemId, location.id)}
                className={`group p-3 rounded-xl border cursor-grab active:cursor-grabbing transition-all hover:shadow-card
                  ${level === 'critical' ? 'border-destructive/30 bg-destructive/4' : level === 'low' ? 'border-warning/30 bg-warning/4' : 'border-border bg-card hover:bg-muted/30'}`}
              >
                <div className="flex items-start gap-2.5">
                  <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${stockDotColor(level)}`} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => onItemSelect(ls.itemId)}
                      className="font-semibold text-sm text-foreground hover:text-primary transition-colors text-left w-full truncate"
                    >
                      {ls.item!.name}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {cat && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: cat.color + '18', color: cat.color }}>
                          {cat.name}
                        </span>
                      )}
                      {level !== 'ok' && (
                        <span className={`text-[11px] font-semibold ${level === 'critical' ? 'text-destructive' : 'text-warning'}`}>
                          {level === 'critical' ? 'Нет в наличии' : 'Мало'}
                        </span>
                      )}
                    </div>
                    {otherLocs.length > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-1">
                        Ещё: {otherLocs.map(ol => `${ol.loc?.name} (${ol.quantity})`).join(', ')}
                      </div>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-base font-bold tabular-nums
                      ${level === 'critical' ? 'text-destructive' : level === 'low' ? 'text-warning' : 'text-foreground'}`}>
                      {ls.quantity}
                    </div>
                    <div className="text-xs text-muted-foreground">{ls.item!.unit}</div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                    <Icon name="GripHorizontal" size={11} />
                    <span>Перетащите · </span>
                    <button onClick={() => onItemSelect(ls.itemId)} className="text-primary hover:underline">открыть карточку</button>
                  </div>
                  <button
                    onClick={() => setMoveItemId(ls.itemId)}
                    className="flex items-center gap-1 text-[11px] font-medium text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition-colors shrink-0"
                    title="Переместить на другую полку"
                  >
                    <Icon name="ArrowRightLeft" size={11} />
                    Переместить
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
    <QRDialog open={showQR} onClose={() => setShowQR(false)} value={qrValue} title="QR-код локации" />
    {moveItemId && (
      <MoveItemModal
        itemId={moveItemId}
        fromLocationId={location.id}
        state={state}
        onStateChange={onStateChange}
        onClose={() => setMoveItemId(null)}
      />
    )}
    </>
  );
}