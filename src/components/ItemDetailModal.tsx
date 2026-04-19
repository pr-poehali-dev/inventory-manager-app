import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Item, AppState, AssetType, crudAction } from '@/data/store';
import { useItemPhoto } from '@/hooks/useItemPhoto';
import OperationModal from './OperationModal';
import { TechDocsList } from './ItemAttachmentsTab';
import { ItemHistoryTab } from './ItemHistoryTab';

import { loadBoard, BoardNode } from '@/pages/technician/BoardView';

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
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [editing, setEditing] = useState(false);
  const [edited, setEdited] = useState<{ name: string; unit: string; assetType: AssetType; description: string; categoryId: string; lowStockThreshold: number }>({ name: '', unit: '', assetType: 'МЗ', description: '', categoryId: '', lowStockThreshold: 5 });
  const liveItem = item ? (state.items.find(i => i.id === item.id) || item) : ({ id: '' } as Item);
  const photo = useItemPhoto(liveItem, state, onStateChange);

  if (!item) return null;
  const category = state.categories.find(c => c.id === liveItem.categoryId);
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

  const handleOperation = (op: import('@/data/store').Operation, _newQty: number, updatedState?: AppState) => {
    const base = updatedState || state;
    const next: AppState = {
      ...base,
      operations: [op, ...base.operations],
    };
    onStateChange(next);
    crudAction('upsert_operation', { operation: op });
    setOpType(null);
  };

  const handleDelete = () => {
    const next: AppState = {
      ...state,
      items: state.items.filter(i => i.id !== liveItem.id),
      operations: state.operations.filter(op => op.itemId !== liveItem.id),
      locationStocks: state.locationStocks.filter(ls => ls.itemId !== liveItem.id),
      warehouseStocks: (state.warehouseStocks || []).filter(ws => ws.itemId !== liveItem.id),
      barcodes: (state.barcodes || []).filter(b => b.itemId !== liveItem.id),
      techDocs: (state.techDocs || []).filter(d => d.itemId !== liveItem.id),
      workOrders: state.workOrders.map(o => ({
        ...o,
        items: o.items.filter(oi => oi.itemId !== liveItem.id),
      })),
    };
    onStateChange(next);
    crudAction('delete_item', { itemId: liveItem.id });
    onClose();
  };

  const handleSaveEdit = () => {
    const updatedItem = {
      ...liveItem,
      name: edited.name.trim() || liveItem.name,
      unit: edited.unit.trim() || liveItem.unit,
      assetType: edited.assetType,
      description: edited.description.trim(),
      categoryId: edited.categoryId,
      lowStockThreshold: edited.lowStockThreshold,
    };
    const next = { ...state, items: state.items.map(i => i.id === liveItem.id ? updatedItem : i) };
    onStateChange(next);
    crudAction('upsert_item', { item: updatedItem, locationStocks: state.locationStocks.filter(ls => ls.itemId === liveItem.id), warehouseStocks: (state.warehouseStocks || []).filter(ws => ws.itemId === liveItem.id) });
    setEditing(false);
  };

  const itemDocs = (state.techDocs || []).filter(d => d.itemId === liveItem.id);
  const totalFilesCount = itemDocs.reduce((s, d) => s + d.attachments.length, 0);

  const boardLinkedFiles = (() => {
    const bd = loadBoard();
    const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
    if (!myNode) return 0;
    return bd.connections
      .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
      .filter(c => bd.nodes.find(n => n.id === (c.fromId === myNode.id ? c.toId : c.fromId))?.type === 'file')
      .length;
  })();

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'info',      label: 'Инфо',       icon: 'Info' },
    { id: 'history',   label: 'История',     icon: 'History',   badge: itemOps.length || undefined },
    { id: 'documents', label: 'Документы',   icon: 'Paperclip', badge: (totalFilesCount + boardLinkedFiles) || undefined },
  ];

  return (
    <>
      <Dialog open={!!item} onOpenChange={onClose}>
        <DialogContent className="max-w-xl lg:max-w-2xl xl:max-w-3xl p-0 overflow-hidden animate-scale-in max-h-[95vh] flex flex-col">
          {/* Header image */}
          <div className="relative h-40 bg-muted overflow-hidden shrink-0 group">
            {liveItem.imageUrl ? (
              <img src={liveItem.imageUrl} alt={liveItem.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center" style={{ backgroundColor: (category?.color || '#6366f1') + '14' }}>
                <Icon name="Package" size={44} style={{ color: (category?.color || '#6366f1') + '55' }} />
              </div>
            )}

            {/* Photo upload/replace overlay */}
            <label
              className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 hover:bg-black/40 text-white opacity-0 hover:opacity-100 cursor-pointer transition-all text-sm font-medium"
              title={liveItem.imageUrl ? 'Заменить фото' : 'Загрузить фото'}
            >
              {photo.uploading ? (
                <><Icon name="Loader2" size={18} className="animate-spin" />Загрузка...</>
              ) : (
                <>
                  <Icon name={liveItem.imageUrl ? 'ImagePlus' : 'Upload'} size={18} />
                  {liveItem.imageUrl ? 'Заменить фото' : 'Загрузить фото'}
                </>
              )}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={e => { photo.selectPhoto(e.target.files?.[0]); e.target.value = ''; }}
              />
            </label>

            <button onClick={onClose}
              className="absolute top-3 right-3 w-8 h-8 rounded-lg bg-black/30 hover:bg-black/50 text-white flex items-center justify-center backdrop-blur-sm transition-colors z-10">
              <Icon name="X" size={16} />
            </button>
            {liveItem.imageUrl && (
              <button
                onClick={photo.removePhoto}
                title="Удалить фото"
                className="absolute top-3 right-12 w-8 h-8 rounded-lg bg-black/30 hover:bg-destructive/80 text-white flex items-center justify-center backdrop-blur-sm transition-colors z-10"
              >
                <Icon name="Trash2" size={14} />
              </button>
            )}
            {isLow && (
              <div className={`absolute top-3 left-3 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold backdrop-blur-sm z-10
                ${isCritical ? 'bg-destructive text-destructive-foreground' : 'bg-warning text-warning-foreground'}`}>
                <Icon name="AlertTriangle" size={12} />
                {isCritical ? 'Нет в наличии' : 'Низкий остаток'}
              </div>
            )}
            {photo.error && (
              <div className="absolute bottom-2 left-2 right-2 text-xs text-white bg-destructive/90 px-2 py-1 rounded text-center z-10">
                {photo.error}
              </div>
            )}
          </div>

          <div className="p-5 space-y-4 overflow-y-auto flex-1">
            {/* Title */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <h2 className="text-xl font-bold leading-tight flex-1 break-words min-w-0">
                  {editing ? (
                    <input value={edited.name} onChange={e => setEdited({...edited, name: e.target.value})}
                      className="w-full text-xl font-bold bg-transparent border-b-2 border-primary outline-none" />
                  ) : liveItem.name}
                </h2>
                {!editing && (
                  <button onClick={() => { setEditing(true); setEdited({ name: liveItem.name, unit: liveItem.unit, assetType: liveItem.assetType || 'МЗ', description: liveItem.description || '', categoryId: liveItem.categoryId || '', lowStockThreshold: liveItem.lowStockThreshold }); }}
                    className="w-8 h-8 rounded-lg border border-border hover:bg-muted flex items-center justify-center shrink-0 transition-colors">
                    <Icon name="Pencil" size={14} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-1.5">
                {category && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: category.color + '20', color: category.color }}>
                    {category.name}
                  </span>
                )}
              </div>
              {liveItem.description && !editing && <p className="text-sm text-muted-foreground mt-1.5">{liveItem.description}</p>}
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
                {editing ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Единица измерения</label>
                      <input value={edited.unit} onChange={e => setEdited({...edited, unit: e.target.value})}
                        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Тип (МЗ/ОС)</label>
                      <select value={edited.assetType} onChange={e => setEdited({...edited, assetType: e.target.value as AssetType})}
                        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="МЗ">МЗ — материальные запасы</option>
                        <option value="ОС">ОС — основные средства</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Категория</label>
                      <select value={edited.categoryId} onChange={e => setEdited({...edited, categoryId: e.target.value})}
                        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring">
                        <option value="">Без категории</option>
                        {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Порог низкого остатка</label>
                      <input type="number" min={0} value={edited.lowStockThreshold} onChange={e => setEdited({...edited, lowStockThreshold: Number(e.target.value)})}
                        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring" />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground font-medium">Описание</label>
                      <textarea value={edited.description} onChange={e => setEdited({...edited, description: e.target.value})} rows={3}
                        className="w-full mt-1 px-3 py-2 text-sm rounded-lg border border-border bg-background focus:outline-none focus:ring-2 focus:ring-ring resize-none" />
                    </div>
                    <div className="flex gap-2 pt-2">
                      <Button variant="outline" size="sm" onClick={() => setEditing(false)} className="flex-1">Отмена</Button>
                      <Button size="sm" onClick={handleSaveEdit} className="flex-1 gap-1.5">
                        <Icon name="Check" size={14} />Сохранить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-0 divide-y divide-border text-sm">
                    {[
                      { label: 'Единица измерения', value: liveItem.unit },
                      { label: 'Тип', value: liveItem.assetType || 'МЗ' },
                      { label: 'Добавлен', value: new Date(liveItem.createdAt).toLocaleDateString('ru-RU') },
                      { label: 'Категория', value: category?.name || '—' },
                    ].map(row => (
                      <div key={row.label} className="flex justify-between py-2.5">
                        <span className="text-muted-foreground">{row.label}</span>
                        <span className="font-medium">{row.value}</span>
                      </div>
                    ))}
                  </div>
                )}

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

                {!editing && (
                  <div className="pt-4 border-t border-border">
                    {!showDeleteConfirm ? (
                      <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(true)}
                        className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 gap-2">
                        <Icon name="Trash2" size={14} />Удалить номенклатуру
                      </Button>
                    ) : (
                      <div className="p-3 bg-destructive/8 border border-destructive/20 rounded-xl space-y-3">
                        <p className="text-sm text-muted-foreground">
                          <b className="text-foreground">«{liveItem.name}»</b> будет удалён вместе с историей, остатками и документами. Это необратимо.
                        </p>
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => setShowDeleteConfirm(false)} className="flex-1">Отмена</Button>
                          <Button size="sm" onClick={handleDelete}
                            className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground font-semibold gap-1.5">
                            <Icon name="Trash2" size={13} />Удалить
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'history' && (
              <ItemHistoryTab liveItem={liveItem} itemOps={itemOps} state={state} />
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                <TechDocsList itemDocs={itemDocs} state={state} />

                {/* Files linked on board */}
                {(() => {
                  const bd = loadBoard();
                  const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
                  if (!myNode) return null;
                  const linkedFiles = bd.connections
                    .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
                    .map(c => bd.nodes.find(n => n.id === (c.fromId === myNode.id ? c.toId : c.fromId)))
                    .filter((n): n is BoardNode => !!n && n.type === 'file');
                  if (linkedFiles.length === 0) return null;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                        <Icon name="Cable" size={12} />Файлы с доски ({linkedFiles.length})
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {linkedFiles.map(file => {
                          const isImage = file.fileMime?.startsWith('image/');
                          return (
                            <a key={file.id} href={file.fileDataUrl} download={file.fileName}
                              className="flex flex-col rounded-xl border border-border bg-muted/30 overflow-hidden hover:border-primary/40 hover:shadow-md transition-all group">
                              {isImage && file.fileDataUrl ? (
                                <div className="h-24 bg-muted overflow-hidden">
                                  <img src={file.fileDataUrl} alt={file.fileName} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                </div>
                              ) : (
                                <div className="h-16 bg-muted flex items-center justify-center">
                                  <Icon name="File" size={24} className="text-muted-foreground/40" />
                                </div>
                              )}
                              <div className="px-2.5 py-2 flex items-center gap-1.5">
                                <Icon name="Download" size={11} className="text-primary shrink-0" />
                                <span className="text-[11px] font-medium truncate">{file.fileName || 'Файл'}</span>
                              </div>
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

                {itemDocs.length === 0 && (() => {
                  const bd = loadBoard();
                  const myNode = bd.nodes.find(n => n.type === 'item' && n.refId === liveItem.id);
                  const hasFiles = myNode && bd.connections
                    .filter(c => c.fromId === myNode.id || c.toId === myNode.id)
                    .some(c => bd.nodes.find(n => n.id === (c.fromId === myNode.id ? c.toId : c.fromId))?.type === 'file');
                  if (hasFiles) return null;
                  return (
                    <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
                      <Icon name="FileText" size={28} className="mb-2 opacity-30" />
                      <p>Документы добавляются через вкладку <b className="text-foreground">Техник</b></p>
                    </div>
                  );
                })()}
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