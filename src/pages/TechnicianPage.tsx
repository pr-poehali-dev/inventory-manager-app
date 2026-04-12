import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { AppState, DocEntry, crudAction } from '@/data/store';
import { DocCard } from './technician/DocCard';
import { DocDetailModal, NewDocModal } from './technician/DocModals';
import { formatDate } from './technician/technicianUtils';
import BoardView from './technician/BoardView';

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
  const [pageMode,    setPageMode]    = useState<'docs' | 'board'>('docs');

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
    onStateChange(next); crudAction('upsert_tech_doc', { techDoc: doc });
  };

  const deleteDoc = (id: string) => {
    const next = { ...state, techDocs: docs.filter(d => d.id !== id) };
    onStateChange(next); crudAction('delete_tech_doc', { techDocId: id });
  };

  const activeFilters = [search, typeFilter !== 'all', catFilter !== 'all', itemFilter !== 'all'].filter(Boolean).length;

  return (
    <div className="space-y-5 pb-24 md:pb-0">
      {/* ─── Header ───────────────────────────────────────────────── */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {pageMode === 'docs' ? 'База документов' : 'Доска связей'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {pageMode === 'docs'
              ? 'Техническая документация и вложения по номенклатуре'
              : 'Визуальная карта связей между позициями и документами'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex p-0.5 bg-muted rounded-lg">
            <button onClick={() => setPageMode('docs')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${pageMode === 'docs' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon name="FileText" size={13} />Документы
            </button>
            <button onClick={() => setPageMode('board')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all
                ${pageMode === 'board' ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon name="Cable" size={13} />Доска
            </button>
          </div>
          {pageMode === 'docs' && (
            <Button onClick={() => setShowNew(true)} className="font-semibold gap-2 shrink-0">
              <Icon name="FilePlus" size={16} />
              Добавить документ
            </Button>
          )}
        </div>
      </div>

      {pageMode === 'board' && (
        <BoardView state={state} onStateChange={onStateChange} />
      )}

      {pageMode === 'docs' && <>
      {/* ─── Stats row ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Записей',  value: docs.length,      icon: 'FileText',  color: 'text-primary' },
          { label: 'Позиций',  value: totalItems,        icon: 'Package',   color: 'text-success' },
          { label: 'Файлов',   value: totalAttachments,  icon: 'Paperclip', color: 'text-warning' },
        ].map((s, i) => (
          <div key={s.label} className={`bg-card border border-border rounded-2xl p-4 shadow-card flex items-center gap-3 ${i === 2 ? 'col-span-2 sm:col-span-1' : ''}`}>
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
        <div className="relative flex-1 min-w-0 sm:min-w-44">
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
            <Icon name="FilePlus" size={16} />Добавить первый документ
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
      </>}
    </div>
  );
}