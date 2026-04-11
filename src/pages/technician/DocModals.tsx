import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, DocEntry, DocCustomField, Attachment, generateId } from '@/data/store';
import { AttachmentZone } from './AttachmentZone';
import { DOC_TYPES, formatDate } from './technicianUtils';

// ─── CoverPhotoPicker ──────────────────────────────────────────────────────────

function CoverPhotoPicker({
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
    if (file.size > 5 * 1024 * 1024) { setError('Размер не больше 5 МБ'); return; }
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

// ─── DocDetailModal ────────────────────────────────────────────────────────────

export function DocDetailModal({
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

          {/* ─── Главное фото (фон карточки) ─────────────────────── */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Главное фото карточки
            </h3>
            <CoverPhotoPicker
              coverUrl={edited.coverUrl}
              attachments={edited.attachments}
              onChange={(url, newAtt) => set({
                coverUrl: url,
                attachments: newAtt ? [...edited.attachments, newAtt] : edited.attachments,
              })}
            />
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

// ─── NewDocModal ───────────────────────────────────────────────────────────────

export function NewDocModal({
  state, onSave, onClose,
}: {
  state: AppState;
  onSave: (doc: DocEntry) => void;
  onClose: () => void;
}) {
  const [itemId, setItemId]         = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [docType, setDocType]       = useState(DOC_TYPES[0]);
  const [docNumber, setDocNumber]   = useState('');
  const [docDate, setDocDate]       = useState('');
  const [supplier, setSupplier]     = useState('');
  const [notes, setNotes]           = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [coverUrl, setCoverUrl] = useState<string>('');
  const [customFields, setCustomFields] = useState<DocCustomField[]>([]);
  const [cfKey, setCfKey]           = useState('');
  const [cfVal, setCfVal]           = useState('');
  const [error, setError]           = useState('');

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
      coverUrl: coverUrl || undefined,
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

          {/* Главное фото карточки */}
          <section>
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Главное фото карточки
            </h3>
            <CoverPhotoPicker
              coverUrl={coverUrl}
              attachments={attachments}
              onChange={(url, newAtt) => {
                setCoverUrl(url);
                if (newAtt) setAttachments(prev => [...prev, newAtt]);
              }}
            />
          </section>

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