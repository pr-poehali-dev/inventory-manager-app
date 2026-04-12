import Icon from '@/components/ui/icon';
import { Item, Category, Location, LocationStock, Warehouse } from '@/data/store';

type Props = {
  item: Item;
  category?: Category;
  location?: Location;
  locationStocks?: { location: Location; warehouse?: Warehouse; quantity: number }[];
  onClick: () => void;
  index?: number;
};

const CATEGORY_ICONS: Record<string, string> = {
  'cat-1': 'Cpu',
  'cat-2': 'FileText',
  'cat-3': 'Wrench',
  'cat-4': 'Package',
  'cat-5': 'Box',
};

export default function ItemCard({ item, category, location, locationStocks, onClick, index = 0 }: Props) {
  const isLow = item.quantity <= item.lowStockThreshold;
  const isCritical = item.quantity === 0;
  const catColor = category?.color || '#6366f1';

  return (
    <button
      onClick={onClick}
      className="group w-full text-left bg-card rounded-xl border border-border shadow-card hover:shadow-card-hover hover:border-primary/30 transition-all duration-200 overflow-hidden animate-fade-in"
      style={{ animationDelay: `${index * 40}ms` }}
    >
      {/* Image area */}
      <div className="relative aspect-[4/3] bg-muted overflow-hidden">
        {item.imageUrl ? (
          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center gap-2" style={{ backgroundColor: catColor + '14' }}>
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: catColor + '22' }}>
              <Icon name={CATEGORY_ICONS[item.categoryId] || 'Package'} size={22} style={{ color: catColor }} />
            </div>
          </div>
        )}
        {/* Category badge */}
        {category && (
          <div className="absolute top-2 left-2">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: catColor + '20', color: catColor }}>
              {category.name}
            </span>
          </div>
        )}
        {/* Low stock badge */}
        {isLow && (
          <div className={`absolute top-2 right-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold
            ${isCritical ? 'bg-destructive text-destructive-foreground' : 'bg-warning/90 text-warning-foreground'}`}>
            <Icon name="AlertTriangle" size={10} />
            {isCritical ? 'Нет' : 'Мало'}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-3.5">
        <h3 className="font-semibold text-sm leading-snug mb-1.5 text-foreground line-clamp-2">{item.name}</h3>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 text-xs text-muted-foreground min-w-0 flex-1 mr-2">
            <Icon name="MapPin" size={11} className="shrink-0" />
            {locationStocks && locationStocks.length > 0 ? (
              <span className="truncate" title={locationStocks.map(ls => `${ls.warehouse?.name ? ls.warehouse.name + ' → ' : ''}${ls.location.name}: ${ls.quantity}`).join(', ')}>
                {locationStocks.length === 1
                  ? (locationStocks[0].warehouse ? `${locationStocks[0].warehouse.name} → ${locationStocks[0].location.name}` : locationStocks[0].location.name)
                  : `${locationStocks.length} локаций`
                }
              </span>
            ) : (
              <span className="truncate">{location?.name || '—'}</span>
            )}
          </div>
          <div className={`flex items-center gap-1 font-bold text-sm shrink-0
            ${isCritical ? 'text-destructive' : isLow ? 'text-warning' : 'text-foreground'}`}>
            <span className="tabular-nums">{item.quantity}</span>
            <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
          </div>
        </div>
      </div>
    </button>
  );
}