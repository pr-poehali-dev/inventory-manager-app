import { useState, useRef } from 'react';
import Icon from '@/components/ui/icon';
import { Item, AppState, Attachment, crudAction, generateId } from '@/data/store';
import { useItemPhoto } from '@/hooks/useItemPhoto';

function FileIcon({ mime, name }: { mime: string; name: string }) {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/')) return <Icon name="Image" size={20} className="text-blue-500" />;
  if (mime.includes('pdf')) return <Icon name="FileText" size={20} className="text-red-500" />;
  if (mime.includes('word') || ext === 'docx' || ext === 'doc') return <Icon name="FileText" size={20} className="text-blue-600" />;
  if (mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xlsx' || ext === 'xls')
    return <Icon name="Table" size={20} className="text-green-600" />;
  if (mime.includes('zip') || mime.includes('rar')) return <Icon name="Archive" size={20} className="text-yellow-600" />;
  return <Icon name="File" size={20} className="text-muted-foreground" />;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} КБ`;
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export function AttachmentsTab({ item, state, onStateChange }: {
  item: Item; state: AppState; onStateChange: (s: AppState) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<Attachment | null>(null);
  const photo = useItemPhoto(item, state, onStateChange);

  const attachments = item.attachments || [];

  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);

    const readers = Array.from(files).map(file =>
      new Promise<Attachment>((resolve, reject) => {
        if (file.size > 500 * 1024 * 1024) {
          reject(new Error(`Файл "${file.name}" слишком большой (макс. 500 МБ)`));
          return;
        }
        const reader = new FileReader();
        reader.onload = () => {
          resolve({
            id: generateId(),
            name: file.name,
            size: file.size,
            mimeType: file.type || 'application/octet-stream',
            dataUrl: reader.result as string,
            uploadedAt: new Date().toISOString(),
          });
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      })
    );

    Promise.allSettled(readers).then(results => {
      const newAtts: Attachment[] = [];
      results.forEach(r => {
        if (r.status === 'fulfilled') newAtts.push(r.value);
      });
      if (newAtts.length > 0) {
        const updatedItem = { ...item, attachments: [...attachments, ...newAtts] };
        const next: AppState = { ...state, items: state.items.map(i => i.id === item.id ? updatedItem : i) };
        onStateChange(next);
        crudAction('upsert_item', { item: updatedItem });
      }
      setUploading(false);
    });
  };

  const handleDelete = (attId: string) => {
    const updatedItem = { ...item, attachments: attachments.filter(a => a.id !== attId) };
    const next: AppState = { ...state, items: state.items.map(i => i.id === item.id ? updatedItem : i) };
    onStateChange(next);
    crudAction('upsert_item', { item: updatedItem });
  };

  const handleDownload = (att: Attachment) => {
    const a = document.createElement('a');
    a.href = att.dataUrl;
    a.download = att.name;
    a.click();
  };

  const handleOpen = (att: Attachment) => {
    if (att.mimeType.startsWith('image/')) {
      setPreviewAtt(att);
      return;
    }
    const a = document.createElement('a');
    a.href = att.dataUrl;
    a.target = '_blank';
    a.download = att.name;
    a.click();
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        onClick={() => fileRef.current?.click()}
        className={`relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
          ${dragOver ? 'border-primary bg-accent' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
      >
        <input ref={fileRef} type="file" multiple className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif,.webp,.zip,.txt,.csv"
          onChange={e => handleFiles(e.target.files)} />
        {uploading ? (
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            <span className="text-sm text-muted-foreground">Загрузка...</span>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Icon name="Upload" size={18} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Перетащите файлы или нажмите</p>
              <p className="text-xs text-muted-foreground mt-0.5">PDF, Word, Excel, изображения — до 10 МБ</p>
            </div>
          </div>
        )}
      </div>

      {/* Files list */}
      {attachments.length === 0 ? (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Вложений пока нет
        </div>
      ) : (
        <div className="space-y-1.5">
          {attachments.map(att => (
            <div key={att.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border bg-card hover:bg-muted/40 transition-colors group">
              {att.mimeType.startsWith('image/') ? (
                <img src={att.dataUrl} alt={att.name} className="w-10 h-10 rounded-lg object-cover shrink-0 cursor-pointer" onClick={() => setPreviewAtt(att)} />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <FileIcon mime={att.mimeType} name={att.name} />
                </div>
              )}

              <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleOpen(att)}>
                <div className="text-sm font-medium text-foreground truncate">{att.name}</div>
                <div className="text-xs text-muted-foreground">
                  {formatBytes(att.size)} · {new Date(att.uploadedAt).toLocaleDateString('ru-RU')}
                </div>
              </div>

              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => handleDownload(att)}
                  className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                  <Icon name="Download" size={13} />
                </button>
                <button onClick={() => handleDelete(att.id)}
                  className="w-7 h-7 rounded-md hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors">
                  <Icon name="Trash2" size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Image preview modal */}
      {previewAtt && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 animate-fade-in" onClick={() => setPreviewAtt(null)}>
          <div className="relative max-w-3xl max-h-full" onClick={e => e.stopPropagation()}>
            <img src={previewAtt.dataUrl} alt={previewAtt.name} className="max-w-full max-h-[80vh] rounded-xl object-contain" />
            <div className="absolute bottom-0 left-0 right-0 bg-black/60 rounded-b-xl px-4 py-2 flex items-center justify-between">
              <span className="text-white text-sm font-medium truncate">{previewAtt.name}</span>
              <div className="flex gap-2 shrink-0">
                {previewAtt.mimeType.startsWith('image/') && item.imageUrl !== previewAtt.dataUrl && (
                  <button
                    onClick={() => { photo.setPhotoFromDataUrl(previewAtt.dataUrl); setPreviewAtt(null); }}
                    title="Сделать главным фото"
                    className="px-3 h-8 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold flex items-center gap-1.5 transition-colors"
                  >
                    <Icon name="Star" size={13} />
                    Сделать главным
                  </button>
                )}
                <button onClick={() => handleDownload(previewAtt)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                  <Icon name="Download" size={15} />
                </button>
                <button onClick={() => setPreviewAtt(null)}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors">
                  <Icon name="X" size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function TechDocsList({ itemDocs, state }: {
  itemDocs: import('@/data/store').DocEntry[];
  state: AppState;
}) {
  if (itemDocs.length === 0) return null;
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <span className="text-xs text-muted-foreground font-medium px-2 shrink-0">
          Из базы документов ({itemDocs.length})
        </span>
        <div className="flex-1 h-px bg-border" />
      </div>
      {itemDocs.map(doc => {
        const firstImg = doc.attachments.find(a => a.mimeType.startsWith('image/'));
        return (
          <div key={doc.id} className="border border-border rounded-xl overflow-hidden bg-card">
            <div className="flex items-start gap-3 p-3">
              <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                {firstImg
                  ? <img src={firstImg.dataUrl} alt="" className="w-full h-full object-cover" />
                  : <Icon name="FileText" size={16} className="text-muted-foreground" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{doc.docType}</span>
                  {doc.docNumber && <span className="text-xs text-muted-foreground">№ {doc.docNumber}</span>}
                  {doc.docDate && <span className="text-xs text-muted-foreground">{new Date(doc.docDate).toLocaleDateString('ru-RU')}</span>}
                </div>
                {doc.supplier && (
                  <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <Icon name="Building2" size={10} />{doc.supplier}
                  </div>
                )}
                {doc.notes && <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{doc.notes}</div>}
                {doc.customFields.length > 0 && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {doc.customFields.map((cf, i) => (
                      <span key={i} className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{cf.key}:</span> {cf.value}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {doc.attachments.length > 0 && (
              <div className="border-t border-border/50 px-3 py-2 space-y-1.5">
                {doc.attachments.map(att => {
                  const isImg = att.mimeType.startsWith('image/');
                  const ext = att.name.split('.').pop()?.toLowerCase() || '';
                  let iconName = 'File'; let iconColor = 'text-muted-foreground';
                  if (isImg) { iconName = 'Image'; iconColor = 'text-blue-500'; }
                  else if (att.mimeType.includes('pdf')) { iconName = 'FileText'; iconColor = 'text-red-500'; }
                  else if (att.mimeType.includes('word') || ext === 'docx' || ext === 'doc') { iconName = 'FileText'; iconColor = 'text-blue-600'; }
                  else if (att.mimeType.includes('excel') || ext === 'xlsx' || ext === 'xls') { iconName = 'Table'; iconColor = 'text-green-600'; }
                  return (
                    <div key={att.id} className="flex items-center gap-2.5 group">
                      <div className="w-7 h-7 rounded-md bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                        {isImg ? <img src={att.dataUrl} alt="" className="w-full h-full object-cover" /> : <Icon name={iconName} size={14} className={iconColor} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-foreground truncate">{att.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {att.size < 1024 ? att.size + ' Б' : att.size < 1048576 ? (att.size / 1024).toFixed(0) + ' КБ' : (att.size / 1048576).toFixed(1) + ' МБ'}
                        </div>
                      </div>
                      <a href={att.dataUrl} download={att.name}
                        className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                        <Icon name="Download" size={12} />
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}