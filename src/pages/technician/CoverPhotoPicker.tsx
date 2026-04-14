import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Attachment, generateId } from '@/data/store';

export default function CoverPhotoPicker({
  coverUrl, attachments, onChange,
}: {
  coverUrl?: string;
  attachments: Attachment[];
  onChange: (url: string, newAttachment?: Attachment) => void;
}) {
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const imageAtts = attachments.filter(a => a.mimeType.startsWith('image/'));

  const handleFile = (file: File | null | undefined) => {
    setError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) { setError('Только изображения'); return; }
    if (file.size > 500 * 1024 * 1024) { setError('Размер не больше 500 МБ'); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const newAtt: Attachment = {
        id: generateId(),
        name: file.name,
        size: file.size,
        mimeType: file.type,
        dataUrl,
        uploadedAt: new Date().toISOString(),
      };
      onChange(dataUrl, newAtt);
      setUploading(false);
    };
    reader.onerror = () => { setError('Ошибка чтения файла'); setUploading(false); };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-3">
      {coverUrl ? (
        <div className="relative inline-block">
          <img src={coverUrl} alt="Главное фото" className="max-h-40 rounded-lg border border-border object-contain bg-muted" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/90 border border-border text-muted-foreground hover:text-destructive flex items-center justify-center shadow-sm"
            title="Убрать главное фото"
          >
            <Icon name="X" size={12} />
          </button>
        </div>
      ) : (
        <label className="flex items-center justify-center gap-2 h-20 px-4 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors text-sm text-muted-foreground">
          {uploading ? (
            <><Icon name="Loader2" size={16} className="animate-spin" />Загрузка...</>
          ) : (
            <><Icon name="Upload" size={16} />Загрузить фото (jpg, png, до 5 МБ)</>
          )}
          <input type="file" accept="image/*" className="hidden" onChange={e => handleFile(e.target.files?.[0])} />
        </label>
      )}
      {error && <div className="text-xs text-destructive">{error}</div>}

      {imageAtts.length > 0 && (
        <div>
          <div className="text-[11px] text-muted-foreground mb-1.5">или выбрать из вложений:</div>
          <div className="flex gap-2 flex-wrap">
            {imageAtts.map(att => {
              const isActive = coverUrl === att.dataUrl;
              return (
                <button
                  key={att.id}
                  type="button"
                  onClick={() => onChange(isActive ? '' : att.dataUrl)}
                  className={`relative w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${isActive ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'}`}
                  title={att.name}
                >
                  <img src={att.dataUrl} alt="" className="w-full h-full object-cover" />
                  {isActive && (
                    <div className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Icon name="Check" size={10} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
