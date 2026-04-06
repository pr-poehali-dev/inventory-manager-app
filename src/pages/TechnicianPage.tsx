import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, DocEntry, DocCustomField, Attachment, saveState, generateId } from '@/data/store';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOC_TYPES = ['Накладная', 'Акт', 'Паспорт изделия', 'Инструкция', 'Сертификат', 'Договор', 'Счёт', 'Иное'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  } catch { return iso; }
}

function getFileIcon(mime: string, name: string): { icon: string; color: string } {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (mime.startsWith('image/'))                            return { icon: 'Image',    color: 'text-blue-500' };
  if (mime.includes('pdf'))                                 return { icon: 'FileText', color: 'text-red-500' };
  if (mime.includes('word') || ext === 'docx' || ext === 'doc') return { icon: 'FileText', color: 'text-blue-600' };
  if (mime.includes('excel') || mime.includes('spreadsheet') || ext === 'xlsx' || ext === 'xls')
                                                            return { icon: 'Table',    color: 'text-green-600' };
  if (mime.includes('zip') || mime.includes('rar'))         return { icon: 'Archive',  color: 'text-yellow-600' };
  return { icon: 'File', color: 'text-muted-foreground' };
}

// ─── AttachmentZone ───────────────────────────────────────────────────────────

function AttachmentZone({
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

// ─── DocDetailModal ───────────────────────────────────────────────────────────

function DocDetailModal({
  doc, state, onSave, onDelete, onClose,
}: {
  doc: DocEntry;
  state: AppState;
  onSave: (updated: DocEntry) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}) {
  const item = state.items.find(i => i.id === doc.itemId);
  const cat  = item ? state.categories.find(c => c.id === item.categoryId) : null;

  const [edited, setEdited] = useState<DocEntry>({ ...doc, customFields: [...doc.customFields], attachments: [...doc.attachments] });
  const [cfKey, setCfKey] = useState('');
  const [cfVal, setCfVal] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  const set = (patch: Partial<DocEntry>) => setEdited(prev => ({ ...prev, ...patch }));

  const handleSave = () => {
    onSave({ ...edited, updatedAt: new Date().toISOString() });
    onClose();
  };

  const addCf = () => {
    if (!cfKey.trim()) return;
    set({ customFields: [...edited.customFields, { key: cfKey.trim(), value: cfVal.trim() }] });
    setCfKey(''); setCfVal('');
  };

  const removeCf = (idx: number) => set({ customFields: edited.customFields.filter((_, i) => i !== idx) });

  const updateCf = (idx: number, patch: Partial<DocCustomField>) =>
    set({ customFields: edited.customFields.map((cf, i) => i === idx ? { ...cf, ...patch } : cf) });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[92vh] overflow-y-auto animate-scale-in p-0">
        {/* Top bar with item info */}
        <div className="sticky top-0 z-10 bg-card border-b border-border px-6 py-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              {/* Номенклатура */}
              <div className="flex items-center gap-2 mb-1">
                {cat && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full shrink-0"
                    style={{ backgroundColor: cat.color + '18', color: cat.color }}>
                    {cat.name}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">{item?.unit}</span>
              </div>
              <h2 className="font-bold text-lg text-foreground leading-tight">{item?.name || '—'}</h2>
              <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Icon name="FileText" size={11} />{edited.docType}</span>
                {edited.docNumber && <span>№ {edited.docNumber}</span>}
                {edited.docDate && <span>{formatDate(edited.docDate)}</span>}
                <span className="flex items-center gap-1"><Icon name="Paperclip" size={11} />{edited.attachments.length} файл.</span>
              </div>
            </div>
            <button onClick={onClose}
              className="w-8 h-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground shrink-0">
              <Icon name="X" size={15} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* ─── Основные реквизиты ─────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Реквизиты документа</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Тип документа</Label>
                <select value={edited.docType} onChange={e => set({ docType: e.target.value })}
                  className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Номер документа</Label>
                <Input value={edited.docNumber || ''} onChange={e => set({ docNumber: e.target.value })}
                  placeholder="АКТ-0042 / ТН-001..." className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Дата документа</Label>
                <Input type="date" value={edited.docDate || ''} onChange={e => set({ docDate: e.target.value })}
                  className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Поставщик / Источник</Label>
                <Input value={edited.supplier || ''} onChange={e => set({ supplier: e.target.value })}
                  placeholder="ООО Поставщик..." className="h-9 text-sm" />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Примечание</Label>
              <textarea value={edited.notes || ''} onChange={e => set({ notes: e.target.value })}
                rows={2}
                placeholder="Комментарий, пометки..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground" />
            </div>
          </section>

          {/* ─── Кастомные поля ─────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Дополнительные поля</h3>
            {edited.customFields.length > 0 && (
              <div className="space-y-2 mb-3">
                {edited.customFields.map((cf, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={cf.key} onChange={e => updateCf(idx, { key: e.target.value })}
                      placeholder="Поле" className="h-8 text-sm w-36 shrink-0" />
                    <Input value={cf.value} onChange={e => updateCf(idx, { value: e.target.value })}
                      placeholder="Значение" className="h-8 text-sm flex-1" />
                    <button onClick={() => removeCf(idx)}
                      className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center text-muted-foreground hover:text-destructive shrink-0">
                      <Icon name="X" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Input value={cfKey} onChange={e => setCfKey(e.target.value)} placeholder="Название поля"
                className="h-8 text-sm w-36 shrink-0" onKeyDown={e => e.key === 'Enter' && addCf()} />
              <Input value={cfVal} onChange={e => setCfVal(e.target.value)} placeholder="Значение"
                className="h-8 text-sm flex-1" onKeyDown={e => e.key === 'Enter' && addCf()} />
              <button onClick={addCf}
                className="w-8 h-8 rounded-lg border border-dashed border-border hover:border-primary hover:bg-primary/5 flex items-center justify-center text-muted-foreground hover:text-primary transition-all shrink-0">
                <Icon name="Plus" size={14} />
              </button>
            </div>
          </section>

          {/* ─── Вложения ─────────────────────────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Вложения
              {edited.attachments.length > 0 && (
                <span className="ml-2 text-primary font-bold normal-case">{edited.attachments.length}</span>
              )}
            </h3>
            <AttachmentZone
              attachments={edited.attachments}
              onChange={atts => set({ attachments: atts })}
            />
          </section>

          {/* ─── Footer ──────────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-2 border-t border-border">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-destructive">Удалить запись?</span>
                <Button variant="destructive" size="sm" onClick={() => { onDelete(doc.id); onClose(); }}>
                  Да, удалить
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(false)}>Отмена</Button>
              </div>
            ) : (
              <button onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors">
                <Icon name="Trash2" size={13} />Удалить запись
              </button>
            )}
            <div className="flex gap-2">
              <Button variant="outline" onClick={onClose}>Отмена</Button>
              <Button onClick={handleSave} className="font-semibold">
                <Icon name="Save" size={14} className="mr-1.5" />Сохранить
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── NewDocModal ──────────────────────────────────────────────────────────────

function NewDocModal({
  state, onSave, onClose,
}: {
  state: AppState;
  onSave: (doc: DocEntry) => void;
  onClose: () => void;
}) {
  const [itemId, setItemId]     = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [docType, setDocType]   = useState(DOC_TYPES[0]);
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate]   = useState('');
  const [supplier, setSupplier] = useState('');
  const [notes, setNotes]       = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [customFields, setCustomFields] = useState<DocCustomField[]>([]);
  const [cfKey, setCfKey]       = useState('');
  const [cfVal, setCfVal]       = useState('');
  const [error, setError]       = useState('');

  const filteredItems = useMemo(() => {
    if (!itemSearch.trim()) return state.items.slice(0, 30);
    const q = itemSearch.toLowerCase();
    return state.items.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q)).slice(0, 20);
  }, [state.items, itemSearch]);

  const selectedItem = itemId ? state.items.find(i => i.id === itemId) : null;

  const addCf = () => {
    if (!cfKey.trim()) return;
    setCustomFields(prev => [...prev, { key: cfKey.trim(), value: cfVal.trim() }]);
    setCfKey(''); setCfVal('');
  };

  const handleCreate = () => {
    if (!itemId) { setError('Выберите позицию номенклатуры'); return; }
    const doc: DocEntry = {
      id: generateId(), itemId, docType, docNumber: docNumber || undefined,
      docDate: docDate || undefined, supplier: supplier || undefined,
      notes: notes || undefined, customFields, attachments,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      createdBy: state.currentUser,
    };
    onSave(doc); onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-lg w-full max-h-[92vh] overflow-y-auto animate-scale-in p-0">
        <DialogHeader className="px-6 py-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center shrink-0">
              <Icon name="FilePlus" size={16} />
            </div>
            Новая запись документа
          </DialogTitle>
        </DialogHeader>

        <div className="p-6 space-y-5">
          {/* Step 1: выбор позиции */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
              Позиция номенклатуры <span className="text-destructive">*</span>
            </h3>
            {selectedItem ? (
              <div className="flex items-center gap-3 p-3 bg-accent/50 border border-primary/20 rounded-xl">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon name="Package" size={16} className="text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm text-foreground truncate">{selectedItem.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {state.categories.find(c => c.id === selectedItem.categoryId)?.name || '—'} · {selectedItem.quantity} {selectedItem.unit}
                  </div>
                </div>
                <button onClick={() => { setItemId(''); setItemSearch(''); }}
                  className="w-7 h-7 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground">
                  <Icon name="X" size={13} />
                </button>
              </div>
            ) : (
              <>
                <div className="relative">
                  <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input value={itemSearch} onChange={e => setItemSearch(e.target.value)} autoFocus
                    placeholder="Поиск по названию..."
                    className="pl-9 h-9 text-sm" />
                </div>
                {error && <p className="text-xs text-destructive mt-1">{error}</p>}
                <div className="mt-2 border border-border rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  {filteredItems.length === 0
                    ? <p className="text-sm text-muted-foreground text-center py-6">Ничего не найдено</p>
                    : filteredItems.map(item => {
                      const cat = state.categories.find(c => c.id === item.categoryId);
                      return (
                        <button key={item.id} onClick={() => { setItemId(item.id); setError(''); }}
                          className="w-full text-left flex items-center gap-3 px-3 py-2.5 hover:bg-muted border-b border-border/40 last:border-0 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-foreground truncate">{item.name}</div>
                            {cat && <div className="text-xs" style={{ color: cat.color }}>{cat.name}</div>}
                          </div>
                          <div className="text-xs text-muted-foreground shrink-0">{item.quantity} {item.unit}</div>
                        </button>
                      );
                    })}
                </div>
              </>
            )}
          </section>

          {/* Step 2: реквизиты */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Реквизиты</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Тип документа</Label>
                <select value={docType} onChange={e => setDocType(e.target.value)}
                  className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
                  {DOC_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Номер документа</Label>
                <Input value={docNumber} onChange={e => setDocNumber(e.target.value)}
                  placeholder="№ накладной / акта..." className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Дата</Label>
                <Input type="date" value={docDate} onChange={e => setDocDate(e.target.value)} className="h-9 text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Поставщик / Источник</Label>
                <Input value={supplier} onChange={e => setSupplier(e.target.value)}
                  placeholder="Компания..." className="h-9 text-sm" />
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">Примечание</Label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                placeholder="Дополнительная информация..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none placeholder:text-muted-foreground" />
            </div>
          </section>

          {/* Доп. поля */}
          {customFields.length > 0 && (
            <div className="space-y-2">
              {customFields.map((cf, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground w-28 shrink-0 truncate">{cf.key}:</span>
                  <span className="flex-1">{cf.value}</span>
                  <button onClick={() => setCustomFields(prev => prev.filter((_, i) => i !== idx))}
                    className="text-muted-foreground hover:text-destructive"><Icon name="X" size={12} /></button>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2">
            <Input value={cfKey} onChange={e => setCfKey(e.target.value)} placeholder="+ доп. поле"
              className="h-8 text-xs w-32 shrink-0" onKeyDown={e => e.key === 'Enter' && addCf()} />
            <Input value={cfVal} onChange={e => setCfVal(e.target.value)} placeholder="значение"
              className="h-8 text-xs flex-1" onKeyDown={e => e.key === 'Enter' && addCf()} />
            <button onClick={addCf}
              className="w-8 h-8 rounded-lg border border-dashed border-border hover:border-primary flex items-center justify-center text-muted-foreground hover:text-primary">
              <Icon name="Plus" size={13} />
            </button>
          </div>

          {/* Вложения */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Вложения</h3>
            <AttachmentZone attachments={attachments} onChange={setAttachments} />
          </section>

          <div className="flex gap-2 pt-2 border-t border-border">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button onClick={handleCreate} className="flex-1 font-semibold">
              <Icon name="FilePlus" size={14} className="mr-1.5" />Создать запись
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── DocCard ──────────────────────────────────────────────────────────────────

function DocCard({ doc, state, onClick }: { doc: DocEntry; state: AppState; onClick: () => void }) {
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
        <div className="font-bold text-sm text-foreground leading-snug mb-1 group-hover:text-primary transition-colors">
          {item?.name || '—'}
        </div>

        {/* Doc number + date */}
        {(doc.docNumber || doc.docDate) && (
          <div className="text-xs text-muted-foreground mb-2">
            {doc.docNumber && <span>№ {doc.docNumber}</span>}
            {doc.docNumber && doc.docDate && <span> · </span>}
            {doc.docDate && <span>{formatDate(doc.docDate)}</span>}
          </div>
        )}

        {/* Supplier */}
        {doc.supplier && (
          <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
            <Icon name="Building2" size={11} />{doc.supplier}
          </div>
        )}

        {/* Custom fields preview */}
        {doc.customFields.length > 0 && (
          <div className="space-y-0.5 mb-2">
            {doc.customFields.slice(0, 2).map((cf, i) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="font-medium text-foreground">{cf.key}:</span>
                <span className="truncate">{cf.value}</span>
              </div>
            ))}
            {doc.customFields.length > 2 && (
              <div className="text-xs text-muted-foreground">+{doc.customFields.length - 2} поля</div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
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

// ─── TechnicianPage ───────────────────────────────────────────────────────────

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

export default function TechnicianPage({ state, onStateChange }: Props) {
  const docs = state.techDocs || [];

  const [search,      setSearch]      = useState('');
  const [typeFilter,  setTypeFilter]  = useState('all');
  const [catFilter,   setCatFilter]   = useState('all');
  const [itemFilter,  setItemFilter]  = useState('all');
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [showNew,     setShowNew]     = useState(false);
  const [viewMode,    setViewMode]    = useState<'grid' | 'list'>('grid');

  const selectedDoc = docs.find(d => d.id === selectedId) || null;

  const usedTypes = useMemo(() => [...new Set(docs.map(d => d.docType))].sort(), [docs]);

  const filtered = useMemo(() => {
    let list = [...docs];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d => {
        const item = state.items.find(i => i.id === d.itemId);
        return (
          item?.name.toLowerCase().includes(q) ||
          d.docNumber?.toLowerCase().includes(q) ||
          d.supplier?.toLowerCase().includes(q) ||
          d.notes?.toLowerCase().includes(q) ||
          d.docType.toLowerCase().includes(q) ||
          d.customFields.some(cf => cf.key.toLowerCase().includes(q) || cf.value.toLowerCase().includes(q))
        );
      });
    }
    if (typeFilter !== 'all') list = list.filter(d => d.docType === typeFilter);
    if (catFilter  !== 'all') list = list.filter(d => {
      const item = state.items.find(i => i.id === d.itemId);
      return item?.categoryId === catFilter;
    });
    if (itemFilter !== 'all') list = list.filter(d => d.itemId === itemFilter);
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [docs, search, typeFilter, catFilter, itemFilter, state.items]);

  const totalAttachments = docs.reduce((s, d) => s + d.attachments.length, 0);
  const totalItems = new Set(docs.map(d => d.itemId)).size;

  const saveDoc = (doc: DocEntry) => {
    const next = {
      ...state,
      techDocs: docs.some(d => d.id === doc.id)
        ? docs.map(d => d.id === doc.id ? doc : d)
        : [...docs, doc],
    };
    onStateChange(next); saveState(next);
  };

  const deleteDoc = (id: string) => {
    const next = { ...state, techDocs: docs.filter(d => d.id !== id) };
    onStateChange(next); saveState(next);
  };

  const activeFilters = [search, typeFilter !== 'all', catFilter !== 'all', itemFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">База документов</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Техническая документация и вложения по номенклатуре
          </p>
        </div>
        <Button onClick={() => setShowNew(true)} className="font-semibold gap-2 shrink-0">
          <Icon name="FilePlus" size={16} />
          Добавить документ
        </Button>
      </div>

      {/* ─── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Записей',    value: docs.length,       icon: 'FileText',  color: 'text-primary'     },
          { label: 'Позиций',    value: totalItems,         icon: 'Package',   color: 'text-success'     },
          { label: 'Файлов',     value: totalAttachments,   icon: 'Paperclip', color: 'text-warning'     },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-2xl p-4 shadow-card flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl bg-muted flex items-center justify-center shrink-0 ${s.color}`}>
              <Icon name={s.icon} size={20} />
            </div>
            <div>
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ─── Filters ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-44">
          <Icon name="Search" size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          <Input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Поиск по товару, документу, поставщику..."
            className="pl-9 h-9 text-sm" />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <Icon name="X" size={13} />
            </button>
          )}
        </div>

        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Все типы</option>
          {usedTypes.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select value={catFilter} onChange={e => setCatFilter(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring">
          <option value="all">Все категории</option>
          {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={itemFilter} onChange={e => setItemFilter(e.target.value)}
          className="h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring max-w-48">
          <option value="all">Все позиции</option>
          {state.items.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
        </select>

        {activeFilters > 0 && (
          <button onClick={() => { setSearch(''); setTypeFilter('all'); setCatFilter('all'); setItemFilter('all'); }}
            className="h-9 px-3 text-sm rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted flex items-center gap-1.5 transition-colors">
            <Icon name="X" size={13} />Сбросить
          </button>
        )}

        {/* View toggle */}
        <div className="flex p-0.5 bg-muted rounded-lg ml-auto">
          {(['grid', 'list'] as const).map(v => (
            <button key={v} onClick={() => setViewMode(v)}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-all
                ${viewMode === v ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon name={v === 'grid' ? 'LayoutGrid' : 'List'} size={14} />
            </button>
          ))}
        </div>
      </div>

      {/* ─── Empty state ──────────────────────────────────────────── */}
      {docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center animate-fade-in">
          <div className="w-20 h-20 rounded-3xl bg-muted flex items-center justify-center mb-5">
            <Icon name="FolderOpen" size={36} className="text-muted-foreground" />
          </div>
          <h3 className="text-lg font-bold mb-2">База документов пуста</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-sm">
            Прикрепляйте накладные, акты, паспорта изделий, инструкции и фото к каждой позиции номенклатуры
          </p>
          <Button onClick={() => setShowNew(true)} className="font-semibold gap-2">
            <Icon name="FilePlus" size={16} />
            Добавить первый документ
          </Button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center animate-fade-in">
          <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-3">
            <Icon name="SearchX" size={24} className="text-muted-foreground" />
          </div>
          <p className="font-medium">Ничего не найдено</p>
          <p className="text-sm text-muted-foreground mt-1">Попробуйте изменить фильтры</p>
        </div>
      ) : viewMode === 'grid' ? (
        /* ─── Grid view ─────────────────────────────────────────── */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(doc => (
            <DocCard key={doc.id} doc={doc} state={state} onClick={() => setSelectedId(doc.id)} />
          ))}
        </div>
      ) : (
        /* ─── List view ─────────────────────────────────────────── */
        <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Позиция</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Тип</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Номер</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Дата</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Поставщик</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">Файлы</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(doc => {
                const item = state.items.find(i => i.id === doc.itemId);
                const cat  = item ? state.categories.find(c => c.id === item.categoryId) : null;
                return (
                  <tr key={doc.id} onClick={() => setSelectedId(doc.id)}
                    className="border-b border-border/50 hover:bg-muted/30 cursor-pointer transition-colors group animate-fade-in">
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground group-hover:text-primary transition-colors">{item?.name || '—'}</div>
                      {cat && <div className="text-[11px] mt-0.5" style={{ color: cat.color }}>{cat.name}</div>}
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">{doc.docType}</span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{doc.docNumber || '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{doc.docDate ? formatDate(doc.docDate) : '—'}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs truncate max-w-[140px]">{doc.supplier || '—'}</td>
                    <td className="px-4 py-3 text-center">
                      {doc.attachments.length > 0 ? (
                        <span className="text-xs font-semibold text-primary">{doc.attachments.length}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ─── Modals ───────────────────────────────────────────────── */}
      {selectedDoc && (
        <DocDetailModal
          key={selectedDoc.id}
          doc={selectedDoc}
          state={state}
          onSave={saveDoc}
          onDelete={deleteDoc}
          onClose={() => setSelectedId(null)}
        />
      )}
      {showNew && (
        <NewDocModal
          state={state}
          onSave={saveDoc}
          onClose={() => setShowNew(false)}
        />
      )}
    </div>
  );
}