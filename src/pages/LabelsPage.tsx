import { useState, useMemo, useCallback } from 'react';
import { AppState, getItemBarcodes } from '@/data/store';
import { LabelSize, LabelDataEntry } from './labels/LabelConfig';
import ItemSelectionPanel from './labels/ItemSelectionPanel';
import LabelSettingsPanel from './labels/LabelSettingsPanel';
import LabelPreviewDialog from './labels/LabelPreviewDialog';

type Props = {
  state: AppState;
};

export default function LabelsPage({ state }: Props) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [labelSize, setLabelSize] = useState<LabelSize>('medium');
  const [showPreview, setShowPreview] = useState(false);
  const [copies, setCopies] = useState(1);

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

  const selectedItems = useMemo(
    () => state.items.filter(i => selectedIds.has(i.id)),
    [state.items, selectedIds],
  );

  const labelData: LabelDataEntry[] = useMemo(() => {
    return selectedItems.flatMap(item => {
      const barcodes = getItemBarcodes(state, item.id);
      const barcodeValue = barcodes.length > 0 ? barcodes[0].code : item.id;
      const cat = categoryMap.get(item.categoryId);
      const loc = locationMap.get(item.locationId);
      const wh = loc?.warehouseId ? warehouseMap.get(loc.warehouseId) : null;

      const entry: LabelDataEntry = {
        item,
        barcodeValue,
        categoryName: cat?.name ?? '',
        locationName: loc?.name ?? '',
        warehouseName: wh?.name ?? '',
      };

      return Array.from({ length: copies }, () => entry);
    });
  }, [selectedItems, state, categoryMap, locationMap, warehouseMap, copies]);

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

  return (
    <div className="space-y-5 pb-20 md:pb-0">
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

      <div>
        <h1 className="text-2xl font-bold text-foreground">Печать этикеток</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Выберите товары и распечатайте этикетки со штрих-кодами
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
        <ItemSelectionPanel
          state={state}
          filteredItems={filteredItems}
          selectedIds={selectedIds}
          search={search}
          copies={copies}
          categoryMap={categoryMap}
          onSearchChange={setSearch}
          onToggleItem={toggleItem}
          onSelectAll={selectAll}
          onDeselectAll={deselectAll}
        />

        <LabelSettingsPanel
          labelSize={labelSize}
          copies={copies}
          selectedCount={selectedIds.size}
          onLabelSizeChange={setLabelSize}
          onCopiesChange={setCopies}
          onPreview={() => setShowPreview(true)}
          onPrint={handlePrint}
        />
      </div>

      <LabelPreviewDialog
        open={showPreview}
        onOpenChange={setShowPreview}
        labelData={labelData}
        labelSize={labelSize}
      />
    </div>
  );
}
