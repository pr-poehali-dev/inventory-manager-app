import { useState, useRef, useCallback, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { InvoiceTemplate, InvElement, InvElementType, generateId } from '@/data/store';
import { excelToTemplate } from '@/data/excelImport';

type Props = {
  template: InvoiceTemplate;
  onSave: (t: InvoiceTemplate) => void;
  onClose: () => void;
};

const CANVAS_W = 1414;
const CANVAS_H = 1000;
const GRID = 8;
const snap = (v: number) => Math.round(v / GRID) * GRID;
const RULER_SIZE = 20;

const SOURCES = [
  { value: '', label: 'Вручную' },
  { value: '{{number}}', label: 'Номер заявки' },
  { value: '{{date}}', label: 'Дата' },
  { value: '{{recipient}}', label: 'Получатель' },
  { value: '{{institution}}', label: 'Учреждение' },
  { value: '{{signatory}}', label: 'Подписант' },
  { value: '{{signatoryRole}}', label: 'Должность подписанта' },
];

const TABLE_SOURCES = [
  { value: '', label: 'Вручную' },
  { value: '{{item.name}}', label: 'Наименование' },
  { value: '{{item.unit}}', label: 'Ед. измерения' },
  { value: '{{item.qtyReq}}', label: 'Затребовано' },
  { value: '{{item.qtyRel}}', label: 'Отпущено' },
  { value: '{{item.price}}', label: 'Цена' },
  { value: '{{item.sum}}', label: 'Сумма' },
  { value: '{{item.note}}', label: 'Примечание' },
  { value: '{{item.nomenNum}}', label: 'Номенкл. номер' },
  { value: '{{item.debit}}', label: 'Дебет' },
  { value: '{{item.credit}}', label: 'Кредит' },
];

function defaultElement(type: InvElementType): InvElement {
  const base = { id: generateId(), type, x: 40, y: 40 };
  switch (type) {
    case 'text': return { ...base, w: 300, h: 28, text: 'Текст', fontSize: 12, bold: false, italic: false, align: 'left' };
    case 'table': return { ...base, w: 900, h: 200, columns: [
      { key: generateId(), label: 'Наименование', width: 200, source: '{{item.name}}' },
      { key: generateId(), label: 'Ед.', width: 60, source: '{{item.unit}}' },
      { key: generateId(), label: 'Затребовано', width: 80, source: '{{item.qtyReq}}' },
      { key: generateId(), label: 'Отпущено', width: 80, source: '{{item.qtyRel}}' },
    ] };
    case 'line': return { ...base, w: 400, h: 2, lineStyle: 'solid', lineWidth: 1, vertical: false };
    case 'frame': return { ...base, w: 280, h: 150, lineStyle: 'dashed', frameLabel: 'Блок' };
  }
}

export default function InvoiceDesigner({ template, onSave, onClose }: Props) {
  const [elements, setElements] = useState<InvElement[]>(template.elements || []);
  const [selected, setSelected] = useState<string | null>(null);
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [resizing, setResizing] = useState<{ id: string; edge: string; ox: number; oy: number; ow: number; oh: number; ex: number; ey: number } | null>(null);
  const [tplName, setTplName] = useState(template.name);
  const canvasRef = useRef<HTMLDivElement>(null);
  const excelRef = useRef<HTMLInputElement>(null);
  const [zoom, setZoom] = useState(0.7);

  const sel = elements.find(e => e.id === selected) || null;

  const upd = useCallback((id: string, patch: Partial<InvElement>) => {
    setElements(prev => prev.map(e => e.id === id ? { ...e, ...patch } : e));
  }, []);

  const add = (type: InvElementType) => {
    const el = defaultElement(type);
    setElements(prev => [...prev, el]);
    setSelected(el.id);
  };

  const del = (id: string) => {
    setElements(prev => prev.filter(e => e.id !== id));
    if (selected === id) setSelected(null);
  };

  const dup = (id: string) => {
    const src = elements.find(e => e.id === id);
    if (!src) return;
    const ne = { ...src, id: generateId(), x: src.x + 20, y: src.y + 20 };
    setElements(prev => [...prev, ne]);
    setSelected(ne.id);
  };

  const moveLayer = (id: string, dir: 1 | -1) => {
    setElements(prev => {
      const idx = prev.findIndex(e => e.id === id);
      if (idx < 0) return prev;
      const ni = idx + dir;
      if (ni < 0 || ni >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };

  const handleSave = () => {
    onSave({ ...template, name: tplName, elements, canvasWidth: CANVAS_W, canvasHeight: CANVAS_H, updatedAt: new Date().toISOString() });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selected) del(selected);
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const onMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setSelected(id);
    const rect = canvasRef.current!.getBoundingClientRect();
    const el = elements.find(x => x.id === id)!;
    setDragging({ id, ox: (e.clientX - rect.left) / zoom - el.x, oy: (e.clientY - rect.top) / zoom - el.y });
  };

  const onResizeDown = (e: React.MouseEvent, id: string, edge: string) => {
    e.stopPropagation();
    const el = elements.find(x => x.id === id)!;
    setResizing({ id, edge, ox: e.clientX, oy: e.clientY, ow: el.w, oh: el.h, ex: el.x, ey: el.y });
  };

  useEffect(() => {
    if (!dragging && !resizing) return;
    const onMove = (e: MouseEvent) => {
      if (dragging) {
        const rect = canvasRef.current!.getBoundingClientRect();
        const nx = snap((e.clientX - rect.left) / zoom - dragging.ox);
        const ny = snap((e.clientY - rect.top) / zoom - dragging.oy);
        upd(dragging.id, { x: Math.max(0, nx), y: Math.max(0, ny) });
      }
      if (resizing) {
        const dx = (e.clientX - resizing.ox) / zoom;
        const dy = (e.clientY - resizing.oy) / zoom;
        const patch: Partial<InvElement> = {};
        if (resizing.edge.includes('r')) patch.w = snap(Math.max(24, resizing.ow + dx));
        if (resizing.edge.includes('b')) patch.h = snap(Math.max(8, resizing.oh + dy));
        if (resizing.edge.includes('l')) { patch.x = snap(resizing.ex + dx); patch.w = snap(Math.max(24, resizing.ow - dx)); }
        if (resizing.edge.includes('t')) { patch.y = snap(resizing.ey + dy); patch.h = snap(Math.max(8, resizing.oh - dy)); }
        upd(resizing.id, patch);
      }
    };
    const onUp = () => { setDragging(null); setResizing(null); };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [dragging, resizing, zoom, upd]);

  const renderElement = (el: InvElement) => {
    const isSel = el.id === selected;
    const outline = isSel ? '2px solid #3b82f6' : 'none';

    if (el.type === 'text') {
      return (
        <div key={el.id} className="absolute cursor-move select-none" style={{ left: el.x, top: el.y, width: el.w, outline, fontFamily: "'Times New Roman', serif", fontSize: el.fontSize, fontWeight: el.bold ? 'bold' : 'normal', fontStyle: el.italic ? 'italic' : 'normal', textAlign: el.align || 'left', lineHeight: 1.3, minHeight: el.h }}
          onMouseDown={e => onMouseDown(e, el.id)}>
          {el.source ? <span className="text-blue-500/70">{'{{'}{SOURCES.find(s => s.value === el.source)?.label || el.source}{'}}'}</span> : (el.text || '\u00A0')}
          {isSel && <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-500 cursor-se-resize rounded-sm" onMouseDown={e => onResizeDown(e, el.id, 'rb')} />}
        </div>
      );
    }

    if (el.type === 'table') {
      const cols = el.columns || [];
      return (
        <div key={el.id} className="absolute cursor-move select-none" style={{ left: el.x, top: el.y, width: el.w, outline, minHeight: el.h }}
          onMouseDown={e => onMouseDown(e, el.id)}>
          <table className="w-full border-collapse" style={{ fontFamily: "'Times New Roman', serif", fontSize: 9, border: '1px solid #000' }}>
            <thead>
              <tr>{cols.map(c => <th key={c.key} className="border border-black px-1 py-0.5 text-center" style={{ width: c.width, fontSize: 8 }}>{c.label}</th>)}</tr>
            </thead>
            <tbody>
              <tr>{cols.map(c => <td key={c.key} className="border border-black px-1 py-1 text-center text-blue-400/60" style={{ fontSize: 7 }}>{c.source ? TABLE_SOURCES.find(s => s.value === c.source)?.label || '...' : '...'}</td>)}</tr>
              <tr>{cols.map(c => <td key={c.key} className="border border-black px-1 py-1" />)}</tr>
            </tbody>
          </table>
          {isSel && <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-500 cursor-se-resize rounded-sm" onMouseDown={e => onResizeDown(e, el.id, 'rb')} />}
        </div>
      );
    }

    if (el.type === 'line') {
      return (
        <div key={el.id} className="absolute cursor-move" style={{ left: el.x, top: el.y, width: el.vertical ? (el.lineWidth || 1) : el.w, height: el.vertical ? el.h : (el.lineWidth || 1), outline }}
          onMouseDown={e => onMouseDown(e, el.id)}>
          <div className="w-full h-full" style={{ borderTop: el.vertical ? 'none' : `${el.lineWidth || 1}px ${el.lineStyle || 'solid'} #000`, borderLeft: el.vertical ? `${el.lineWidth || 1}px ${el.lineStyle || 'solid'} #000` : 'none' }} />
          {isSel && <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-500 cursor-se-resize rounded-sm" onMouseDown={e => onResizeDown(e, el.id, 'rb')} />}
        </div>
      );
    }

    if (el.type === 'frame') {
      return (
        <div key={el.id} className="absolute cursor-move" style={{ left: el.x, top: el.y, width: el.w, height: el.h, border: `1px ${el.lineStyle || 'dashed'} #000`, outline, padding: 4 }}
          onMouseDown={e => onMouseDown(e, el.id)}>
          {el.frameLabel && <div className="text-center font-bold" style={{ fontFamily: "'Times New Roman', serif", fontSize: 9 }}>{el.frameLabel}</div>}
          {isSel && <div className="absolute -right-1 -bottom-1 w-3 h-3 bg-blue-500 cursor-se-resize rounded-sm" onMouseDown={e => onResizeDown(e, el.id, 'rb')} />}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-full flex flex-col bg-gray-100 overflow-hidden" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-200 shrink-0">
        <Button variant="outline" size="sm" onClick={onClose}><Icon name="ArrowLeft" size={14} /></Button>
        <input value={tplName} onChange={e => setTplName(e.target.value)} className="h-8 px-2 text-sm border border-gray-300 rounded bg-white w-48" placeholder="Название шаблона" />
        <div className="flex gap-1 ml-2">
          <Button variant="outline" size="sm" onClick={() => add('text')} className="gap-1 text-xs"><Icon name="Type" size={13} />Текст</Button>
          <Button variant="outline" size="sm" onClick={() => add('table')} className="gap-1 text-xs"><Icon name="Table" size={13} />Таблица</Button>
          <Button variant="outline" size="sm" onClick={() => add('line')} className="gap-1 text-xs"><Icon name="Minus" size={13} />Линия</Button>
          <Button variant="outline" size="sm" onClick={() => add('frame')} className="gap-1 text-xs"><Icon name="Square" size={13} />Рамка</Button>
          <div className="w-px h-5 bg-gray-200 mx-1" />
          <Button variant="outline" size="sm" onClick={() => excelRef.current?.click()} className="gap-1 text-xs"><Icon name="FileSpreadsheet" size={13} />Excel</Button>
          <input ref={excelRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={e => {
            const file = e.target.files?.[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (ev) => {
              try {
                const tpl = excelToTemplate(ev.target?.result as ArrayBuffer, file.name);
                setElements(prev => [...prev, ...(tpl.elements || [])]);
              } catch (err) { console.error(err); }
            };
            reader.readAsArrayBuffer(file);
            e.target.value = '';
          }} />
        </div>
        <div className="flex-1" />
        {sel && <span className="text-[10px] text-gray-400 font-mono">X:{sel.x} Y:{sel.y} {sel.w}×{sel.h}</span>}
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.max(0.3, z - 0.1))}><Icon name="ZoomOut" size={14} /></Button>
          <span>{Math.round(zoom * 100)}%</span>
          <Button variant="ghost" size="sm" onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}><Icon name="ZoomIn" size={14} /></Button>
        </div>
        <Button size="sm" onClick={handleSave} className="gap-1"><Icon name="Save" size={14} />Сохранить</Button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto" onClick={() => setSelected(null)}>
          <div className="inline-block p-4" style={{ minWidth: 'fit-content' }}>
            <div style={{ position: 'relative', width: (CANVAS_W * zoom) + RULER_SIZE, height: (CANVAS_H * zoom) + RULER_SIZE }}>
              <svg className="absolute top-0 left-0" width={CANVAS_W * zoom + RULER_SIZE} height={RULER_SIZE} style={{ zIndex: 2 }}>
                <rect x={0} y={0} width={RULER_SIZE} height={RULER_SIZE} fill="#e5e7eb" />
                <rect x={RULER_SIZE} y={0} width={CANVAS_W * zoom} height={RULER_SIZE} fill="#f3f4f6" />
                {Array.from({ length: Math.ceil(CANVAS_W / 50) + 1 }, (_, i) => {
                  const px = i * 50 * zoom;
                  const isMajor = i % 2 === 0;
                  return <g key={i}>
                    <line x1={RULER_SIZE + px} y1={isMajor ? 0 : 10} x2={RULER_SIZE + px} y2={RULER_SIZE} stroke="#9ca3af" strokeWidth={isMajor ? 1 : 0.5} />
                    {isMajor && <text x={RULER_SIZE + px + 2} y={10} fontSize={8} fill="#6b7280">{i * 50}</text>}
                  </g>;
                })}
                <line x1={RULER_SIZE} y1={RULER_SIZE - 0.5} x2={RULER_SIZE + CANVAS_W * zoom} y2={RULER_SIZE - 0.5} stroke="#d1d5db" />
              </svg>
              <svg className="absolute top-0 left-0" width={RULER_SIZE} height={CANVAS_H * zoom + RULER_SIZE} style={{ zIndex: 2 }}>
                <rect x={0} y={RULER_SIZE} width={RULER_SIZE} height={CANVAS_H * zoom} fill="#f3f4f6" />
                {Array.from({ length: Math.ceil(CANVAS_H / 50) + 1 }, (_, i) => {
                  const py = i * 50 * zoom;
                  const isMajor = i % 2 === 0;
                  return <g key={i}>
                    <line y1={RULER_SIZE + py} x1={isMajor ? 0 : 10} y2={RULER_SIZE + py} x2={RULER_SIZE} stroke="#9ca3af" strokeWidth={isMajor ? 1 : 0.5} />
                    {isMajor && <text x={2} y={RULER_SIZE + py + 10} fontSize={8} fill="#6b7280">{i * 50}</text>}
                  </g>;
                })}
                <line y1={RULER_SIZE} x1={RULER_SIZE - 0.5} y2={RULER_SIZE + CANVAS_H * zoom} x2={RULER_SIZE - 0.5} stroke="#d1d5db" />
              </svg>
              <div ref={canvasRef} className="bg-white shadow-lg border border-gray-300 absolute"
                style={{ left: RULER_SIZE, top: RULER_SIZE, width: CANVAS_W * zoom, height: CANVAS_H * zoom }}>
                <div style={{ transform: `scale(${zoom})`, transformOrigin: '0 0', width: CANVAS_W, height: CANVAS_H, position: 'relative' }}>
                  {elements.map(renderElement)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {sel && (
          <div className="w-64 bg-white border-l border-gray-200 overflow-y-auto p-3 space-y-3 shrink-0 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm">{sel.type === 'text' ? 'Текст' : sel.type === 'table' ? 'Таблица' : sel.type === 'line' ? 'Линия' : 'Рамка'}</span>
              <div className="flex gap-0.5">
                <button onClick={() => moveLayer(sel.id, -1)} className="p-1 hover:bg-gray-100 rounded"><Icon name="ChevronDown" size={12} /></button>
                <button onClick={() => moveLayer(sel.id, 1)} className="p-1 hover:bg-gray-100 rounded"><Icon name="ChevronUp" size={12} /></button>
                <button onClick={() => dup(sel.id)} className="p-1 hover:bg-gray-100 rounded"><Icon name="Copy" size={12} /></button>
                <button onClick={() => del(sel.id)} className="p-1 hover:bg-gray-100 rounded text-red-500"><Icon name="Trash2" size={12} /></button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-1.5">
              <label>X<input type="number" value={sel.x} onChange={e => upd(sel.id, { x: +e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs" /></label>
              <label>Y<input type="number" value={sel.y} onChange={e => upd(sel.id, { y: +e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs" /></label>
              <label>W<input type="number" value={sel.w} onChange={e => upd(sel.id, { w: +e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs" /></label>
              <label>H<input type="number" value={sel.h} onChange={e => upd(sel.id, { h: +e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs" /></label>
            </div>

            {sel.type === 'text' && (
              <>
                <div>
                  <label className="block mb-0.5 text-gray-500">Текст</label>
                  <textarea value={sel.text || ''} onChange={e => upd(sel.id, { text: e.target.value })} className="w-full h-16 px-2 py-1 border border-gray-200 rounded text-xs resize-none" />
                </div>
                <div>
                  <label className="block mb-0.5 text-gray-500">Авто-значение</label>
                  <select value={sel.source || ''} onChange={e => upd(sel.id, { source: e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs">
                    {SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-3 gap-1">
                  <label>Размер<input type="number" value={sel.fontSize || 12} onChange={e => upd(sel.id, { fontSize: +e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs" /></label>
                  <label className="flex items-end gap-1"><input type="checkbox" checked={!!sel.bold} onChange={e => upd(sel.id, { bold: e.target.checked })} /><span>Ж</span></label>
                  <label className="flex items-end gap-1"><input type="checkbox" checked={!!sel.italic} onChange={e => upd(sel.id, { italic: e.target.checked })} /><span>К</span></label>
                </div>
                <div>
                  <label className="block mb-0.5 text-gray-500">Выравнивание</label>
                  <div className="flex gap-1">
                    {(['left', 'center', 'right'] as const).map(a => (
                      <button key={a} onClick={() => upd(sel.id, { align: a })} className={`flex-1 h-7 rounded border text-xs ${sel.align === a ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-200'}`}>
                        {a === 'left' ? 'Лево' : a === 'center' ? 'Центр' : 'Право'}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {sel.type === 'table' && (
              <div className="space-y-2">
                <div className="font-semibold">Столбцы</div>
                {(sel.columns || []).map((col, ci) => (
                  <div key={col.key} className="p-2 bg-gray-50 rounded space-y-1">
                    <div className="flex items-center gap-1">
                      <input value={col.label} onChange={e => {
                        const cols = [...(sel.columns || [])];
                        cols[ci] = { ...cols[ci], label: e.target.value };
                        upd(sel.id, { columns: cols });
                      }} className="flex-1 h-6 px-1 border border-gray-200 rounded text-xs" placeholder="Заголовок" />
                      <button onClick={() => {
                        const cols = (sel.columns || []).filter((_, i) => i !== ci);
                        upd(sel.id, { columns: cols });
                      }} className="text-red-400 hover:text-red-600"><Icon name="X" size={12} /></button>
                    </div>
                    <div className="flex gap-1">
                      <input type="number" value={col.width} onChange={e => {
                        const cols = [...(sel.columns || [])];
                        cols[ci] = { ...cols[ci], width: +e.target.value };
                        upd(sel.id, { columns: cols });
                      }} className="w-16 h-6 px-1 border border-gray-200 rounded text-xs" placeholder="Ширина" />
                      <select value={col.source || ''} onChange={e => {
                        const cols = [...(sel.columns || [])];
                        cols[ci] = { ...cols[ci], source: e.target.value };
                        upd(sel.id, { columns: cols });
                      }} className="flex-1 h-6 px-1 border border-gray-200 rounded text-xs">
                        {TABLE_SOURCES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
                <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => {
                  const cols = [...(sel.columns || []), { key: generateId(), label: 'Столбец', width: 80, source: '' }];
                  upd(sel.id, { columns: cols });
                }}><Icon name="Plus" size={12} className="mr-1" />Добавить столбец</Button>
              </div>
            )}

            {sel.type === 'line' && (
              <>
                <div>
                  <label className="block mb-0.5 text-gray-500">Стиль</label>
                  <select value={sel.lineStyle || 'solid'} onChange={e => upd(sel.id, { lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted' })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs">
                    <option value="solid">Сплошная</option>
                    <option value="dashed">Пунктир</option>
                    <option value="dotted">Точки</option>
                  </select>
                </div>
                <label className="flex items-center gap-2"><input type="checkbox" checked={!!sel.vertical} onChange={e => upd(sel.id, { vertical: e.target.checked, w: sel.h, h: sel.w })} /><span>Вертикальная</span></label>
                <label>Толщина<input type="number" value={sel.lineWidth || 1} onChange={e => upd(sel.id, { lineWidth: +e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs" /></label>
              </>
            )}

            {sel.type === 'frame' && (
              <>
                <div>
                  <label className="block mb-0.5 text-gray-500">Заголовок рамки</label>
                  <input value={sel.frameLabel || ''} onChange={e => upd(sel.id, { frameLabel: e.target.value })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs" />
                </div>
                <div>
                  <label className="block mb-0.5 text-gray-500">Стиль рамки</label>
                  <select value={sel.lineStyle || 'dashed'} onChange={e => upd(sel.id, { lineStyle: e.target.value as 'solid' | 'dashed' | 'dotted' })} className="w-full h-7 px-1.5 border border-gray-200 rounded text-xs">
                    <option value="solid">Сплошная</option>
                    <option value="dashed">Пунктир</option>
                    <option value="dotted">Точки</option>
                  </select>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}