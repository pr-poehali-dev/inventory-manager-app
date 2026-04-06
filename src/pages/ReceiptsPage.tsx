import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Receipt } from '@/data/store';
import { NewReceiptModal } from './receipts/ReceiptNewModal';
import { ReceiptDetailModal } from './receipts/ReceiptDetailModal';
import { ReceiptsList } from './receipts/ReceiptsList';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

export default function ReceiptsPage({ state, onStateChange }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [search, setSearch] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const receipts = state.receipts || [];

  const filtered = useMemo(() => {
    return receipts
      .filter(r => {
        if (supplierFilter !== 'all' && r.supplierId !== supplierFilter && r.supplierName !== supplierFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!r.number.toLowerCase().includes(q) && !r.supplierName.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [receipts, search, supplierFilter]);

  const totalLines = receipts.reduce((s, r) => s + r.lines.length, 0);
  const totalAmount = receipts.reduce((s, r) => s + (r.totalAmount || r.lines.reduce((ls, l) => ls + (l.price || 0) * l.qty, 0)), 0);
  const newItemsCount = receipts.reduce((s, r) => s + r.lines.filter(l => l.isNew).length, 0);
  const uniqueSuppliers = new Set(receipts.map(r => r.supplierName).filter(Boolean)).size;

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Оприходование</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {receipts.length} документов · {totalLines} позиций
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-success hover:bg-success/90 text-success-foreground font-semibold">
          <Icon name="PackagePlus" size={16} />
          Новое оприходование
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Документов', value: receipts.length, icon: 'FileText', color: 'text-foreground' },
          { label: 'Поставщиков', value: uniqueSuppliers, icon: 'Truck', color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Новых товаров', value: newItemsCount, icon: 'Sparkles', color: 'text-primary' },
          { label: 'Сумма', value: totalAmount > 0 ? totalAmount.toLocaleString('ru-RU') + ' ₽' : '—', icon: 'Banknote', color: 'text-success' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={16} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-44">
          <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Поиск по номеру, поставщику..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><Icon name="X" size={13} /></button>}
        </div>
        <select
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
          className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
        >
          <option value="all">Все поставщики</option>
          {[...new Set(receipts.map(r => r.supplierName).filter(Boolean))].map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {/* List */}
      <ReceiptsList
        filtered={filtered}
        allCount={receipts.length}
        onSelect={setSelectedReceipt}
        onCreateNew={() => setShowCreate(true)}
      />

      {showCreate && (
        <NewReceiptModal state={state} onStateChange={onStateChange} onClose={() => setShowCreate(false)} />
      )}

      {selectedReceipt && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          state={state}
          onClose={() => setSelectedReceipt(null)}
        />
      )}
    </div>
  );
}
