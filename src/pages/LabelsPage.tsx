import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import JsBarcode from 'jsbarcode';
import { AppState, Item, getItemBarcodes } from '@/data/store';

// ─── Types ───────────────────────────────────────────────────────────────────

type LabelSize = 'small' | 'medium' | 'large';

type Props = {
  state: AppState;
};

const LABEL_CONFIG: Record<
  LabelSize,
  {
    label: string;
    dims: string;
    width: string;
    height: string;
    fontSize: string;
    barcodeW: number;
    barcodeH: number;
    nameTruncate: number;
  }
> = {
  small: {
    label: 'Маленький',
    dims: '40x25 мм',
    width: 'w-[150px]',
    height: 'h-[95px]',
    fontSize: 'text-[9px]',
    barcodeW: 1,
    barcodeH: 25,
    nameTruncate: 22,
  },
  medium: {
    label: 'Средний',
    dims: '58x40 мм',
    width: 'w-[220px]',
    height: 'h-[150px]',
    fontSize: 'text-[11px]',
    barcodeW: 1.5,
    barcodeH: 40,
    nameTruncate: 32,
  },
  large: {
    label: 'Большой',
    dims: '100x50 мм',
    width: 'w-[375px]',
    height: 'h-[190px]',
    fontSize: 'text-[13px]',
    barcodeW: 2,
    barcodeH: 55,
    nameTruncate: 50,
  },
};

// ─── Barcode SVG Component ───────────────────────────────────────────────────

