import { useState, useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { Attachment, generateId } from '@/data/store';
import { formatBytes, formatDate, getFileIcon } from './technicianUtils';

export function AttachmentZone({
  attachments, onChange,
}: {
  attachments: Attachment[];
  onChange: (next: Attachment[]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    const readers = Array.from(files).map(file =>
      new Promise<Attachment>((resolve, reject) => {
        if (file.size > 20 * 1024 * 1024) { reject(new Error('Файл слишком большой (макс. 20 МБ)')); return; }
        const reader = new FileReader();
        reader.onload = () => resolve({
          id: generateId(), name: file.name, size: file.size,
          mimeType: file.type || 'application/octet-stream',
          dataUrl: reader.result as string, uploadedAt: new Date().toISOString(),
        });
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })
    );
    Promise.allSettled(readers).then(results => {
      const newAtts = results.filter(r => r.status === 'fulfilled').map(r => (r as PromiseFulfilledResult<Attachment>).value);
      if (newAtts.length) onChange([...attachments, ...newAtts]);
      setUploading(false);
    });
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all select-none
          ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
      >
        <input ref={fileRef} type="file" multiple className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.zip,.rar,.txt,.csv"
          onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Icon name="Loader2" size={16} className="animate-spin" />Загрузка...
          </div>
        ) : (
          <>
            <Icon name="Upload" size={22} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Перетащите файлы или нажмите</p>
            <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, Excel, фото, архивы — до 20 МБ</p>
          </>
        )}
      </div>

      {/* File list */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map(att => {
            const { icon, color } = getFileIcon(att.mimeType, att.name);
            const isImage = att.mimeType.startsWith('image/');
            return (
              <div key={att.id}
                className="flex items-center gap-3 p-2.5 bg-muted/40 rounded-xl border border-border/50 group hover:border-border transition-all">
                {/* Thumb */}
                <div className="w-9 h-9 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 overflow-hidden">
                  {isImage
                    ? <img src={att.dataUrl} alt={att.name} className="w-full h-full object-cover" />
                    : <Icon name={icon} size={18} className={color} />
                  }
                </div>
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground truncate">{att.name}</div>
                  <div className="text-xs text-muted-foreground">{formatBytes(att.size)} · {formatDate(att.uploadedAt)}</div>
                </div>
                {/* Actions */}
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  {isImage && (
                    <button onClick={() => setPreview(att)}
                      className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                      <Icon name="Eye" size={13} />
                    </button>
                  )}
                  <a href={att.dataUrl} download={att.name}
                    className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground">
                    <Icon name="Download" size={13} />
                  </a>
                  <button onClick={() => onChange(attachments.filter(a => a.id !== att.id))}
                    className="w-7 h-7 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive">
                    <Icon name="Trash2" size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Image preview modal */}
      {preview && (
        <Dialog open onOpenChange={() => setPreview(null)}>
          <DialogContent className="max-w-2xl p-2">
            <img src={preview.dataUrl} alt={preview.name} className="w-full rounded-xl object-contain max-h-[80vh]" />
            <p className="text-center text-sm text-muted-foreground mt-1">{preview.name}</p>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
