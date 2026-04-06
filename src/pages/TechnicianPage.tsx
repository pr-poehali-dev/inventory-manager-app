import { useState, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { AppState, TechTask, TaskStatus, TaskPriority, TaskCheckItem, TaskCustomField, Attachment, saveState, generateId } from '@/data/store';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getStatusLabel(status: TaskStatus): string {
  switch (status) {
    case 'todo':        return 'К выполнению';
    case 'in_progress': return 'В работе';
    case 'done':        return 'Готово';
    case 'overdue':     return 'Просрочено';
  }
}

function getStatusColor(status: TaskStatus): string {
  switch (status) {
    case 'todo':        return 'bg-muted text-muted-foreground';
    case 'in_progress': return 'bg-primary/10 text-primary';
    case 'done':        return 'bg-success/10 text-success';
    case 'overdue':     return 'bg-destructive/10 text-destructive';
  }
}

function getPriorityLabel(priority: TaskPriority): string {
  switch (priority) {
    case 'low':      return 'Низкий';
    case 'normal':   return 'Обычный';
    case 'high':     return 'Высокий';
    case 'critical': return 'Критический';
  }
}

function getPriorityColor(priority: TaskPriority): string {
  switch (priority) {
    case 'low':      return 'bg-muted text-muted-foreground';
    case 'normal':   return 'bg-primary/10 text-primary';
    case 'high':     return 'bg-warning/10 text-warning';
    case 'critical': return 'bg-destructive/10 text-destructive';
  }
}

function getPriorityBorder(priority: TaskPriority): string {
  switch (priority) {
    case 'low':      return 'bg-muted-foreground/40';
    case 'normal':   return 'bg-primary';
    case 'high':     return 'bg-warning';
    case 'critical': return 'bg-destructive';
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' Б';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' КБ';
  return (bytes / (1024 * 1024)).toFixed(1) + ' МБ';
}

function getFileIcon(mimeType: string): string {
  if (mimeType.startsWith('image/')) return 'Image';
  if (mimeType.includes('pdf')) return 'FileText';
  if (mimeType.includes('word') || mimeType.includes('document')) return 'FileText';
  if (mimeType.includes('excel') || mimeType.includes('spreadsheet')) return 'Table';
  if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archive';
  return 'File';
}

// ─── TaskDetailModal ──────────────────────────────────────────────────────────

type TaskDetailModalProps = {
  task: TechTask;
  state: AppState;
  onClose: () => void;
  onUpdate: (task: TechTask) => void;
  onDelete: (id: string) => void;
};

function TaskDetailModal({ task, state, onClose, onUpdate, onDelete }: TaskDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'task' | 'attachments'>('task');
  const [editTask, setEditTask] = useState<TechTask>({ ...task });
  const [newCheckText, setNewCheckText] = useState('');
  const [newFieldKey, setNewFieldKey] = useState('');
  const [newFieldValue, setNewFieldValue] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const doneItems = editTask.checklist.filter(c => c.done).length;
  const totalItems = editTask.checklist.length;

  function save(updated: TechTask) {
    const final = { ...updated, updatedAt: new Date().toISOString() };
    setEditTask(final);
    onUpdate(final);
  }

  function handleCheckToggle(id: string) {
    const updated = {
      ...editTask,
      checklist: editTask.checklist.map(c => c.id === id ? { ...c, done: !c.done } : c),
    };
    save(updated);
  }

  function handleAddCheckItem() {
    const text = newCheckText.trim();
    if (!text) return;
    const updated = {
      ...editTask,
      checklist: [...editTask.checklist, { id: generateId(), text, done: false }],
    };
    setNewCheckText('');
    save(updated);
  }

  function handleRemoveCheckItem(id: string) {
    const updated = {
      ...editTask,
      checklist: editTask.checklist.filter(c => c.id !== id),
    };
    save(updated);
  }

  function handleAddCustomField() {
    const key = newFieldKey.trim();
    const value = newFieldValue.trim();
    if (!key) return;
    const updated = {
      ...editTask,
      customFields: [...editTask.customFields, { key, value }],
    };
    setNewFieldKey('');
    setNewFieldValue('');
    save(updated);
  }

  function handleRemoveCustomField(index: number) {
    const updated = {
      ...editTask,
      customFields: editTask.customFields.filter((_, i) => i !== index),
    };
    save(updated);
  }

  function handleFieldChange(field: keyof TechTask, value: string | number) {
    const updated = { ...editTask, [field]: value };
    save(updated);
  }

  function handleStatusChange(status: TaskStatus) {
    save({ ...editTask, status });
  }

  function handleProgressChange(value: number) {
    save({ ...editTask, progress: value });
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const fileArr = Array.from(files);
    let processed = 0;
    const newAttachments: Attachment[] = [];

    fileArr.forEach(file => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = (ev.target?.result as string) || '';
        newAttachments.push({
          id: generateId(),
          name: file.name,
          size: file.size,
          mimeType: file.type,
          dataUrl,
          uploadedAt: new Date().toISOString(),
        });
        processed++;
        if (processed === fileArr.length) {
          const updated = {
            ...editTask,
            attachments: [...editTask.attachments, ...newAttachments],
          };
          save(updated);
        }
      };
      reader.readAsDataURL(file);
    });

    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  function handleRemoveAttachment(id: string) {
    const updated = {
      ...editTask,
      attachments: editTask.attachments.filter(a => a.id !== id),
    };
    save(updated);
  }

  const statusList: TaskStatus[] = ['todo', 'in_progress', 'done', 'overdue'];

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-modal animate-scale-in p-0">
        <div className={`h-1.5 w-full rounded-t-lg ${getPriorityBorder(editTask.priority)}`} />
        <div className="flex flex-col overflow-hidden flex-1 px-6 pb-6 pt-4">
          <DialogHeader className="mb-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <input
                  className="text-xl font-bold text-foreground bg-transparent border-none outline-none w-full focus:ring-0 p-0 leading-tight"
                  value={editTask.title}
                  onChange={e => setEditTask(prev => ({ ...prev, title: e.target.value }))}
                  onBlur={() => save(editTask)}
                />
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(editTask.status)}`}>
                    {getStatusLabel(editTask.status)}
                  </span>
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getPriorityColor(editTask.priority)}`}>
                    {getPriorityLabel(editTask.priority)}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                    {editTask.category}
                  </span>
                </div>
              </div>
              {confirmDelete ? (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-muted-foreground">Удалить?</span>
                  <Button size="sm" variant="destructive" onClick={() => onDelete(editTask.id)}>Да</Button>
                  <Button size="sm" variant="outline" onClick={() => setConfirmDelete(false)}>Нет</Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" className="text-muted-foreground hover:text-destructive flex-shrink-0" onClick={() => setConfirmDelete(true)}>
                  <Icon name="Trash2" size={16} />
                </Button>
              )}
            </div>
          </DialogHeader>

          {/* Tabs */}
          <div className="flex gap-1 border-b border-border mb-4">
            {(['task', 'attachments'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === tab
                    ? 'text-primary border-b-2 border-primary -mb-px'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab === 'task' ? (
                  <span className="flex items-center gap-1.5"><Icon name="ClipboardList" size={14} />Задача</span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <Icon name="Paperclip" size={14} />
                    Вложения
                    {editTask.attachments.length > 0 && (
                      <span className="ml-1 bg-primary/10 text-primary text-xs rounded-full px-1.5">{editTask.attachments.length}</span>
                    )}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="overflow-y-auto flex-1 space-y-5 pr-1">
            {activeTab === 'task' && (
              <>
                {/* Status buttons */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Статус</Label>
                  <div className="flex flex-wrap gap-2">
                    {statusList.map(s => (
                      <button
                        key={s}
                        onClick={() => handleStatusChange(s)}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                          editTask.status === s
                            ? `${getStatusColor(s)} border-current`
                            : 'border-border text-muted-foreground hover:border-border hover:bg-muted'
                        }`}
                      >
                        {getStatusLabel(s)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Progress slider */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Прогресс</span>
                    <span className="text-foreground font-semibold">{editTask.progress}%</span>
                  </Label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={editTask.progress}
                    onChange={e => handleProgressChange(Number(e.target.value))}
                    className="w-full h-2 appearance-none rounded-full bg-muted cursor-pointer accent-primary"
                  />
                  <div className="h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${editTask.progress}%` }}
                    />
                  </div>
                </div>

                {/* Meta fields */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Исполнитель</Label>
                    <Input
                      value={editTask.assignee || ''}
                      onChange={e => setEditTask(prev => ({ ...prev, assignee: e.target.value }))}
                      onBlur={() => save(editTask)}
                      placeholder="Имя исполнителя"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Срок выполнения</Label>
                    <Input
                      type="date"
                      value={editTask.dueDate || ''}
                      onChange={e => handleFieldChange('dueDate', e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Локация</Label>
                    <select
                      value={editTask.locationId || ''}
                      onChange={e => handleFieldChange('locationId', e.target.value)}
                      className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">— не указана —</option>
                      {state.locations.map(loc => (
                        <option key={loc.id} value={loc.id}>{loc.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground mb-1 block">Приоритет</Label>
                    <select
                      value={editTask.priority}
                      onChange={e => handleFieldChange('priority', e.target.value as TaskPriority)}
                      className="w-full h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="low">Низкий</option>
                      <option value="normal">Обычный</option>
                      <option value="high">Высокий</option>
                      <option value="critical">Критический</option>
                    </select>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Описание</Label>
                  <textarea
                    value={editTask.description || ''}
                    onChange={e => setEditTask(prev => ({ ...prev, description: e.target.value }))}
                    onBlur={() => save(editTask)}
                    placeholder="Подробное описание задачи..."
                    rows={3}
                    className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                  />
                </div>

                {/* Checklist */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 flex items-center justify-between">
                    <span>Чек-лист</span>
                    {totalItems > 0 && (
                      <span className="text-foreground font-semibold">{doneItems}/{totalItems}</span>
                    )}
                  </Label>
                  {totalItems > 0 && (
                    <div className="h-1 bg-muted rounded-full mb-3 overflow-hidden">
                      <div
                        className="h-full bg-success rounded-full transition-all"
                        style={{ width: `${totalItems > 0 ? (doneItems / totalItems) * 100 : 0}%` }}
                      />
                    </div>
                  )}
                  <div className="space-y-1.5 mb-2">
                    {editTask.checklist.map(item => (
                      <div key={item.id} className="flex items-center gap-2 group py-1 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                        <button
                          onClick={() => handleCheckToggle(item.id)}
                          className={`flex-shrink-0 w-4 h-4 rounded border transition-all flex items-center justify-center ${
                            item.done
                              ? 'bg-success border-success text-success-foreground'
                              : 'border-border hover:border-primary'
                          }`}
                        >
                          {item.done && <Icon name="Check" size={10} />}
                        </button>
                        <span className={`flex-1 text-sm ${item.done ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {item.text}
                        </span>
                        <button
                          onClick={() => handleRemoveCheckItem(item.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                        >
                          <Icon name="X" size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={newCheckText}
                      onChange={e => setNewCheckText(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddCheckItem(); }}
                      placeholder="Добавить пункт..."
                      className="h-8 text-sm flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={handleAddCheckItem} className="h-8 px-3">
                      <Icon name="Plus" size={14} />
                    </Button>
                  </div>
                </div>

                {/* Custom fields */}
                <div>
                  <Label className="text-xs text-muted-foreground uppercase tracking-wide mb-2 block">Дополнительные поля</Label>
                  {editTask.customFields.length > 0 && (
                    <div className="space-y-1.5 mb-2">
                      {editTask.customFields.map((cf, i) => (
                        <div key={i} className="flex items-center gap-2 group px-2 py-1.5 rounded-lg bg-muted/40">
                          <span className="text-xs font-medium text-muted-foreground w-28 flex-shrink-0 truncate">{cf.key}</span>
                          <span className="flex-1 text-sm text-foreground truncate">{cf.value}</span>
                          <button
                            onClick={() => handleRemoveCustomField(i)}
                            className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-0.5"
                          >
                            <Icon name="X" size={12} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Input
                      value={newFieldKey}
                      onChange={e => setNewFieldKey(e.target.value)}
                      placeholder="Поле"
                      className="h-8 text-sm w-28"
                    />
                    <Input
                      value={newFieldValue}
                      onChange={e => setNewFieldValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddCustomField(); }}
                      placeholder="Значение"
                      className="h-8 text-sm flex-1"
                    />
                    <Button size="sm" variant="outline" onClick={handleAddCustomField} className="h-8 px-3">
                      <Icon name="Plus" size={14} />
                    </Button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'attachments' && (
              <>
                <div
                  className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Icon name="Upload" size={28} className="mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">Нажмите или перетащите файлы сюда</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Любые форматы файлов</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    className="hidden"
                    onChange={handleFileUpload}
                  />
                </div>

                {editTask.attachments.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    <Icon name="Paperclip" size={24} className="mx-auto mb-2 opacity-40" />
                    Вложений нет
                  </div>
                ) : (
                  <div className="space-y-2">
                    {editTask.attachments.map(att => (
                      <div key={att.id} className="flex items-center gap-3 p-3 rounded-lg border border-border bg-muted/30 group hover:bg-muted/60 transition-colors">
                        {att.mimeType.startsWith('image/') && att.dataUrl ? (
                          <img src={att.dataUrl} alt={att.name} className="w-10 h-10 rounded object-cover flex-shrink-0 border border-border" />
                        ) : (
                          <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
                            <Icon name={getFileIcon(att.mimeType)} size={20} className="text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{att.name}</p>
                          <p className="text-xs text-muted-foreground">{formatFileSize(att.size)}</p>
                        </div>
                        <button
                          onClick={() => handleRemoveAttachment(att.id)}
                          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1.5 rounded-md hover:bg-destructive/10"
                        >
                          <Icon name="Trash2" size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── NewTaskModal ─────────────────────────────────────────────────────────────

type NewTaskModalProps = {
  state: AppState;
  onClose: () => void;
  onCreate: (task: TechTask) => void;
};

function NewTaskModal({ state, onClose, onCreate }: NewTaskModalProps) {
  const existingCategories = useMemo(() => {
    const cats = new Set<string>();
    state.techTasks.forEach(t => cats.add(t.category));
    ['Обслуживание', 'Ремонт', 'Инвентаризация', 'Уборка', 'Проверка'].forEach(c => cats.add(c));
    return Array.from(cats).filter(Boolean);
  }, [state.techTasks]);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(existingCategories[0] || 'Обслуживание');
  const [customCategory, setCustomCategory] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [assignee, setAssignee] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [locationId, setLocationId] = useState('');
  const [checkItems, setCheckItems] = useState<string[]>(['']);
  const [customFields, setCustomFields] = useState<TaskCustomField[]>([]);
  const [cfKey, setCfKey] = useState('');
  const [cfValue, setCfValue] = useState('');
  const [errors, setErrors] = useState<{ title?: string }>({});

  function handleAddCheckItem() {
    setCheckItems(prev => [...prev, '']);
  }

  function handleRemoveCheckItem(idx: number) {
    setCheckItems(prev => prev.filter((_, i) => i !== idx));
  }

  function handleCheckItemChange(idx: number, val: string) {
    setCheckItems(prev => prev.map((v, i) => i === idx ? val : v));
  }

  function handleAddCustomField() {
    const key = cfKey.trim();
    if (!key) return;
    setCustomFields(prev => [...prev, { key, value: cfValue.trim() }]);
    setCfKey('');
    setCfValue('');
  }

  function handleRemoveCustomField(idx: number) {
    setCustomFields(prev => prev.filter((_, i) => i !== idx));
  }

  function handleSubmit() {
    const trimTitle = title.trim();
    if (!trimTitle) {
      setErrors({ title: 'Введите название задачи' });
      return;
    }
    const finalCategory = category === '__custom__' ? customCategory.trim() || 'Без категории' : category;
    const checklist: TaskCheckItem[] = checkItems
      .map(text => text.trim())
      .filter(text => text.length > 0)
      .map(text => ({ id: generateId(), text, done: false }));

    const now = new Date().toISOString();
    const newTask: TechTask = {
      id: generateId(),
      title: trimTitle,
      description: description.trim() || undefined,
      status,
      priority,
      category: finalCategory,
      assignee: assignee.trim() || undefined,
      dueDate: dueDate || undefined,
      locationId: locationId || undefined,
      createdAt: now,
      updatedAt: now,
      checklist,
      customFields,
      attachments: [],
      progress: 0,
      tags: [],
    };
    onCreate(newTask);
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-modal animate-scale-in p-0">
        <div className={`h-1.5 w-full rounded-t-lg ${getPriorityBorder(priority)}`} />
        <div className="flex flex-col overflow-hidden flex-1 px-6 pb-6 pt-4">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-lg font-bold text-foreground">Новая задача</DialogTitle>
          </DialogHeader>

          <div className="overflow-y-auto flex-1 space-y-4 pr-1">
            {/* Title */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">
                Название <span className="text-destructive">*</span>
              </Label>
              <Input
                value={title}
                onChange={e => { setTitle(e.target.value); if (errors.title) setErrors({}); }}
                placeholder="Что нужно сделать?"
                className={errors.title ? 'border-destructive' : ''}
                autoFocus
              />
              {errors.title && <p className="text-xs text-destructive mt-1">{errors.title}</p>}
            </div>

            {/* Description */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Описание</Label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Подробности задачи..."
                rows={3}
                className="w-full text-sm rounded-lg border border-input bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              />
            </div>

            {/* Category */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Категория</Label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                {existingCategories.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
                <option value="__custom__">+ Новая категория...</option>
              </select>
              {category === '__custom__' && (
                <Input
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Название категории"
                  className="mt-2 text-sm"
                />
              )}
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Приоритет</Label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as TaskPriority)}
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="low">Низкий</option>
                  <option value="normal">Обычный</option>
                  <option value="high">Высокий</option>
                  <option value="critical">Критический</option>
                </select>
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Статус</Label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as TaskStatus)}
                  className="w-full h-9 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="todo">К выполнению</option>
                  <option value="in_progress">В работе</option>
                  <option value="done">Готово</option>
                  <option value="overdue">Просрочено</option>
                </select>
              </div>
            </div>

            {/* Assignee & Due date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Исполнитель</Label>
                <Input
                  value={assignee}
                  onChange={e => setAssignee(e.target.value)}
                  placeholder="Имя исполнителя"
                  className="text-sm h-9"
                />
              </div>
              <div>
                <Label className="text-sm font-medium mb-1.5 block">Срок выполнения</Label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={e => setDueDate(e.target.value)}
                  className="text-sm h-9"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Локация</Label>
              <select
                value={locationId}
                onChange={e => setLocationId(e.target.value)}
                className="w-full h-9 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="">— не указана —</option>
                {state.locations.map(loc => (
                  <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
              </select>
            </div>

            {/* Checklist */}
            <div>
              <Label className="text-sm font-medium mb-1.5 flex items-center justify-between">
                <span>Чек-лист</span>
                <button onClick={handleAddCheckItem} className="text-xs text-primary hover:underline flex items-center gap-1">
                  <Icon name="Plus" size={12} /> Добавить пункт
                </button>
              </Label>
              <div className="space-y-1.5">
                {checkItems.map((item, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border border-border flex-shrink-0" />
                    <Input
                      value={item}
                      onChange={e => handleCheckItemChange(idx, e.target.value)}
                      placeholder={`Пункт ${idx + 1}`}
                      className="text-sm h-8 flex-1"
                    />
                    {checkItems.length > 1 && (
                      <button onClick={() => handleRemoveCheckItem(idx)} className="text-muted-foreground hover:text-destructive p-1">
                        <Icon name="X" size={12} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Custom fields */}
            <div>
              <Label className="text-sm font-medium mb-1.5 block">Дополнительные поля</Label>
              {customFields.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {customFields.map((cf, i) => (
                    <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-muted/40 group">
                      <span className="text-xs font-medium text-muted-foreground w-24 flex-shrink-0 truncate">{cf.key}</span>
                      <span className="flex-1 text-sm text-foreground truncate">{cf.value}</span>
                      <button onClick={() => handleRemoveCustomField(i)} className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive p-0.5">
                        <Icon name="X" size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <Input
                  value={cfKey}
                  onChange={e => setCfKey(e.target.value)}
                  placeholder="Поле"
                  className="h-8 text-sm w-28"
                />
                <Input
                  value={cfValue}
                  onChange={e => setCfValue(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCustomField(); }}
                  placeholder="Значение"
                  className="h-8 text-sm flex-1"
                />
                <Button size="sm" variant="outline" onClick={handleAddCustomField} className="h-8 px-3">
                  <Icon name="Plus" size={14} />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-4 pt-4 border-t border-border">
            <Button variant="outline" onClick={onClose}>Отмена</Button>
            <Button onClick={handleSubmit}>
              <Icon name="Plus" size={16} className="mr-1.5" />
              Создать задачу
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── TechnicianPage ───────────────────────────────────────────────────────────

type Props = {
  state: AppState;
  onStateChange: (s: AppState) => void;
};

const STATUS_TABS: { value: TaskStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'todo', label: 'К выполнению' },
  { value: 'in_progress', label: 'В работе' },
  { value: 'done', label: 'Готово' },
  { value: 'overdue', label: 'Просрочено' },
];

export default function TechnicianPage({ state, onStateChange }: Props) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<TaskStatus | 'all'>('all');
  const [priorityFilter, setPriorityFilter] = useState<TaskPriority | 'all'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);

  const tasks = state.techTasks || [];

  const categories = useMemo(() => {
    const cats = new Set<string>();
    tasks.forEach(t => cats.add(t.category));
    return Array.from(cats).filter(Boolean).sort();
  }, [tasks]);

  const filtered = useMemo(() => {
    let list = [...tasks];
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.assignee?.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') list = list.filter(t => t.status === statusFilter);
    if (priorityFilter !== 'all') list = list.filter(t => t.priority === priorityFilter);
    if (categoryFilter !== 'all') list = list.filter(t => t.category === categoryFilter);
    list.sort((a, b) => {
      const priorityOrder: Record<TaskPriority, number> = { critical: 0, high: 1, normal: 2, low: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority] || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return list;
  }, [tasks, search, statusFilter, priorityFilter, categoryFilter]);

  const stats = useMemo(() => ({
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    done: tasks.filter(t => t.status === 'done').length,
    overdue: tasks.filter(t => t.status === 'overdue').length,
  }), [tasks]);

  const overallProgress = useMemo(() => {
    if (tasks.length === 0) return 0;
    return Math.round(tasks.reduce((acc, t) => acc + t.progress, 0) / tasks.length);
  }, [tasks]);

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) || null : null;

  function updateTask(updated: TechTask) {
    const newTasks = tasks.map(t => t.id === updated.id ? updated : t);
    const newState = { ...state, techTasks: newTasks };
    saveState(newState);
    onStateChange(newState);
  }

  function deleteTask(id: string) {
    const newTasks = tasks.filter(t => t.id !== id);
    const newState = { ...state, techTasks: newTasks };
    saveState(newState);
    onStateChange(newState);
    setSelectedTaskId(null);
  }

  function createTask(task: TechTask) {
    const newState = { ...state, techTasks: [...tasks, task] };
    saveState(newState);
    onStateChange(newState);
    setShowNewModal(false);
  }

  return (
    <div className="space-y-5 pb-20 md:pb-0 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Техник склада</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Управление задачами и обслуживанием</p>
        </div>
        <Button onClick={() => setShowNewModal(true)} className="flex items-center gap-2">
          <Icon name="Plus" size={16} />
          Новая задача
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Всего</span>
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <Icon name="ClipboardList" size={16} className="text-muted-foreground" />
            </div>
          </div>
          <p className="text-3xl font-bold text-foreground">{stats.total}</p>
          <p className="text-xs text-muted-foreground mt-0.5">задач</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">В работе</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon name="Loader2" size={16} className="text-primary" />
            </div>
          </div>
          <p className="text-3xl font-bold text-primary">{stats.inProgress}</p>
          <p className="text-xs text-muted-foreground mt-0.5">активных</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Готово</span>
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center">
              <Icon name="CheckCircle2" size={16} className="text-success" />
            </div>
          </div>
          <p className="text-3xl font-bold text-success">{stats.done}</p>
          <p className="text-xs text-muted-foreground mt-0.5">выполнено</p>
        </div>
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Просрочено</span>
            <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center">
              <Icon name="AlertCircle" size={16} className="text-destructive" />
            </div>
          </div>
          <p className="text-3xl font-bold text-destructive">{stats.overdue}</p>
          <p className="text-xs text-muted-foreground mt-0.5">нарушение сроков</p>
        </div>
      </div>

      {/* Overall progress */}
      {tasks.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 shadow-card">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-foreground">Общий прогресс выполнения</span>
            <span className="text-sm font-bold text-primary">{overallProgress}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${overallProgress}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {stats.done} из {stats.total} задач завершено
          </p>
        </div>
      )}

      {/* Filters */}
      <div className="space-y-3">
        {/* Search */}
        <div className="relative">
          <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Поиск задач..."
            className="pl-9"
          />
        </div>

        {/* Status tabs */}
        <div className="flex gap-1 overflow-x-auto pb-1 scrollbar-none">
          {STATUS_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === tab.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
              }`}
            >
              {tab.label}
              {tab.value !== 'all' && (
                <span className={`ml-1.5 text-xs rounded-full px-1.5 ${
                  statusFilter === tab.value
                    ? 'bg-primary-foreground/20 text-primary-foreground'
                    : 'bg-background text-muted-foreground'
                }`}>
                  {tasks.filter(t => t.status === tab.value).length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Priority & Category filters */}
        <div className="flex gap-2 flex-wrap">
          <select
            value={priorityFilter}
            onChange={e => setPriorityFilter(e.target.value as TaskPriority | 'all')}
            className="h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="all">Все приоритеты</option>
            <option value="critical">Критический</option>
            <option value="high">Высокий</option>
            <option value="normal">Обычный</option>
            <option value="low">Низкий</option>
          </select>
          {categories.length > 0 && (
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="h-8 text-sm rounded-md border border-input bg-background px-2 text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            >
              <option value="all">Все категории</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          )}
          {(priorityFilter !== 'all' || categoryFilter !== 'all' || search.trim()) && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => { setPriorityFilter('all'); setCategoryFilter('all'); setSearch(''); }}
              className="h-8 text-muted-foreground hover:text-foreground"
            >
              <Icon name="X" size={14} className="mr-1" />
              Сбросить
            </Button>
          )}
        </div>
      </div>

      {/* Task list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Icon name="ClipboardList" size={28} className="text-muted-foreground" />
          </div>
          <p className="text-foreground font-medium">
            {tasks.length === 0 ? 'Задач пока нет' : 'Нет задач по выбранным фильтрам'}
          </p>
          <p className="text-sm text-muted-foreground mt-1">
            {tasks.length === 0
              ? 'Создайте первую задачу нажав "+ Новая задача"'
              : 'Попробуйте изменить фильтры или поисковый запрос'}
          </p>
          {tasks.length === 0 && (
            <Button className="mt-4" onClick={() => setShowNewModal(true)}>
              <Icon name="Plus" size={16} className="mr-1.5" />
              Создать задачу
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(task => {
            const doneChecks = task.checklist.filter(c => c.done).length;
            const totalChecks = task.checklist.length;
            const checkProgress = totalChecks > 0 ? (doneChecks / totalChecks) * 100 : 0;
            const locationName = task.locationId
              ? state.locations.find(l => l.id === task.locationId)?.name
              : null;

            return (
              <div
                key={task.id}
                onClick={() => setSelectedTaskId(task.id)}
                className="bg-card border border-border rounded-xl shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all cursor-pointer group overflow-hidden animate-fade-in"
              >
                <div className="flex">
                  {/* Priority stripe */}
                  <div className={`w-1 flex-shrink-0 ${getPriorityBorder(task.priority)}`} />

                  <div className="flex-1 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(task.status)}`}>
                            {getStatusLabel(task.status)}
                          </span>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-accent text-accent-foreground">
                            {task.category}
                          </span>
                          {task.priority === 'critical' && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-destructive/10 text-destructive">
                              <Icon name="Zap" size={10} />
                              Критично
                            </span>
                          )}
                        </div>

                        <h3 className="font-semibold text-foreground text-base leading-tight group-hover:text-primary transition-colors truncate">
                          {task.title}
                        </h3>

                        {task.description && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{task.description}</p>
                        )}

                        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-muted-foreground">
                          {task.assignee && (
                            <span className="flex items-center gap-1">
                              <Icon name="User" size={12} />
                              {task.assignee}
                            </span>
                          )}
                          {task.dueDate && (
                            <span className={`flex items-center gap-1 ${
                              task.status !== 'done' && new Date(task.dueDate) < new Date()
                                ? 'text-destructive font-medium'
                                : ''
                            }`}>
                              <Icon name="Calendar" size={12} />
                              {new Date(task.dueDate).toLocaleDateString('ru-RU')}
                            </span>
                          )}
                          {locationName && (
                            <span className="flex items-center gap-1">
                              <Icon name="MapPin" size={12} />
                              {locationName}
                            </span>
                          )}
                          {task.attachments.length > 0 && (
                            <span className="flex items-center gap-1">
                              <Icon name="Paperclip" size={12} />
                              {task.attachments.length}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <span className={`text-xs font-bold ${
                          task.progress === 100
                            ? 'text-success'
                            : task.progress > 0
                            ? 'text-primary'
                            : 'text-muted-foreground'
                        }`}>
                          {task.progress}%
                        </span>
                        <Icon
                          name="ChevronRight"
                          size={16}
                          className="text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all"
                        />
                      </div>
                    </div>

                    {/* Progress bar */}
                    {(task.progress > 0 || totalChecks > 0) && (
                      <div className="mt-3">
                        {totalChecks > 0 ? (
                          <div>
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted-foreground flex items-center gap-1">
                                <Icon name="CheckSquare" size={10} />
                                {doneChecks}/{totalChecks} пунктов
                              </span>
                            </div>
                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-success rounded-full transition-all"
                                style={{ width: `${checkProgress}%` }}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full transition-all"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {selectedTask && (
        <TaskDetailModal
          key={selectedTask.id}
          task={selectedTask}
          state={state}
          onClose={() => setSelectedTaskId(null)}
          onUpdate={updateTask}
          onDelete={deleteTask}
        />
      )}

      {showNewModal && (
        <NewTaskModal
          state={state}
          onClose={() => setShowNewModal(false)}
          onCreate={createTask}
        />
      )}
    </div>
  );
}
