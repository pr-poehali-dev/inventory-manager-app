import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Item, AppState, Barcode, crudAction, generateId, getItemBarcodes } from '@/data/store';
import ScannerModal, { ScannedCode } from './ScannerModal';

export function BarcodesSection({ item, state, onStateChange }: {
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
    const newBarcode = {
      id: generateId(), itemId: item.id, code, format: 'manual',
      label: newLabel.trim() || undefined, createdAt: new Date().toISOString(),
    };
    const next: AppState = {
      ...state,
      barcodes: [...(state.barcodes || []), newBarcode],
    };
    onStateChange(next);
    crudAction('upsert_barcode', { barcode: newBarcode });
    setNewCode(''); setNewLabel(''); setAdding(false);
  };

  const handleRemove = (id: string) => {
    const next: AppState = { ...state, barcodes: (state.barcodes || []).filter(b => b.id !== id) };
    onStateChange(next);
    crudAction('delete_barcode', { barcodeId: id });
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
    if (next !== state) {
      onStateChange(next);
      const newBarcodes = (next.barcodes || []).filter(b => !(state.barcodes || []).some(ob => ob.id === b.id));
      for (const bc of newBarcodes) {
        crudAction('upsert_barcode', { barcode: bc });
      }
    }
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