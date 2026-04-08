import { useState, useRef, useCallback, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { AppState, DocEntry, Item, saveState } from '@/data/store';

type BoardNode = {
  id: string;
  type: 'item' | 'doc';
  refId: string;
  x: number;
  y: number;
  pinned?: boolean;
};

type BoardConnection = {
  id: string;
  fromId: string;
  toId: string;
  label?: string;
  color?: string;
};

type BoardState = {
  nodes: BoardNode[];
  connections: BoardConnection[];
};

const BOARD_KEY = 'stockbase_board_v1';
const NODE_W = 180;
const NODE_H = 80;

function loadBoard(): BoardState {
  try {
    const raw = localStorage.getItem(BOARD_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return { nodes: [], connections: [] };
}

function saveBoardState(b: BoardState) {
  localStorage.setItem(BOARD_KEY, JSON.stringify(b));
}

const CONN_COLORS = ['#6366f1', '#ef4444', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9'];

export default function BoardView({ state }: { state: AppState; onStateChange: (s: AppState) => void }) {
  const [board, setBoard] = useState<BoardState>(loadBoard);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [connColor, setConnColor] = useState(CONN_COLORS[0]);
  const [connLabel, setConnLabel] = useState('');
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [selectedConn, setSelectedConn] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const save = useCallback((b: BoardState) => {
    setBoard(b);
    saveBoardState(b);
  }, []);

  const addNode = (type: 'item' | 'doc', refId: string) => {
    if (board.nodes.some(n => n.type === type && n.refId === refId)) return;
    const id = `node_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const cx = 200 + Math.random() * 400 - pan.x;
    const cy = 200 + Math.random() * 300 - pan.y;
    save({ ...board, nodes: [...board.nodes, { id, type, refId, x: cx, y: cy }] });
    setShowAddMenu(false);
    setAddSearch('');
  };

  const removeNode = (id: string) => {
    save({
      nodes: board.nodes.filter(n => n.id !== id),
      connections: board.connections.filter(c => c.fromId !== id && c.toId !== id),
    });
  };

  const handleMouseDown = (e: React.MouseEvent, nodeId: string) => {
    if (connecting) {
      if (connecting !== nodeId) {
        const id = `conn_${Date.now()}`;
        save({
          ...board,
          connections: [...board.connections, { id, fromId: connecting, toId: nodeId, label: connLabel || undefined, color: connColor }],
        });
      }
      setConnecting(null);
      setConnLabel('');
      return;
    }
    const node = board.nodes.find(n => n.id === nodeId);
    if (!node) return;
    setDragging(nodeId);
    setDragOffset({ x: e.clientX - node.x - pan.x, y: e.clientY - node.y - pan.y });
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (dragging) {
      const updated = board.nodes.map(n =>
        n.id === dragging ? { ...n, x: e.clientX - dragOffset.x - pan.x, y: e.clientY - dragOffset.y - pan.y } : n
      );
      setBoard(prev => ({ ...prev, nodes: updated }));
    }
    if (isPanning) {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  }, [dragging, dragOffset, pan, isPanning, panStart, board.nodes]);

  const handleMouseUp = useCallback(() => {
    if (dragging) {
      saveBoardState(board);
      setDragging(null);
    }
    if (isPanning) setIsPanning(false);
  }, [dragging, board, isPanning]);

  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  const handleBgMouseDown = (e: React.MouseEvent) => {
    if (e.target === containerRef.current || e.target === svgRef.current) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
      setSelectedConn(null);
      if (connecting) setConnecting(null);
    }
  };

  const removeConnection = (id: string) => {
    save({ ...board, connections: board.connections.filter(c => c.id !== id) });
    setSelectedConn(null);
  };

  const getNodeCenter = (node: BoardNode) => ({
    x: node.x + NODE_W / 2,
    y: node.y + NODE_H / 2,
  });

  const getNodeData = (node: BoardNode): { title: string; subtitle: string; icon: string; color: string } => {
    if (node.type === 'item') {
      const item = state.items.find(i => i.id === node.refId);
      const cat = item ? state.categories.find(c => c.id === item.categoryId) : null;
      return {
        title: item?.name || 'Удалено',
        subtitle: `${item?.quantity ?? 0} ${item?.unit || 'шт'}`,
        icon: 'Package',
        color: cat?.color || '#6366f1',
      };
    }
    const doc = (state.techDocs || []).find(d => d.id === node.refId);
    const item = doc ? state.items.find(i => i.id === doc.itemId) : null;
    return {
      title: doc ? `${doc.docType} ${doc.docNumber || ''}`.trim() : 'Удалено',
      subtitle: item?.name || '',
      icon: 'FileText',
      color: '#f59e0b',
    };
  };

  const items = state.items || [];
  const docs = state.techDocs || [];
  const filteredItems = addSearch
    ? items.filter(i => i.name.toLowerCase().includes(addSearch.toLowerCase()))
    : items.slice(0, 20);
  const filteredDocs = addSearch
    ? docs.filter(d => {
        const it = items.find(i => i.id === d.itemId);
        return d.docType.toLowerCase().includes(addSearch.toLowerCase()) ||
               d.docNumber?.toLowerCase().includes(addSearch.toLowerCase()) ||
               it?.name.toLowerCase().includes(addSearch.toLowerCase());
      })
    : docs.slice(0, 20);

  return (
    <div className="relative w-full h-[calc(100vh-200px)] min-h-[500px] bg-[repeating-linear-gradient(0deg,transparent,transparent_19px,hsl(var(--border)/0.3)_20px),repeating-linear-gradient(90deg,transparent,transparent_19px,hsl(var(--border)/0.3)_20px)] bg-card rounded-2xl border border-border overflow-hidden select-none"
      ref={containerRef}
      onMouseDown={handleBgMouseDown}
      style={{ cursor: isPanning ? 'grabbing' : connecting ? 'crosshair' : 'grab' }}
    >
      {/* SVG connections layer */}
      <svg ref={svgRef} className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        {board.connections.map(conn => {
          const from = board.nodes.find(n => n.id === conn.fromId);
          const to = board.nodes.find(n => n.id === conn.toId);
          if (!from || !to) return null;
          const fc = getNodeCenter(from);
          const tc = getNodeCenter(to);
          const fx = fc.x + pan.x, fy = fc.y + pan.y;
          const tx = tc.x + pan.x, ty = tc.y + pan.y;
          const mx = (fx + tx) / 2;
          const my = (fy + ty) / 2;
          const color = conn.color || '#6366f1';
          const isSelected = selectedConn === conn.id;
          return (
            <g key={conn.id}>
              <line x1={fx} y1={fy} x2={tx} y2={ty}
                stroke={color} strokeWidth={isSelected ? 3.5 : 2}
                strokeDasharray={isSelected ? '0' : '8 4'}
                opacity={isSelected ? 1 : 0.7}
                className="pointer-events-auto cursor-pointer"
                onClick={() => setSelectedConn(conn.id)}
              />
              {/* Dot at midpoint */}
              <circle cx={mx} cy={my} r={5} fill={color}
                className="pointer-events-auto cursor-pointer"
                onClick={() => setSelectedConn(conn.id)}
              />
              {conn.label && (
                <text x={mx} y={my - 10} textAnchor="middle" fill={color}
                  fontSize={11} fontWeight={600}
                  className="pointer-events-auto cursor-pointer"
                  onClick={() => setSelectedConn(conn.id)}
                >{conn.label}</text>
              )}
            </g>
          );
        })}
        {/* Line while connecting */}
        {connecting && (() => {
          const from = board.nodes.find(n => n.id === connecting);
          if (!from) return null;
          const fc = getNodeCenter(from);
          return (
            <line x1={fc.x + pan.x} y1={fc.y + pan.y}
              x2={fc.x + pan.x} y2={fc.y + pan.y}
              stroke={connColor} strokeWidth={2} strokeDasharray="5 3" opacity={0.5}
              style={{ pointerEvents: 'none' }}
              id="connecting-line"
            />
          );
        })()}
      </svg>

      {/* Nodes layer */}
      <div className="absolute inset-0" style={{ zIndex: 2 }}>
        {board.nodes.map(node => {
          const data = getNodeData(node);
          const isConnecting = connecting === node.id;
          return (
            <div
              key={node.id}
              onMouseDown={e => { e.stopPropagation(); handleMouseDown(e, node.id); }}
              className={`absolute flex flex-col rounded-xl border-2 shadow-lg bg-card p-3 transition-shadow
                ${isConnecting ? 'border-primary ring-2 ring-primary/30' : connecting ? 'border-primary/50 hover:border-primary' : 'border-border hover:shadow-xl'}
                ${dragging === node.id ? 'shadow-2xl z-50 scale-105' : ''}`}
              style={{
                left: node.x + pan.x,
                top: node.y + pan.y,
                width: NODE_W,
                minHeight: NODE_H,
                cursor: connecting ? 'pointer' : 'move',
              }}
            >
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ backgroundColor: data.color + '20', color: data.color }}>
                  <Icon name={data.icon} size={13} />
                </div>
                <span className="text-xs font-bold truncate text-foreground flex-1">{data.title}</span>
                <button onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                  className="w-5 h-5 rounded flex items-center justify-center text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0">
                  <Icon name="X" size={10} />
                </button>
              </div>
              <div className="text-[10px] text-muted-foreground truncate">{data.subtitle}</div>
              <button onClick={(e) => { e.stopPropagation(); setConnecting(connecting === node.id ? null : node.id); }}
                className={`mt-1.5 self-start text-[10px] font-semibold px-2 py-0.5 rounded-full transition-all
                  ${isConnecting ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                {isConnecting ? 'Нажмите на цель...' : 'Связать'}
              </button>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div className="absolute top-3 left-3 flex gap-2 z-30">
        <button onClick={() => setShowAddMenu(!showAddMenu)}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold shadow-lg hover:bg-primary/90 transition-all">
          <Icon name="Plus" size={14} />Добавить на доску
        </button>
        {connecting && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-primary shadow-lg">
            <span className="text-xs font-semibold text-primary">Связь:</span>
            <input value={connLabel} onChange={e => setConnLabel(e.target.value)}
              placeholder="Подпись..." className="w-24 text-xs bg-transparent border-b border-border focus:outline-none focus:border-primary px-1 py-0.5" />
            <div className="flex gap-1">
              {CONN_COLORS.map(c => (
                <button key={c} onClick={() => setConnColor(c)}
                  className="w-4 h-4 rounded-full transition-all"
                  style={{ backgroundColor: c, outline: connColor === c ? `2px solid ${c}` : 'none', outlineOffset: 1 }}
                />
              ))}
            </div>
            <button onClick={() => { setConnecting(null); setConnLabel(''); }}
              className="text-xs text-muted-foreground hover:text-foreground">Отмена</button>
          </div>
        )}
      </div>

      {/* Selected connection actions */}
      {selectedConn && (
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border shadow-lg">
          <span className="text-xs text-muted-foreground">Связь выделена</span>
          <button onClick={() => removeConnection(selectedConn)}
            className="flex items-center gap-1 text-xs text-destructive hover:bg-destructive/10 px-2 py-1 rounded-lg font-semibold">
            <Icon name="Trash2" size={12} />Удалить
          </button>
        </div>
      )}

      {/* Info badge */}
      <div className="absolute bottom-3 left-3 z-30 text-[10px] text-muted-foreground/60 bg-card/80 backdrop-blur-sm px-2 py-1 rounded-lg border border-border/50">
        {board.nodes.length} объектов · {board.connections.length} связей · Тяни фон чтобы двигать
      </div>

      {/* Add menu */}
      {showAddMenu && (
        <div className="absolute top-14 left-3 z-40 w-72 bg-card border border-border rounded-xl shadow-xl p-3 space-y-2 animate-scale-in">
          <input value={addSearch} onChange={e => setAddSearch(e.target.value)}
            placeholder="Поиск позиций и документов..."
            className="w-full text-sm px-3 py-2 rounded-lg border border-border bg-muted/30 focus:outline-none focus:ring-2 focus:ring-ring" autoFocus />

          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {filteredItems.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-2 pt-1">Номенклатура</div>
                {filteredItems.map(item => {
                  const onBoard = board.nodes.some(n => n.type === 'item' && n.refId === item.id);
                  return (
                    <button key={item.id} onClick={() => !onBoard && addNode('item', item.id)}
                      disabled={onBoard}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors
                        ${onBoard ? 'opacity-40 cursor-default' : 'hover:bg-muted'}`}>
                      <Icon name="Package" size={13} className="text-primary shrink-0" />
                      <span className="truncate flex-1">{item.name}</span>
                      <span className="text-xs text-muted-foreground shrink-0">{item.quantity} {item.unit}</span>
                      {onBoard && <Icon name="Check" size={12} className="text-success shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}
            {filteredDocs.length > 0 && (
              <>
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-semibold px-2 pt-2">Документы</div>
                {filteredDocs.map(doc => {
                  const onBoard = board.nodes.some(n => n.type === 'doc' && n.refId === doc.id);
                  const item = items.find(i => i.id === doc.itemId);
                  return (
                    <button key={doc.id} onClick={() => !onBoard && addNode('doc', doc.id)}
                      disabled={onBoard}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm text-left transition-colors
                        ${onBoard ? 'opacity-40 cursor-default' : 'hover:bg-muted'}`}>
                      <Icon name="FileText" size={13} className="text-warning shrink-0" />
                      <div className="truncate flex-1">
                        <span>{doc.docType} {doc.docNumber || ''}</span>
                        {item && <span className="text-xs text-muted-foreground ml-1">({item.name})</span>}
                      </div>
                      {onBoard && <Icon name="Check" size={12} className="text-success shrink-0" />}
                    </button>
                  );
                })}
              </>
            )}
            {filteredItems.length === 0 && filteredDocs.length === 0 && (
              <div className="text-center text-sm text-muted-foreground py-4">Ничего не найдено</div>
            )}
          </div>
          <button onClick={() => { setShowAddMenu(false); setAddSearch(''); }}
            className="w-full text-xs text-muted-foreground hover:text-foreground text-center py-1">Закрыть</button>
        </div>
      )}
    </div>
  );
}
