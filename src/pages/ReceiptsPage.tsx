import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Receipt, ReceiptStatus } from '@/data/store';
import { NewReceiptModal } from './receipts/ReceiptNewModal';
import { ReceiptDetailModal } from './receipts/ReceiptDetailModal';
import { ReceiptsList } from './receipts/ReceiptsList';
import { ReceiptConfirmPage } from './receipts/ReceiptConfirmPage';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'pending', label: 'Заявки' },
  { value: 'confirming', label: 'В процессе' },
  { value: 'posted', label: 'Оприходовано' },
  { value: 'draft', label: 'Черновики' },
];

export default function ReceiptsPage({ state, onStateChange }: Props) {
  const [showCreate, setShowCreate] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<Receipt | null>(null);
  const [confirmReceipt, setConfirmReceipt] = useState<Receipt | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [supplierFilter, setSupplierFilter] = useState('all');

  const receipts = state.receipts || [];

  const filtered = useMemo(() => {
    return receipts
      .filter(r => {
        if (statusFilter !== 'all' && (r.status || 'draft') !== statusFilter) return false;
        if (supplierFilter !== 'all' && r.supplierId !== supplierFilter && r.supplierName !== supplierFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (!r.number.toLowerCase().includes(q) && !r.supplierName.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [receipts, search, statusFilter, supplierFilter]);

  const totalLines = receipts.reduce((s, r) => s + r.lines.length, 0);
  const totalAmount = receipts.reduce((s, r) => s + (r.totalAmount || r.lines.reduce((ls, l) => ls + (l.price || 0) * l.qty, 0)), 0);
  const pendingCount = receipts.filter(r => r.status === 'pending' || r.status === 'confirming').length;
  const uniqueSuppliers = new Set(receipts.map(r => r.supplierName).filter(Boolean)).size;

  // Если открыт экран подтверждения — показываем его на весь экран
  if (confirmReceipt) {
    const liveReceipt = state.receipts.find(r => r.id === confirmReceipt.id) || confirmReceipt;
    return (
      <ReceiptConfirmPage
        receipt={liveReceipt}
        state={state}
        onStateChange={onStateChange}
        onBack={() => setConfirmReceipt(null)}
        onPosted={() => setConfirmReceipt(null)}
      />
    );
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Оприходование</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {receipts.length} документов · {totalLines} позиций
            {pendingCount > 0 && (
              <span className="ml-2 font-semibold text-amber-600 dark:text-amber-400">
                · {pendingCount} требуют подтверждения
              </span>
            )}
          </p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-semibold">
          <Icon name="PackagePlus" size={16} />
          Новое оприходование
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {[
          { label: 'Документов', value: receipts.length, icon: 'FileText', color: 'text-foreground' },
          { label: 'Поставщиков', value: uniqueSuppliers, icon: 'Truck', color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Ожидают подтв.', value: pendingCount, icon: 'Clock', color: 'text-amber-600 dark:text-amber-400' },
          { label: 'Сумма', value: totalAmount > 0 ? totalAmount.toLocaleString('ru-RU') + ' ₽' : '—', icon: 'Banknote', color: 'text-success' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={16} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Pending alert */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Icon name="AlertCircle" size={16} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              {pendingCount} {pendingCount === 1 ? 'заявка ожидает' : 'заявки ожидают'} подтверждения
            </div>
            <div className="text-xs text-amber-600/80 dark:text-amber-400/80">Нажмите на документ → «Начать подтверждение»</div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-2">
        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === f.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              {f.label}
              {f.value !== 'all' && (
                <span className="ml-1 opacity-70">
                  {receipts.filter(r => (r.status || 'draft') === f.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-0 sm:min-w-44">
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
      </div>

      {/* List */}
      <ReceiptsList
        filtered={filtered}
        allCount={receipts.length}
        onSelect={r => {
          if (r.status === 'pending' || r.status === 'confirming') {
            setSelectedReceipt(r);
          } else {
            setSelectedReceipt(r);
          }
        }}
        onCreateNew={() => setShowCreate(true)}
      />

      {showCreate && (
        <NewReceiptModal
          state={state}
          onStateChange={onStateChange}
          onClose={() => setShowCreate(false)}
          onCreated={(receipt) => {
            setShowCreate(false);
            setConfirmReceipt(receipt);
          }}
        />
      )}

      {selectedReceipt && (
        <ReceiptDetailModal
          receipt={selectedReceipt}
          state={state}
          onStateChange={onStateChange}
          onClose={() => setSelectedReceipt(null)}
          onStartConfirm={(r) => {
            setSelectedReceipt(null);
            setConfirmReceipt(r);
          }}
        />
      )}
    </div>
  );
}