import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Item, AppState, saveState } from '@/data/store';
import OperationModal from './OperationModal';
import { TechDocsList } from './ItemAttachmentsTab';
import { BarcodesSection } from './ItemBarcodesSection';
import { ItemHistoryTab } from './ItemHistoryTab';

import { loadBoard, BoardNode, BoardConnection } from '@/pages/technician/BoardView';

type Tab = 'info' | 'history' | 'documents';

type Props = {
  item: Item | null;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
};

export default function ItemDetailModal({ item, state, onStateChange, onClose }: Props) {
  const [opType, setOpType] = useState<'in' | 'out' | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('info');

  if (!item) return null;

  const liveItem = state.items.find(i => i.id === item.id) || item;
  const category = state.categories.find(c => c.id === liveItem.categoryId);
  const location = state.locations.find(l => l.id === liveItem.locationId);
  const itemOps = state.operations
    .filter(o => o.itemId === liveItem.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const isLow = liveItem.quantity <= liveItem.lowStockThreshold;
  const isCritical = liveItem.quantity === 0;

  const locStocks = (state.locationStocks || [])
    .filter(ls => ls.itemId === liveItem.id && ls.quantity > 0)
    .map(ls => ({ ...ls, location: state.locations.find(l => l.id === ls.locationId) }))
    .filter(ls => ls.location);

  const whStocks = (state.warehouseStocks || [])
    .filter(ws => ws.itemId === liveItem.id)
    .map(ws => ({ ...ws, warehouse: (state.warehouses || []).find(w => w.id === ws.warehouseId) }))
    .filter(ws => ws.warehouse);

  const handleOperation = (op: import('@/data/store').Operation, newQty: number, updatedState?: AppState) => {
    const base = updatedState || state;
    const next: AppState = {
      ...base,
      items: base.items.map(i => i.id === liveItem.id ? { ...i, quantity: newQty } : i),
      operations: [op, ...base.operations],
    };
    onStateChange(next);
    saveState(next);
    setOpType(null);
  };



  const handleQR = () => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/?item=' + liveItem.id)}`;
    window.open(url, '_blank');
  };

  const itemDocs = (state.techDocs || []).filter(d => d.itemId === liveItem.id);
  const totalFilesCount = itemDocs.reduce((s, d) => s + d.attachments.length, 0);

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'info',      label: 'Инфо',       icon: 'Info' },
    { id: 'history',   label: 'История',     icon: 'History',   badge: itemOps.length || undefined },
    { id: 'documents', label: 'Документы',   icon: 'Paperclip', badge: totalFilesCount || undefined },
  ];

  return (
    <>
      <Dialog open={!!item} onOpenChange={onClose}>
        <DialogContent className="max-w-xl p-0 overflow-hidden animate-scale-in max-h-[92vh] flex flex-col">
          {/* Header image */}
          <div className="relative h-40 bg-muted overflow-hidden shrink-0">
            {liveItem.imageUrl ? (
              <img src={liveItem.imageUrl} alt={liveItem.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (category?.color || '#6366f1') + '14' }}>
                <Icon name="Package" size={44} style={{ color: (category?.color || '#6366f1') + '55' }} />
              </div>
            )}
            <button onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/20 hover:bg-black/40 text-white flex items-center justify-center backdrop-blur-sm transition-colors">
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

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Title */}
            <div>
              <h2 className="text-xl font-bold leading-tight">{liveItem.name}</h2>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {category && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + '20', color: category.color }}>
                    {category.name}
                  </span>
                )}
                {location && (
                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon name="MapPin" size={11} />{location.name}
                  </span>
                )}
              </div>
              {liveItem.description && <p className="text-sm text-muted-foreground mt-1.5">{liveItem.description}</p>}
            </div>

            {/* Quantity block */}
            <div className={`p-4 rounded-xl border-2 space-y-3
              ${isCritical ? 'bg-destructive/8 border-destructive/30' : isLow ? 'bg-warning/8 border-warning/30' : 'bg-muted/50 border-transparent'}`}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-0.5">Текущий остаток</div>
                  <div className={`text-4xl font-bold tabular-nums ${isCritical ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>
                    {liveItem.quantity}
                    <span className="text-base font-normal text-muted-foreground ml-1.5">{liveItem.unit}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">порог: {liveItem.lowStockThreshold} {liveItem.unit}</div>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button onClick={() => setOpType('in')}
                    className="bg-success hover:bg-success/90 text-success-foreground font-semibold h-9 px-3 text-sm">
                    <Icon name="Plus" size={14} className="mr-1" />Приход
                  </Button>
                  <Button variant="outline" onClick={() => setOpType('out')} disabled={liveItem.quantity === 0}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 font-semibold h-9 px-3 text-sm">
                    <Icon name="Minus" size={14} className="mr-1" />Расход
                  </Button>
                </div>
              </div>

              {/* Warehouse + location stocks */}
              {whStocks.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                    <Icon name="Warehouse" size={11} />Остатки по складам:
                  </div>
                  <div className="space-y-1.5">
                    {whStocks.map(ws => {
                      const whLocStocks = (state.locationStocks || [])
                        .filter(ls => ls.itemId === liveItem.id && ls.quantity > 0)
                        .map(ls => ({ ...ls, loc: state.locations.find(l => l.id === ls.locationId) }))
                        .filter(ls => ls.loc);
                      return (
                        <div key={ws.warehouseId} className="rounded-lg border border-border bg-background/70 overflow-hidden">
                          <div className="flex items-center justify-between px-2.5 py-1.5 bg-muted/30">
                            <div className="flex items-center gap-1.5">
                              <Icon name="Warehouse" size={11} className="text-primary shrink-0" />
                              <span className="text-xs font-semibold text-foreground">{ws.warehouse?.name}</span>
                            </div>
                            <span className={`text-sm font-bold tabular-nums ${ws.quantity === 0 ? 'text-destructive' : 'text-foreground'}`}>
                              {ws.quantity} <span className="text-xs font-normal text-muted-foreground">{liveItem.unit}</span>
                            </span>
                          </div>
                          {whLocStocks.length > 0 && (
                            <div className="divide-y divide-border/50">
                              {whLocStocks.map(ls => (
                                <div key={ls.locationId} className="flex items-center justify-between px-3 py-1 text-xs">
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Icon name="MapPin" size={9} />
                                    <span>{ls.loc?.name}</span>
                                    {ls.loc?.description && <span className="opacity-60">· {ls.loc.description}</span>}
                                  </div>
                                  <span className="font-semibold text-foreground">{ls.quantity}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}


            </div>

            {/* Tabs */}
            <div className="flex gap-0.5 p-1 bg-muted rounded-lg">
              {tabs.map(t => (
                <button key={t.id} onClick={() => setActiveTab(t.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-1.5 rounded-md transition-all
                    ${activeTab === t.id ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Icon name={t.icon} size={13} />
                  {t.label}
                  {t.badge !== undefined && t.badge > 0 && (
                    <span className="bg-muted-foreground/20 text-[11px] px-1.5 rounded-full leading-4">{t.badge}</span>
                  )}
                </button>
              ))}
            </div>

            {/* Tab content */}
            {activeTab === 'info' && (
              <div className="space-y-4">
                <div className="space-y-0 divide-y divide-border text-sm">
                  {[
                    { label: 'Единица измерения', value: liveItem.unit },
                    { label: 'Добавлен', value: new Date(liveItem.createdAt).toLocaleDateString('ru-RU') },
                    { label: 'Категория', value: category?.name || '—' },
                    { label: 'Основная локация', value: location?.name || '—' },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between py-2.5">
                      <span className="text-muted-foreground">{row.label}</span>
                      <span className="font-medium">{row.value}</span>
                    </div>
                  ))}
                  <div className="flex justify-between py-2.5">
                    <span className="text-muted-foreground">QR-код товара</span>
                    <button onClick={handleQR} className="flex items-center gap-1.5 text-primary hover:text-primary/80 font-medium">
                      <Icon name="QrCode" size={13} />Открыть
                    </button>
                  </div>
                </div>
                <div className="pt-1">
                  <BarcodesSection item={liveItem} state={state} onStateChange={onStateChange} />
                </div>

                {/* Board connections */}
                {(() => {
                  const bd = loadBoard();
                  const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
                  if (!myNode) return null;
                  const linked = bd.connections
                    .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
                    .map(c => {
                      const otherId = c.fromId === myNode.id ? c.toId : c.fromId;
                      const other = bd.nodes.find(n => n.id === otherId);
                      return { conn: c, other };
                    })
                    .filter(l => l.other);
                  if (linked.length === 0) return null;

                  const resolveNode = (node: BoardNode) => {
                    if (node.type === 'item') {
                      const it = state.items.find(i => i.id === node.refId);
                      return { title: it?.name || 'Удалено', icon: 'Package', color: state.categories.find(c => c.id === it?.categoryId)?.color || '#6366f1' };
                    }
                    if (node.type === 'doc') {
                      const doc = (state.techDocs || []).find(d => d.id === node.refId);
                      return { title: doc ? `${doc.docType} ${doc.docNumber || ''}`.trim() : 'Удалено', icon: 'FileText', color: '#f59e0b' };
                    }
                    if (node.type === 'file') return { title: node.fileName || 'Файл', icon: 'File', color: '#0ea5e9' };
                    return { title: 'Заметка', icon: 'StickyNote', color: '#ec4899' };
                  };

                  return (
                    <div className="pt-3 space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Icon name="Cable" size={12} />Связи на доске ({linked.length})
                      </div>
                      <div className="space-y-1">
                        {linked.map(({ conn, other }) => {
                          if (!other) return null;
                          const nd = resolveNode(other);
                          return (
                            <div key={conn.id} className="flex items-center gap-2 px-2.5 py-2 rounded-lg bg-muted/40 border border-border/50">
                              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: conn.color || '#6366f1' }} />
                              <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: nd.color + '20', color: nd.color }}>
                                <Icon name={nd.icon} size={11} />
                              </div>
                              <span className="text-xs font-medium truncate flex-1">{nd.title}</span>
                              {conn.label && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{conn.label}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            {activeTab === 'history' && (
              <ItemHistoryTab liveItem={liveItem} itemOps={itemOps} state={state} />
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                <TechDocsList itemDocs={itemDocs} state={state} />
                {itemDocs.length === 0 && (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                    <Icon name="FileText" size={28} className="mb-2 opacity-30" />
                    <p>Документы добавляются через вкладку <b className="text-foreground">Техник</b></p>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {opType && (
        <OperationModal
          open={!!opType}
          onClose={() => setOpType(null)}
          item={liveItem}
          type={opType}
          performedBy={state.currentUser}
          state={state}
          onSave={handleOperation}
        />
      )}


    </>
  );
}