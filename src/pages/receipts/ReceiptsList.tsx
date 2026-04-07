import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Receipt, ReceiptStatus } from '@/data/store';

const STATUS_CONFIG: Record<ReceiptStatus, { label: string; color: string; bg: string; icon: string }> = {
  draft:       { label: 'Черновик',              color: 'text-muted-foreground', bg: 'bg-muted',          icon: 'FileEdit' },
  pending:     { label: 'Заявка на сборку',      color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/12', icon: 'Clock' },
  confirming:  { label: 'В процессе подтверждения', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/12',  icon: 'ScanLine' },
  posted:      { label: 'Оприходовано',          color: 'text-success',          bg: 'bg-success/12',     icon: 'CheckCircle2' },
};

export function getReceiptProgress(receipt: Receipt) {
  const total = receipt.lines.reduce((s, l) => s + l.qty, 0);
  const confirmed = receipt.lines.reduce((s, l) => s + (l.confirmedQty || 0), 0);
  return { total, confirmed, pct: total > 0 ? Math.round((confirmed / total) * 100) : 0 };
}

export function ReceiptsList({ filtered, allCount, onSelect, onCreateNew }: {
  filtered: Receipt[];
  allCount: number;
  onSelect: (r: Receipt) => void;
  onCreateNew: () => void;
}) {
  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
        <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon name="PackagePlus" size={28} className="text-muted-foreground" />
        </div>
        <h3 className="text-base font-semibold mb-1">
          {allCount === 0 ? 'Документов оприходования нет' : 'Ничего не найдено'}
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          {allCount === 0 ? 'Создайте первое оприходование товаров' : 'Попробуйте изменить фильтры'}
        </p>
        {allCount === 0 && (
          <Button onClick={onCreateNew} className="bg-success hover:bg-success/90 text-success-foreground">
            <Icon name="Plus" size={14} className="mr-1.5" />
            Новое оприходование
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filtered.map((receipt, idx) => {
        const cfg = STATUS_CONFIG[receipt.status || 'draft'];
        const lineTotal = receipt.totalAmount || receipt.lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
        const newCount = receipt.lines.filter(l => l.isNew).length;
        const { total, confirmed, pct } = getReceiptProgress(receipt);
        const needsAction = receipt.status === 'pending' || receipt.status === 'confirming';

        return (
          <button
            key={receipt.id}
            onClick={() => onSelect(receipt)}
            className="w-full text-left bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary/30 p-4 transition-all group animate-fade-in"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${cfg.bg} ${cfg.color} flex items-center justify-center shrink-0 mt-0.5`}>
                <Icon name={cfg.icon} size={18} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground group-hover:text-primary transition-colors">{receipt.number}</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                    {cfg.label}
                  </span>
                  {newCount > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/12 text-primary flex items-center gap-1">
                      <Icon name="Sparkles" size={9} />+{newCount} новых
                    </span>
                  )}
                  {needsAction && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-destructive/10 text-destructive animate-pulse">
                      Требует действия
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <Icon name="Truck" size={12} />
                  <span className="font-medium text-foreground">{receipt.supplierName}</span>
                </div>

                {/* Progress bar for confirming/pending */}
                {(receipt.status === 'confirming' || receipt.status === 'pending') && total > 0 && (
                  <div className="mt-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span>Просканировано {confirmed} из {total} ед.</span>
                      <span className="font-semibold">{pct}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{new Date(receipt.date).toLocaleDateString('ru-RU')}</span>
                  <span>{receipt.lines.length} поз.</span>
                  {receipt.status === 'posted' && <span className="text-success font-medium">+{total} ед.</span>}
                  {lineTotal > 0 && <span>{lineTotal.toLocaleString('ru-RU')} ₽</span>}
                </div>
              </div>

              <div className="flex flex-col items-end gap-1 shrink-0">
                <Icon name="ChevronRight" size={16} className="text-muted-foreground group-hover:text-primary mt-2 transition-colors" />
                {needsAction && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${cfg.bg} ${cfg.color}`}>
                    {receipt.status === 'pending' ? 'Шаг 2' : 'Идёт...'}
                  </span>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
