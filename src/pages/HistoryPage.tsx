import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Receipt } from '@/data/store';

type Props = {
  state: AppState;
};

export default function HistoryPage({ state }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'in' | 'out'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [tab, setTab] = useState<'ops' | 'receipts'>('ops');

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
  }, [state.operations, itemMap, categoryMap, search, typeFilter, dateFrom, dateTo, categoryFilter]);

  const receipts: Receipt[] = useMemo(() =>
    [...(state.receipts || [])].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [state.receipts]
  );

  const totalIn = enriched.filter(o => o.type === 'in').reduce((s, o) => s + o.quantity, 0);
  const totalOut = enriched.filter(o => o.type === 'out').reduce((s, o) => s + o.quantity, 0);

  const activeFilters = [typeFilter !== 'all', dateFrom !== '', dateTo !== '', categoryFilter !== 'all', search !== ''].filter(Boolean).length;

  const resetFilters = () => {
    setSearch(''); setTypeFilter('all'); setDateFrom(''); setDateTo(''); setCategoryFilter('all');
  };

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">История</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {(state.operations || []).length} операций · {(state.receipts || []).length} оприходований
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
        <button onClick={() => setTab('ops')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all
            ${tab === 'ops' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Icon name="ClipboardList" size={14} />
          Операции
          <span className="ml-1 text-xs text-muted-foreground">({(state.operations || []).length})</span>
        </button>
        <button onClick={() => setTab('receipts')}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all
            ${tab === 'receipts' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
          <Icon name="PackagePlus" size={14} />
          Оприходование
          <span className="ml-1 text-xs text-muted-foreground">({(state.receipts || []).length})</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <div className="text-2xl font-bold text-foreground tabular-nums">{tab === 'ops' ? enriched.length : receipts.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{tab === 'ops' ? 'Всего операций' : 'Документов'}</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
          <div className="text-2xl font-bold text-success tabular-nums">+{totalIn}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Единиц принято</div>
        </div>
        <div className="bg-card rounded-xl border border-border p-4 shadow-card">
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

          {activeFilters > 0 && (
            <button onClick={resetFilters} className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5">
              <Icon name="X" size={13} />
              Сбросить ({activeFilters})
            </button>
          )}
        </div>

        {/* Search + dates */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input placeholder="Поиск по названию, комментарию..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="h-9 text-sm w-36" />
            <span className="text-muted-foreground text-sm">—</span>
            <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="h-9 text-sm w-36" />
          </div>
        </div>
      </div>

      {/* Receipts tab */}
      {tab === 'receipts' && (
        receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <Icon name="PackagePlus" size={28} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold mb-1">Оприходований нет</h3>
            <p className="text-sm text-muted-foreground">Создайте первое оприходование во вкладке «Оприходование»</p>
          </div>
        ) : (
          <div className="space-y-2">
            {receipts.map((r, idx) => {
              const totalQty = r.lines.reduce((s, l) => s + l.qty, 0);
              const totalAmt = r.totalAmount || r.lines.reduce((s, l) => s + (l.price || 0) * l.qty, 0);
              const newCount = r.lines.filter(l => l.isNew).length;
              return (
                <div key={r.id} className="bg-card rounded-xl border border-border p-4 shadow-card animate-fade-in" style={{ animationDelay: `${idx * 20}ms` }}>
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-success/12 text-success flex items-center justify-center shrink-0">
                      <Icon name="FileText" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm">{r.number}</span>
                        {newCount > 0 && (
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-primary/12 text-primary">+{newCount} новых</span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                        <Icon name="Truck" size={10} />
                        <span className="font-medium text-foreground">{r.supplierName || '—'}</span>
                        <span>·</span>
                        <span>{new Date(r.date).toLocaleDateString('ru-RU')}</span>
                      </div>
                      {r.customFields.length > 0 && (
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                          {r.customFields.slice(0, 3).map((f, i) => (
                            <span key={i} className="text-[11px] text-muted-foreground">
                              {f.key}: <b className="text-foreground">{f.value || '—'}</b>
                            </span>
                          ))}
                        </div>
                      )}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                        <span>{r.lines.length} поз.</span>
                        <span className="text-success font-medium">+{totalQty} ед.</span>
                        {totalAmt > 0 && <span>{totalAmt.toLocaleString('ru-RU')} ₽</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Table / list (ops tab) */}
      {tab === 'ops' && enriched.length === 0 ? (
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
      ) : tab === 'ops' && (
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
