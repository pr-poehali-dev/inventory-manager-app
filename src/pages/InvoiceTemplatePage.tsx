import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { AppState } from '@/data/store';

type BlockType = 'text' | 'table' | 'signature' | 'frame' | 'line';

interface Block {
  id: string;
  type: BlockType;
  x: number;
  y: number;
  w: number;
  h: number;
  text?: string;
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  align?: 'left' | 'center' | 'right';
  columns?: { label: string; width: number }[];
  rows?: string[][];
  signLabel?: string;
  signParts?: string[];
  signDate?: string;
  frameLabel?: string;
  lineWidth?: number;
}

const STORAGE_KEY = 'invoice_builder_blocks';
const CANVAS_W = 1200;
const CANVAS_H = 850;
const GRID_SIZE = 10;
const MAX_HISTORY = 50;

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function snap(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function defaultBlocks(): Block[] {
  return [
    {
      id: uid(), type: 'text', x: 300, y: 30, w: 600, h: 30,
      text: 'ТРЕБОВАНИЕ-НАКЛАДНАЯ №', fontSize: 14, bold: true, align: 'center',
    },
    {
      id: uid(), type: 'text', x: 720, y: 30, w: 150, h: 30,
      text: '22-ЧТ', fontSize: 14, bold: true, align: 'left',
    },
    {
      id: uid(), type: 'text', x: 450, y: 55, w: 250, h: 20,
      text: 'от _________________ г.', fontSize: 10, bold: false, align: 'left',
    },
    {
      id: uid(), type: 'table', x: 1020, y: 20, w: 170, h: 80,
      columns: [{ label: '', width: 100 }, { label: 'Коды', width: 70 }],
      rows: [['Форма по ОКУД', '0504204'], ['Дата', ''], ['по ОКПО', '']],
    },
    {
      id: uid(), type: 'text', x: 30, y: 100, w: 500, h: 20,
      text: 'Учреждение _______________', fontSize: 10, bold: false, align: 'left',
    },
    {
      id: uid(), type: 'text', x: 30, y: 120, w: 500, h: 20,
      text: 'Структурное подразделение — отправитель', fontSize: 10, bold: false, align: 'left',
    },
    {
      id: uid(), type: 'text', x: 30, y: 140, w: 500, h: 20,
      text: 'Структурное подразделение — получатель', fontSize: 10, bold: false, align: 'left',
    },
    {
      id: uid(), type: 'table', x: 30, y: 220, w: 1140, h: 400,
      columns: [
        { label: '№ п/п', width: 40 },
        { label: 'Наименование', width: 160 },
        { label: 'Номенкл. №', width: 70 },
        { label: 'Ед. изм.', width: 50 },
        { label: 'Код ОКЕИ', width: 50 },
        { label: 'Цена, руб.', width: 70 },
        { label: 'Затребовано', width: 75 },
        { label: 'Отпущено', width: 75 },
        { label: 'Сумма, руб.', width: 80 },
        { label: 'Дебет', width: 70 },
        { label: 'Кредит', width: 70 },
        { label: 'Срок годн.', width: 70 },
        { label: 'Примечание', width: 100 },
      ],
      rows: Array.from({ length: 11 }, () => Array(13).fill('')),
    },
    {
      id: uid(), type: 'signature', x: 30, y: 700, w: 500, h: 70,
      signLabel: 'Отпустил', signParts: ['должность', 'подпись', 'расшифровка подписи'],
      signDate: '«__» _________ 20__ г.',
    },
    {
      id: uid(), type: 'signature', x: 30, y: 780, w: 500, h: 70,
      signLabel: 'Получил', signParts: ['должность', 'подпись', 'расшифровка подписи'],
      signDate: '«__» _________ 20__ г.',
    },
    {
      id: uid(), type: 'frame', x: 700, y: 690, w: 480, h: 120,
      frameLabel: 'Отметка бухгалтерии',
    },
  ];
}

function cloneBlocks(blocks: Block[]): Block[] {
  return JSON.parse(JSON.stringify(blocks));
}

function computeTableSum(rows: string[][], colIndex: number): string {
  let sum = 0;
  let hasNum = false;
  for (const row of rows) {
    const val = parseFloat(row[colIndex]);
    if (!isNaN(val)) {
      sum += val;
      hasNum = true;
    }
  }
  return hasNum ? sum.toFixed(2) : '';
}

interface Props {
  state: AppState;
  onStateChange: (s: AppState) => void;
}

export default function InvoiceTemplatePage({ state, onStateChange }: Props) {
  void state;
  void onStateChange;

  const [blocks, setBlocks] = useState<Block[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingCell, setEditingCell] = useState<{ blockId: string; row: number; col: number } | null>(null);
  const [zoom, setZoom] = useState(0.8);
  const [history, setHistory] = useState<Block[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragState, setDragState] = useState<{ blockId: string; offsetX: number; offsetY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ blockId: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);

  const pushHistory = useCallback((newBlocks: Block[]) => {
    setHistory(prev => {
      const trimmed = prev.slice(0, historyIndex + 1);
      const next = [...trimmed, cloneBlocks(newBlocks)];
      if (next.length > MAX_HISTORY) next.shift();
      return next;
    });
    setHistoryIndex(prev => Math.min(prev + 1, MAX_HISTORY - 1));
  }, [historyIndex]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Block[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setBlocks(parsed);
          setHistory([cloneBlocks(parsed)]);
          setHistoryIndex(0);
          return;
        }
      }
    } catch { /* ignore */ }
    const def = defaultBlocks();
    setBlocks(def);
    setHistory([cloneBlocks(def)]);
    setHistoryIndex(0);
  }, []);

  const updateBlocks = useCallback((newBlocks: Block[], addToHistory = true) => {
    setBlocks(newBlocks);
    if (addToHistory) {
      pushHistory(newBlocks);
    }
  }, [pushHistory]);

  const undo = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setBlocks(cloneBlocks(history[newIndex]));
    }
  }, [history, historyIndex]);

  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setBlocks(cloneBlocks(history[newIndex]));
    }
  }, [history, historyIndex]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      if (e.key === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Z' && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        redo();
      }
      if (e.key === 'Delete' && selectedId && !editingId && !editingCell) {
        e.preventDefault();
        const newBlocks = blocks.filter(b => b.id !== selectedId);
        setSelectedId(null);
        updateBlocks(newBlocks);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedId, editingId, editingCell, blocks, updateBlocks]);

  const addBlock = (type: BlockType) => {
    const newBlock: Block = {
      id: uid(),
      type,
      x: 100,
      y: 100,
      w: type === 'line' ? 300 : type === 'table' ? 600 : type === 'signature' ? 500 : type === 'frame' ? 300 : 200,
      h: type === 'line' ? 2 : type === 'table' ? 200 : type === 'signature' ? 70 : type === 'frame' ? 150 : 30,
    };

    if (type === 'text') {
      newBlock.text = 'Новый текст';
      newBlock.fontSize = 10;
      newBlock.bold = false;
      newBlock.italic = false;
      newBlock.align = 'left';
    }
    if (type === 'table') {
      newBlock.columns = [
        { label: 'Столбец 1', width: 150 },
        { label: 'Столбец 2', width: 150 },
        { label: 'Столбец 3', width: 150 },
      ];
      newBlock.rows = [['', '', ''], ['', '', ''], ['', '', '']];
    }
    if (type === 'signature') {
      newBlock.signLabel = 'Подпись';
      newBlock.signParts = ['должность', 'подпись', 'расшифровка подписи'];
      newBlock.signDate = '«__» _________ 20__ г.';
    }
    if (type === 'frame') {
      newBlock.frameLabel = 'Заголовок';
    }

    const newBlocks = [...blocks, newBlock];
    setSelectedId(newBlock.id);
    updateBlocks(newBlocks);
  };

  const updateBlock = (id: string, updates: Partial<Block>, addToHistory = true) => {
    const newBlocks = blocks.map(b => b.id === id ? { ...b, ...updates } : b);
    if (addToHistory) {
      updateBlocks(newBlocks);
    } else {
      setBlocks(newBlocks);
    }
  };

  const deleteBlock = (id: string) => {
    const newBlocks = blocks.filter(b => b.id !== id);
    setSelectedId(null);
    updateBlocks(newBlocks);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-dots')) {
      setSelectedId(null);
      setEditingId(null);
      setEditingCell(null);
    }
  };

  const handleBlockMouseDown = (e: React.MouseEvent, blockId: string) => {
    if (editingId === blockId || editingCell?.blockId === blockId) return;
    e.stopPropagation();
    e.preventDefault();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const rect = canvasEl.getBoundingClientRect();
    const mouseX = (e.clientX - rect.left) / zoom;
    const mouseY = (e.clientY - rect.top) / zoom;
    setSelectedId(blockId);
    setEditingId(null);
    setEditingCell(null);
    setDragState({ blockId, offsetX: mouseX - block.x, offsetY: mouseY - block.y });
  };

  const handleResizeMouseDown = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    e.preventDefault();
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    setResizeState({ blockId, startX: e.clientX, startY: e.clientY, startW: block.w, startH: block.h });
  };

  useEffect(() => {
    if (!dragState && !resizeState) return;

    const handleMove = (e: MouseEvent) => {
      if (dragState) {
        const canvasEl = canvasRef.current;
        if (!canvasEl) return;
        const rect = canvasEl.getBoundingClientRect();
        const mouseX = (e.clientX - rect.left) / zoom;
        const mouseY = (e.clientY - rect.top) / zoom;
        const newX = snap(Math.max(0, Math.min(CANVAS_W - 20, mouseX - dragState.offsetX)));
        const newY = snap(Math.max(0, Math.min(CANVAS_H - 20, mouseY - dragState.offsetY)));
        setBlocks(prev => prev.map(b => b.id === dragState.blockId ? { ...b, x: newX, y: newY } : b));
      }
      if (resizeState) {
        const dx = (e.clientX - resizeState.startX) / zoom;
        const dy = (e.clientY - resizeState.startY) / zoom;
        const newW = snap(Math.max(30, resizeState.startW + dx));
        const newH = snap(Math.max(10, resizeState.startH + dy));
        setBlocks(prev => prev.map(b => b.id === resizeState.blockId ? { ...b, w: newW, h: newH } : b));
      }
    };

    const handleUp = () => {
      if (dragState || resizeState) {
        setBlocks(prev => {
          pushHistory(prev);
          return prev;
        });
      }
      setDragState(null);
      setResizeState(null);
    };

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, resizeState, zoom, pushHistory]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blocks));
  };

  const handleClear = () => {
    const def = defaultBlocks();
    setSelectedId(null);
    setEditingId(null);
    setEditingCell(null);
    updateBlocks(def);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    const renderBlockHtml = (block: Block): string => {
      const baseStyle = `position:absolute;left:${block.x}px;top:${block.y}px;width:${block.w}px;font-family:'Times New Roman',serif;`;

      if (block.type === 'text') {
        const fs = block.fontSize || 10;
        const fw = block.bold ? 'bold' : 'normal';
        const fst = block.italic ? 'italic' : 'normal';
        const ta = block.align || 'left';
        return `<div style="${baseStyle}font-size:${fs}pt;font-weight:${fw};font-style:${fst};text-align:${ta};white-space:pre-wrap;">${block.text || ''}</div>`;
      }

      if (block.type === 'table') {
        const cols = block.columns || [];
        const rows = block.rows || [];
        let html = `<div style="${baseStyle}"><table style="border-collapse:collapse;width:100%;font-size:8pt;font-family:'Times New Roman',serif;">`;
        html += '<thead><tr>';
        for (const col of cols) {
          html += `<th style="border:1px solid #000;padding:2px 3px;font-weight:normal;text-align:center;">${col.label}</th>`;
        }
        html += '</tr></thead><tbody>';
        for (let ri = 0; ri < rows.length; ri++) {
          html += '<tr>';
          for (let ci = 0; ci < cols.length; ci++) {
            html += `<td style="border:1px solid #000;padding:2px 3px;text-align:center;">${rows[ri]?.[ci] || ''}</td>`;
          }
          html += '</tr>';
        }
        const sumRow = cols.map((_, ci) => computeTableSum(rows, ci));
        const hasAnySum = sumRow.some(s => s !== '');
        if (hasAnySum) {
          html += '<tr>';
          for (let ci = 0; ci < cols.length; ci++) {
            html += `<td style="border:1px solid #000;padding:2px 3px;text-align:center;font-weight:bold;">${ci === 0 ? 'Итого' : sumRow[ci]}</td>`;
          }
          html += '</tr>';
        }
        html += '</tbody></table></div>';
        return html;
      }

      if (block.type === 'signature') {
        const parts = block.signParts || ['должность', 'подпись', 'расшифровка подписи'];
        let html = `<div style="${baseStyle}font-size:10pt;">`;
        html += `<div style="margin-bottom:6px;font-weight:bold;">${block.signLabel || ''}</div>`;
        html += '<div style="display:flex;gap:30px;">';
        for (const p of parts) {
          html += `<div style="text-align:center;"><div style="border-bottom:1px solid #000;min-width:120px;height:18px;"></div><div style="font-size:7pt;">(${p})</div></div>`;
        }
        html += '</div>';
        html += `<div style="margin-top:4px;font-size:9pt;">${block.signDate || ''}</div>`;
        html += '</div>';
        return html;
      }

      if (block.type === 'frame') {
        let html = `<div style="${baseStyle}height:${block.h}px;border:1px solid #000;position:absolute;">`;
        if (block.frameLabel) {
          html += `<div style="font-size:8pt;padding:2px 4px;border-bottom:1px solid #000;background:#fff;">${block.frameLabel}</div>`;
        }
        html += '</div>';
        return html;
      }

      if (block.type === 'line') {
        return `<div style="${baseStyle}height:0;border-top:1px solid #000;"></div>`;
      }

      return '';
    };

    const allHtml = blocks.map(renderBlockHtml).join('\n');

    w.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Печать накладной</title>
<style>
@page { size: landscape; margin: 6mm; }
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Times New Roman',serif; }
.canvas { position:relative; width:${CANVAS_W}px; height:${CANVAS_H}px; }
</style></head><body>
<div class="canvas">${allHtml}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  };

  const selectedBlock = blocks.find(b => b.id === selectedId);

  const renderTextBlock = (block: Block) => {
    const isEditing = editingId === block.id;
    return (
      <div
        style={{
          width: '100%',
          minHeight: 20,
          fontSize: `${block.fontSize || 10}pt`,
          fontWeight: block.bold ? 'bold' : 'normal',
          fontStyle: block.italic ? 'italic' : 'normal',
          textAlign: block.align || 'left',
          fontFamily: "'Times New Roman', serif",
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          outline: 'none',
          cursor: isEditing ? 'text' : 'move',
        }}
        contentEditable={isEditing}
        suppressContentEditableWarning
        onDoubleClick={(e) => {
          e.stopPropagation();
          setEditingId(block.id);
        }}
        onBlur={(e) => {
          if (editingId === block.id) {
            updateBlock(block.id, { text: e.currentTarget.textContent || '' });
            setEditingId(null);
          }
        }}
        onMouseDown={(e) => {
          if (isEditing) e.stopPropagation();
        }}
      >
        {block.text || ''}
      </div>
    );
  };

  const renderTableBlock = (block: Block) => {
    const cols = block.columns || [];
    const rows = block.rows || [];
    const isSelected = selectedId === block.id;
    return (
      <div style={{ width: '100%', fontFamily: "'Times New Roman', serif", fontSize: '8pt' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              {cols.map((col, ci) => (
                <th
                  key={ci}
                  style={{
                    border: '1px solid #000',
                    padding: '2px 3px',
                    fontWeight: 'normal',
                    textAlign: 'center',
                    fontSize: '7pt',
                    minWidth: 30,
                  }}
                >
                  {editingCell?.blockId === block.id && editingCell.row === -1 && editingCell.col === ci ? (
                    <input
                      autoFocus
                      className="w-full border-none bg-blue-50 text-center outline-none"
                      style={{ fontSize: '7pt', fontFamily: "'Times New Roman', serif" }}
                      defaultValue={col.label}
                      onBlur={(e) => {
                        const newCols = [...cols];
                        newCols[ci] = { ...newCols[ci], label: e.target.value };
                        updateBlock(block.id, { columns: newCols });
                        setEditingCell(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                      }}
                      onMouseDown={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <span
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingCell({ blockId: block.id, row: -1, col: ci });
                      }}
                    >
                      {col.label}
                    </span>
                  )}
                </th>
              ))}
              {isSelected && <th style={{ border: 'none', width: 20 }} />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                {cols.map((_, ci) => (
                  <td
                    key={ci}
                    style={{
                      border: '1px solid #000',
                      padding: '1px 3px',
                      textAlign: 'center',
                      minWidth: 30,
                    }}
                  >
                    {editingCell?.blockId === block.id && editingCell.row === ri && editingCell.col === ci ? (
                      <input
                        autoFocus
                        className="w-full border-none bg-blue-50 text-center outline-none"
                        style={{ fontSize: '8pt', fontFamily: "'Times New Roman', serif" }}
                        defaultValue={row[ci] || ''}
                        onBlur={(e) => {
                          const newRows = rows.map(r => [...r]);
                          newRows[ri][ci] = e.target.value;
                          updateBlock(block.id, { rows: newRows });
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                            const nextCi = ci + 1 < cols.length ? ci + 1 : 0;
                            const nextRi = ci + 1 < cols.length ? ri : ri + 1;
                            if (nextRi < rows.length) {
                              setEditingCell({ blockId: block.id, row: nextRi, col: nextCi });
                            }
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ blockId: block.id, row: ri, col: ci });
                        }}
                        style={{ display: 'block', minHeight: 14, cursor: 'text' }}
                      >
                        {row[ci] || ''}
                      </span>
                    )}
                  </td>
                ))}
                {isSelected && (
                  <td style={{ border: 'none', padding: 0, width: 20, verticalAlign: 'middle' }}>
                    <button
                      className="flex h-4 w-4 items-center justify-center rounded bg-red-100 text-red-600 hover:bg-red-200"
                      style={{ fontSize: '9px', lineHeight: 1 }}
                      onMouseDown={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const newRows = rows.filter((_, i) => i !== ri);
                        updateBlock(block.id, { rows: newRows });
                      }}
                    >
                      x
                    </button>
                  </td>
                )}
              </tr>
            ))}
            {(() => {
              const sumRow = cols.map((_, ci) => computeTableSum(rows, ci));
              const hasAny = sumRow.some(s => s !== '');
              if (!hasAny) return null;
              return (
                <tr>
                  {cols.map((_, ci) => (
                    <td
                      key={ci}
                      style={{
                        border: '1px solid #000',
                        padding: '1px 3px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        fontSize: '8pt',
                      }}
                    >
                      {ci === 0 ? 'Итого' : sumRow[ci]}
                    </td>
                  ))}
                </tr>
              );
            })()}
          </tbody>
        </table>
        {isSelected && (
          <div className="mt-1 flex gap-1" onMouseDown={(e) => e.stopPropagation()}>
            <button
              className="rounded bg-gray-100 px-2 py-0.5 text-xs hover:bg-gray-200"
              style={{ fontFamily: 'system-ui' }}
              onClick={(e) => {
                e.stopPropagation();
                const newRows = [...rows, Array(cols.length).fill('')];
                updateBlock(block.id, { rows: newRows });
              }}
            >
              + строка
            </button>
            <button
              className="rounded bg-gray-100 px-2 py-0.5 text-xs hover:bg-gray-200"
              style={{ fontFamily: 'system-ui' }}
              onClick={(e) => {
                e.stopPropagation();
                const newCols = [...cols, { label: 'Новый', width: 80 }];
                const newRows = rows.map(r => [...r, '']);
                updateBlock(block.id, { columns: newCols, rows: newRows });
              }}
            >
              + столбец
            </button>
            {cols.length > 1 && (
              <button
                className="rounded bg-red-50 px-2 py-0.5 text-xs text-red-600 hover:bg-red-100"
                style={{ fontFamily: 'system-ui' }}
                onClick={(e) => {
                  e.stopPropagation();
                  const newCols = cols.slice(0, -1);
                  const newRows = rows.map(r => r.slice(0, -1));
                  updateBlock(block.id, { columns: newCols, rows: newRows });
                }}
              >
                - столбец
              </button>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderSignatureBlock = (block: Block) => {
    const parts = block.signParts || ['должность', 'подпись', 'расшифровка подписи'];
    const isEditing = editingId === block.id;
    return (
      <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '10pt', width: '100%' }}>
        <div
          style={{ marginBottom: 4, fontWeight: 'bold', cursor: isEditing ? 'text' : 'default' }}
          contentEditable={isEditing}
          suppressContentEditableWarning
          onDoubleClick={(e) => {
            e.stopPropagation();
            setEditingId(block.id);
          }}
          onBlur={(e) => {
            updateBlock(block.id, { signLabel: e.currentTarget.textContent || '' });
            setEditingId(null);
          }}
          onMouseDown={(e) => { if (isEditing) e.stopPropagation(); }}
        >
          {block.signLabel || ''}
        </div>
        <div style={{ display: 'flex', gap: 30 }}>
          {parts.map((p, i) => (
            <div key={i} style={{ textAlign: 'center' }}>
              <div style={{ borderBottom: '1px solid #000', minWidth: 120, height: 18 }} />
              <div style={{ fontSize: '7pt' }}>({p})</div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 4, fontSize: '9pt' }}>
          {block.signDate || ''}
        </div>
      </div>
    );
  };

  const renderFrameBlock = (block: Block) => {
    const isEditing = editingId === block.id;
    return (
      <div style={{
        width: '100%',
        height: '100%',
        border: '1px solid #000',
        fontFamily: "'Times New Roman', serif",
        position: 'relative',
      }}>
        {block.frameLabel !== undefined && (
          <div
            style={{
              fontSize: '8pt',
              padding: '2px 4px',
              borderBottom: '1px solid #000',
              background: '#fff',
              cursor: isEditing ? 'text' : 'default',
              outline: 'none',
            }}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onDoubleClick={(e) => {
              e.stopPropagation();
              setEditingId(block.id);
            }}
            onBlur={(e) => {
              updateBlock(block.id, { frameLabel: e.currentTarget.textContent || '' });
              setEditingId(null);
            }}
            onMouseDown={(e) => { if (isEditing) e.stopPropagation(); }}
          >
            {block.frameLabel || ''}
          </div>
        )}
      </div>
    );
  };

  const renderLineBlock = () => {
    return (
      <div style={{ width: '100%', height: 0, borderTop: '1px solid #000' }} />
    );
  };

  const renderBlock = (block: Block) => {
    switch (block.type) {
      case 'text': return renderTextBlock(block);
      case 'table': return renderTableBlock(block);
      case 'signature': return renderSignatureBlock(block);
      case 'frame': return renderFrameBlock(block);
      case 'line': return renderLineBlock();
      default: return null;
    }
  };

  const renderPropertyPanel = () => {
    if (!selectedBlock) return null;
    const b = selectedBlock;
    return (
      <div
        className="flex w-[200px] shrink-0 flex-col gap-2 overflow-y-auto border-l border-gray-200 bg-white p-3"
        style={{ fontFamily: 'system-ui', fontSize: '12px' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="text-xs font-semibold uppercase text-gray-400">
          {b.type === 'text' ? 'Текст' : b.type === 'table' ? 'Таблица' : b.type === 'signature' ? 'Подпись' : b.type === 'frame' ? 'Рамка' : 'Линия'}
        </div>

        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500">X</span>
          <input
            type="number"
            className="rounded border border-gray-200 px-2 py-1 text-xs"
            value={b.x}
            onChange={(e) => updateBlock(b.id, { x: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500">Y</span>
          <input
            type="number"
            className="rounded border border-gray-200 px-2 py-1 text-xs"
            value={b.y}
            onChange={(e) => updateBlock(b.id, { y: Number(e.target.value) })}
          />
        </label>
        <label className="flex flex-col gap-0.5">
          <span className="text-[10px] text-gray-500">Ширина</span>
          <input
            type="number"
            className="rounded border border-gray-200 px-2 py-1 text-xs"
            value={b.w}
            onChange={(e) => updateBlock(b.id, { w: Number(e.target.value) })}
          />
        </label>
        {(b.type === 'frame' || b.type === 'table') && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500">Высота</span>
            <input
              type="number"
              className="rounded border border-gray-200 px-2 py-1 text-xs"
              value={b.h}
              onChange={(e) => updateBlock(b.id, { h: Number(e.target.value) })}
            />
          </label>
        )}

        {b.type === 'text' && (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-500">Размер шрифта</span>
              <input
                type="number"
                min={8}
                max={24}
                className="rounded border border-gray-200 px-2 py-1 text-xs"
                value={b.fontSize || 10}
                onChange={(e) => updateBlock(b.id, { fontSize: Number(e.target.value) })}
              />
            </label>
            <div className="flex gap-1">
              <button
                className={`rounded border px-2 py-1 text-xs font-bold ${b.bold ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                onClick={() => updateBlock(b.id, { bold: !b.bold })}
              >
                B
              </button>
              <button
                className={`rounded border px-2 py-1 text-xs italic ${b.italic ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                onClick={() => updateBlock(b.id, { italic: !b.italic })}
              >
                I
              </button>
            </div>
            <div className="flex gap-1">
              {(['left', 'center', 'right'] as const).map(a => (
                <button
                  key={a}
                  className={`rounded border px-2 py-1 text-xs ${b.align === a ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                  onClick={() => updateBlock(b.id, { align: a })}
                >
                  {a === 'left' ? 'Л' : a === 'center' ? 'Ц' : 'П'}
                </button>
              ))}
            </div>
          </>
        )}

        {b.type === 'signature' && (
          <>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-500">Подпись</span>
              <input
                className="rounded border border-gray-200 px-2 py-1 text-xs"
                value={b.signLabel || ''}
                onChange={(e) => updateBlock(b.id, { signLabel: e.target.value })}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-[10px] text-gray-500">Дата</span>
              <input
                className="rounded border border-gray-200 px-2 py-1 text-xs"
                value={b.signDate || ''}
                onChange={(e) => updateBlock(b.id, { signDate: e.target.value })}
              />
            </label>
            {(b.signParts || []).map((part, i) => (
              <label key={i} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-gray-500">Часть {i + 1}</span>
                <input
                  className="rounded border border-gray-200 px-2 py-1 text-xs"
                  value={part}
                  onChange={(e) => {
                    const newParts = [...(b.signParts || [])];
                    newParts[i] = e.target.value;
                    updateBlock(b.id, { signParts: newParts });
                  }}
                />
              </label>
            ))}
          </>
        )}

        {b.type === 'frame' && (
          <label className="flex flex-col gap-0.5">
            <span className="text-[10px] text-gray-500">Заголовок</span>
            <input
              className="rounded border border-gray-200 px-2 py-1 text-xs"
              value={b.frameLabel || ''}
              onChange={(e) => updateBlock(b.id, { frameLabel: e.target.value })}
            />
          </label>
        )}

        {b.type === 'table' && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500">Столбцов: {(b.columns || []).length}</span>
            <span className="text-[10px] text-gray-500">Строк: {(b.rows || []).length}</span>
          </div>
        )}

        <div className="mt-auto pt-2">
          <Button
            variant="destructive"
            size="sm"
            className="w-full"
            onClick={() => deleteBlock(b.id)}
          >
            <Icon name="Trash2" size={14} />
            Удалить
          </Button>
        </div>
      </div>
    );
  };

  const dotPattern = `radial-gradient(circle, #d1d5db 0.5px, transparent 0.5px)`;

  return (
    <div className="flex h-screen flex-col" style={{ fontFamily: 'system-ui' }}>
      <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-4 py-2">
        <div className="text-sm font-semibold text-gray-700">Шаблон накладной</div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={undo}
            disabled={historyIndex <= 0}
            title="Отменить (Ctrl+Z)"
          >
            <Icon name="Undo2" size={16} />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            title="Повторить (Ctrl+Shift+Z)"
          >
            <Icon name="Redo2" size={16} />
          </Button>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <Button variant="ghost" size="sm" onClick={() => addBlock('text')} title="Текст">
            <Icon name="Type" size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addBlock('table')} title="Таблица">
            <Icon name="Table" size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addBlock('signature')} title="Подпись">
            <Icon name="PenLine" size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addBlock('frame')} title="Рамка">
            <Icon name="Square" size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => addBlock('line')} title="Линия">
            <Icon name="Minus" size={16} />
          </Button>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <Button variant="ghost" size="sm" onClick={handleClear} title="Очистить">
            <Icon name="Trash2" size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handleSave} title="Сохранить">
            <Icon name="Save" size={16} />
          </Button>
          <Button variant="ghost" size="sm" onClick={handlePrint} title="Печать">
            <Icon name="Printer" size={16} />
          </Button>
          <div className="mx-1 h-5 w-px bg-gray-200" />
          <div className="flex items-center gap-1">
            <button
              className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
              onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
            >
              -
            </button>
            <span className="w-10 text-center text-xs text-gray-500">{Math.round(zoom * 100)}%</span>
            <button
              className="rounded px-1.5 py-0.5 text-xs text-gray-500 hover:bg-gray-100"
              onClick={() => setZoom(z => Math.min(1.5, z + 0.1))}
            >
              +
            </button>
          </div>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        <div
          className="flex-1 overflow-auto bg-gray-100"
          style={{ padding: 40 }}
          onMouseDown={handleCanvasMouseDown}
        >
          <div
            ref={canvasRef}
            className="relative mx-auto bg-white shadow-lg"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              backgroundImage: dotPattern,
              backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
            }}
            onMouseDown={handleCanvasMouseDown}
          >
            {blocks.map(block => (
              <div
                key={block.id}
                style={{
                  position: 'absolute',
                  left: block.x,
                  top: block.y,
                  width: block.w,
                  height: block.type === 'frame' || block.type === 'table' ? block.h : undefined,
                  minHeight: block.type === 'line' ? 2 : undefined,
                  cursor: editingId === block.id || editingCell?.blockId === block.id ? 'default' : 'move',
                  outline: selectedId === block.id ? '2px solid #3b82f6' : 'none',
                  outlineOffset: 1,
                  zIndex: selectedId === block.id ? 10 : 1,
                  userSelect: editingId === block.id || editingCell?.blockId === block.id ? 'text' : 'none',
                }}
                onMouseDown={(e) => handleBlockMouseDown(e, block.id)}
                onDoubleClick={(e) => {
                  e.stopPropagation();
                  if (block.type === 'text' || block.type === 'signature' || block.type === 'frame') {
                    setEditingId(block.id);
                  }
                }}
              >
                {renderBlock(block)}
                {selectedId === block.id && (
                  <div
                    style={{
                      position: 'absolute',
                      right: -4,
                      bottom: -4,
                      width: 8,
                      height: 8,
                      background: '#3b82f6',
                      cursor: 'nwse-resize',
                      borderRadius: 1,
                    }}
                    onMouseDown={(e) => handleResizeMouseDown(e, block.id)}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {renderPropertyPanel()}
      </div>
    </div>
  );
}
