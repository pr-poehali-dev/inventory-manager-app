import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import Autocomplete, { AutocompleteOption } from '@/components/Autocomplete';
import {
  AppState, saveState, generateId,
  Receipt, ReceiptLine, ReceiptCustomField,
  Partner, Item, updateLocationStock, Operation,
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
  state, onStateChange, onClose,
}: {
  state: AppState;
  onStateChange: (s: AppState) => void;
  onClose: () => void;
}) {
  const counter = state.receiptCounter ?? 1;
  const [docNumber, setDocNumber] = useState(`ПРХ-${String(counter).padStart(4, '0')}`);
  const [supplierLabel, setSupplierLabel] = useState('');
  const [supplierId, setSupplierId] = useState('');
  const [comment, setComment] = useState('');
  const [customFields, setCustomFields] = useState<ReceiptCustomField[]>([]);
  const [newFieldKey, setNewFieldKey] = useState('');
  const [showFieldSuggestions, setShowFieldSuggestions] = useState(false);
  const [lines, setLines] = useState<DraftLine[]>([
    { id: generateId(), itemId: '', itemLabel: '', isNew: false, qty: '1', unit: 'шт', price: '', locationId: '', categoryId: '', description: '', lowStockThreshold: '5' },
  ]);
  const [_step] = useState<'form' | 'preview'>('form');

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
    if (supplierLabel.trim() && !supplierId) {
      const newPartner: Partner = {
        id: generateId(), name: supplierLabel.trim(), type: 'supplier',
        createdAt: new Date().toISOString(),
      };
      next = { ...next, partners: [...(next.partners || []), newPartner] };
      finalSupplierId = newPartner.id;
    }

    const newOperations: Operation[] = [];
    const receiptLines: ReceiptLine[] = [];

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
      }

      next = {
        ...next,
        items: next.items.map(i => i.id === itemId ? { ...i, quantity: i.quantity + qty } : i),
      };

      if (line.locationId) {
        next = updateLocationStock(next, itemId, line.locationId, qty);
      }

      const op: Operation = {
        id: generateId(),
        itemId,
        type: 'in',
        quantity: qty,
        comment: `[Оприходование ${docNumber}] ${customFields.map(f => `${f.key}: ${f.value}`).join(' · ')}${comment ? ' · ' + comment : ''}`,
        from: supplierLabel.trim(),
        to: line.locationId ? next.locations.find(l => l.id === line.locationId)?.name : undefined,
        performedBy: next.currentUser,
        date: new Date().toISOString(),
        locationId: line.locationId || undefined,
      };
      newOperations.push(op);

      receiptLines.push({
        id: line.id,
        itemId,
        itemName: line.itemLabel || next.items.find(i => i.id === itemId)?.name || '',
        qty,
        locationId: line.locationId,
        price: parseFloat(line.price) || undefined,
        unit: line.unit,
        isNew: !line.itemId,
      });
    }

    const receipt: Receipt = {
      id: generateId(),
      number: docNumber.trim(),
      supplierId: finalSupplierId || undefined,
      supplierName: supplierLabel.trim(),
      date: new Date().toISOString(),
      createdBy: next.currentUser,
      lines: receiptLines,
      customFields,
      comment: comment.trim() || undefined,
      totalAmount: totalAmount > 0 ? totalAmount : undefined,
    };

    next = {
      ...next,
      receipts: [receipt, ...(next.receipts || [])],
      operations: [...newOperations, ...next.operations],
      receiptCounter: (next.receiptCounter || 1) + 1,
    };

    onStateChange(next);
    saveState(next);
    onClose();
  };



  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto animate-scale-in">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
              <Icon name="PackagePlus" size={16} />
            </div>
            Новое оприходование
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 pt-2">

          {/* Header section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Номер документа</Label>
              <Input value={docNumber} onChange={e => setDocNumber(e.target.value)} placeholder="ПРХ-0001 / накладная №..." />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1">
                Поставщик <span className="text-destructive">*</span>
              </Label>
              <Autocomplete
                value={supplierLabel}
                onChange={v => { setSupplierLabel(v); setSupplierId(''); }}
                onSelect={opt => { setSupplierLabel(opt.label); setSupplierId(opt.id === '__new__' ? '' : opt.id); }}
                options={supplierOptions}
                placeholder="Выберите или введите нового..."
                allowCustom
              />
              {supplierLabel && !supplierId && (
                <p className="text-xs text-primary flex items-center gap-1">
                  <Icon name="PlusCircle" size={11} />Новый поставщик будет добавлен автоматически
                </p>
              )}
            </div>
          </div>

          {/* Custom fields */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Поля документа</Label>
              <div className="relative">
                <button
                  onClick={() => setShowFieldSuggestions(!showFieldSuggestions)}
                  className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <Icon name="Plus" size={13} />
                  Добавить поле
                </button>
                {showFieldSuggestions && (
                  <div className="absolute right-0 top-6 z-50 bg-card border border-border rounded-xl shadow-modal p-1 min-w-44 animate-scale-in">
                    <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border mb-1">
                      <Input
                        value={newFieldKey}
                        onChange={e => setNewFieldKey(e.target.value)}
                        placeholder="Название поля..."
                        className="h-7 text-xs"
                        onKeyDown={e => e.key === 'Enter' && addCustomField(newFieldKey)}
                        autoFocus
                      />
                      <button onClick={() => addCustomField(newFieldKey)} className="text-primary shrink-0">
                        <Icon name="Plus" size={14} />
                      </button>
                    </div>
                    {COMMON_DOC_FIELDS.map(f => (
                      <button
                        key={f}
                        onClick={() => addCustomField(f)}
                        className="w-full text-left px-2 py-1.5 text-xs hover:bg-muted rounded-lg transition-colors"
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {customFields.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {customFields.map((f, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1 space-y-0">
                      <Label className="text-[11px] text-muted-foreground">{f.key}</Label>
                      <Input
                        value={f.value}
                        onChange={e => updateCustomField(idx, e.target.value)}
                        placeholder="Значение..."
                        className="h-8 text-sm"
                      />
                    </div>
                    <button
                      onClick={() => removeCustomField(idx)}
                      className="mt-4 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                    >
                      <Icon name="X" size={13} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Комментарий</Label>
              <Input value={comment} onChange={e => setComment(e.target.value)} placeholder="Дополнительные заметки..." />
            </div>
          </div>

          {/* Lines table */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>
                Позиции ({validLines.length})
                {totalAmount > 0 && (
                  <span className="ml-2 text-muted-foreground font-normal">
                    · {totalAmount.toLocaleString('ru-RU')} ₽
                  </span>
                )}
              </Label>
              <button
                onClick={addLine}
                className="flex items-center gap-1 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <Icon name="Plus" size={14} />
                Добавить позицию
              </button>
            </div>

            <div className="space-y-3">
              {lines.map((line, idx) => {
                const existingItem = line.itemId ? state.items.find(i => i.id === line.itemId) : null;
                const isDup = duplicateItemIds.has(line.itemId);
                const lineTotal = (parseFloat(line.price) || 0) * (parseInt(line.qty) || 0);

                return (
                  <div
                    key={line.id}
                    className={`rounded-xl border p-4 space-y-3 transition-all
                      ${line.isNew ? 'border-primary/30 bg-primary/3' : isDup ? 'border-warning/40 bg-warning/4' : 'border-border bg-muted/20'}`}
                  >
                    {/* Line header */}
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className={`text-xs font-semibold px-2 py-0.5 rounded-full
                        ${line.isNew ? 'bg-primary/12 text-primary' : 'bg-muted text-muted-foreground'}`}>
                        {line.isNew ? '+ Новый товар' : `Позиция ${idx + 1}`}
                      </div>
                      {existingItem && (
                        <span className="text-xs text-muted-foreground">
                          Остаток: <b className="text-foreground">{existingItem.quantity} {existingItem.unit}</b>
                        </span>
                      )}
                      {isDup && (
                        <span className="text-xs text-warning flex items-center gap-1">
                          <Icon name="AlertTriangle" size={11} />Дубликат
                        </span>
                      )}
                      <button onClick={() => removeLine(line.id)} className="ml-auto text-muted-foreground hover:text-destructive transition-colors">
                        <Icon name="X" size={15} />
                      </button>
                    </div>

                    {/* Item select */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div className="sm:col-span-2 space-y-1">
                        <Label className="text-xs">Товар *</Label>
                        <Autocomplete
                          value={line.itemLabel}
                          onChange={v => updateLine(line.id, { itemLabel: v, itemId: '', isNew: false })}
                          onSelect={opt => {
                            if (opt.id === '__new__') {
                              updateLine(line.id, { itemId: '', itemLabel: opt.label, isNew: true });
                            } else {
                              const item = state.items.find(i => i.id === opt.id);
                              updateLine(line.id, {
                                itemId: opt.id, itemLabel: opt.label, isNew: false,
                                unit: item?.unit || 'шт',
                              });
                            }
                          }}
                          options={itemOptions}
                          placeholder="Начните вводить или создайте новый..."
                          allowCustom
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Ед. изм.</Label>
                        <select
                          value={line.unit}
                          onChange={e => updateLine(line.id, { unit: e.target.value })}
                          className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                        >
                          {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </div>
                    </div>

                    {/* New item extra fields */}
                    {line.isNew && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 py-2 px-3 bg-primary/6 rounded-lg border border-primary/20">
                        <div className="space-y-1">
                          <Label className="text-xs text-primary">Категория</Label>
                          <select
                            value={line.categoryId}
                            onChange={e => updateLine(line.id, { categoryId: e.target.value })}
                            className="w-full h-8 px-2 text-xs rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                          >
                            <option value="">— Выбрать —</option>
                            {state.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                          </select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-primary">Описание</Label>
                          <Input
                            value={line.description}
                            onChange={e => updateLine(line.id, { description: e.target.value })}
                            placeholder="Краткое описание..."
                            className="h-8 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-primary">Порог минимума</Label>
                          <Input
                            type="number"
                            value={line.lowStockThreshold}
                            onChange={e => updateLine(line.id, { lowStockThreshold: e.target.value })}
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}

                    {/* Qty + Location + Price */}
                    <div className="grid grid-cols-3 gap-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Количество *</Label>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => updateLine(line.id, { qty: String(Math.max(1, (parseInt(line.qty) || 0) - 1)) })}
                            className="w-8 h-9 shrink-0 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
                          >
                            <Icon name="Minus" size={12} />
                          </button>
                          <Input
                            type="number"
                            min="1"
                            value={line.qty}
                            onChange={e => updateLine(line.id, { qty: e.target.value })}
                            className="text-center font-bold h-9 px-1"
                          />
                          <button
                            type="button"
                            onClick={() => updateLine(line.id, { qty: String((parseInt(line.qty) || 0) + 1) })}
                            className="w-8 h-9 shrink-0 rounded-lg border border-border bg-card hover:bg-muted flex items-center justify-center transition-colors"
                          >
                            <Icon name="Plus" size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Локация</Label>
                        <select
                          value={line.locationId}
                          onChange={e => updateLine(line.id, { locationId: e.target.value })}
                          className="w-full h-9 px-2 text-sm rounded-lg border border-border bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring appearance-none cursor-pointer"
                        >
                          <option value="">— Не указана —</option>
                          {state.locations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                        </select>
                      </div>

                      <div className="space-y-1">
                        <Label className="text-xs">Цена за ед. (₽)</Label>
                        <div className="relative">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.price}
                            onChange={e => updateLine(line.id, { price: e.target.value })}
                            placeholder="0.00"
                            className="h-9 pr-6"
                          />
                          {lineTotal > 0 && (
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                              ={lineTotal.toLocaleString('ru-RU')}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Result preview */}
                    {existingItem && parseInt(line.qty) > 0 && (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground px-1">
                        <Icon name="TrendingUp" size={12} className="text-success shrink-0" />
                        После оприходования:
                        <span className="font-semibold text-success">
                          {existingItem.quantity} + {line.qty} = {existingItem.quantity + (parseInt(line.qty) || 0)} {existingItem.unit}
                        </span>
                        {line.locationId && (
                          <>
                            <span className="text-muted-foreground/50">·</span>
                            <Icon name="MapPin" size={10} />
                            <span>{state.locations.find(l => l.id === line.locationId)?.name}</span>
                          </>
                        )}
                      </div>
                    )}
                    {line.isNew && line.itemLabel.trim() && (
                      <div className="flex items-center gap-2 text-xs text-primary px-1">
                        <Icon name="Sparkles" size={12} className="shrink-0" />
                        Новый товар «{line.itemLabel}» будет создан в номенклатуре
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Add line button */}
            <button
              onClick={addLine}
              className="w-full py-3 rounded-xl border-2 border-dashed border-border hover:border-primary/50 hover:bg-muted/30 transition-all flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"
            >
              <Icon name="Plus" size={15} />
              Добавить ещё позицию
            </button>
          </div>

          {/* Summary */}
          {validLines.length > 0 && (
            <div className="p-4 bg-success/8 border border-success/25 rounded-xl space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Icon name="CheckCircle2" size={15} className="text-success" />
                Итоги оприходования
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                <div>
                  <div className="text-muted-foreground text-xs">Позиций</div>
                  <div className="font-bold text-foreground">{validLines.length}</div>
                </div>
                <div>
                  <div className="text-muted-foreground text-xs">Новых товаров</div>
                  <div className="font-bold text-primary">{validLines.filter(l => l.isNew).length}</div>
                </div>
                {totalAmount > 0 && (
                  <div>
                    <div className="text-muted-foreground text-xs">Сумма</div>
                    <div className="font-bold text-foreground">{totalAmount.toLocaleString('ru-RU')} ₽</div>
                  </div>
                )}
              </div>
              {validLines.filter(l => l.isNew).length > 0 && (
                <div className="text-xs text-primary flex items-center gap-1.5">
                  <Icon name="Info" size={11} />
                  Новые товары появятся в Каталоге и Номенклатуре после сохранения
                </div>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button variant="outline" onClick={onClose} className="flex-1">Отмена</Button>
            <Button
              onClick={handleSave}
              disabled={!canSave}
              className="flex-1 bg-success hover:bg-success/90 text-success-foreground font-semibold"
            >
              <Icon name="PackagePlus" size={15} className="mr-1.5" />
              Оприходовать ({validLines.length} поз.)
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}