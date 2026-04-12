import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';
import { exportOperationsToExcel } from '@/utils/exportExcel';

type Props = {
  state: AppState;
};

export default function HistoryPage({ state }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [warehouseFilter, setWarehouseFilter] = useState('all');

  // Pre-build item map for O(1) lookup instead of nested finds
  const itemMap = useMemo(() => new Map(state.items.map(i => [i.id, i])), [state.items]);
  const categoryMap = useMemo(() => new Map(state.categories.map(c => [c.id, c])), [state.categories]);

  const enriched = useMemo(() => {
    return (state.operations || [])
      .map(op => {
        const item = itemMap.get(op.itemId);
        const category = item ? categoryMap.get(item.categoryId) : undefined;
        return { ...op, item, category };
      })
      .filter(op => {
        if (typeFilter !== 'all' && op.type !== typeFilter) return false;
        if (warehouseFilter !== 'all' && op.warehouseId !== warehouseFilter) return false;
        if (search.trim()) {
          const q = search.toLowerCase();
          if (
            !op.item?.name.toLowerCase().includes(q) &&
            !op.comment?.toLowerCase().includes(q) &&
            !op.from?.toLowerCase().includes(q) &&
            !op.to?.toLowerCase().includes(q)
          ) return false;
        }
        if (categoryFilter !== 'all' && op.item?.categoryId !== categoryFilter) return false;
        const opDate = new Date(op.date);
        if (dateFrom && opDate < new Date(dateFrom)) return false;
        if (dateTo && opDate > new Date(dateTo + 'T23:59:59')) return false;
        return true;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [state.operations, itemMap, categoryMap, search, typeFilter, dateFrom, dateTo, categoryFilter, warehouseFilter]);

  const totalIn = enriched.filter(o => o.type === 'in').reduce((s, o) => s + o.quantity, 0);
  const totalOut = enriched.filter(o => o.type === 'out').reduce((s, o) => s + o.quantity, 0);

  const activeFilters = [typeFilter !== 'all', dateFrom !== '', dateTo !== '', categoryFilter !== 'all', search !== '', warehouseFilter !== 'all'].filter(Boolean).length;

  const resetFilters = () => {
    setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setCategoryFilter('all'); setWarehouseFilter('all');
  };

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">История операций</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(state.operations || []).length} операций · все приходы и расходы
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => {
          const itemMap = new Map(state.items.map(i => [i.id, i.name]));
          exportOperationsToExcel(state.operations.map(op => ({
            date: new Date(op.date).toLocaleString('ru'),
            item: itemMap.get(op.itemId) || op.itemId,
            type: op.type === 'in' ? 'Приход' : 'Расход',
            quantity: op.quantity,
            from: op.from || '',
            to: op.to || '',
            performedBy: op.performedBy,
            comment: op.comment,
          })));
        }}>
          <Icon name="Download" size={14} className="mr-1.5" />Excel
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <div className="text-2xl font-bold text-foreground tabular-nums">{enriched.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Всего операций</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <div className="text-2xl font-bold text-success tabular-nums">+{totalIn}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Единиц принято</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card col-span-2 sm:col-span-1">
          <div className="text-2xl font-bold text-destructive tabular-nums">-{totalOut}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Единиц выдано</div>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Type filter */}
          <div className="flex gap-1 p-1 bg-muted rounded-lg">
            {(['all', 'in', 'out'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all
                  ${typeFilter === t ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}
              >
                {t === 'all' ? 'Все' : t === 'in' ? '↓ Приход' : '↑ Расход'}
              </button>
            ))}
          </div>

          {/* Category filter */}
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="all">Все категории</option>
            {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          {/* Warehouse filter */}
          {(state.warehouses || []).length > 1 && (
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="all">Все склады</option>
              {(state.warehouses || []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          )}

          {activeFilters > 0 && (
            <button onClick={resetFilters} className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5">
              <Icon name="X" size={13} />
              Сбросить ({activeFilters})
            </button>
          )}
        </div>

        {/* Search + dates */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-0 sm:min-w-48">
            <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input placeholder="Поиск по названию, комментарию..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm flex-1 sm:w-36 sm:flex-none" />
            <span className="text-muted-foreground text-sm">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm flex-1 sm:w-36 sm:flex-none" />
          </div>
        </div>
      </div>

      {/* Table / list */}
      {enriched.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon name="ClipboardList" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold mb-1">
            {(state.operations || []).length === 0 ? 'История пуста' : 'Операций не найдено'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {(state.operations || []).length === 0
              ? 'Операции появятся здесь после оприходования и выдачи товаров'
              : 'Попробуйте изменить или сбросить фильтры'}
          </p>
          {activeFilters > 0 && (
            <button onClick={resetFilters} className="mt-3 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors">
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block bg-card rounded-xl border border-border shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Дата</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Тип</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Товар</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Кол-во</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Комментарий</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">От / Кому</th>
                </tr>
              </thead>
              <tbody>
                {enriched.map((op, idx) => (
                  <tr key={op.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors animate-fade-in`} style={{ animationDelay: `${idx * 20}ms` }}>
                    <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                      {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                      <div className="text-xs opacity-60">{new Date(op.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-semibold
                        ${op.type === 'in' ? 'bg-success/12 text-success' : 'bg-destructive/12 text-destructive'}`}>
                        <Icon name={op.type === 'in' ? 'ArrowDownToLine' : 'ArrowUpFromLine'} size={10} />
                        {op.type === 'in' ? 'Приход' : 'Расход'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">{op.item?.name || 'Неизвестно'}</div>
                      {op.category && (
                        <div className="text-xs mt-0.5" style={{ color: op.category.color }}>{op.category.name}</div>
                      )}
                    </td>
                    <td className={`px-4 py-3 text-right font-bold tabular-nums ${op.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                      {op.type === 'in' ? '+' : '-'}{op.quantity}
                      <span className="text-xs font-normal text-muted-foreground ml-1">{op.item?.unit}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[200px]">
                      <span className="line-clamp-1">{op.comment || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {op.from && <div className="text-xs">← {op.from}</div>}
                      {op.to && <div className="text-xs">→ {op.to}</div>}
                      {!op.from && !op.to && <span>—</span>}
                      {op.warehouseId && (() => {
                        const wh = (state.warehouses || []).find(w => w.id === op.warehouseId);
                        return wh ? <div className="text-xs mt-0.5 flex items-center gap-0.5 text-primary/70"><Icon name="Warehouse" size={9} />{wh.name}</div> : null;
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {enriched.map((op, idx) => (
              <div key={op.id} className="bg-card rounded-xl border border-border p-3.5 shadow-card animate-fade-in" style={{ animationDelay: `${idx * 20}ms` }}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0
                      ${op.type === 'in' ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}>
                      <Icon name={op.type === 'in' ? 'ArrowDownToLine' : 'ArrowUpFromLine'} size={14} />
                    </div>
                    <div>
                      <div className="font-semibold text-sm text-foreground">{op.item?.name || 'Неизвестно'}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(op.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' })} · {new Date(op.date).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <span className={`font-bold text-base tabular-nums shrink-0 ${op.type === 'in' ? 'text-success' : 'text-destructive'}`}>
                    {op.type === 'in' ? '+' : '-'}{op.quantity} {op.item?.unit}
                  </span>
                </div>
                {(op.comment || op.from || op.to) && (
                  <div className="mt-2 pl-10 space-y-0.5 text-xs text-muted-foreground">
                    {op.comment && <div>{op.comment}</div>}
                    {(op.from || op.to) && <div>{op.from && `← ${op.from}`}{op.from && op.to ? ' · ' : ''}{op.to && `→ ${op.to}`}</div>}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}