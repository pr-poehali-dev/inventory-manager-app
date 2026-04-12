import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import {
  AppState, crudAction, generateId,
  Receipt, ReceiptLine, ReceiptCustomField,
  Attachment, Partner, Item,
} from '@/data/store';

const COMMON_DOC_FIELDS = [
  'Номер ТТН', 'Номер заказа', 'Дата поставки', 'Договор №',
  'Счёт-фактура №', 'Водитель', 'Транспортная компания', 'Примечание',
];

const UNITS = ['шт', 'кг', 'л', 'м', 'м²', 'м³', 'уп', 'пачка', 'рул', 'упак', 'кор', 'пар'];

type DraftLine = {
  id: string;
  itemId: string;
  itemLabel: string;
  isNew: boolean;
  qty: string;
  unit: string;
  price: string;
  locationId: string;
  categoryId: string;
  description: string;
  lowStockThreshold: string;
};

export function NewReceiptModal({
  state, onStateChange, onClose, onCreated,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
  onCreated?: (receipt: Receipt) => void;
}) {
  const counter = state.receiptCounter ?? 1;
  const [docNumber, setDocNumber] = useState(`ПРХ-${String(counter).padStart(4, '0')}`);
  const [supplierLabel, setSupplierLabel] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [warehouseId, setWarehouseId] = useState(state.warehouses?.[0]?.id || '');
  const [comment, setComment] = useState('');
  const [photoUrl, setPhotoUrl] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState('');
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [customFields, setCustomFields] = useState<ReceiptCustomField[]>([]);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [showFieldSuggestions, setShowFieldSuggestions] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([
    { id: generateId(), itemId: '', itemLabel: '', isNew: false, qty: '1', unit: 'шт', price: '', locationId: '', categoryId: '', description: '', lowStockThreshold: '5' },
  ]);

  const supplierOptions: AutocompleteOption[] = useMemo(() =>
    (state.partners || []).filter(p => p.type === 'supplier').map(p => ({
      id: p.id, label: p.name, sublabel: p.contact || p.note || undefined,
    })), [state.partners]);

  const itemOptions: AutocompleteOption[] = useMemo(() =>
    state.items.map(item => {
      const cat = state.categories.find(c => c.id === item.categoryId);
      return { id: item.id, label: item.name, sublabel: `${item.quantity} ${item.unit} · ${cat?.name || ''}` };
    }), [state.items, state.categories]);

  const addLine = () => setLines(prev => [...prev, {
    id: generateId(), itemId: '', itemLabel: '', isNew: false,
    qty: '1', unit: 'шт', price: '', locationId: '',
    categoryId: '', description: '', lowStockThreshold: '5',
  }]);

  const removeLine = (id: string) => setLines(prev => prev.filter(l => l.id !== id));

  const updateLine = (id: string, patch: Partial<DraftLine>) =>
    setLines(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));

  const addCustomField = (key: string) => {
    if (!key.trim()) return;
    setCustomFields(prev => [...prev, { key: key.trim(), value: '' }]);
    setNewFieldKey('');
    setShowFieldSuggestions(false);
  };

  const updateCustomField = (idx: number, value: string) =>
    setCustomFields(prev => prev.map((f, i) => i === idx ? { ...f, value } : f));

  const removeCustomField = (idx: number) =>
    setCustomFields(prev => prev.filter((_, i) => i !== idx));

  const handlePhotoSelect = (file: File | null | undefined) => {
    setPhotoError('');
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoError('Можно загрузить только изображение');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError('Размер не больше 5 МБ');
      return;
    }
    setPhotoUploading(true);
    const reader = new FileReader();
    reader.onload = () => {
      setPhotoUrl(String(reader.result || ''));
      setPhotoUploading(false);
    };
    reader.onerror = () => {
      setPhotoError('Не удалось прочитать файл');
      setPhotoUploading(false);
    };
    reader.readAsDataURL(file);
  };

  const validLines = lines.filter(l => (l.itemId || l.itemLabel.trim()) && parseInt(l.qty) > 0);
  const totalAmount = validLines.reduce((sum, l) => sum + (parseFloat(l.price) || 0) * (parseInt(l.qty) || 0), 0);
  const canSave = supplierLabel.trim() && validLines.length > 0;

  const duplicateItemIds = useMemo(() => {
    const seen = new Map<string, number>();
    validLines.forEach(l => { if (l.itemId) seen.set(l.itemId, (seen.get(l.itemId) || 0) + 1); });
    return new Set([...seen.entries()].filter(([, c]) => c > 1).map(([k]) => k));
  }, [validLines]);

  const handleSave = () => {
    if (!canSave) return;

    let next = { ...state };

    let finalSupplierId = supplierId;
    let newSupplierPartner: Partner | null = null;
    if (supplierLabel.trim() && !supplierId) {
      newSupplierPartner = {
        id: generateId(), name: supplierLabel.trim(), type: 'supplier',
        createdAt: new Date().toISOString(),
      };
      next = { ...next, partners: [...(next.partners || []), newSupplierPartner] };
      finalSupplierId = newSupplierPartner.id;
    }

    const receiptLines: ReceiptLine[] = [];
    const newItems: Item[] = [];

    for (const line of validLines) {
      const qty = parseInt(line.qty) || 0;
      if (qty <= 0) continue;

      let itemId = line.itemId;

      if (!itemId) {
        const newItem: Item = {
          id: generateId(),
          name: line.itemLabel.trim(),
          categoryId: line.categoryId || (next.categories[0]?.id || ''),
          locationId: line.locationId || (next.locations[0]?.id || ''),
          description: line.description || undefined,
          unit: line.unit,
          quantity: 0,
          lowStockThreshold: parseInt(line.lowStockThreshold) || 5,
          createdAt: new Date().toISOString(),
        };
        next = { ...next, items: [...next.items, newItem] };
        itemId = newItem.id;
        newItems.push(newItem);
      }

      receiptLines.push({
        id: line.id,
        itemId,
        itemName: line.itemLabel || next.items.find(i => i.id === itemId)?.name || '',
        qty,
        confirmedQty: 0,
        locationId: line.locationId,
        price: parseFloat(line.price) || undefined,
        unit: line.unit,
        isNew: !line.itemId,
      });
    }

    const receipt: Receipt = {
      id: generateId(),
      number: docNumber.trim(),
      status: 'pending',
      supplierId: finalSupplierId || undefined,
      supplierName: supplierLabel.trim(),
      warehouseId: warehouseId || undefined,
      date: new Date().toISOString(),
      createdBy: next.currentUser,
      lines: receiptLines,
      customFields,
      comment: comment.trim() || undefined,
      totalAmount: totalAmount > 0 ? totalAmount : undefined,
      scanHistory: [],
      photoUrl: photoUrl || undefined,
      attachments: attachments.length > 0 ? attachments : undefined,
    };

    const newCounter = (next.receiptCounter || 1) + 1;
    next = {
      ...next,
      receipts: [receipt, ...(next.receipts || [])],
      receiptCounter: newCounter,
    };

    onStateChange(next);
    crudAction('upsert_receipt', { receipt, receiptLines: receipt.lines });
    crudAction('update_setting', { key: 'receiptCounter', value: String(newCounter) });
    for (const newItem of newItems) {
      crudAction('upsert_item', { item: newItem });
    }
    if (newSupplierPartner) {
      crudAction('upsert_partner', { partner: newSupplierPartner });
    }
    onCreated?.(receipt);
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <Icon name="ClipboardList" size={16} />
            </div>
            <div>
              <div>Этап 1 — Создание заявки</div>
              <div className="text-xs font-normal text-muted-foreground">Заполните шапку и добавьте товары</div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 py-2">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-amber-500 text-white text-xs flex items-center justify-center font-bold">1</div>
            <span className="text-sm font-medium">Заявка</span>
          </div>
          <div className="flex-1 h-0.5 bg-muted rounded" />
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-muted text-muted-foreground text-xs flex items-center justify-center font-bold">2</div>
            <span className="text-sm text-muted-foreground">Сканирование и подтверждение</span>
          </div>
        </div>

        <div className="space-y-5 pt-1">

          {/* Шапка */}
          <div className="rounded-xl border border-border p-4 space-y-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
              <Icon name="FileText" size={12} />Реквизиты документа
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Номер документа</Label>
                <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="ПРХ-0001" />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1">
                  Поставщик <span className="text-destructive">*</span>
                </Label>
                <Autocomplete
                  value={supplierLabel}
                  onChange={v => { setSupplierLabel(v); setSupplierId(''); }}
                  onSelect={opt => { setSupplierLabel(opt.label); setSupplierId(opt.id); }}
                  options={supplierOptions}
                  placeholder="Введите или выберите поставщика"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Склад назначения</Label>
                <select
                  value={warehouseId}
                  onChange={e => setWarehouseId(e.target.value)}
                  className="w-full h-9 px-3 pr-8 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                >
                  <option value="">— не указан —</option>
                  {(state.warehouses || []).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Комментарий</Label>
                <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Примечание к документу" />
              </div>
            </div>

            {/* Главное фото */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Icon name="Image" size={12} />
                Главное фото накладной
              </Label>
              {photoUrl ? (
                <div className="relative inline-block">
                  <img
                    src={photoUrl}
                    alt="Фото накладной"
                    className="max-h-48 rounded-lg border border-border object-contain bg-muted"
                  />
                  <button
                    type="button"
                    onClick={() => { setPhotoUrl(''); setPhotoError(''); }}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-background/90 border border-border text-muted-foreground hover:text-destructive flex items-center justify-center shadow-sm"
                    title="Удалить фото"
                  >
                    <Icon name="X" size={12} />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 h-20 px-4 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors text-sm text-muted-foreground">
                  {photoUploading ? (
                    <>
                      <Icon name="Loader2" size={16} className="animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Icon name="Upload" size={16} />
                      Загрузить фото (jpg, png, до 5 МБ)
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={e => handlePhotoSelect(e.target.files?.[0])}
                  />
                </label>
              )}
              {photoError && <div className="text-xs text-destructive">{photoError}</div>}
            </div>

            {/* Вложения (документы) */}
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5">
                <Icon name="Paperclip" size={12} />
                Вложения
              </Label>
              {attachments.length > 0 && (
                <div className="space-y-1">
                  {attachments.map(att => (
                    <div key={att.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50 text-sm">
                      <Icon name="File" size={14} className="text-muted-foreground shrink-0" />
                      <span className="flex-1 truncate">{att.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {att.size < 1024 ? `${att.size} Б` : att.size < 1048576 ? `${(att.size / 1024).toFixed(1)} КБ` : `${(att.size / 1048576).toFixed(1)} МБ`}
                      </span>
                      <button
                        type="button"
                        onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                        className="p-1 text-muted-foreground hover:text-destructive rounded"
                        title="Удалить"
                      >
                        <Icon name="X" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center justify-center gap-2 h-16 px-4 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/60 cursor-pointer transition-colors text-sm text-muted-foreground">
                <Icon name="Upload" size={16} />
                Добавить файлы (до 500 МБ)
                <input
                  type="file"
                  multiple
                  className="hidden"
                  onChange={e => {
                    if (!e.target.files) return;
                    Array.from(e.target.files).forEach(file => {
                      if (file.size > 500 * 1024 * 1024) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const att: Attachment = {
                          id: generateId(),
                          name: file.name,
                          size: file.size,
                          mimeType: file.type || 'application/octet-stream',
                          dataUrl: reader.result as string,
                          uploadedAt: new Date().toISOString(),
                        };
                        setAttachments(prev => [...prev, att]);
                      };
                      reader.readAsDataURL(file);
                    });
                    e.target.value = '';
                  }}
                />
              </label>
            </div>
          </div>

          {/* Доп. поля */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Дополнительные поля</div>
            </div>
            {customFields.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customFields.map((f, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <div className="flex-1 relative">
                      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] text-muted-foreground pointer-events-none">{f.key}:</div>
                      <Input
                        value={f.value}
                        onChange={e => updateCustomField(i, e.target.value)}
                        className="pl-[calc(var(--label-width,80px)+12px)] text-sm h-9"
                        style={{ paddingLeft: `${f.key.length * 7 + 20}px` }}
                        placeholder="Значение"
                      />
                    </div>
                    <button onClick={() => removeCustomField(i)} className="p-1.5 text-muted-foreground hover:text-destructive rounded">
                      <Icon name="X" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  value={newFieldKey}
                  onChange={e => { setNewFieldKey(e.target.value); setShowFieldSuggestions(true); }}
                  onFocus={() => setShowFieldSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowFieldSuggestions(false), 150)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomField(newFieldKey); } }}
                  placeholder="Название поля (напр. Номер ТТН)"
                  className="h-9 text-sm"
                />
                {showFieldSuggestions && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 bg-card border border-border rounded-lg shadow-lg overflow-hidden">
                    {COMMON_DOC_FIELDS.filter(f => !customFields.find(cf => cf.key === f) && (!newFieldKey || f.toLowerCase().includes(newFieldKey.toLowerCase()))).slice(0, 5).map(f => (
                      <button key={f} onClick={() => addCustomField(f)} className="w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors">
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => addCustomField(newFieldKey)} className="h-9 shrink-0">
                <Icon name="Plus" size={14} />
              </Button>
            </div>
          </div>

          {/* Табличная часть */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                <Icon name="Package" size={12} />Товары ({validLines.length})
              </div>
              <Button variant="outline" size="sm" onClick={addLine} className="h-7 text-xs gap-1">
                <Icon name="Plus" size={12} />Добавить строку
              </Button>
            </div>

            <div className="space-y-2">
              {lines.map((line, idx) => {
                const isDup = line.itemId && duplicateItemIds.has(line.itemId);
                return (
                  <div key={line.id} className={`rounded-xl border p-3 space-y-3 ${isDup ? 'border-destructive/40 bg-destructive/5' : 'border-border bg-card'}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-muted-foreground">#{idx + 1}</span>
                      <div className="flex items-center gap-2">
                        {isDup && (
                          <span className="text-[11px] text-destructive flex items-center gap-1">
                            <Icon name="AlertTriangle" size={11} />Дубликат
                          </span>
                        )}
                        {line.isNew && (
                          <span className="text-[11px] text-primary flex items-center gap-1">
                            <Icon name="Sparkles" size={11} />Новый товар
                          </span>
                        )}
                        {lines.length > 1 && (
                          <button onClick={() => removeLine(line.id)} className="p-1 text-muted-foreground hover:text-destructive rounded">
                            <Icon name="Trash2" size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Товар <span className="text-destructive">*</span></Label>
                        <Autocomplete
                          value={line.itemLabel}
                          onChange={v => updateLine(line.id, { itemLabel: v, itemId: '', isNew: !state.items.find(i => i.name === v) })}
                          onSelect={opt => {
                            const item = state.items.find(i => i.id === opt.id);
                            updateLine(line.id, {
                              itemId: opt.id, itemLabel: opt.label, isNew: false,
                              unit: item?.unit || 'шт',
                              locationId: item?.locationId || '',
                            });
                          }}
                          options={itemOptions}
                          placeholder="Выберите или введите название"
                        />
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Кол-во</Label>
                          <Input
                            type="number" min="1"
                            value={line.qty}
                            onChange={e => updateLine(line.id, { qty: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Ед.</Label>
                          <select
                            value={line.unit}
                            onChange={e => updateLine(line.id, { unit: e.target.value })}
                            className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none appearance-none"
                          >
                            {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Цена ₽</Label>
                          <Input
                            type="number" min="0"
                            value={line.price}
                            onChange={e => updateLine(line.id, { price: e.target.value })}
                            placeholder="0"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Место хранения</Label>
                      <select
                        value={line.locationId}
                        onChange={e => updateLine(line.id, { locationId: e.target.value })}
                        className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none appearance-none"
                      >
                        <option value="">— не указано —</option>
                        {state.locations.map(l => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>

                    {line.isNew && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-border/50">
                        <div className="space-y-1.5">
                          <Label className="text-xs">Категория нового товара</Label>
                          <select
                            value={line.categoryId}
                            onChange={e => updateLine(line.id, { categoryId: e.target.value })}
                            className="w-full h-9 px-3 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none appearance-none"
                          >
                            <option value="">— выберите —</option>
                            {state.categories.map(c => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-1.5">
                          <Label className="text-xs">Мин. остаток</Label>
                          <Input
                            type="number" min="0"
                            value={line.lowStockThreshold}
                            onChange={e => updateLine(line.id, { lowStockThreshold: e.target.value })}
                            className="h-9 text-sm"
                          />
                        </div>
                        <div className="sm:col-span-2 space-y-1.5">
                          <Label className="text-xs">Описание нового товара</Label>
                          <Input
                            value={line.description}
                            onChange={e => updateLine(line.id, { description: e.target.value })}
                            placeholder="Необязательное описание"
                            className="h-9 text-sm"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {totalAmount > 0 && (
            <div className="flex items-center justify-between px-4 py-3 bg-muted rounded-xl text-sm font-semibold">
              <span className="text-muted-foreground">Итого по документу</span>
              <span className="text-lg">{totalAmount.toLocaleString('ru-RU')} ₽</span>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 bg-amber-500 hover:bg-amber-600 text-white font-semibold gap-2"
            >
              <Icon name="ClipboardCheck" size={16} />
              Создать заявку → Этап 2
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}