function BarcodeView({
  value,
  width,
  height,
}: {
  value: string;
  width?: number;
  height?: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format: 'CODE128',
          width: width || 1.5,
          height: height || 40,
          displayValue: true,
          fontSize: 10,
          margin: 2,
          background: 'transparent',
        });
      } catch {
        /* invalid barcode value — leave svg empty */
      }
    }
  }, [value, width, height]);

  return <svg ref={svgRef} className="mx-auto" />;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function LabelsPage({ state }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [showPreview, setShowPreview] = useState(false);
  const [copies, setCopies] = useState(1);

  // ── Lookup maps ──────────────────────────────────────────────────────────

  const categoryMap = useMemo(
    () => new Map(state.categories.map(c => [c.id, c])),
    [state.categories],
  );

  const locationMap = useMemo(
    () => new Map(state.locations.map(l => [l.id, l])),
    [state.locations],
  );

  const warehouseMap = useMemo(
    () => new Map(state.warehouses.map(w => [w.id, w])),
    [state.warehouses],
  );

  // ── Filtered items ───────────────────────────────────────────────────────

  const filteredItems = useMemo(() => {
    let items = [...state.items];
    if (search.trim()) {
      const q = search.toLowerCase();
      items = items.filter(
        i =>
          i.name.toLowerCase().includes(q) ||
          i.description?.toLowerCase().includes(q) ||
          i.id.toLowerCase().includes(q),
      );
    }
    return items.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
  }, [state.items, search]);

  // ── Selected items for printing ──────────────────────────────────────────

  const selectedItems = useMemo(
    () => state.items.filter(i => selectedIds.has(i.id)),
    [state.items, selectedIds],
  );

  // ── Label data for each selected item ────────────────────────────────────

  const labelData = useMemo(() => {
    return selectedItems.flatMap(item => {
      const barcodes = getItemBarcodes(state, item.id);
      const barcodeValue = barcodes.length > 0 ? barcodes[0].code : item.id;
      const cat = categoryMap.get(item.categoryId);
      const loc = locationMap.get(item.locationId);
      const wh = loc?.warehouseId ? warehouseMap.get(loc.warehouseId) : null;

      const entry = {
        item,
        barcodeValue,
        categoryName: cat?.name ?? '',
        locationName: loc?.name ?? '',
        warehouseName: wh?.name ?? '',
      };

      return Array.from({ length: copies }, () => entry);
    });
  }, [selectedItems, state, categoryMap, locationMap, warehouseMap, copies]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const toggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(filteredItems.map(i => i.id)));
  }, [filteredItems]);

  const deselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handlePrint = useCallback(() => {
    setShowPreview(true);
    setTimeout(() => window.print(), 400);
  }, []);

  // ── Config shorthand ─────────────────────────────────────────────────────

  const cfg = LABEL_CONFIG[labelSize];

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="space-y-5 pb-20 md:pb-0">
      {/* Print-only styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #print-labels, #print-labels * { visibility: visible !important; }
          #print-labels {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 8mm;
          }
        }
      `}</style>

      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Печать этикеток</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Выберите товары и распечатайте этикетки со штрих-кодами
        </p>
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        {/* ── Left Panel: Item Selection ─────────────────────────────────── */}
        <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
          {/* Panel header */}
          <div className="px-4 py-3 border-b border-border flex flex-col sm:flex-row sm:items-center gap-2">
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
                className="pl-9 h-9"
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
            <div className="flex gap-1.5 shrink-0">
              <Button variant="outline" size="sm" onClick={selectAll} className="text-xs h-8">
                Выбрать все
              </Button>
              <Button variant="outline" size="sm" onClick={deselectAll} className="text-xs h-8">
                Снять все
              </Button>
            </div>
          </div>

          {/* Selected count */}
          {selectedIds.size > 0 && (
            <div className="px-4 py-2 bg-primary/5 border-b border-primary/15 text-xs font-medium text-primary flex items-center gap-1.5">
              <Icon name="CheckSquare" size={13} />
              Выбрано: {selectedIds.size} {getNoun(selectedIds.size, 'товар', 'товара', 'товаров')}
              {copies > 1 && (
                <span className="text-muted-foreground font-normal">
                  &middot; {selectedIds.size * copies} этикеток
                </span>
              )}
            </div>
          )}

          {/* Items list */}
          <div className="max-h-[520px] overflow-y-auto divide-y divide-border">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <Icon name="PackageSearch" size={22} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-0.5">Товары не найдены</p>
                <p className="text-xs text-muted-foreground">Попробуйте другой запрос</p>
              </div>
            ) : (
              filteredItems.map(item => {
                const isSelected = selectedIds.has(item.id);
                const barcodes = getItemBarcodes(state, item.id);
                const cat = categoryMap.get(item.categoryId);

                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/40
                      ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleItem(item.id)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">
                          {item.name}
                        </span>
                        {cat && (
                          <span
                            className="shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                            style={{ backgroundColor: cat.color }}
                          >
                            {cat.name}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                        <span>
                          {item.quantity} {item.unit}
                        </span>
                        {barcodes.length > 0 && (
                          <span className="flex items-center gap-1">
                            <Icon name="Barcode" size={11} />
                            {barcodes[0].code}
                          </span>
                        )}
                        {barcodes.length === 0 && (
                          <span className="flex items-center gap-1 text-muted-foreground/50">
                            <Icon name="Barcode" size={11} />
                            ID: {item.id}
                          </span>
                        )}
                      </div>
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Panel: Settings ──────────────────────────────────────── */}
        <div className="space-y-4">
          {/* Label size */}
          <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon name="Ruler" size={15} className="text-muted-foreground" />
              Размер этикетки
            </div>
            <div className="space-y-1.5">
              {(Object.keys(LABEL_CONFIG) as LabelSize[]).map(key => {
                const c = LABEL_CONFIG[key];
                const isActive = labelSize === key;
                return (
                  <button
                    key={key}
                    onClick={() => setLabelSize(key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-all text-sm
                      ${isActive
                        ? 'border-primary bg-primary/5 text-foreground ring-1 ring-primary/30'
                        : 'border-border bg-background text-muted-foreground hover:bg-muted/40 hover:text-foreground'
                      }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors
                        ${isActive ? 'border-primary' : 'border-border'}`}
                    >
                      {isActive && <div className="w-2.5 h-2.5 rounded-full bg-primary" />}
                    </div>
                    <div>
                      <div className={`font-medium ${isActive ? 'text-foreground' : ''}`}>
                        {c.label}
                      </div>
                      <div className="text-xs text-muted-foreground">{c.dims}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Copies */}
          <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon name="Copy" size={15} className="text-muted-foreground" />
              Копий на товар
            </div>
            <Input
              type="number"
              min={1}
              max={50}
              value={copies}
              onChange={e => setCopies(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
              className="h-9 tabular-nums"
            />
          </div>

          {/* Summary */}
          <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Icon name="FileText" size={15} className="text-muted-foreground" />
              Итого
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Товаров:</span>
                <span className="font-medium text-foreground tabular-nums">
                  {selectedIds.size}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Копий:</span>
                <span className="font-medium text-foreground tabular-nums">{copies}</span>
              </div>
              <div className="flex justify-between border-t border-border pt-1 mt-1">
                <span className="text-muted-foreground font-medium">Этикеток:</span>
                <span className="font-bold text-foreground tabular-nums">
                  {selectedIds.size * copies}
                </span>
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => setShowPreview(true)}
              disabled={selectedIds.size === 0}
            >
              <Icon name="Eye" size={15} />
              Предпросмотр
            </Button>
            <Button
              className="w-full gap-2"
              onClick={handlePrint}
              disabled={selectedIds.size === 0}
            >
              <Icon name="Printer" size={15} />
              Печать
            </Button>
          </div>
        </div>
      </div>

      {/* ── Preview Dialog ──────────────────────────────────────────────── */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto animate-scale-in">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
                <Icon name="Eye" size={16} />
              </div>
              Предпросмотр этикеток
              <span className="text-sm font-normal text-muted-foreground ml-1">
                ({labelData.length} шт)
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="pt-2">
            {/* Print button in preview */}
            <div className="flex justify-end mb-3">
              <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
                <Icon name="Printer" size={14} />
                Печать
              </Button>
            </div>

            {/* Labels grid */}
            <div
              id="print-labels"
              className="flex flex-wrap gap-3 justify-center p-4 bg-muted/30 rounded-xl border border-border min-h-[200px]"
            >
              {labelData.map((data, idx) => (
                <LabelCard
                  key={`${data.item.id}-${idx}`}
                  item={data.item}
                  barcodeValue={data.barcodeValue}
                  categoryName={data.categoryName}
                  locationName={data.locationName}
                  warehouseName={data.warehouseName}
                  size={labelSize}
                />
              ))}
              {labelData.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-center w-full">
                  <Icon name="Tag" size={28} className="text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">Нет выбранных товаров</p>
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Label Card ──────────────────────────────────────────────────────────────

function LabelCard({
  item,
  barcodeValue,
  categoryName,
  locationName,
  warehouseName,
  size,
}: {
  item: Item;
  barcodeValue: string;
  categoryName: string;
  locationName: string;
  warehouseName: string;
  size: LabelSize;
}) {
  const cfg = LABEL_CONFIG[size];
  const displayName =
    item.name.length > cfg.nameTruncate
      ? item.name.slice(0, cfg.nameTruncate) + '...'
      : item.name;

  const locationInfo = [warehouseName, locationName].filter(Boolean).join(' / ');

  return (
    <div
      className={`${cfg.width} ${cfg.height} bg-white border border-gray-300 rounded p-2 flex flex-col items-center justify-between overflow-hidden shrink-0`}
      style={{ pageBreakInside: 'avoid' }}
    >
      {/* Name */}
      <div
        className={`${cfg.fontSize} font-bold text-black text-center leading-tight w-full truncate`}
      >
        {displayName}
      </div>

      {/* Barcode */}
      <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
        <BarcodeView value={barcodeValue} width={cfg.barcodeW} height={cfg.barcodeH} />
      </div>

      {/* Footer info */}
      <div className={`${cfg.fontSize} text-gray-600 text-center w-full space-y-0`}>
        <div className="flex items-center justify-center gap-1">
          <span className="font-medium text-black">
            {item.quantity} {item.unit}
          </span>
          {categoryName && (
            <>
              <span className="text-gray-400">&middot;</span>
              <span className="truncate">{categoryName}</span>
            </>
          )}
        </div>
        {locationInfo && (
          <div className="text-gray-400 truncate leading-tight">{locationInfo}</div>
        )}
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getNoun(n: number, one: string, two: string, five: string): string {
  const abs = Math.abs(n) % 100;
  const n1 = abs % 10;
  if (abs > 10 && abs < 20) return five;
  if (n1 > 1 && n1 < 5) return two;
  if (n1 === 1) return one;
  return five;
}