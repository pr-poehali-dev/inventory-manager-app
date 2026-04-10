import { useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';
import { format, subDays, startOfDay, isAfter, parseISO } from 'date-fns';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

// ─── Types ───────────────────────────────────────────────────────────────────

type Props = {
  state: AppState;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PIE_COLORS = [
  '#6366f1',
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParse(dateStr: string): Date {
  try {
    return parseISO(dateStr);
  } catch {
    return new Date(dateStr);
  }
}

function formatOpDate(dateStr: string): string {
  try {
    const d = safeParse(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${mon} ${h}:${m}`;
  } catch {
    return dateStr;
  }
}

// ─── StatCard ────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  label,
  value,
  sub,
  color,
}: {
  icon: string;
  label: string;
  value: number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="bg-card rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div
          className={`w-10 h-10 rounded-lg flex items-center justify-center ${color || 'bg-primary/10 text-primary'}`}
        >
          <Icon name={icon} size={20} />
        </div>
      </div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-sm text-muted-foreground">{label}</div>
      {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function DashboardPage({ state }: Props) {
  // ── Lookup maps ──────────────────────────────────────────────────────────

  const itemMap = useMemo(
    () => new Map(state.items.map(i => [i.id, i])),
    [state.items],
  );

  const categoryMap = useMemo(
    () => new Map(state.categories.map(c => [c.id, c])),
    [state.categories],
  );

  // ── Summary cards data ───────────────────────────────────────────────────

  const lowStockItems = useMemo(
    () =>
      state.items
        .filter(i => i.quantity <= i.lowStockThreshold)
        .sort((a, b) => a.quantity - a.lowStockThreshold - (b.quantity - b.lowStockThreshold))
        .slice(0, 10),
    [state.items],
  );

  const lowStockCount = useMemo(
    () => state.items.filter(i => i.quantity <= i.lowStockThreshold).length,
    [state.items],
  );

  const recentOpsCount = useMemo(() => {
    const thirtyDaysAgo = subDays(new Date(), 30);
    return (state.operations || []).filter(op => {
      try {
        return isAfter(safeParse(op.date), thirtyDaysAgo);
      } catch {
        return false;
      }
    }).length;
  }, [state.operations]);

  // ── Bar chart: last 7 days ───────────────────────────────────────────────

  const last7 = useMemo(() => {
    const days: { date: string; in: number; out: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = subDays(new Date(), i);
      const dayStr = format(day, 'yyyy-MM-dd');
      const dayLabel = format(day, 'dd.MM');
      const dayOps = (state.operations || []).filter(o => {
        try {
          return format(safeParse(o.date), 'yyyy-MM-dd') === dayStr;
        } catch {
          return false;
        }
      });
      days.push({
        date: dayLabel,
        in: dayOps.filter(o => o.type === 'in').reduce((s, o) => s + o.quantity, 0),
        out: dayOps.filter(o => o.type === 'out').reduce((s, o) => s + o.quantity, 0),
      });
    }
    return days;
  }, [state.operations]);

  // ── Pie chart: quantity by category ──────────────────────────────────────

  const categoryData = useMemo(() => {
    const grouped = new Map<string, number>();
    state.items.forEach(item => {
      const catName = categoryMap.get(item.categoryId)?.name || 'Без категории';
      grouped.set(catName, (grouped.get(catName) || 0) + item.quantity);
    });
    return Array.from(grouped)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [state.items, state.categories]);

  // ── Last 10 operations ───────────────────────────────────────────────────

  const lastOps = useMemo(
    () =>
      [...(state.operations || [])]
        .sort((a, b) => safeParse(b.date).getTime() - safeParse(a.date).getTime())
        .slice(0, 10),
    [state.operations],
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Дашборд</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Сводная аналитика по складскому учёту
        </p>
      </div>

      {/* ── 1. Summary Cards ──────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon="Package" label="Всего товаров" value={state.items.length} />
        <StatCard
          icon="AlertTriangle"
          label="Низкий остаток"
          value={lowStockCount}
          color="bg-destructive/10 text-destructive"
        />
        <StatCard
          icon="ArrowUpDown"
          label="Операций за 30 дней"
          value={recentOpsCount}
          color="bg-blue-500/10 text-blue-500"
        />
        <StatCard
          icon="Warehouse"
          label="Активных складов"
          value={state.warehouses.length}
          color="bg-amber-500/10 text-amber-500"
        />
      </div>

      {/* ── 2. Charts Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <h3 className="font-semibold text-foreground mb-4">Приход / Расход за 7 дней</h3>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={last7}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="in" name="Приход" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="out" name="Расход" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <h3 className="font-semibold text-foreground mb-4">Остатки по категориям</h3>
          {categoryData.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              Нет данных для отображения
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={categoryData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {categoryData.map((_, idx) => (
                    <Cell key={`cell-${idx}`} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                  formatter={(value: number) => [`${value} ед.`, '']}
                />
                <Legend
                  verticalAlign="bottom"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* ── 3. Tables Row ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Items */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <h3 className="font-semibold text-foreground mb-3">Товары с низким остатком</h3>

          {lowStockItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Icon name="CheckCircle" size={28} className="text-success mb-2" />
              <p className="text-sm text-muted-foreground">Все остатки в норме</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lowStockItems.map(item => {
                const cat = categoryMap.get(item.categoryId);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-2.5 rounded-lg bg-destructive/5"
                  >
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-foreground truncate">
                        {item.name}
                      </span>
                      {cat && (
                        <span className="text-xs text-muted-foreground ml-2">{cat.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-sm font-bold text-destructive tabular-nums">
                        {item.quantity}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        / {item.lowStockThreshold}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Last 10 Operations */}
        <div className="bg-card rounded-xl border border-border shadow-card p-5">
          <h3 className="font-semibold text-foreground mb-3">Последние 10 операций</h3>

          {lastOps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Icon name="ClipboardList" size={28} className="text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">Операций пока нет</p>
            </div>
          ) : (
            <div className="space-y-2">
              {lastOps.map(op => {
                const item = itemMap.get(op.itemId);
                const isIn = op.type === 'in';
                return (
                  <div
                    key={op.id}
                    className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/40"
                  >
                    {/* Date */}
                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap w-[72px] shrink-0">
                      {formatOpDate(op.date)}
                    </span>

                    {/* Item name */}
                    <span className="text-sm font-medium text-foreground truncate flex-1 min-w-0">
                      {item?.name ?? 'Неизвестно'}
                    </span>

                    {/* Type badge */}
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0
                        ${isIn ? 'bg-success/15 text-success' : 'bg-destructive/15 text-destructive'}`}
                    >
                      <Icon name={isIn ? 'ArrowDownLeft' : 'ArrowUpRight'} size={10} />
                      {isIn ? 'Приход' : 'Расход'}
                    </span>

                    {/* Quantity */}
                    <span className="text-sm font-semibold tabular-nums text-foreground w-10 text-right shrink-0">
                      {isIn ? '+' : '-'}
                      {op.quantity}
                    </span>

                    {/* User */}
                    <span className="text-xs text-muted-foreground truncate w-24 shrink-0 hidden sm:block">
                      {op.performedBy || '\u2014'}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
