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
};

type SortKey = 'name' | 'quantity_asc' | 'quantity_desc' | 'date';

export default function CatalogPage({ state, onStateChange }: Props) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

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
    <div className="space-y-5 pb-20 md:pb-0">
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
