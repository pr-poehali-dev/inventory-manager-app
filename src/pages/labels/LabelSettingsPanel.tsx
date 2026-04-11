import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { LABEL_CONFIG, LabelSize } from './LabelConfig';

type Props = {
  labelSize: LabelSize;
  copies: number;
  selectedCount: number;
  onLabelSizeChange: (size: LabelSize) => void;
  onCopiesChange: (copies: number) => void;
  onPreview: () => void;
  onPrint: () => void;
};

export default function LabelSettingsPanel({
  labelSize,
  copies,
  selectedCount,
  onLabelSizeChange,
  onCopiesChange,
  onPreview,
  onPrint,
}: Props) {
  return (
    <div className="space-y-4">
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
                onClick={() => onLabelSizeChange(key)}
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
          onChange={e => onCopiesChange(Math.max(1, Math.min(50, parseInt(e.target.value) || 1)))}
          className="h-9 tabular-nums"
        />
      </div>

      <div className="bg-card rounded-xl border border-border shadow-card p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Icon name="FileText" size={15} className="text-muted-foreground" />
          Итого
        </div>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Товаров:</span>
            <span className="font-medium text-foreground tabular-nums">
              {selectedCount}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Копий:</span>
            <span className="font-medium text-foreground tabular-nums">{copies}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-1 mt-1">
            <span className="text-muted-foreground font-medium">Этикеток:</span>
            <span className="font-bold text-foreground tabular-nums">
              {selectedCount * copies}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={onPreview}
          disabled={selectedCount === 0}
        >
          <Icon name="Eye" size={15} />
          Предпросмотр
        </Button>
        <Button
          className="w-full gap-2"
          onClick={onPrint}
          disabled={selectedCount === 0}
        >
          <Icon name="Printer" size={15} />
          Печать
        </Button>
      </div>
    </div>
  );
}
