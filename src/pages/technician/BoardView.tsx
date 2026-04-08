import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { AppState } from '@/data/store';

export type BoardNode = {
  id: string;
  type: 'item' | 'doc' | 'file' | 'note';
  refId: string;
  x: number;
  y: number;
  pinned?: boolean;
  color?: string;
  // file nodes
  fileName?: string;
  fileDataUrl?: string;
  fileMime?: string;
  // note nodes
  noteText?: string;
};

export type BoardConnection = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
};

export type BoardData = {
  nodes: BoardNode[];
  connections: BoardConnection[];
};

const BOARD_KEY = 'stockbase_board_v1';
const NODE_W = 190;
const NODE_H = 86;
const CONN_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9'];
const NODE_COLORS = ['', '#6366f1', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#f97316'];

export function loadBoard(): BoardData {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* */ }
  return { nodes: [], connections: [] };
}

function saveBoardLocal(b: BoardData) {
  localStorage.setItem(BOARD_KEY, JSON.stringify(b));
}

export default function BoardView({ state }: { state: AppState; onStateChange: (s: AppState) => void }) {
  const [board, setBoard] = useState<BoardData>(loadBoard);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connColor, setConnColor] = useState(CONN_COLORS[0]);
  const [connLabel, setConnLabel] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [addTab, setAddTab] = useState<'items' | 'docs' | 'files' | 'notes'>('items');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selConn, setSelConn] = useState<string | null>(null);
  const [selNode, setSelNode] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [editingConn, setEditingConn] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const save = useCallback((b: BoardData) => { setBoard(b); saveBoardLocal(b); }, []);

  // ─── Node CRUD ────────────────────────────────────────────
  const addNode = (type: BoardNode['type'], refId: string, extra?: Partial<BoardNode>) => {
    if ((type === 'item' || type === 'doc') && board.nodes.some(n => n.type === type && n.refId === refId)) return;
    const id = `n_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    save({ ...board, nodes: [...board.nodes, { id, type, refId, x: 200 + Math.random() * 300 - pan.x, y: 150 + Math.random() * 200 - pan.y, ...extra }] });
    setShowAdd(false); setAddSearch('');
  };

  const removeNode = (id: string) => {
    save({ nodes: board.nodes.filter(n => n.id !== id), connections: board.connections.filter(c => c.fromId !== id && c.toId !== id) });
    if (selNode === id) setSelNode(null);
  };

  const updateNode = (id: string, patch: Partial<BoardNode>) => {
    save({ ...board, nodes: board.nodes.map(n => n.id === id ? { ...n, ...patch } : n) });
  };

  // ─── File upload ───────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        addNode('file', `file_${Date.now()}`, {
          fileName: file.name,
          fileDataUrl: reader.result as string,
          fileMime: file.type,
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = '';
  };

  // ─── Note ──────────────────────────────────────────────────
  const addNote = () => {
    if (!noteText.trim()) return;
    addNode('note', `note_${Date.now()}`, { noteText: noteText.trim() });
    setNoteText('');
  };

  // ─── Connection CRUD ──────────────────────────────────────
  const removeConnection = (id: string) => { save({ ...board, connections: board.connections.filter(c => c.id !== id) }); setSelConn(null); };

  const updateConnection = (id: string, patch: Partial<BoardConnection>) => {
    save({ ...board, connections: board.connections.map(c => c.id === id ? { ...c, ...patch } : c) });
  };

  // ─── Mouse drag logic ─────────────────────────────────────
  const handleNodeMouseDown = (e: React.MouseEvent, nodeId: string) => {
    e.stopPropagation();
    if (connecting) {
      if (connecting !== nodeId) {
        const id = `c_${Date.now()}`;
        save({ ...board, connections: [...board.connections, { id, fromId: connecting, toId: nodeId, label: connLabel || undefined, color: connColor }] });
      }
      setConnecting(null); setConnLabel('');
      return;
    }
    const node = board.nodes.find(n => n.id === nodeId);
    if (!node || node.pinned) { setSelNode(nodeId); return; }
    setDragging(nodeId); setSelNode(nodeId);
    setDragOff({ x: e.clientX - node.x - pan.x, y: e.clientY - node.y - pan.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) {
      setBoard(prev => ({ ...prev, nodes: prev.nodes.map(n => n.id === dragging ? { ...n, x: e.clientX - dragOff.x - pan.x, y: e.clientY - dragOff.y - pan.y } : n) }));
    }
    if (isPanning) setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
  }, [dragging, dragOff, pan, isPanning, panStart]);

  const handleMouseUp = useCallback(() => {
    if (dragging) { saveBoardLocal(board); setDragging(null); }
    if (isPanning) setIsPanning(false);
  }, [dragging, board, isPanning]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, [handleMouseMove, handleMouseUp]);

  const handleBgDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === svgRef.current) {
      setIsPanning(true); setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelConn(null); setSelNode(null); if (connecting) setConnecting(null);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────
  const center = (n: BoardNode) => ({ x: n.x + NODE_W / 2, y: n.y + NODE_H / 2 });

  const nodeData = (node: BoardNode) => {
    if (node.type === 'item') {
      const item = state.items.find(i => i.id === node.refId);
      const cat = item ? state.categories.find(c => c.id === item.categoryId) : null;
      return { title: item?.name || 'Удалено', sub: `${item?.quantity ?? 0} ${item?.unit || 'шт'}`, icon: 'Package', defaultColor: cat?.color || '#6366f1' };
    }
    if (node.type === 'doc') {
      const doc = (state.techDocs || []).find(d => d.id === node.refId);
      const item = doc ? state.items.find(i => i.id === doc.itemId) : null;
      return { title: doc ? `${doc.docType} ${doc.docNumber || ''}`.trim() : 'Удалено', sub: item?.name || '', icon: 'FileText', defaultColor: '#f59e0b' };
    }
    if (node.type === 'file') {
      const isImage = node.fileMime?.startsWith('image/');
      return { title: node.fileName || 'Файл', sub: isImage ? 'Изображение' : (node.fileMime || 'Файл'), icon: isImage ? 'Image' : 'File', defaultColor: '#0ea5e9' };
    }
    return { title: 'Заметка', sub: node.noteText?.slice(0, 40) || '', icon: 'StickyNote', defaultColor: '#ec4899' };
  };

  const items = state.items || [];
  const docs = state.techDocs || [];
  const q = addSearch.toLowerCase();
  const fItems = q ? items.filter(i => i.name.toLowerCase().includes(q)) : items.slice(0, 30);
  const fDocs = q ? docs.filter(d => d.docType.toLowerCase().includes(q) || d.docNumber?.toLowerCase().includes(q) || items.find(i => i.id === d.itemId)?.name.toLowerCase().includes(q)) : docs.slice(0, 30);

  const selectedNodeObj = selNode ? board.nodes.find(n => n.id === selNode) : null;

  // ─── Clear board ───────────────────────────────────────────
  const clearBoard = () => { save({ nodes: [], connections: [] }); setSelNode(null); setSelConn(null); };

  return (
    <div className="relative w-full h-[calc(100vh-200px)] min-h-[500px] bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,hsl(var(--border)/0.3)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,hsl(var(--border)/0.3)_20px)] bg-card rounded-2xl border border-border overflow-hidden select-none"
      ref={containerRef} onMouseDown={handleBgDown}
      style={{ cursor: isPanning ? 'grabbing' : connecting ? 'crosshair' : 'grab' }}>

      <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileUpload} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt" />

      {/* SVG */}
      <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        {board.connections.map(conn => {
          const from = board.nodes.find(n => n.id === conn.fromId);
          const to = board.nodes.find(n => n.id === conn.toId);
          if (!from || !to) return null;
          const fc = center(from), tc = center(to);
          const fx = fc.x + pan.x, fy = fc.y + pan.y, tx = tc.x + pan.x, ty = tc.y + pan.y;
          const mx = (fx + tx) / 2, my = (fy + ty) / 2;
          const color = conn.color || '#6366f1';
          const sel = selConn === conn.id;
          return (
            <g key={conn.id}>
              <line x1={fx} y1={fy} x2={tx} y2={ty} stroke={color} strokeWidth={sel ? 3.5 : 2} strokeDasharray={sel ? '0' : '8 4'} opacity={sel ? 1 : 0.65} className="pointer-events-auto cursor-pointer" onClick={() => { setSelConn(conn.id); setSelNode(null); }} />
              <circle cx={mx} cy={my} r={5} fill={color} className="pointer-events-auto cursor-pointer" onClick={() => { setSelConn(conn.id); setSelNode(null); }} />
              {conn.label && <text x={mx} y={my - 10} textAnchor="middle" fill={color} fontSize={11} fontWeight={600} className="pointer-events-auto cursor-pointer" onClick={() => { setSelConn(conn.id); setSelNode(null); }}>{conn.label}</text>}
            </g>
          );
        })}
      </svg>

      {/* Nodes */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        {board.nodes.map(node => {
          const d = nodeData(node);
          const color = node.color || d.defaultColor;
          const isConn = connecting === node.id;
          const isSel = selNode === node.id;
          const isFile = node.type === 'file';
          const isNote = node.type === 'note';
          const isImage = isFile && node.fileMime?.startsWith('image/');

          return (
            <div key={node.id} onMouseDown={e => handleNodeMouseDown(e, node.id)}
              className={`absolute flex flex-col rounded-xl border-2 shadow-lg bg-card overflow-hidden transition-shadow
                ${isConn ? 'border-primary ring-2 ring-primary/30' : isSel ? 'border-primary/70 shadow-xl' : connecting ? 'border-border/60 hover:border-primary/50' : 'border-border hover:shadow-xl'}
                ${dragging === node.id ? 'shadow-2xl z-50 scale-[1.03]' : ''} ${node.pinned ? 'ring-1 ring-warning/40' : ''}`}
              style={{ left: node.x + pan.x, top: node.y + pan.y, width: isNote ? 160 : NODE_W, minHeight: isNote ? 60 : NODE_H, cursor: node.pinned ? 'default' : connecting ? 'pointer' : 'move', borderColor: isSel || isConn ? undefined : color + '40' }}>

              {/* Image preview for file nodes */}
              {isImage && node.fileDataUrl && (
                <div className="h-20 bg-muted overflow-hidden">
                  <img src={node.fileDataUrl} alt={node.fileName} className="w-full h-full object-cover" />
                </div>
              )}

              <div className="p-2.5 flex flex-col gap-1 flex-1">
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded flex items-center justify-center shrink-0" style={{ backgroundColor: color + '20', color }}>
                    <Icon name={d.icon} size={11} />
                  </div>
                  <span className="text-[11px] font-bold truncate flex-1 text-foreground">{d.title}</span>
                  {node.pinned && <Icon name="Pin" size={9} className="text-warning shrink-0" />}
                </div>
                {isNote ? (
                  <div className="text-[10px] text-muted-foreground whitespace-pre-wrap leading-tight max-h-16 overflow-hidden">{node.noteText}</div>
                ) : (
                  <div className="text-[10px] text-muted-foreground truncate">{d.sub}</div>
                )}
                {/* File download */}
                {isFile && node.fileDataUrl && !isImage && (
                  <a href={node.fileDataUrl} download={node.fileName} onClick={e => e.stopPropagation()}
                    className="text-[10px] text-primary font-semibold flex items-center gap-1 hover:underline mt-0.5">
                    <Icon name="Download" size={10} />Скачать
                  </a>
                )}
                <button onClick={e => { e.stopPropagation(); setConnecting(isConn ? null : node.id); }}
                  className={`mt-auto self-start text-[9px] font-semibold px-1.5 py-0.5 rounded-full transition-all
                    ${isConn ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                  {isConn ? 'Выберите цель...' : 'Связать'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ─── Top toolbar ────────────────────────────────── */}
      <div className="absolute top-3 left-3 flex flex-wrap gap-2 z-30">
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-lg hover:bg-primary/90">
          <Icon name="Plus" size={13} />На доску
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold shadow-lg hover:bg-muted">
          <Icon name="Upload" size={13} />Файл
        </button>
        <button onClick={() => { setAddTab('notes'); setShowAdd(true); }} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-border text-xs font-semibold shadow-lg hover:bg-muted">
          <Icon name="StickyNote" size={13} />Заметка
        </button>
        {board.nodes.length > 0 && (
          <button onClick={clearBoard} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-card border border-destructive/30 text-xs font-semibold text-destructive shadow-lg hover:bg-destructive/10">
            <Icon name="Trash2" size={13} />Очистить
          </button>
        )}
      </div>

      {/* ─── Connection mode bar ─────────────────────── */}
      {connecting && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-primary shadow-lg">
          <span className="text-xs font-bold text-primary">Связь:</span>
          <input value={connLabel} onChange={e => setConnLabel(e.target.value)} placeholder="Подпись..." className="w-20 text-xs bg-transparent border-b border-border focus:outline-none focus:border-primary px-1 py-0.5" />
          <div className="flex gap-1">{CONN_COLORS.map(c => <button key={c} onClick={() => setConnColor(c)} className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c, outline: connColor === c ? `2px solid ${c}` : 'none', outlineOffset: 1 }} />)}</div>
          <button onClick={() => { setConnecting(null); setConnLabel(''); }} className="text-[10px] text-muted-foreground hover:text-foreground">Отмена</button>
        </div>
      )}

      {/* ─── Selected node panel ─────────────────────── */}
      {selectedNodeObj && !connecting && (
        <div className="absolute top-3 right-3 z-30 w-52 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2">
          <div className="text-xs font-bold text-foreground truncate">{nodeData(selectedNodeObj).title}</div>
          <div className="flex gap-1 flex-wrap">
            <span className="text-[10px] text-muted-foreground">Цвет:</span>
            {NODE_COLORS.map(c => (
              <button key={c || 'default'} onClick={() => updateNode(selectedNodeObj.id, { color: c || undefined })}
                className="w-4 h-4 rounded-full border border-border/50"
                style={{ backgroundColor: c || nodeData(selectedNodeObj).defaultColor, outline: (selectedNodeObj.color || '') === c ? '2px solid currentColor' : 'none', outlineOffset: 1 }} />
            ))}
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => updateNode(selectedNodeObj.id, { pinned: !selectedNodeObj.pinned })}
              className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg transition-all ${selectedNodeObj.pinned ? 'bg-warning/15 text-warning' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
              <Icon name="Pin" size={10} />{selectedNodeObj.pinned ? 'Открепить' : 'Закрепить'}
            </button>
            <button onClick={() => removeNode(selectedNodeObj.id)} className="flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20">
              <Icon name="Trash2" size={10} />Удалить
            </button>
          </div>
          {selectedNodeObj.type === 'file' && selectedNodeObj.fileDataUrl && (
            <a href={selectedNodeObj.fileDataUrl} download={selectedNodeObj.fileName} className="flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline">
              <Icon name="Download" size={10} />Скачать файл
            </a>
          )}
        </div>
      )}

      {/* ─── Selected connection panel ──────────────── */}
      {selConn && (
        <div className="absolute top-3 right-3 z-30 w-52 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2">
          <div className="text-xs font-bold">Редактировать связь</div>
          {editingConn === selConn ? (
            <div className="flex gap-1">
              <input value={editLabel} onChange={e => setEditLabel(e.target.value)} className="flex-1 text-xs border border-border rounded px-2 py-1 bg-muted/30 focus:outline-none focus:ring-1 focus:ring-primary" autoFocus />
              <button onClick={() => { updateConnection(selConn, { label: editLabel || undefined }); setEditingConn(null); }} className="text-[10px] font-bold text-primary">OK</button>
            </div>
          ) : (
            <button onClick={() => { setEditingConn(selConn); setEditLabel(board.connections.find(c => c.id === selConn)?.label || ''); }}
              className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1">
              <Icon name="Pencil" size={10} />Подпись: {board.connections.find(c => c.id === selConn)?.label || '(нет)'}
            </button>
          )}
          <div className="flex gap-1">
            <span className="text-[10px] text-muted-foreground">Цвет:</span>
            {CONN_COLORS.map(c => <button key={c} onClick={() => updateConnection(selConn, { color: c })} className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: c, outline: board.connections.find(cn => cn.id === selConn)?.color === c ? '2px solid currentColor' : 'none', outlineOffset: 1 }} />)}
          </div>
          <button onClick={() => removeConnection(selConn)} className="flex items-center gap-1 text-[10px] font-semibold text-destructive hover:bg-destructive/10 px-2 py-1 rounded-lg w-full">
            <Icon name="Trash2" size={10} />Удалить связь
          </button>
        </div>
      )}

      {/* ─── Info ────────────────────────────────────── */}
      <div className="absolute bottom-3 left-3 z-30 text-[10px] text-muted-foreground/60 bg-card/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-border/50">
        {board.nodes.length} объектов · {board.connections.length} связей
      </div>

      {/* ─── Add menu ────────────────────────────────── */}
      {showAdd && (
        <div className="absolute top-14 left-3 z-40 w-80 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2 animate-scale-in">
          <div className="flex gap-0.5 p-0.5 bg-muted rounded-lg">
            {([['items', 'Package', 'Товары'], ['docs', 'FileText', 'Документы'], ['files', 'Upload', 'Файлы'], ['notes', 'StickyNote', 'Заметки']] as const).map(([tab, icon, label]) => (
              <button key={tab} onClick={() => setAddTab(tab)} className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-[10px] font-semibold transition-all ${addTab === tab ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground'}`}>
                <Icon name={icon} size={11} />{label}
              </button>
            ))}
          </div>

          {(addTab === 'items' || addTab === 'docs') && (
            <input value={addSearch} onChange={e => setAddSearch(e.target.value)} placeholder="Поиск..." className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />
          )}

          {addTab === 'items' && (
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {fItems.map(item => {
                const on = board.nodes.some(n => n.type === 'item' && n.refId === item.id);
                return <button key={item.id} onClick={() => !on && addNode('item', item.id)} disabled={on} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left ${on ? 'opacity-30' : 'hover:bg-muted'}`}>
                  <Icon name="Package" size={12} className="text-primary shrink-0" /><span className="truncate flex-1">{item.name}</span><span className="text-[10px] text-muted-foreground shrink-0">{item.quantity} {item.unit}</span>{on && <Icon name="Check" size={10} className="text-success" />}
                </button>;
              })}
              {fItems.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">Не найдено</div>}
            </div>
          )}

          {addTab === 'docs' && (
            <div className="max-h-52 overflow-y-auto space-y-0.5">
              {fDocs.map(doc => {
                const on = board.nodes.some(n => n.type === 'doc' && n.refId === doc.id);
                const it = items.find(i => i.id === doc.itemId);
                return <button key={doc.id} onClick={() => !on && addNode('doc', doc.id)} disabled={on} className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs text-left ${on ? 'opacity-30' : 'hover:bg-muted'}`}>
                  <Icon name="FileText" size={12} className="text-warning shrink-0" /><span className="truncate flex-1">{doc.docType} {doc.docNumber || ''} {it ? `(${it.name})` : ''}</span>{on && <Icon name="Check" size={10} className="text-success" />}
                </button>;
              })}
              {fDocs.length === 0 && <div className="text-center text-xs text-muted-foreground py-4">Не найдено</div>}
            </div>
          )}

          {addTab === 'files' && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Загрузите файлы (фото, PDF, документы) прямо на доску.</p>
              <button onClick={() => { fileInputRef.current?.click(); setShowAdd(false); }}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed border-primary/40 bg-primary/5 hover:bg-primary/10 text-sm font-semibold text-primary">
                <Icon name="Upload" size={16} />Выбрать файлы
              </button>
            </div>
          )}

          {addTab === 'notes' && (
            <div className="space-y-2">
              <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Текст заметки..." rows={3}
                className="w-full text-xs px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring resize-none" autoFocus />
              <button onClick={addNote} disabled={!noteText.trim()}
                className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold disabled:opacity-40">
                <Icon name="Plus" size={12} className="inline mr-1" />Добавить заметку
              </button>
            </div>
          )}

          <button onClick={() => { setShowAdd(false); setAddSearch(''); }} className="w-full text-[10px] text-muted-foreground hover:text-foreground text-center py-0.5">Закрыть</button>
        </div>
      )}
    </div>
  );
}
