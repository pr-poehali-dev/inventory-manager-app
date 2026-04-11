import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { AppState, getItemBarcodes, Item } from '@/data/store';
import { getNoun } from './LabelConfig';

type Props = {
  state: AppState;
  filteredItems: Item[];
  selectedIds: Set<string>;
  search: string;
  copies: number;
  categoryMap: Map<string, { id: string; name: string; color: string }>;
  onSearchChange: (value: string) => void;
  onToggleItem: (id: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
};

export default function ItemSelectionPanel({
  state,
  filteredItems,
  selectedIds,
  search,
  copies,
  categoryMap,
  onSearchChange,
  onToggleItem,
  onSelectAll,
  onDeselectAll,
}: Props) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1">
          <Icon
            name="Search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
          <Input
            placeholder="Поиск товаров..."
            value={search}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
          {search && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={onSelectAll} className="text-xs h-8">
            Выбрать все
          </Button>
          <Button variant="outline" size="sm" onClick={onDeselectAll} className="text-xs h-8">
            Снять все
          </Button>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="px-4 py-2 bg-primary/5 border-b border-primary/15 text-xs font-medium text-primary flex items-center gap-1.5">
          <Icon name="CheckSquare" size={13} />
          Выбрано: {selectedIds.size} {getNoun(selectedIds.size, 'товар', 'товара', 'товаров')}
          {copies > 1 && (
            <span className="text-muted-foreground font-normal">
              &middot; {selectedIds.size * copies} этикеток
            </span>
          )}
        </div>
      )}

      <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
        {filteredItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Icon name="PackageSearch" size={22} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-0.5">Товары не найдены</p>
            <p className="text-xs text-muted-foreground">Попробуйте другой запрос</p>
          </div>
        ) : (
          filteredItems.map(item => {
            const isSelected = selectedIds.has(item.id);
            const barcodes = getItemBarcodes(state, item.id);
            const cat = categoryMap.get(item.categoryId);

            return (
              <label
                key={item.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40
                  ${isSelected ? 'bg-primary/5' : ''}`}
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => onToggleItem(item.id)}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {item.name}
                    </span>
                    {cat && (
                      <span
                        className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: cat.color }}
                      >
                        {cat.name}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span>
                      {item.quantity} {item.unit}
                    </span>
                    {barcodes.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Icon name="Barcode" size={11} />
                        {barcodes[0].code}
                      </span>
                    )}
                    {barcodes.length === 0 && (
                      <span className="flex items-center gap-1 text-muted-foreground/50">
                        <Icon name="Barcode" size={11} />
                        ID: {item.id}
                      </span>
                    )}
                  </div>
                </div>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
