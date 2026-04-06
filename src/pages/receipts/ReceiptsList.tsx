import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Receipt } from '@/data/store';

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
        const lineTotal = receipt.totalAmount || receipt.lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
        const newCount = receipt.lines.filter(l => l.isNew).length;
        const totalQty = receipt.lines.reduce((s, l) => s + l.qty, 0);

        return (
          <button
            key={receipt.id}
            onClick={() => onSelect(receipt)}
            className="w-full text-left bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-success/40 p-4 transition-all group animate-fade-in"
            style={{ animationDelay: `${idx * 30}ms` }}
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/12 text-success flex items-center justify-center shrink-0 mt-0.5">
                <Icon name="FileText" size={18} />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm text-foreground group-hover:text-success transition-colors">{receipt.number}</span>
                  {newCount > 0 && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/12 text-primary flex items-center gap-1">
                      <Icon name="Sparkles" size={9} />+{newCount} новых
                    </span>
                  )}
                  {receipt.customFields.length > 0 && (
                    <span className="text-[11px] text-muted-foreground">{receipt.customFields.length} полей</span>
                  )}
                </div>

                <div className="flex items-center gap-1 text-sm text-muted-foreground mt-0.5">
                  <Icon name="Truck" size={12} />
                  <span className="font-medium text-foreground">{receipt.supplierName}</span>
                </div>

                {receipt.customFields.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    {receipt.customFields.slice(0, 3).map((f, i) => (
                      <span key={i} className="text-[11px] text-muted-foreground">
                        {f.key}: <b className="text-foreground">{f.value || '—'}</b>
                      </span>
                    ))}
                    {receipt.customFields.length > 3 && (
                      <span className="text-[11px] text-muted-foreground">+{receipt.customFields.length - 3}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{new Date(receipt.date).toLocaleDateString('ru-RU')}</span>
                  <span>{receipt.lines.length} поз.</span>
                  <span className="text-success font-medium">+{totalQty} ед.</span>
                  {lineTotal > 0 && <span>{lineTotal.toLocaleString('ru-RU')} ₽</span>}
                </div>
              </div>

              <Icon name="ChevronRight" size={16} className="text-muted-foreground group-hover:text-success shrink-0 mt-2 transition-colors" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
