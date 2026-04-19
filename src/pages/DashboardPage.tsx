import { useMemo } from "react";
import { subDays, startOfDay, isAfter, format, parseISO } from "date-fns";
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
} from "recharts";
import Icon from "@/components/ui/icon";
import { AppState } from "@/data/store";

type Props = {
  state: AppState;
};

const DAY_NAMES = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const FALLBACK_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#10b981",
  "#f59e0b",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

export default function DashboardPage({ state }: Props) {
  const now = new Date();

  // ── Summary data ──────────────────────────────────────────────────────────
  const totalItems = state.items.length;
  const totalWarehouses = state.warehouses.length;

  const lowStockItems = useMemo(
    () => state.items.filter((i) => i.quantity <= i.lowStockThreshold),
    [state.items]
  );

  const ops30d = useMemo(() => {
    const threshold = startOfDay(subDays(now, 30));
    return state.operations.filter((op) =>
      isAfter(parseISO(op.date), threshold)
    );
  }, [state.operations]);

  // ── Bar chart: last 7 days ────────────────────────────────────────────────
  const barData = useMemo(() => {
    const days: { date: Date; label: string; in: number; out: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = startOfDay(subDays(now, i));
      const dayName = DAY_NAMES[d.getDay()];
      const dateLabel = format(d, "dd.MM");
      days.push({ date: d, label: `${dayName} ${dateLabel}`, in: 0, out: 0 });
    }

    state.operations.forEach((op) => {
      const opDate = startOfDay(parseISO(op.date));
      const entry = days.find((d) => d.date.getTime() === opDate.getTime());
      if (entry) {
        if (op.type === "in") entry.in += op.quantity;
        else entry.out += op.quantity;
      }
    });

    return days.map((d) => ({
      name: d.label,
      Приход: d.in,
      Расход: d.out,
    }));
  }, [state.operations]);

  // ── Pie chart: by category ────────────────────────────────────────────────
  const pieData = useMemo(() => {
    const map = new Map<string, number>();
    state.items.forEach((item) => {
      const prev = map.get(item.categoryId) || 0;
      map.set(item.categoryId, prev + item.quantity);
    });

    const catMap = new Map(state.categories.map((c) => [c.id, c]));

    return Array.from(map.entries()).map(([catId, qty], idx) => {
      const cat = catMap.get(catId);
      return {
        name: cat?.name ?? "Без категории",
        value: qty,
        color: cat?.color || FALLBACK_COLORS[idx % FALLBACK_COLORS.length],
      };
    });
  }, [state.items, state.categories]);

  // ── Low stock table (sorted, max 10) ──────────────────────────────────────
  const lowStockTable = useMemo(() => {
    const catMap = new Map(state.categories.map((c) => [c.id, c]));
    return [...lowStockItems]
      .sort((a, b) => {
        const ratioA =
          a.lowStockThreshold > 0 ? a.quantity / a.lowStockThreshold : 0;
        const ratioB =
          b.lowStockThreshold > 0 ? b.quantity / b.lowStockThreshold : 0;
        return ratioA - ratioB;
      })
      .slice(0, 10)
      .map((item) => ({
        ...item,
        categoryName: catMap.get(item.categoryId)?.name ?? "—",
      }));
  }, [lowStockItems, state.categories]);

  // ── Recent operations (last 10) ───────────────────────────────────────────
  const recentOps = useMemo(() => {
    const itemMap = new Map(state.items.map((i) => [i.id, i]));
    return [...state.operations]
      .sort(
        (a, b) =>
          parseISO(b.date).getTime() - parseISO(a.date).getTime()
      )
      .slice(0, 10)
      .map((op) => ({
        ...op,
        itemName: itemMap.get(op.itemId)?.name ?? "Неизвестный товар",
        formattedDate: format(parseISO(op.date), "dd.MM HH:mm"),
      }));
  }, [state.operations, state.items]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Аналитика</h1>
        <p className="text-muted-foreground text-sm">
          Обзор складской системы
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
        <SummaryCard
          icon="Package"
          iconBg="bg-blue-500/10 text-blue-500"
          value={totalItems}
          label="Всего товаров"
        />
        <SummaryCard
          icon="AlertTriangle"
          iconBg="bg-red-500/10 text-red-500"
          value={lowStockItems.length}
          label="Низкий остаток"
        />
        <SummaryCard
          icon="ArrowUpDown"
          iconBg="bg-violet-500/10 text-violet-500"
          value={ops30d.length}
          label="За 30 дней"
        />
        <SummaryCard
          icon="Warehouse"
          iconBg="bg-green-500/10 text-green-500"
          value={totalWarehouses}
          label="Складов"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bar Chart */}
        <div className="bg-card rounded-xl border shadow-card p-5">
          <h3 className="font-semibold mb-4">Приход / Расход за 7 дней</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="name"
                fontSize={12}
                tickLine={false}
                axisLine={false}
              />
              <YAxis fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Bar dataKey="Приход" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Расход" fill="#ef4444" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-card rounded-xl border shadow-card p-5">
          <h3 className="font-semibold mb-4">По категориям</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                innerRadius={50}
                paddingAngle={2}
              >
                {pieData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  fontSize: 13,
                }}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                iconSize={10}
                formatter={(value: string) => (
                  <span className="text-sm text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Low Stock Table */}
        <div className="bg-card rounded-xl border shadow-card p-5">
          <h3 className="font-semibold mb-4">Товары с низким остатком</h3>
          {lowStockTable.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Icon name="CheckCircle" className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Все остатки в норме</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-0">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium">Название</th>
                    <th className="pb-2 pr-3 font-medium text-right">Кол-во</th>
                    <th className="pb-2 pr-3 font-medium text-right hidden sm:table-cell">Порог</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Категория</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockTable.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 break-words align-top max-w-[140px] sm:max-w-[220px] md:max-w-none">
                        {item.name}
                      </td>
                      <td className="py-2.5 pr-3 text-right font-bold text-red-500 whitespace-nowrap">
                        {item.quantity}
                      </td>
                      <td className="py-2.5 pr-3 text-right text-muted-foreground hidden sm:table-cell">
                        {item.lowStockThreshold}
                      </td>
                      <td className="py-2.5 text-muted-foreground truncate max-w-[120px] hidden sm:table-cell">
                        {item.categoryName}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Recent Operations Table */}
        <div className="bg-card rounded-xl border shadow-card p-5">
          <h3 className="font-semibold mb-4">Последние операции</h3>
          {recentOps.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <Icon name="Inbox" className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">Нет операций</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-0">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 pr-3 font-medium hidden sm:table-cell">Дата</th>
                    <th className="pb-2 pr-3 font-medium">Товар</th>
                    <th className="pb-2 pr-3 font-medium">Тип</th>
                    <th className="pb-2 pr-3 font-medium text-right">Кол-во</th>
                    <th className="pb-2 font-medium hidden sm:table-cell">Исполнитель</th>
                  </tr>
                </thead>
                <tbody>
                  {recentOps.map((op) => (
                    <tr key={op.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-3 whitespace-nowrap text-muted-foreground hidden sm:table-cell">
                        {op.formattedDate}
                      </td>
                      <td className="py-2.5 pr-3 break-words align-top max-w-[120px] sm:max-w-[220px] md:max-w-none">
                        {op.itemName}
                      </td>
                      <td className="py-2.5 pr-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            op.type === "in"
                              ? "bg-green-500/10 text-green-600"
                              : "bg-red-500/10 text-red-600"
                          }`}
                        >
                          {op.type === "in" ? "Приход" : "Расход"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">{op.quantity}</td>
                      <td className="py-2.5 text-muted-foreground truncate max-w-[120px] hidden sm:table-cell">
                        {op.performedBy}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Summary Card Component ────────────────────────────────────────────────────

function SummaryCard({
  icon,
  iconBg,
  value,
  label,
}: {
  icon: string;
  iconBg: string;
  value: number;
  label: string;
}) {
  return (
    <div className="bg-card rounded-xl border shadow-card p-5 flex items-start gap-4">
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-full shrink-0 ${iconBg}`}
      >
        <Icon name={icon} className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold leading-none">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{label}</p>
      </div>
    </div>
  );
}