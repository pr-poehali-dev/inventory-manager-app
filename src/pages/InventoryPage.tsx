import { useState, useMemo, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, Item, Operation, generateId, crudAction } from '@/data/store';

// ─── Types ───────────────────────────────────────────────────────────────────

type InventoryEntry = {
  itemId: string;
  itemName: string;
  systemQty: number;
  actualQty: number | null;
  unit: string;
  category: string;
  categoryColor: string;
  locationName: string;
};

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function InventoryPage({ state, onStateChange }: Props) {
  const [warehouseFilter, setWarehouseFilter] = useState('all');
  const [entries, setEntries] = useState<InventoryEntry[]>([]);
  const [started, setStarted] = useState(false);
  const [search, setSearch] = useState('');
  const [showOnlyDiff, setShowOnlyDiff] = useState(false);
  const [confirmApply, setConfirmApply] = useState(false);

  // ── Lookup maps ──────────────────────────────────────────────────────────

  const categoryMap = useMemo(
    () => new Map(state.categories.map(c => [c.id, c])),
    [state.categories],
  );

  const locationMap = useMemo(
    () => new Map(state.locations.map(l => [l.id, l])),
    [state.locations],
  );

  // ── Derived data ─────────────────────────────────────────────────────────

  const warehouseName = useMemo(() => {
    if (warehouseFilter === 'all') return 'Все склады';
    return state.warehouses.find(w => w.id === warehouseFilter)?.name ?? 'Склад';
  }, [warehouseFilter, state.warehouses]);

  const filteredEntries = useMemo(() => {
    let list = entries;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e => e.itemName.toLowerCase().includes(q) || e.category.toLowerCase().includes(q),
      );
    }
    if (showOnlyDiff) {
      list = list.filter(e => e.actualQty !== null && e.actualQty !== e.systemQty);
    }
    return list;
  }, [entries, search, showOnlyDiff]);

  const progress = useMemo(() => {
    const total = entries.length;
    const counted = entries.filter(e => e.actualQty !== null).length;
    return { total, counted };
  }, [entries]);

  const summary = useMemo(() => {
    const counted = entries.filter(e => e.actualQty !== null);
    const matches = counted.filter(e => e.actualQty === e.systemQty);
    const surpluses = counted.filter(e => e.actualQty !== null && e.actualQty > e.systemQty);
    const shortages = counted.filter(e => e.actualQty !== null && e.actualQty < e.systemQty);
    const discrepancies = counted.filter(e => e.actualQty !== e.systemQty);
    return {
      total: entries.length,
      counted: counted.length,
      matches: matches.length,
      surpluses: surpluses.length,
      shortages: shortages.length,
      discrepancies,
    };
  }, [entries]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const startInventory = useCallback(() => {
    // Determine which items belong to selected warehouse
    let itemIds: Set<string>;
    if (warehouseFilter === 'all') {
      itemIds = new Set(state.items.map(i => i.id));
    } else {
      const whStocks = (state.warehouseStocks || []).filter(
        ws => ws.warehouseId === warehouseFilter && ws.quantity > 0,
      );
      itemIds = new Set(whStocks.map(ws => ws.itemId));
    }

    const filtered = state.items.filter(i => itemIds.has(i.id));

    setEntries(
      filtered.map(item => {
        const cat = categoryMap.get(item.categoryId);
        const loc = locationMap.get(item.locationId);
        return {
          itemId: item.id,
          itemName: item.name,
          systemQty: item.quantity,
          actualQty: null,
          unit: item.unit,
          category: cat?.name ?? 'Без категории',
          categoryColor: cat?.color ?? '#94a3b8',
          locationName: loc?.name ?? '',
        };
      }),
    );
    setStarted(true);
    setSearch('');
    setShowOnlyDiff(false);
  }, [warehouseFilter, state.items, state.warehouseStocks, categoryMap, locationMap]);

  const resetInventory = useCallback(() => {
    setStarted(false);
    setEntries([]);
    setSearch('');
    setShowOnlyDiff(false);
    setConfirmApply(false);
  }, []);

  const updateActualQty = useCallback((itemId: string, value: string) => {
    setEntries(prev =>
      prev.map(e =>
        e.itemId === itemId
          ? { ...e, actualQty: value === '' ? null : Math.max(0, parseInt(value) || 0) }
          : e,
      ),
    );
  }, []);

  const applyCorrections = useCallback(() => {
    let nextState = { ...state };
    const newOperations: Operation[] = [];
    const now = new Date().toISOString();

    for (const entry of entries) {
      if (entry.actualQty === null || entry.actualQty === entry.systemQty) continue;

      const diff = entry.actualQty - entry.systemQty;
      const op: Operation = {
        id: generateId(),
        itemId: entry.itemId,
        type: diff > 0 ? 'in' : 'out',
        quantity: Math.abs(diff),
        comment: diff > 0 ? '[Инвентаризация] Излишек' : '[Инвентаризация] Недостача',
        from: diff > 0 ? '' : 'Склад',
        to: diff > 0 ? 'Склад' : '',
        performedBy: state.currentUser,
        date: now,
        warehouseId: warehouseFilter !== 'all' ? warehouseFilter : undefined,
      };
      newOperations.push(op);

      // Update item quantity
      nextState = {
        ...nextState,
        items: nextState.items.map(item =>
          item.id === entry.itemId ? { ...item, quantity: entry.actualQty! } : item,
        ),
      };

      // Update warehouse stocks if specific warehouse selected
      if (warehouseFilter !== 'all') {
        const stocks = nextState.warehouseStocks || [];
        const existing = stocks.find(
          ws => ws.itemId === entry.itemId && ws.warehouseId === warehouseFilter,
        );
        if (existing) {
          nextState = {
            ...nextState,
            warehouseStocks: stocks.map(ws =>
              ws.itemId === entry.itemId && ws.warehouseId === warehouseFilter
                ? { ...ws, quantity: Math.max(0, ws.quantity + diff) }
                : ws,
            ),
          };
        }
      }
    }

    // Add all operations
    nextState = {
      ...nextState,
      operations: [...(nextState.operations || []), ...newOperations],
    };

    onStateChange(nextState);

    // Fire-and-forget crud calls
    for (const op of newOperations) {
      crudAction('add_operation', { operation: op });
    }
    for (const entry of entries) {
      if (entry.actualQty !== null && entry.actualQty !== entry.systemQty) {
        const updatedItem = nextState.items.find(i => i.id === entry.itemId);
        if (updatedItem) crudAction('upsert_item', { item: updatedItem });
      }
    }

    setConfirmApply(false);
    setStarted(false);
    setEntries([]);
  }, [entries, state, onStateChange, warehouseFilter]);

  // ── Render: Before Start ─────────────────────────────────────────────────

  if (!started) {
    return (
      <div className="space-y-5 pb-20 md:pb-0">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Инвентаризация</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Сверка фактических остатков с системными данными
          </p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6 space-y-5">
          {/* Info */}
          <div className="flex gap-3 items-start p-4 rounded-lg bg-primary/5 border border-primary/15">
            <div className="w-9 h-9 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0 mt-0.5">
              <Icon name="ClipboardCheck" size={18} />
            </div>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">Как проходит инвентаризация</p>
              <p className="text-muted-foreground leading-relaxed">
                Выберите склад, нажмите "Начать" и введите фактическое количество каждого
                товара. Система покажет расхождения. По завершении вы сможете применить
                корректировки — будут созданы операции прихода (излишки) и расхода (недостачи).
              </p>
            </div>
          </div>

          {/* Warehouse selector */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Склад</Label>
            <select
              value={warehouseFilter}
              onChange={e => setWarehouseFilter(e.target.value)}
              className="w-full h-10 px-3 pr-8 text-sm rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
            >
              <option value="all">Все склады</option>
              {state.warehouses.map(w => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </div>

          {/* Items count preview */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon name="Package" size={14} />
            <span>
              Товаров для проверки:{' '}
              <span className="font-semibold text-foreground">
                {warehouseFilter === 'all'
                  ? state.items.length
                  : new Set(
                      (state.warehouseStocks || [])
                        .filter(ws => ws.warehouseId === warehouseFilter && ws.quantity > 0)
                        .map(ws => ws.itemId),
                    ).size}
              </span>
            </span>
          </div>

          {/* Start button */}
          <Button
            onClick={startInventory}
            className="w-full h-11 text-base gap-2"
            disabled={state.items.length === 0}
          >
            <Icon name="ClipboardCheck" size={18} />
            Начать инвентаризацию
          </Button>
        </div>
      </div>
    );
  }

  // ── Render: Inventory In Progress ────────────────────────────────────────

  return (
    <div className="space-y-4 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Инвентаризация</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {warehouseName} &middot; Проверено {progress.counted} из {progress.total}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={resetInventory}
            className="gap-1.5"
          >
            <Icon name="RotateCcw" size={14} />
            Сбросить
          </Button>
          <Button
            size="sm"
            onClick={() => setConfirmApply(true)}
            disabled={summary.discrepancies.length === 0 && summary.counted === 0}
            className="gap-1.5"
          >
            <Icon name="CheckCircle" size={14} />
            Завершить
          </Button>
        </div>
      </div>

      {/* Progress bar */}
      <div className="bg-card rounded-xl border border-border shadow-card p-4">
        <div className="flex items-center justify-between text-sm mb-2">
          <span className="text-muted-foreground">Прогресс</span>
          <span className="font-semibold text-foreground tabular-nums">
            {progress.counted}/{progress.total}
          </span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{
              width: progress.total > 0 ? `${(progress.counted / progress.total) * 100}%` : '0%',
            }}
          />
        </div>
        {/* Mini stats */}
        <div className="flex gap-4 mt-3 text-xs">
          <span className="flex items-center gap-1 text-muted-foreground">
            <span className="w-2 h-2 rounded-full bg-muted-foreground/40" />
            Не проверено: {progress.total - progress.counted}
          </span>
          <span className="flex items-center gap-1 text-success">
            <span className="w-2 h-2 rounded-full bg-success" />
            Совпадает: {summary.matches}
          </span>
          <span className="flex items-center gap-1 text-primary">
            <span className="w-2 h-2 rounded-full bg-primary" />
            Излишек: {summary.surpluses}
          </span>
          <span className="flex items-center gap-1 text-destructive">
            <span className="w-2 h-2 rounded-full bg-destructive" />
            Недостача: {summary.shortages}
          </span>
        </div>
      </div>

      {/* Search and filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Icon
            name="Search"
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
          />
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
        <Button
          variant={showOnlyDiff ? 'default' : 'outline'}
          size="sm"
          onClick={() => setShowOnlyDiff(!showOnlyDiff)}
          className="gap-1.5 h-10 shrink-0"
        >
          <Icon name="AlertTriangle" size={14} />
          Только расхождения
          {summary.discrepancies.length > 0 && (
            <span className="ml-1 text-xs bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
              {summary.discrepancies.length}
            </span>
          )}
        </Button>
      </div>

      {/* Item list */}
      <div className="space-y-2">
        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
              <Icon name="PackageSearch" size={24} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-0.5">Ничего не найдено</p>
            <p className="text-xs text-muted-foreground">
              {showOnlyDiff ? 'Расхождений пока нет' : 'Попробуйте другой поисковый запрос'}
            </p>
          </div>
        ) : (
          filteredEntries.map(entry => {
            const diff =
              entry.actualQty !== null ? entry.actualQty - entry.systemQty : null;
            const isCounted = entry.actualQty !== null;
            const isMatch = isCounted && diff === 0;
            const isSurplus = isCounted && diff !== null && diff > 0;
            const isShortage = isCounted && diff !== null && diff < 0;

            let rowBg = 'bg-card';
            if (isShortage) rowBg = 'bg-destructive/5';
            if (isSurplus) rowBg = 'bg-success/5';

            return (
              <div
                key={entry.itemId}
                className={`${rowBg} rounded-xl border border-border shadow-card p-4 transition-colors`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-sm text-foreground truncate">
                        {entry.itemName}
                      </span>
                      <span
                        className="shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded-full text-white"
                        style={{ backgroundColor: entry.categoryColor }}
                      >
                        {entry.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      {entry.locationName && (
                        <span className="flex items-center gap-1">
                          <Icon name="MapPin" size={11} />
                          {entry.locationName}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Icon name="Package" size={11} />
                        Системный: {entry.systemQty} {entry.unit}
                      </span>
                    </div>
                  </div>

                  {/* Input + diff */}
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground whitespace-nowrap sr-only sm:not-sr-only">
                        Факт:
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="—"
                        value={entry.actualQty !== null ? entry.actualQty : ''}
                        onChange={e => updateActualQty(entry.itemId, e.target.value)}
                        className="w-24 h-9 text-center tabular-nums text-sm font-medium"
                      />
                      <span className="text-xs text-muted-foreground w-8">{entry.unit}</span>
                    </div>

                    {/* Difference indicator */}
                    <div className="w-16 text-center">
                      {!isCounted && (
                        <span className="text-xs text-muted-foreground/50">--</span>
                      )}
                      {isMatch && (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                          <Icon name="Check" size={13} />
                          OK
                        </span>
                      )}
                      {isSurplus && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-success tabular-nums">
                          +{diff}
                        </span>
                      )}
                      {isShortage && (
                        <span className="inline-flex items-center gap-0.5 text-xs font-bold text-destructive tabular-nums">
                          {diff}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Confirm / Apply Dialog ──────────────────────────────────────────── */}
      <Dialog open={confirmApply} onOpenChange={setConfirmApply}>
        <DialogContent className="max-w-lg animate-scale-in max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon name="ClipboardCheck" size={16} />
              </div>
              Результаты инвентаризации
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <SummaryMini label="Всего" value={summary.total} icon="Package" />
              <SummaryMini label="Проверено" value={summary.counted} icon="CheckSquare" />
              <SummaryMini
                label="Излишки"
                value={summary.surpluses}
                icon="TrendingUp"
                color="text-success"
              />
              <SummaryMini
                label="Недостачи"
                value={summary.shortages}
                icon="TrendingDown"
                color="text-destructive"
              />
            </div>

            {/* Совпадения */}
            {summary.counted > 0 && summary.discrepancies.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 text-success text-sm font-medium">
                <Icon name="CheckCircle" size={16} />
                Все проверенные позиции совпадают с системными данными.
              </div>
            )}

            {/* Discrepancies table */}
            {summary.discrepancies.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-foreground">
                  Расхождения ({summary.discrepancies.length})
                </p>
                <div className="rounded-lg border border-border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50">
                        <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">
                          Товар
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                          Система
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                          Факт
                        </th>
                        <th className="text-right px-3 py-2 text-xs font-medium text-muted-foreground">
                          Разница
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.discrepancies.map(entry => {
                        const diff = entry.actualQty! - entry.systemQty;
                        return (
                          <tr
                            key={entry.itemId}
                            className="border-t border-border hover:bg-muted/30"
                          >
                            <td className="px-3 py-2 font-medium text-foreground truncate max-w-[180px]">
                              {entry.itemName}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {entry.systemQty}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium text-foreground">
                              {entry.actualQty}
                            </td>
                            <td
                              className={`px-3 py-2 text-right tabular-nums font-bold ${
                                diff > 0 ? 'text-success' : 'text-destructive'
                              }`}
                            >
                              {diff > 0 ? `+${diff}` : diff}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setConfirmApply(false)}
              >
                Назад
              </Button>
              <Button
                className="flex-1 gap-1.5"
                onClick={applyCorrections}
                disabled={summary.discrepancies.length === 0}
              >
                <Icon name="Check" size={15} />
                Применить корректировку
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Summary Mini Card ───────────────────────────────────────────────────────

function SummaryMini({
  label,
  value,
  icon,
  color,
}: {
  label: string;
  value: number;
  icon: string;
  color?: string;
}) {
  return (
    <div className="bg-muted/50 rounded-lg p-3 text-center">
      <Icon name={icon} size={15} className={`mx-auto mb-1 ${color ?? 'text-muted-foreground'}`} />
      <div className={`text-lg font-bold tabular-nums ${color ?? 'text-foreground'}`}>{value}</div>
      <div className="text-[10px] text-muted-foreground leading-tight">{label}</div>
    </div>
  );
}
