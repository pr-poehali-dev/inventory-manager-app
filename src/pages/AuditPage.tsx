import { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';
import { format, isAfter, subDays, parseISO } from 'date-fns';

// ─── Types ───────────────────────────────────────────────────────────────────

type AuditEventType =
  | 'operation_in'
  | 'operation_out'
  | 'order_created'
  | 'order_completed'
  | 'receipt_created'
  | 'receipt_posted'
  | 'doc_created';

type AuditEvent = {
  id: string;
  date: string;
  type: AuditEventType;
  user: string;
  description: string;
  details?: string;
  icon: string;
  color: string;
};

type Props = {
  state: AppState;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const PAGE_SIZE = 100;

const TYPE_LABELS: Record<AuditEventType, string> = {
  operation_in: 'Приход',
  operation_out: 'Расход',
  order_created: 'Заявка создана',
  order_completed: 'Заявка выполнена',
  receipt_created: 'Приёмка создана',
  receipt_posted: 'Приёмка проведена',
  doc_created: 'Документ',
};

const TYPE_FILTER_OPTIONS: { value: 'all' | AuditEventType; label: string }[] = [
  { value: 'all', label: 'Все типы' },
  { value: 'operation_in', label: 'Приход' },
  { value: 'operation_out', label: 'Расход' },
  { value: 'order_created', label: 'Заявки (создание)' },
  { value: 'order_completed', label: 'Заявки (выполнение)' },
  { value: 'receipt_created', label: 'Приёмки (создание)' },
  { value: 'receipt_posted', label: 'Приёмки (проведение)' },
  { value: 'doc_created', label: 'Документы' },
];

const RU_MONTHS = [
  'январь', 'февраль', 'март', 'апрель', 'май', 'июнь',
  'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь',
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function safeParse(dateStr: string): Date {
  try {
    return parseISO(dateStr);
  } catch {
    return new Date(dateStr);
  }
}

function formatDateTime(dateStr: string): string {
  try {
    const d = safeParse(dateStr);
    const day = String(d.getDate()).padStart(2, '0');
    const mon = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${mon}.${year} ${h}:${m}`;
  } catch {
    return dateStr;
  }
}

function getDateGroup(dateStr: string): string {
  const d = safeParse(dateStr);
  const now = new Date();

  const dStr = format(d, 'yyyy-MM-dd');
  const todayStr = format(now, 'yyyy-MM-dd');
  const yesterdayStr = format(subDays(now, 1), 'yyyy-MM-dd');

  if (dStr === todayStr) return 'Сегодня';
  if (dStr === yesterdayStr) return 'Вчера';
  if (isAfter(d, subDays(now, 7))) return 'На этой неделе';
  if (isAfter(d, subDays(now, 30))) return 'В этом месяце';

  const month = RU_MONTHS[d.getMonth()];
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${d.getFullYear()}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AuditPage({ state }: Props) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AuditEventType>('all');
  const [userFilter, setUserFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  // ── Build item map for O(1) lookups ──────────────────────────────────────

  const itemMap = useMemo(
    () => new Map(state.items.map(i => [i.id, i])),
    [state.items],
  );

  // ── Build all audit events ───────────────────────────────────────────────

  const allEvents = useMemo<AuditEvent[]>(() => {
    const events: AuditEvent[] = [];

    // 1. Operations
    for (const op of state.operations || []) {
      const item = itemMap.get(op.itemId);
      const itemName = item?.name ?? 'Неизвестный товар';
      const isIn = op.type === 'in';

      events.push({
        id: `op-${op.id}`,
        date: op.date,
        type: isIn ? 'operation_in' : 'operation_out',
        user: op.performedBy || 'Система',
        description: `${isIn ? 'Приход' : 'Расход'}: ${itemName} \u00d7 ${op.quantity}`,
        details: op.comment || undefined,
        icon: isIn ? 'ArrowDownLeft' : 'ArrowUpRight',
        color: isIn ? 'text-success' : 'text-destructive',
      });
    }

    // 2. Work Orders
    for (const order of state.workOrders || []) {
      // Created event
      events.push({
        id: `ord-c-${order.id}`,
        date: order.createdAt,
        type: 'order_created',
        user: order.createdBy || 'Система',
        description: `Заявка создана: ${order.title}`,
        details: order.number ? `${order.number}` : undefined,
        icon: 'PackageCheck',
        color: 'text-blue-500',
      });

      // Completed event (assembled or closed)
      if (order.status === 'assembled' || order.status === 'closed') {
        events.push({
          id: `ord-d-${order.id}`,
          date: order.updatedAt,
          type: 'order_completed',
          user: order.createdBy || 'Система',
          description: `Заявка ${order.status === 'assembled' ? 'собрана' : 'закрыта'}: ${order.title}`,
          details: order.number ? `${order.number}` : undefined,
          icon: 'PackageCheck',
          color: 'text-blue-500',
        });
      }
    }

    // 3. Receipts
    for (const receipt of state.receipts || []) {
      // Created event
      events.push({
        id: `rcpt-c-${receipt.id}`,
        date: receipt.date,
        type: 'receipt_created',
        user: receipt.createdBy || 'Система',
        description: `Приёмка создана: \u2116${receipt.number} от ${receipt.supplierName}`,
        details: receipt.comment || undefined,
        icon: 'PackagePlus',
        color: 'text-amber-500',
      });

      // Posted event
      if (receipt.postedAt) {
        events.push({
          id: `rcpt-p-${receipt.id}`,
          date: receipt.postedAt,
          type: 'receipt_posted',
          user: receipt.createdBy || 'Система',
          description: `Приёмка проведена: \u2116${receipt.number}`,
          details: `${receipt.lines?.length ?? 0} позиций`,
          icon: 'PackagePlus',
          color: 'text-amber-500',
        });
      }
    }

    // 4. Tech Docs
    for (const doc of state.techDocs || []) {
      events.push({
        id: `doc-${doc.id}`,
        date: doc.createdAt,
        type: 'doc_created',
        user: doc.createdBy || 'Система',
        description: `Документ создан: ${doc.docType}${doc.docNumber ? ` ${doc.docNumber}` : ''}`,
        details: doc.notes || undefined,
        icon: 'FileText',
        color: 'text-violet-500',
      });
    }

    // Sort by date descending
    events.sort((a, b) => {
      const da = safeParse(a.date).getTime();
      const db = safeParse(b.date).getTime();
      return db - da;
    });

    return events;
  }, [state.operations, state.workOrders, state.receipts, state.techDocs, itemMap]);

  // ── Unique users for filter dropdown ─────────────────────────────────────

  const uniqueUsers = useMemo(() => {
    const users = new Set<string>();
    for (const e of allEvents) {
      if (e.user) users.add(e.user);
    }
    return Array.from(users).sort((a, b) => a.localeCompare(b, 'ru'));
  }, [allEvents]);

  // ── Filtered events ──────────────────────────────────────────────────────

  const filteredEvents = useMemo(() => {
    let list = allEvents;

    if (typeFilter !== 'all') {
      list = list.filter(e => e.type === typeFilter);
    }

    if (userFilter !== 'all') {
      list = list.filter(e => e.user === userFilter);
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        e =>
          e.description.toLowerCase().includes(q) ||
          (e.details?.toLowerCase().includes(q) ?? false) ||
          e.user.toLowerCase().includes(q),
      );
    }

    if (dateFrom) {
      const from = new Date(dateFrom);
      list = list.filter(e => safeParse(e.date) >= from);
    }

    if (dateTo) {
      const to = new Date(dateTo + 'T23:59:59');
      list = list.filter(e => safeParse(e.date) <= to);
    }

    return list;
  }, [allEvents, typeFilter, userFilter, search, dateFrom, dateTo]);

  // ── Stats by type ────────────────────────────────────────────────────────

  const typeCounts = useMemo(() => {
    const counts: Partial<Record<AuditEventType, number>> = {};
    for (const e of filteredEvents) {
      counts[e.type] = (counts[e.type] || 0) + 1;
    }
    return counts;
  }, [filteredEvents]);

  // ── Visible events (lazy load) ──────────────────────────────────────────

  const visibleEvents = useMemo(
    () => filteredEvents.slice(0, visibleCount),
    [filteredEvents, visibleCount],
  );

  const hasMore = filteredEvents.length > visibleCount;

  // ── Grouped by date ──────────────────────────────────────────────────────

  const groupedEvents = useMemo(() => {
    const groups: { label: string; events: AuditEvent[] }[] = [];
    let currentLabel = '';

    for (const event of visibleEvents) {
      const label = getDateGroup(event.date);
      if (label !== currentLabel) {
        groups.push({ label, events: [] });
        currentLabel = label;
      }
      groups[groups.length - 1].events.push(event);
    }

    return groups;
  }, [visibleEvents]);

  // ── Active filters count ─────────────────────────────────────────────────

  const activeFilters = [
    typeFilter !== 'all',
    userFilter !== 'all',
    search !== '',
    dateFrom !== '',
    dateTo !== '',
  ].filter(Boolean).length;

  const resetFilters = useCallback(() => {
    setSearch('');
    setTypeFilter('all');
    setUserFilter('all');
    setDateFrom('');
    setDateTo('');
    setVisibleCount(PAGE_SIZE);
  }, []);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Аудит-лог</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {allEvents.length} событий &middot; все действия в системе
          </p>
        </div>
      </div>

      {/* Stats pills */}
      <div className="flex flex-wrap gap-2">
        <StatPill
          label="Приход"
          count={typeCounts.operation_in || 0}
          color="bg-success/15 text-success"
          icon="ArrowDownLeft"
        />
        <StatPill
          label="Расход"
          count={typeCounts.operation_out || 0}
          color="bg-destructive/15 text-destructive"
          icon="ArrowUpRight"
        />
        <StatPill
          label="Заявки"
          count={(typeCounts.order_created || 0) + (typeCounts.order_completed || 0)}
          color="bg-blue-500/15 text-blue-600 dark:text-blue-400"
          icon="PackageCheck"
        />
        <StatPill
          label="Приёмки"
          count={(typeCounts.receipt_created || 0) + (typeCounts.receipt_posted || 0)}
          color="bg-amber-500/15 text-amber-600 dark:text-amber-400"
          icon="PackagePlus"
        />
        <StatPill
          label="Документы"
          count={typeCounts.doc_created || 0}
          color="bg-violet-500/15 text-violet-600 dark:text-violet-400"
          icon="FileText"
        />
      </div>

      {/* Filters */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={e => {
              setTypeFilter(e.target.value as 'all' | AuditEventType);
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            {TYPE_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>

          {/* User filter */}
          <select
            value={userFilter}
            onChange={e => {
              setUserFilter(e.target.value);
              setVisibleCount(PAGE_SIZE);
            }}
            className="h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
          >
            <option value="all">Все пользователи</option>
            {uniqueUsers.map(u => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </select>

          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors"
            >
              <Icon name="X" size={13} />
              Сбросить ({activeFilters})
            </button>
          )}
        </div>

        {/* Search + date range */}
        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-48">
            <Icon
              name="Search"
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
            />
            <Input
              placeholder="Поиск по описанию, пользователю..."
              value={search}
              onChange={e => {
                setSearch(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="pl-9 h-9 text-sm"
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
          <div className="flex items-center gap-2">
            <Input
              type="date"
              value={dateFrom}
              onChange={e => {
                setDateFrom(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-9 text-sm w-36"
            />
            <span className="text-muted-foreground text-sm">&mdash;</span>
            <Input
              type="date"
              value={dateTo}
              onChange={e => {
                setDateTo(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
              className="h-9 text-sm w-36"
            />
          </div>
        </div>
      </div>

      {/* Results count */}
      {activeFilters > 0 && filteredEvents.length !== allEvents.length && (
        <div className="text-sm text-muted-foreground">
          Найдено: <span className="font-semibold text-foreground">{filteredEvents.length}</span>{' '}
          из {allEvents.length} событий
        </div>
      )}

      {/* Timeline */}
      {filteredEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
            <Icon name="Shield" size={28} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">
            {allEvents.length === 0 ? 'Лог пуст' : 'Событий не найдено'}
          </h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            {allEvents.length === 0
              ? 'Записи появятся по мере работы с системой'
              : 'Попробуйте изменить фильтры или поисковый запрос'}
          </p>
          {activeFilters > 0 && (
            <button
              onClick={resetFilters}
              className="mt-3 px-4 py-2 rounded-lg border border-border text-sm hover:bg-muted transition-colors"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {groupedEvents.map(group => (
            <div key={group.label}>
              {/* Group header */}
              <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-sm pb-2 pt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {group.events.length}
                  </span>
                </div>
              </div>

              {/* Events */}
              <div className="space-y-1">
                {group.events.map(event => (
                  <EventRow key={event.id} event={event} />
                ))}
              </div>
            </div>
          ))}

          {/* Load more */}
          {hasMore && (
            <div className="flex justify-center pt-2 pb-4">
              <Button
                variant="outline"
                onClick={() => setVisibleCount(prev => prev + PAGE_SIZE)}
                className="gap-2"
              >
                <Icon name="ChevronDown" size={15} />
                Показать ещё ({filteredEvents.length - visibleCount} осталось)
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── EventRow ────────────────────────────────────────────────────────────────

function EventRow({ event }: { event: AuditEvent }) {
  const borderColor = getBorderColor(event.type);

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg bg-card border border-border shadow-card transition-colors hover:bg-muted/30 border-l-[3px] ${borderColor}`}
    >
      {/* Icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${getIconBg(event.type)}`}
      >
        <Icon name={event.icon} size={15} className={event.color} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
          <span className="text-sm font-medium text-foreground truncate">
            {event.description}
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <span
              className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${getTypeBadge(event.type)}`}
            >
              {TYPE_LABELS[event.type]}
            </span>
          </div>
        </div>

        {event.details && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{event.details}</p>
        )}

        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 tabular-nums">
            <Icon name="Clock" size={11} />
            {formatDateTime(event.date)}
          </span>
          <span className="flex items-center gap-1">
            <Icon name="User" size={11} />
            {event.user}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── StatPill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  count,
  color,
  icon,
}: {
  label: string;
  count: number;
  color: string;
  icon: string;
}) {
  return (
    <div
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${color}`}
    >
      <Icon name={icon} size={12} />
      {label}: {count}
    </div>
  );
}

// ─── Style helpers ───────────────────────────────────────────────────────────

function getBorderColor(type: AuditEventType): string {
  switch (type) {
    case 'operation_in':
      return 'border-l-success';
    case 'operation_out':
      return 'border-l-destructive';
    case 'order_created':
    case 'order_completed':
      return 'border-l-blue-500';
    case 'receipt_created':
    case 'receipt_posted':
      return 'border-l-amber-500';
    case 'doc_created':
      return 'border-l-violet-500';
    default:
      return 'border-l-border';
  }
}

function getIconBg(type: AuditEventType): string {
  switch (type) {
    case 'operation_in':
      return 'bg-success/10';
    case 'operation_out':
      return 'bg-destructive/10';
    case 'order_created':
    case 'order_completed':
      return 'bg-blue-500/10';
    case 'receipt_created':
    case 'receipt_posted':
      return 'bg-amber-500/10';
    case 'doc_created':
      return 'bg-violet-500/10';
    default:
      return 'bg-muted';
  }
}

function getTypeBadge(type: AuditEventType): string {
  switch (type) {
    case 'operation_in':
      return 'bg-success/15 text-success';
    case 'operation_out':
      return 'bg-destructive/15 text-destructive';
    case 'order_created':
    case 'order_completed':
      return 'bg-blue-500/15 text-blue-600 dark:text-blue-400';
    case 'receipt_created':
    case 'receipt_posted':
      return 'bg-amber-500/15 text-amber-600 dark:text-amber-400';
    case 'doc_created':
      return 'bg-violet-500/15 text-violet-600 dark:text-violet-400';
    default:
      return 'bg-muted text-muted-foreground';
  }
}
