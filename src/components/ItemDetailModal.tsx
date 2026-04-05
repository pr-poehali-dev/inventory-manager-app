import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Item, Category, Location, Operation, AppState, saveState, generateId } from '@/data/store';
import OperationModal from './OperationModal';

type Props = {
  item: Item | null;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
};

export default function ItemDetailModal({ item, state, onStateChange, onClose }: Props) {
  const [opType, setOpType] = useState<'in' | 'out' | null>(null);
  const [historyTab, setHistoryTab] = useState(false);

  if (!item) return null;

  const category = state.categories.find(c => c.id === item.categoryId);
  const location = state.locations.find(l => l.id === item.locationId);
  const itemOps = state.operations
    .filter(o => o.itemId === item.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const isLow = item.quantity <= item.lowStockThreshold;
  const isCritical = item.quantity === 0;

  const handleOperation = (op: Operation, newQty: number) => {
    const updatedItems = state.items.map(i =>
      i.id === item.id ? { ...i, quantity: newQty } : i
    );
    const next: AppState = {
      ...state,
      items: updatedItems,
      operations: [op, ...state.operations],
    };
    onStateChange(next);
    saveState(next);
    setOpType(null);
  };

  const qrUrl = `${window.location.origin}/?item=${item.id}`;

  const handleQR = () => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(qrUrl)}`;
    window.open(url, '_blank');
  };

  return (
    <>
      <Dialog open={!!item} onOpenChange={onClose}>
        <DialogContent className="max-w-xl p-0 overflow-hidden animate-scale-in">
          {/* Header image / placeholder */}
          <div className="relative h-44 bg-muted overflow-hidden">
            {item.imageUrl ? (
              <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (category?.color || '#6366f1') + '14' }}>
                <Icon name="Package" size={48} style={{ color: (category?.color || '#6366f1') + '60' }} />
              </div>
            )}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/20 hover:bg-black/40 text-white flex items-center justify-center backdrop-blur-sm transition-colors"
            >
              <Icon name="X" size={16} />
            </button>
            {isLow && (
              <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm
                ${isCritical ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'}`}>
                <Icon name="AlertTriangle" size={12} />
                {isCritical ? 'Нет в наличии' : 'Низкий остаток'}
              </div>
            )}
          </div>

          <div className="p-5 space-y-4">
            {/* Title & meta */}
            <div>
              <h2 className="text-xl font-bold text-foreground leading-tight">{item.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                {category && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + '20', color: category.color }}>
                    {category.name}
                  </span>
                )}
                {location && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon name="MapPin" size={11} />
                    {location.name}
                  </div>
                )}
              </div>
              {item.description && (
                <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
              )}
            </div>

            {/* Big quantity display */}
            <div className={`flex items-center justify-between p-4 rounded-xl border-2
              ${isCritical ? 'bg-destructive/8 border-destructive/30' : isLow ? 'bg-warning/8 border-warning/30' : 'bg-muted/60 border-transparent'}`}>
              <div>
                <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Текущий остаток</div>
                <div className={`text-4xl font-bold tabular-nums ${isCritical ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>
                  {item.quantity}
                  <span className="text-lg font-normal text-muted-foreground ml-1.5">{item.unit}</span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">порог: {item.lowStockThreshold} {item.unit}</div>
              </div>
              {/* Operation buttons */}
              <div className="flex flex-col gap-2">
                <Button
                  onClick={() => setOpType('in')}
                  className="bg-success hover:bg-success/90 text-success-foreground font-semibold h-10 px-4"
                >
                  <Icon name="Plus" size={16} className="mr-1.5" />
                  Приход
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setOpType('out')}
                  disabled={item.quantity === 0}
                  className="border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold h-10 px-4"
                >
                  <Icon name="Minus" size={16} className="mr-1.5" />
                  Расход
                </Button>
              </div>
            </div>

            {/* Tabs: info / history */}
            <div className="flex gap-1 p-1 bg-muted rounded-lg">
              <button
                onClick={() => setHistoryTab(false)}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all ${!historyTab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                Информация
              </button>
              <button
                onClick={() => setHistoryTab(true)}
                className={`flex-1 text-sm font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1.5 ${historyTab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                История
                {itemOps.length > 0 && <span className="bg-muted-foreground/20 text-xs px-1.5 rounded-full">{itemOps.length}</span>}
              </button>
            </div>

            {!historyTab ? (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Единица измерения</span>
                  <span className="font-medium">{item.unit}</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Добавлен</span>
                  <span className="font-medium">{new Date(item.createdAt).toLocaleDateString('ru-RU')}</span>
                </div>
                <div className="flex justify-between py-2">
                  <span className="text-muted-foreground">QR-код</span>
                  <button onClick={handleQR} className="flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium">
                    <Icon name="QrCode" size={14} />
                    Открыть
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {itemOps.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Icon name="History" size={24} className="mx-auto mb-2 opacity-40" />
                    Операций пока нет
                  </div>
                ) : itemOps.map(op => (
                  <div key={op.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/50 text-sm">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5
                      ${op.type === 'in' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                      <Icon name={op.type === 'in' ? 'ArrowDown' : 'ArrowUp'} size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className={`font-semibold tabular-nums ${op.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                          {op.type === 'in' ? '+' : '-'}{op.quantity} {item.unit}
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' })}
                        </span>
                      </div>
                      {op.comment && <p className="text-xs text-muted-foreground mt-0.5 truncate">{op.comment}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {opType && (
        <OperationModal
          open={!!opType}
          onClose={() => setOpType(null)}
          item={item}
          type={opType}
          performedBy={state.currentUser}
          onSave={handleOperation}
        />
      )}
    </>
  );
}
