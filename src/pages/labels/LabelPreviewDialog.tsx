import { useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import JsBarcode from 'jsbarcode';
import { Item } from '@/data/store';
import { LABEL_CONFIG, LabelSize, LabelDataEntry } from './LabelConfig';

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
      <div
        className={`${cfg.fontSize} font-bold text-black text-center leading-tight w-full truncate`}
      >
        {displayName}
      </div>

      <div className="flex-1 flex items-center justify-center w-full overflow-hidden">
        <BarcodeView value={barcodeValue} width={cfg.barcodeW} height={cfg.barcodeH} />
      </div>

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

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  labelData: LabelDataEntry[];
  labelSize: LabelSize;
};

export default function LabelPreviewDialog({ open, onOpenChange, labelData, labelSize }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
          <div className="flex justify-end mb-3">
            <Button size="sm" className="gap-1.5" onClick={() => window.print()}>
              <Icon name="Printer" size={14} />
              Печать
            </Button>
          </div>

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
  );
}
