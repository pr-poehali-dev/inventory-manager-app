import Icon from '@/components/ui/icon';
import { AppState, DocEntry } from '@/data/store';
import { formatDate } from './technicianUtils';

export function DocCard({ doc, state, onClick }: { doc: DocEntry; state: AppState; onClick: () => void }) {
  const item = state.items.find(i => i.id === doc.itemId);
  const cat  = item ? state.categories.find(c => c.id === item.categoryId) : null;
  const attCount = doc.attachments.length;
  const hasImages = doc.attachments.some(a => a.mimeType.startsWith('image/'));
  const firstImage = doc.attachments.find(a => a.mimeType.startsWith('image/'));

  return (
    <button onClick={onClick}
      className="w-full text-left bg-card border border-border rounded-2xl shadow-card hover:shadow-md hover:border-primary/30 transition-all group animate-fade-in overflow-hidden">
      {/* Image strip */}
      {hasImages && firstImage && (
        <div className="w-full h-28 overflow-hidden bg-muted">
          <img src={firstImage.dataUrl} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
        </div>
      )}

      <div className="p-4">
        {/* Category + type */}
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {cat && (
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
              style={{ backgroundColor: cat.color + '18', color: cat.color }}>
              {cat.name}
            </span>
          )}
          <span className="text-[11px] text-muted-foreground font-medium px-2 py-0.5 rounded-full bg-muted">
            {doc.docType}
          </span>
        </div>

        {/* Item name */}
        <div className="font-semibold text-sm text-foreground leading-snug mb-1 line-clamp-2">
          {item?.name || '—'}
        </div>

        {/* Doc number + supplier */}
        {(doc.docNumber || doc.supplier) && (
          <div className="text-xs text-muted-foreground mb-2 truncate">
            {doc.docNumber && <span>№ {doc.docNumber}</span>}
            {doc.docNumber && doc.supplier && <span> · </span>}
            {doc.supplier && <span>{doc.supplier}</span>}
          </div>
        )}

        {/* Notes preview */}
        {doc.notes && (
          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{doc.notes}</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-auto pt-2 border-t border-border/50">
          <div className="flex items-center gap-2">
            {attCount > 0 ? (
              <span className="flex items-center gap-1 text-primary font-medium">
                <Icon name="Paperclip" size={11} />{attCount} файл.
              </span>
            ) : (
              <span className="flex items-center gap-1">
                <Icon name="Paperclip" size={11} />Нет файлов
              </span>
            )}
            {doc.customFields.length > 0 && (
              <span className="flex items-center gap-1">
                <Icon name="Tag" size={11} />{doc.customFields.length} доп.
              </span>
            )}
          </div>
          <span className="text-[11px] text-muted-foreground">{formatDate(doc.createdAt)}</span>
        </div>
      </div>
    </button>
  );
}
