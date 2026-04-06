import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';
import ItemCard from '@/components/ItemCard';
import ItemDetailModal from '@/components/ItemDetailModal';

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
  initialItemId?: string | null;
};

type SortKey = 'name' | 'quantity_asc' | 'quantity_desc' | 'date';

export default function CatalogPage({ state, onStateChange, initialItemId }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(initialItemId ?? null);

  const filtered = useMemo(() => {
    let items = [...state.items];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    if (categoryFilter !== 'all') items = items.filter(i => i.categoryId === categoryFilter);
    if (locationFilter !== 'all') items = items.filter(i => i.locationId === locationFilter);
    if (showLowOnly) items = items.filter(i => i.quantity <= i.lowStockThreshold);

    items.sort((a, b) => {
      if (sortKey === 'name') return a.name.localeCompare(b.name, 'ru');
      if (sortKey === 'quantity_asc') return a.quantity - b.quantity;
      if (sortKey === 'quantity_desc') return b.quantity - a.quantity;
      if (sortKey === 'date') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      return 0;
    });
    return items;
  }, [state.items, search, categoryFilter, locationFilter, sortKey, showLowOnly]);

  const selectedItem = selectedItemId ? state.items.find(i => i.id === selectedItemId) || null : null;

  const lowCount = state.items.filter(i => i.quantity <= i.lowStockThreshold).length;

  const activeFilters = [
    categoryFilter !== 'all',
    locationFilter !== 'all',
    showLowOnly,
  ].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-20 md:pb-0 relative">

      {/* Floating boxes background */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden style={{ zIndex: -1 }}>
        {[
          { size: 52, x: 5,  y: 8,  delay: 0,   dur: 7.0, rot: 18  },
          { size: 30, x: 82, y: 5,  delay: 1.2, dur: 5.8, rot: -22 },
          { size: 64, x: 90, y: 50, delay: 0.5, dur: 8.2, rot: 32  },
          { size: 22, x: 50, y: 75, delay: 2.1, dur: 5.0, rot: -12 },
          { size: 40, x: 15, y: 62, delay: 0.9, dur: 7.4, rot: 25  },
          { size: 26, x: 68, y: 15, delay: 1.7, dur: 6.1, rot: -38 },
          { size: 72, x: 38, y: 35, delay: 0.3, dur: 9.0, rot: 10  },
          { size: 20, x: 93, y: 25, delay: 2.6, dur: 5.3, rot: 48  },
          { size: 34, x: 25, y: 88, delay: 1.4, dur: 7.6, rot: -20 },
          { size: 18, x: 75, y: 85, delay: 0.7, dur: 4.7, rot: 30  },
          { size: 44, x: 55, y: 45, delay: 1.9, dur: 6.5, rot: -5  },
          { size: 28, x: 3,  y: 45, delay: 0.1, dur: 8.8, rot: 42  },
        ].map((b, i) => (
          <div key={i} className="absolute" style={{
            left: `${b.x}%`, top: `${b.y}%`,
            width: b.size, height: b.size,
            animation: `catalogFloat ${b.dur}s ease-in-out ${b.delay}s infinite`,
            rotate: `${b.rot}deg`,
          }}>
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width={b.size} height={b.size} opacity="0.07">
              <rect x="8" y="18" width="24" height="18" rx="2" fill="#6366f1" />
              <path d="M8 18 L20 10 L32 18 L20 26 Z" fill="#818cf8" />
              <path d="M32 18 L32 36 L20 32 L20 26 Z" fill="#4f46e5" />
              <line x1="8" y1="27" x2="32" y2="27" stroke="white" strokeWidth="1.2" strokeOpacity="0.5" />
              <line x1="20" y1="18" x2="20" y2="36" stroke="white" strokeWidth="1.2" strokeOpacity="0.5" />
            </svg>
          </div>
        ))}
        <style>{`
          @keyframes catalogFloat {
            0%   { translate: 0 0px;   }
            50%  { translate: 0 -16px; }
            100% { translate: 0 0px;   }
          }
        `}</style>
      </div>
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Каталог товаров</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{state.items.length} позиций на складе</p>
        </div>
        {lowCount > 0 && (
          <button
            onClick={() => setShowLowOnly(!showLowOnly)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all
              ${showLowOnly ? 'bg-destructive text-destructive-foreground' : 'bg-destructive/10 text-destructive hover:bg-destructive/20'}`}
          >
            <Icon name="AlertTriangle" size={13} />
            {lowCount} мало
          </button>
        )}
      </div>

      {/* Search + filters */}
      <div className="space-y-3">
        <div className="relative">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Поиск товаров..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-10"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <Icon name="X" size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="all">Все категории</option>
            {state.categories.map(c => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

          {/* Location filter */}
          <select
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="all">Все локации</option>
            {state.locations.map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>

          {/* Sort */}
          <select
            value={sortKey}
            onChange={e => setSortKey(e.target.value as SortKey)}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="name">По названию</option>
            <option value="quantity_asc">Остаток: по возрастанию</option>
            <option value="quantity_desc">Остаток: по убыванию</option>
            <option value="date">По дате добавления</option>
          </select>

          {/* Reset filters */}
          {activeFilters > 0 && (
            <button
              onClick={() => { setCategoryFilter('all'); setLocationFilter('all'); setShowLowOnly(false); }}
              className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors"
            >
              <Icon name="X" size={13} />
              Сбросить ({activeFilters})
            </button>
          )}
        </div>
      </div>

      {/* Category pills */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-none">
        <button
          onClick={() => setCategoryFilter('all')}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
            ${categoryFilter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
        >
          Все
        </button>
        {state.categories.map(c => {
          const count = state.items.filter(i => i.categoryId === c.id).length;
          return (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(categoryFilter === c.id ? 'all' : c.id)}
              className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all
                ${categoryFilter === c.id ? 'text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}
              style={categoryFilter === c.id ? { backgroundColor: c.color } : {}}
            >
              {c.name}
              <span className={`text-[10px] px-1 rounded-full ${categoryFilter === c.id ? 'bg-white/20' : 'bg-muted-foreground/20'}`}>{count}</span>
            </button>
          );
        })}
      </div>

      {/* Results */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon name="PackageSearch" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Товары не найдены</h3>
          <p className="text-sm text-muted-foreground max-w-xs">Попробуйте изменить поиск или сбросить фильтры</p>
          <button
            onClick={() => { setSearch(''); setCategoryFilter('all'); setLocationFilter('all'); setShowLowOnly(false); }}
            className="mt-4 text-sm text-primary hover:underline"
          >
            Сбросить всё
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map((item, idx) => (
            <ItemCard
              key={item.id}
              item={item}
              category={state.categories.find(c => c.id === item.categoryId)}
              location={state.locations.find(l => l.id === item.locationId)}
              onClick={() => setSelectedItemId(item.id)}
              index={idx}
            />
          ))}
        </div>
      )}

      <ItemDetailModal
        item={selectedItem}
        state={state}
        onStateChange={onStateChange}
        onClose={() => setSelectedItemId(null)}
      />
    </div>
  );
}