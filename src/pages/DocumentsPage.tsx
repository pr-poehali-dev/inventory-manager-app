import { useState, useRef, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, Attachment, generateId, crudAction } from '@/data/store';


type Props = { state: AppState; onStateChange: (s: AppState) => void };

type TabKey = 'receipts' | 'expenses';

const formatBytes = (b: number) =>
  b < 1024 ? `${b} Б` : b < 1048576 ? `${(b / 1024).toFixed(1)} КБ` : `${(b / 1048576).toFixed(1)} МБ`;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft:      { label: 'Черновик',        cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  pending:    { label: 'Заявка',          cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  confirming: { label: 'Подтверждение',   cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  posted:     { label: 'Оприходовано',    cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  active:     { label: 'В работе',        cls: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300' },
  assembled:  { label: 'Собрана',         cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  closed:     { label: 'Закрыта',         cls: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300' },
  pending_stock: { label: 'Нет остатков', cls: 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-300' },
};

function StatusBadge({ status }: { status: string }) {
  const info = STATUS_LABELS[status] || { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${info.cls}`}>
      {info.label}
    </span>
  );
}

/* ─── Main Component ────────────────────────────────────────────────────── */

export default function DocumentsPage({ state, onStateChange }: Props) {
  const [tab, setTab] = useState<TabKey>('receipts');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTargetId, setUploadTargetId] = useState<string | null>(null);

  const receipts = state.receipts || [];
  const workOrders = state.workOrders || [];

  /* ─── Filtered lists ──────────────────────────────────────────────── */

  const receiptDocs = useMemo(() => {
    const list = receipts.filter(r => r.status === 'posted' || (r.attachments && r.attachments.length > 0));
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(r =>
      r.number.toLowerCase().includes(q) ||
      r.supplierName.toLowerCase().includes(q)
    );
  }, [receipts, search]);

  const expenseOrders = useMemo(() => {
    const list = workOrders.filter(o => o.status === 'assembled' || o.status === 'closed');
    if (!search.trim()) return list;
    const q = search.toLowerCase();
    return list.filter(o =>
      o.number.toLowerCase().includes(q) ||
      o.title.toLowerCase().includes(q) ||
      (o.recipientName || '').toLowerCase().includes(q)
    );
  }, [workOrders, search]);

  /* ─── Stats ───────────────────────────────────────────────────────── */

  const totalReceiptAttachments = receipts.reduce((s, r) => s + (r.attachments?.length || 0), 0);
  const postedCount = receipts.filter(r => r.status === 'posted').length;
  const assembledCount = workOrders.filter(o => o.status === 'assembled' || o.status === 'closed').length;

  /* ─── File upload ─────────────────────────────────────────────────── */

  const handleFileUpload = (receiptId: string, files: FileList) => {
    Array.from(files).forEach(file => {
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
        const receipt = state.receipts.find(r => r.id === receiptId);
        if (!receipt) return;
        const updated = { ...receipt, attachments: [...(receipt.attachments || []), att] };
        const next = { ...state, receipts: state.receipts.map(r => r.id === receiptId ? updated : r) };
        onStateChange(next);
        crudAction('upsert_receipt', { receipt: updated, receiptLines: updated.lines });
      };
      reader.readAsDataURL(file);
    });
  };

  const handleDeleteAttachment = (receiptId: string, attachmentId: string) => {
    const receipt = state.receipts.find(r => r.id === receiptId);
    if (!receipt) return;
    const updated = { ...receipt, attachments: (receipt.attachments || []).filter(a => a.id !== attachmentId) };
    const next = { ...state, receipts: state.receipts.map(r => r.id === receiptId ? updated : r) };
    onStateChange(next);
    crudAction('upsert_receipt', { receipt: updated, receiptLines: updated.lines });
  };

  const triggerUpload = (receiptId: string) => {
    setUploadTargetId(receiptId);
    setTimeout(() => fileInputRef.current?.click(), 50);
  };

  /* ─── Tab config ──────────────────────────────────────────────────── */

  const TABS: { key: TabKey; label: string; icon: string; count: number }[] = [
    { key: 'receipts',  label: 'Приходы',            icon: 'PackageCheck', count: receiptDocs.length },
    { key: 'expenses',  label: 'Расходы',            icon: 'PackageMinus', count: expenseOrders.length },
  ];

  /* ─── Render helpers ──────────────────────────────────────────────── */

  const getFileIcon = (mime: string) => {
    if (mime.startsWith('image/')) return 'Image';
    if (mime.includes('pdf')) return 'FileText';
    if (mime.includes('spreadsheet') || mime.includes('excel') || mime.includes('csv')) return 'Table';
    if (mime.includes('word') || mime.includes('document')) return 'FileType';
    return 'File';
  };

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={e => {
          if (e.target.files && uploadTargetId) {
            handleFileUpload(uploadTargetId, e.target.files);
          }
          e.target.value = '';
          setUploadTargetId(null);
        }}
      />

      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Документы</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {postedCount} приходов · {assembledCount} расходов · {totalReceiptAttachments} вложений
          </p>
        </div>
      </div>

      {/* ─── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Приходы',      value: postedCount,             icon: 'PackageCheck',  color: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Расходы',      value: assembledCount,          icon: 'PackageMinus',  color: 'text-blue-600 dark:text-blue-400' },
          { label: 'Вложений',     value: totalReceiptAttachments, icon: 'Paperclip',     color: 'text-amber-600 dark:text-amber-400' },
        ].map(s => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-3 shadow-card text-center">
            <Icon name={s.icon} size={16} className={`mx-auto mb-1 ${s.color}`} />
            <div className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ─── Tabs ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(''); setExpandedId(null); }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors
              ${tab === t.key
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground hover:bg-card/50'}`}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
            <span className={`ml-1 text-[11px] px-1.5 py-0.5 rounded-full tabular-nums
              ${tab === t.key ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* ─── Search bar ───────────────────────────────────────────── */}
      <div className="relative">
        <Icon name="Search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={
            tab === 'receipts' ? 'Поиск по номеру или поставщику...'
            : 'Поиск по номеру, названию или получателю...'
          }
          className="pl-9"
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <Icon name="X" size={14} />
          </button>
        )}
      </div>

      {/* ─── Tab: Receipts ────────────────────────────────────────── */}
      {tab === 'receipts' && (
        <div className="space-y-2">
          {receiptDocs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="FileSearch" size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Нет документов приходов</p>
              <p className="text-sm mt-1">Оприходованные документы появятся здесь</p>
            </div>
          ) : (
            receiptDocs.map(receipt => {
              const isExpanded = expandedId === receipt.id;
              const attachments = receipt.attachments || [];
              return (
                <div key={receipt.id} className="bg-card border border-border rounded-xl shadow-card overflow-hidden">
                  {/* Card header */}
                  <button
                    className="w-full flex items-center gap-3 p-4 text-left hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : receipt.id)}
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-300 flex items-center justify-center shrink-0">
                      <Icon name="PackageCheck" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">#{receipt.number}</span>
                        <StatusBadge status={receipt.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {receipt.supplierName} · {new Date(receipt.date).toLocaleDateString('ru-RU')}
                        {attachments.length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-0.5">
                            <Icon name="Paperclip" size={10} />
                            {attachments.length}
                          </span>
                        )}
                      </div>
                    </div>
                    <Icon
                      name={isExpanded ? 'ChevronUp' : 'ChevronDown'}
                      size={16}
                      className="text-muted-foreground shrink-0"
                    />
                  </button>

                  {/* Expanded section */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 pb-4 pt-3 space-y-3">
                      {/* Receipt info */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">Поставщик</span>
                          <div className="font-medium">{receipt.supplierName}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Позиций</span>
                          <div className="font-medium">{receipt.lines.length}</div>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">Дата</span>
                          <div className="font-medium">{new Date(receipt.date).toLocaleDateString('ru-RU')}</div>
                        </div>
                      </div>

                      {/* Attachments */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                            Вложения ({attachments.length})
                          </h4>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs gap-1"
                            onClick={() => triggerUpload(receipt.id)}
                          >
                            <Icon name="Upload" size={12} />
                            Добавить файл
                          </Button>
                        </div>

                        {attachments.length === 0 ? (
                          <div className="text-center py-6 border border-dashed border-border rounded-lg text-muted-foreground text-sm">
                            <Icon name="FileUp" size={20} className="mx-auto mb-1.5 opacity-40" />
                            Нет вложений
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {attachments.map(att => (
                              <div
                                key={att.id}
                                className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 text-sm group"
                              >
                                <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center shrink-0">
                                  <Icon name={getFileIcon(att.mimeType)} size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{att.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {formatBytes(att.size)} · {new Date(att.uploadedAt).toLocaleDateString('ru-RU')}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {att.dataUrl && (
                                    <a
                                      href={att.dataUrl}
                                      download={att.name}
                                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                      title="Скачать"
                                    >
                                      <Icon name="Download" size={13} />
                                    </a>
                                  )}
                                  <button
                                    onClick={() => handleDeleteAttachment(receipt.id, att.id)}
                                    className="p-1.5 rounded-md hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
                                    title="Удалить"
                                  >
                                    <Icon name="Trash2" size={13} />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ─── Tab: Expenses ────────────────────────────────────────── */}
      {tab === 'expenses' && (
        <div className="space-y-2">
          {expenseOrders.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Icon name="FileSearch" size={36} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">Нет документов расходов</p>
              <p className="text-sm mt-1">Собранные и закрытые заявки появятся здесь</p>
            </div>
          ) : (
            expenseOrders.map(order => {
              const recipient = order.recipientName
                || (order.recipientId ? state.partners.find(p => p.id === order.recipientId)?.name : undefined)
                || '—';
              const totalItems = order.items.reduce((s, i) => s + i.requiredQty, 0);
              const pickedItems = order.items.reduce((s, i) => s + i.pickedQty, 0);

              return (
                <div key={order.id} className="bg-card border border-border rounded-xl shadow-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center shrink-0">
                      <Icon name="PackageMinus" size={16} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-sm">#{order.number}</span>
                        <StatusBadge status={order.status} />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 truncate">
                        {order.recipientName || `${order.items.length} позиций`}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                    <div>
                      <span className="text-muted-foreground text-xs">Получатель</span>
                      <div className="font-medium truncate">{recipient}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Позиций</span>
                      <div className="font-medium">{order.items.length}</div>
                    </div>
                    <div>
                      <span className="text-muted-foreground text-xs">Собрано</span>
                      <div className="font-medium tabular-nums">{pickedItems}/{totalItems}</div>
                    </div>
                  </div>

                  {order.comment && (
                    <div className="mt-2 text-xs text-muted-foreground bg-muted/50 rounded-lg px-3 py-2">
                      {order.comment}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
