import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Item, AppState, Attachment, Barcode, saveState, generateId, getItemBarcodes, getWarehouseStock } from '@/data/store';
import OperationModal from './OperationModal';
import ScannerModal, { ScannedCode } from './ScannerModal';

type Tab = 'info' | 'history' | 'documents';

type Props = {
  item: Item | null;
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
};

// ─── File icon by type ────────────────────────────────────────────────────────
function FileIcon({ mime, name }: { mime: string; name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/')) return <Icon name="Image" size={20} className="text-blue-500" />;
  if (mime.includes('pdf')) return <Icon name="FileText" size={20} className="text-red-500" />;
  if (mime.includes('word') || ext === 'docx' || ext === 'doc') return <Icon name="FileText" size={20} className="text-blue-600" />;
  if (mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xlsx' || ext === 'xls')
    return <Icon name="Table" size={20} className="text-green-600" />;
  if (mime.includes('zip') || mime.includes('rar')) return <Icon name="Archive" size={20} className="text-yellow-600" />;
  return <Icon name="File" size={20} className="text-muted-foreground" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

// ─── Attachments tab ──────────────────────────────────────────────────────────
function AttachmentsTab({ item, state, onStateChange }: {
  item: Item; state: AppState; onStateChange: (s: AppState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);

  const attachments = item.attachments || [];

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const readers = Array.from(files).map(file =>
      new Promise<Attachment>((resolve, reject) => {
        // 10MB limit
        if (file.size > 10 * 1024 * 1024) {
          reject(new Error(`Файл "${file.name}" слишком большой (макс. 10 МБ)`));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id: generateId(),
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            dataUrl: reader.result as string,
            uploadedAt: new Date().toISOString(),
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })
    );

    Promise.allSettled(readers).then(results => {
      const newAtts: Attachment[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') newAtts.push(r.value);
      });
      if (newAtts.length > 0) {
        const updatedItem = { ...item, attachments: [...attachments, ...newAtts] };
        const next: AppState = { ...state, items: state.items.map(i => i.id === item.id ? updatedItem : i) };
        onStateChange(next);
        saveState(next);
      }
      setUploading(false);
    });
  };

  const handleDelete = (attId: string) => {
    const updatedItem = { ...item, attachments: attachments.filter(a => a.id !== attId) };
    const next: AppState = { ...state, items: state.items.map(i => i.id === item.id ? updatedItem : i) };
    onStateChange(next);
    saveState(next);
  };

  const handleDownload = (att: Attachment) => {
    const a = document.createElement('a');
    a.href = att.dataUrl;
    a.download = att.name;
    a.click();
  };

  const handleOpen = (att: Attachment) => {
    if (att.mimeType.startsWith('image/')) {
      setPreviewAtt(att);
      return;
    }
    const a = document.createElement('a');
    a.href = att.dataUrl;
    a.target = '_blank';
    a.download = att.name;
    a.click();
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${dragOver ? 'border-primary bg-accent' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
      >
        <input ref={fileRef} type="file" multiple className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.zip,.txt,.csv"
          onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-muted-foreground">Загрузка...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Icon name="Upload" size={18} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Перетащите файлы или нажмите</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, Excel, изображения — до 10 МБ</p>
            </div>
          </div>
        )}
      </div>

      {/* Files list */}
      {attachments.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Вложений пока нет
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors group">
              {/* Preview for images */}
              {att.mimeType.startsWith('image/') ? (
                <img src={att.dataUrl} alt={att.name} className="w-10 h-10 rounded-lg object-cover shrink-0 cursor-pointer" onClick={() => setPreviewAtt(att)} />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileIcon mime={att.mimeType} name={att.name} />
                </div>
              )}

              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpen(att)}>
                <div className="text-sm font-medium text-foreground truncate">{att.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(att.size)} · {new Date(att.uploadedAt).toLocaleDateString('ru-RU')}
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDownload(att)}
                  className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <Icon name="Download" size={13} />
                </button>
                <button onClick={() => handleDelete(att.id)}
                  className="w-7 h-7 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                  <Icon name="Trash2" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image preview modal */}
      {previewAtt && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewAtt(null)}>
          <div className="relative max-w-3xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={previewAtt.dataUrl} alt={previewAtt.name} className="max-w-full max-h-[80vh] rounded-xl object-contain" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-xl px-4 py-2 flex items-center justify-between">
              <span className="text-white text-sm font-medium truncate">{previewAtt.name}</span>
              <div className="flex gap-2">
                <button onClick={() => handleDownload(previewAtt)} className="text-white/80 hover:text-white transition-colors">
                  <Icon name="Download" size={16} />
                </button>
                <button onClick={() => setPreviewAtt(null)} className="text-white/80 hover:text-white transition-colors">
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Barcodes section ────────────────────────────────────────────────────────
function BarcodesSection({ item, state, onStateChange }: {
  item: Item; state: AppState; onStateChange: (s: AppState) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [newCode, setNewCode] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [showScanner, setShowScanner] = useState(false);
  const barcodes = getItemBarcodes(state, item.id);

  const handleAdd = () => {
    const code = newCode.trim();
    if (!code) return;
    const already = (state.barcodes || []).some(b => b.code === code);
    if (already) { setNewCode(''); setNewLabel(''); return; }
    const next: AppState = {
      ...state,
      barcodes: [...(state.barcodes || []), {
        id: generateId(), itemId: item.id, code, format: 'manual',
        label: newLabel.trim() || undefined, createdAt: new Date().toISOString(),
      }],
    };
    onStateChange(next);
    saveState(next);
    setNewCode(''); setNewLabel(''); setAdding(false);
  };

  const handleRemove = (id: string) => {
    const next: AppState = { ...state, barcodes: (state.barcodes || []).filter(b => b.id !== id) };
    onStateChange(next);
    saveState(next);
  };

  const handleScanAdd = (codes: ScannedCode[]) => {
    let next = state;
    for (const sc of codes) {
      const already = (next.barcodes || []).some(b => b.code === sc.code);
      if (!already) {
        next = {
          ...next,
          barcodes: [...(next.barcodes || []), {
            id: generateId(), itemId: item.id, code: sc.code,
            format: sc.format, label: '', createdAt: new Date().toISOString(),
          }],
        };
      }
    }
    if (next !== state) { onStateChange(next); saveState(next); }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Icon name="Barcode" size={14} />
          Штрих-коды и QR-коды
          {barcodes.length > 0 && <span className="text-xs text-muted-foreground font-normal">({barcodes.length})</span>}
        </span>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setShowScanner(true)}
            className="h-7 px-2.5 rounded-lg border border-primary/40 text-primary text-xs font-medium hover:bg-primary/8 flex items-center gap-1.5 transition-colors">
            <Icon name="ScanLine" size={12} />Сканировать
          </button>
          <button onClick={() => setAdding(v => !v)}
            className="h-7 px-2.5 rounded-lg border border-border text-muted-foreground text-xs font-medium hover:bg-muted flex items-center gap-1.5 transition-colors">
            <Icon name="Plus" size={12} />Вручную
          </button>
        </div>
      </div>

      {barcodes.length === 0 && !adding && (
        <div className="flex items-center gap-2 py-2 px-3 bg-muted/40 rounded-lg text-xs text-muted-foreground">
          <Icon name="Info" size={12} />
          Кодов пока нет. Добавьте вручную или отсканируйте.
        </div>
      )}

      {barcodes.length > 0 && (
        <div className="space-y-1.5">
          {barcodes.map((b: Barcode) => (
            <div key={b.id} className="flex items-center gap-2.5 p-2 bg-muted/40 rounded-lg border border-border group">
              <div className="w-7 h-7 rounded-md bg-background border border-border flex items-center justify-center shrink-0">
                <Icon name={b.format === 'qr_code' ? 'QrCode' : 'Barcode'} size={14} className="text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-mono text-xs font-semibold text-foreground truncate">{b.code}</div>
                {b.label && <div className="text-[11px] text-muted-foreground">{b.label}</div>}
                {b.format && b.format !== 'manual' && (
                  <div className="text-[11px] text-muted-foreground">{b.format.toUpperCase().replace('_', '-')}</div>
                )}
              </div>
              <button onClick={() => handleRemove(b.id)}
                className="w-6 h-6 rounded-md opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive flex items-center justify-center text-muted-foreground transition-all shrink-0">
                <Icon name="Trash2" size={11} />
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="space-y-2 p-3 bg-muted/30 rounded-xl border border-border">
          <Input
            value={newCode} onChange={e => setNewCode(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Код (EAN-13, QR, CODE-128...)"
            className="font-mono text-sm h-9"
            autoFocus
          />
          <Input
            value={newLabel} onChange={e => setNewLabel(e.target.value)}
            placeholder="Метка (необязательно)"
            className="text-sm h-9"
          />
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => { setAdding(false); setNewCode(''); setNewLabel(''); }} className="flex-1">
              Отмена
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!newCode.trim()} className="flex-1">
              Добавить
            </Button>
          </div>
        </div>
      )}

      <ScannerModal
        open={showScanner}
        onClose={() => setShowScanner(false)}
        onConfirm={handleScanAdd}
        title="Привязать коды к товару"
        itemBarcodes={barcodes.map(b => b.code)}
      />
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────
export default function ItemDetailModal({ item, state, onStateChange, onClose }: Props) {
  const [opType, setOpType] = useState<'in' | 'out' | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [quickScanType, setQuickScanType] = useState<'in' | 'out' | null>(null);

  if (!item) return null;

  const liveItem = state.items.find(i => i.id === item.id) || item;
  const category = state.categories.find(c => c.id === liveItem.categoryId);
  const location = state.locations.find(l => l.id === liveItem.locationId);
  const itemOps = state.operations
    .filter(o => o.itemId === liveItem.id)
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const attachments = liveItem.attachments || [];

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

  const itemBarcodes = getItemBarcodes(state, liveItem.id);

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

  const handleQuickScan = (codes: ScannedCode[], scanType: 'in' | 'out') => {
    if (codes.length === 0) return;
    const warehouses = state.warehouses || [];
    const defaultWh = warehouses[0];
    if (!defaultWh) return;

    let newState = state;
    // Auto-register new barcodes
    for (const sc of codes) {
      const alreadyKnown = (newState.barcodes || []).some(b => b.code === sc.code);
      if (!alreadyKnown) {
        newState = {
          ...newState,
          barcodes: [...(newState.barcodes || []), {
            id: generateId(), itemId: liveItem.id, code: sc.code,
            format: sc.format, label: '', createdAt: new Date().toISOString(),
          }],
        };
      }
    }

    const qty = codes.length;
    const delta = scanType === 'in' ? qty : -qty;
    const whId = defaultWh.id;
    const whStock = getWarehouseStock(newState, liveItem.id, whId);
    if (scanType === 'out' && qty > whStock) return; // not enough

    // Import updateWarehouseStock inline
    const stocks = newState.warehouseStocks || [];
    const existing = stocks.find(ws => ws.itemId === liveItem.id && ws.warehouseId === whId);
    let nextStocks;
    if (existing) {
      nextStocks = stocks.map(ws => ws.itemId === liveItem.id && ws.warehouseId === whId
        ? { ...ws, quantity: Math.max(0, ws.quantity + delta) } : ws);
    } else if (delta > 0) {
      nextStocks = [...stocks, { itemId: liveItem.id, warehouseId: whId, quantity: delta }];
    } else {
      nextStocks = stocks;
    }
    const totalQty = nextStocks.filter(ws => ws.itemId === liveItem.id).reduce((s, ws) => s + ws.quantity, 0);
    newState = {
      ...newState,
      warehouseStocks: nextStocks,
      items: newState.items.map(i => i.id === liveItem.id ? { ...i, quantity: totalQty } : i),
    };

    const op: import('@/data/store').Operation = {
      id: generateId(), itemId: liveItem.id, type: scanType, quantity: qty,
      comment: `[Сканирование] ${scanType === 'in' ? 'Приход' : 'Расход'} ${qty} шт. — ${codes.map(c => c.code).join(', ')}`,
      from: scanType === 'in' ? 'Сканирование' : defaultWh.name,
      to: scanType === 'in' ? defaultWh.name : 'Сканирование',
      performedBy: state.currentUser,
      date: new Date().toISOString(),
      warehouseId: whId,
      scannedCodes: codes.map(c => c.code),
    };

    const finalState: AppState = { ...newState, operations: [op, ...newState.operations] };
    onStateChange(finalState);
    saveState(finalState);
    setQuickScanType(null);
  };

  const handleQR = () => {
    const url = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(window.location.origin + '/?item=' + liveItem.id)}`;
    window.open(url, '_blank');
  };

  const itemDocs = (state.techDocs || []).filter(d => d.itemId === liveItem.id);
  const totalFilesCount = attachments.length + itemDocs.reduce((s, d) => s + d.attachments.length, 0);

  const tabs: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'info',      label: 'Инфо',       icon: 'Info' },
    { id: 'history',   label: 'История',     icon: 'History',  badge: itemOps.length || undefined },
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
                      // Find locationStocks for this item that belong to this warehouse's locations
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

              {/* Quick scan buttons */}
              {itemBarcodes.length > 0 && (
                <div className="flex gap-2">
                  <button onClick={() => setQuickScanType('in')}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-success/10 border border-success/30 text-success text-xs font-semibold hover:bg-success/20 transition-colors">
                    <Icon name="ScanLine" size={13} />Сканировать приход
                  </button>
                  <button onClick={() => setQuickScanType('out')} disabled={liveItem.quantity === 0}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-destructive/8 border border-destructive/30 text-destructive text-xs font-semibold hover:bg-destructive/15 transition-colors disabled:opacity-40 disabled:pointer-events-none">
                    <Icon name="ScanLine" size={13} />Сканировать расход
                  </button>
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

                {/* Barcode section */}
                <div className="pt-1">
                  <BarcodesSection item={liveItem} state={state} onStateChange={onStateChange} />
                </div>
              </div>
            )}

            {activeTab === 'history' && (
              <div className="space-y-1.5">
                {itemOps.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">
                    <Icon name="History" size={24} className="mx-auto mb-2 opacity-40" />
                    Операций пока нет
                  </div>
                ) : itemOps.map(op => {
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
            )}

            {activeTab === 'documents' && (
              <div className="space-y-4">
                {/* ─── Прямые вложения товара ─── */}
                <AttachmentsTab item={liveItem} state={state} onStateChange={onStateChange} />

                {/* ─── Документы из базы техника ─── */}
                {itemDocs.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-px bg-border" />
                      <span className="text-xs text-muted-foreground font-medium px-2 shrink-0">
                        Из базы документов ({itemDocs.length})
                      </span>
                      <div className="flex-1 h-px bg-border" />
                    </div>
                    {itemDocs.map(doc => {
                      const firstImg = doc.attachments.find(a => a.mimeType.startsWith('image/'));
                      return (
                        <div key={doc.id} className="border border-border rounded-xl overflow-hidden bg-card">
                          <div className="flex items-start gap-3 p-3">
                            <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                              {firstImg
                                ? <img src={firstImg.dataUrl} alt="" className="w-full h-full object-cover" />
                                : <Icon name="FileText" size={16} className="text-muted-foreground" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{doc.docType}</span>
                                {doc.docNumber && <span className="text-xs text-muted-foreground">№ {doc.docNumber}</span>}
                                {doc.docDate && <span className="text-xs text-muted-foreground">{new Date(doc.docDate).toLocaleDateString('ru-RU')}</span>}
                              </div>
                              {doc.supplier && (
                                <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Icon name="Building2" size={10} />{doc.supplier}
                                </div>
                              )}
                              {doc.notes && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.notes}</div>}
                              {doc.customFields.length > 0 && (
                                <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                  {doc.customFields.map((cf, i) => (
                                    <span key={i} className="text-xs text-muted-foreground">
                                      <span className="font-medium text-foreground">{cf.key}:</span> {cf.value}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                          {doc.attachments.length > 0 && (
                            <div className="border-t border-border/50 px-3 py-2 space-y-1.5">
                              {doc.attachments.map(att => {
                                const isImg = att.mimeType.startsWith('image/');
                                const ext = att.name.split('.').pop()?.toLowerCase() || '';
                                let iconName = 'File'; let iconColor = 'text-muted-foreground';
                                if (isImg) { iconName = 'Image'; iconColor = 'text-blue-500'; }
                                else if (att.mimeType.includes('pdf')) { iconName = 'FileText'; iconColor = 'text-red-500'; }
                                else if (att.mimeType.includes('word') || ext === 'docx' || ext === 'doc') { iconName = 'FileText'; iconColor = 'text-blue-600'; }
                                else if (att.mimeType.includes('excel') || ext === 'xlsx' || ext === 'xls') { iconName = 'Table'; iconColor = 'text-green-600'; }
                                return (
                                  <div key={att.id} className="flex items-center gap-2.5 group">
                                    <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                                      {isImg ? <img src={att.dataUrl} alt="" className="w-full h-full object-cover" /> : <Icon name={iconName} size={14} className={iconColor} />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="text-xs font-medium text-foreground truncate">{att.name}</div>
                                      <div className="text-[11px] text-muted-foreground">
                                        {att.size < 1024 ? att.size + ' Б' : att.size < 1048576 ? (att.size / 1024).toFixed(0) + ' КБ' : (att.size / 1048576).toFixed(1) + ' МБ'}
                                      </div>
                                    </div>
                                    <a href={att.dataUrl} download={att.name}
                                      className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Icon name="Download" size={12} />
                                    </a>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
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

      {quickScanType && (
        <ScannerModal
          open={!!quickScanType}
          onClose={() => setQuickScanType(null)}
          onConfirm={(codes) => handleQuickScan(codes, quickScanType)}
          title={quickScanType === 'in' ? 'Сканировать приход' : 'Сканировать расход'}
          itemBarcodes={itemBarcodes.map(b => b.code)}
        />
      )}
    </>
  );
}