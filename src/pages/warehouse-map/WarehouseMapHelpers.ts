export type MapCell = {
  locationId: string;
  col: number;
  row: number;
  colSpan?: number;
  rowSpan?: number;
  color?: string;
};

export type WarehouseLayout = {
  cols: number;
  rows: number;
  cells: MapCell[];
};

export const ZONE_COLORS = [
  '#6366f1', '#0ea5e9', '#f59e0b', '#10b981', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#64748b', '#84cc16',
];

export const DEFAULT_LAYOUT: WarehouseLayout = {
  cols: 6,
  rows: 4,
  cells: [
    { locationId: 'loc-1', col: 0, row: 0, colSpan: 2, color: '#6366f1' },
    { locationId: 'loc-2', col: 2, row: 0, colSpan: 2, color: '#0ea5e9' },
    { locationId: 'loc-3', col: 4, row: 0, colSpan: 2, color: '#f59e0b' },
    { locationId: 'loc-4', col: 0, row: 1, colSpan: 1, color: '#6366f1' },
    { locationId: 'loc-5', col: 1, row: 1, colSpan: 1, color: '#6366f1' },
    { locationId: 'loc-6', col: 2, row: 1, colSpan: 2, color: '#0ea5e9' },
  ],
};

export function getStockLevel(qty: number, threshold: number): 'ok' | 'low' | 'critical' {
  if (qty === 0) return 'critical';
  if (qty <= threshold) return 'low';
  return 'ok';
}

export function stockLevelColor(level: 'ok' | 'low' | 'critical') {
  if (level === 'ok') return 'bg-success/15 text-success border-success/30';
  if (level === 'low') return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-destructive/15 text-destructive border-destructive/30';
}

export function stockDotColor(level: 'ok' | 'low' | 'critical') {
  if (level === 'ok') return 'bg-success';
  if (level === 'low') return 'bg-warning';
  return 'bg-destructive';
}
