import { useState, useEffect, useRef, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { AppState } from '@/data/store';

type BlockType = 'text' | 'table' | 'signature' | 'frame' | 'line';

type ChildType = 'label' | 'sign-fields' | 'date-text' | 'line-separator' | 'free-text';

interface BlockChild {
  id: string;
  type: ChildType;
  text?: string;
  fontSize?: number;
  bold?: boolean;
  parts?: string[];
  lineStyle?: 'solid' | 'dashed';
  align?: 'left' | 'center' | 'right';
  gap?: number;
  minWidth?: number;
}

interface HeaderCell {
  text: string;
  colspan?: number;
  rowspan?: number;
  width?: number;
}

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
  frameContent?: string;
  lineWidth?: number;
  children?: BlockChild[];
  headerRows?: HeaderCell[][];
  showRowNumbers?: boolean;
  showTotals?: boolean;
  totalsLabel?: string;
  totalsLabelCol?: number;
  borderStyle?: 'solid' | 'dashed';
}

const STORAGE_KEY = 'invoice_builder_blocks';
const STORAGE_VERSION_KEY = 'invoice_builder_version';
const CURRENT_VERSION = 8;
const CANVAS_W = 1122;
const CANVAS_H = 794;
const GRID_SIZE = 10;
const MAX_HISTORY = 50;

function uid(): string {
  return Math.random().toString(36).slice(2, 9);
}

function snap(v: number): number {
  return Math.round(v / GRID_SIZE) * GRID_SIZE;
}

function makeSignatureChildren(label: string, parts: string[], date: string): BlockChild[] {
  return [
    { id: uid(), type: 'label', text: label, fontSize: 10, bold: true },
    { id: uid(), type: 'sign-fields', parts: [...parts], gap: 30, minWidth: 120 },
    { id: uid(), type: 'date-text', text: date, fontSize: 9 },
  ];
}

function makeFrameChildren(label: string, _content: string): BlockChild[] {
  return [
    { id: uid(), type: 'label', text: label, fontSize: 8 },
    { id: uid(), type: 'free-text', text: _content, fontSize: 9 },
  ];
}

function ensureChildren(block: Block): BlockChild[] {
  if (block.children && block.children.length > 0) return block.children;
  if (block.type === 'signature') {
    return makeSignatureChildren(
      block.signLabel || '',
      block.signParts || ['должность', 'подпись', 'расшифровка подписи'],
      block.signDate || '«__» _________ 20__ г.'
    );
  }
  if (block.type === 'frame') {
    return makeFrameChildren(
      block.frameLabel || '',
      block.frameContent || ''
    );
  }
  return [];
}

function defaultBlocks(): Block[] {
  const L = 30;
  const R = 1090;
  const TW = R - L;
  return [
    {
      id: uid(), type: 'text', x: 300, y: 15, w: 380, h: 20,
      text: 'ТРЕБОВАНИЕ-НАКЛАДНАЯ  №', fontSize: 11, bold: true, align: 'center',
    },
    {
      id: uid(), type: 'text', x: 640, y: 15, w: 70, h: 20,
      text: '22-ЧТ', fontSize: 11, bold: true, align: 'center',
    },
    {
      id: uid(), type: 'text', x: 420, y: 36, w: 30, h: 12,
      text: 'от', fontSize: 8, align: 'right',
    },
    {
      id: uid(), type: 'text', x: 456, y: 34, w: 140, h: 12,
      text: '4 апреля 2026 г.', fontSize: 8, align: 'center',
    },
    {
      id: uid(), type: 'line', x: 454, y: 46, w: 144, h: 1, lineWidth: 1,
    },
    {
      id: uid(), type: 'text', x: 880, y: 28, w: 100, h: 13,
      text: 'Форма по ОКУД', fontSize: 7, bold: true, align: 'right',
    },
    {
      id: uid(), type: 'text', x: 920, y: 44, w: 60, h: 13,
      text: 'Дата', fontSize: 7, bold: true, align: 'right',
    },
    {
      id: uid(), type: 'text', x: 900, y: 60, w: 80, h: 13,
      text: 'по ОКПО', fontSize: 7, bold: false, align: 'right',
    },
    {
      id: uid(), type: 'text', x: 900, y: 106, w: 80, h: 13,
      text: 'по ОКЕИ', fontSize: 7, bold: false, align: 'right',
    },
    {
      id: uid(), type: 'table', x: 990, y: 10, w: 70, h: 120,
      columns: [{ label: 'Коды', width: 70 }],
      rows: [['0504204'], [''], [''], [''], [''], ['383']],
    },
    {
      id: uid(), type: 'text', x: L, y: 66, w: 400, h: 13,
      text: 'Учреждение', fontSize: 8, align: 'left',
    },
    {
      id: uid(), type: 'text', x: L, y: 80, w: 400, h: 13,
      text: 'Структурное подразделение - отправитель', fontSize: 8, align: 'left',
    },
    {
      id: uid(), type: 'text', x: L, y: 94, w: 400, h: 13,
      text: 'Структурное подразделение - получатель', fontSize: 8, align: 'left',
    },
    {
      id: uid(), type: 'text', x: L, y: 108, w: 500, h: 13,
      text: 'Единица измерения: руб. (с точностью до второго десятичного знака)', fontSize: 8, align: 'left',
    },
    {
      id: uid(), type: 'text', x: L, y: 132, w: 70, h: 12,
      text: 'Затребовал', fontSize: 8, align: 'left',
    },
    {
      id: uid(), type: 'text', x: 120, y: 128, w: 80, h: 11,
      text: 'лейтенант', fontSize: 8, italic: true, align: 'center',
    },
    { id: uid(), type: 'line', x: 108, y: 139, w: 105, h: 1, lineWidth: 1 },
    {
      id: uid(), type: 'text', x: 108, y: 140, w: 105, h: 9,
      text: '(звание)', fontSize: 6, align: 'center',
    },
    {
      id: uid(), type: 'text', x: 268, y: 128, w: 80, h: 11,
      text: '0', fontSize: 8, italic: true, align: 'center',
    },
    { id: uid(), type: 'line', x: 240, y: 139, w: 140, h: 1, lineWidth: 1 },
    {
      id: uid(), type: 'text', x: 240, y: 140, w: 140, h: 9,
      text: '(фамилия, инициалы)', fontSize: 6, align: 'center',
    },
    {
      id: uid(), type: 'text', x: 490, y: 132, w: 65, h: 12,
      text: 'Разрешил', fontSize: 8, align: 'left',
    },
    {
      id: uid(), type: 'text', x: 608, y: 128, w: 80, h: 11,
      text: 'НЦ (БпС)', fontSize: 8, italic: true, align: 'center',
    },
    { id: uid(), type: 'line', x: 590, y: 139, w: 110, h: 1, lineWidth: 1 },
    {
      id: uid(), type: 'text', x: 590, y: 140, w: 110, h: 9,
      text: '(должность)', fontSize: 6, align: 'center',
    },
    { id: uid(), type: 'line', x: 720, y: 139, w: 80, h: 1, lineWidth: 1 },
    {
      id: uid(), type: 'text', x: 720, y: 140, w: 80, h: 9,
      text: '(подпись)', fontSize: 6, align: 'center',
    },
    {
      id: uid(), type: 'text', x: 940, y: 128, w: 170, h: 11,
      text: 'Калита Е.Н', fontSize: 8, italic: true, align: 'center',
    },
    { id: uid(), type: 'line', x: 940, y: 139, w: 170, h: 1, lineWidth: 1 },
    {
      id: uid(), type: 'text', x: 940, y: 140, w: 170, h: 9,
      text: '(расшифровка подписи)', fontSize: 6, align: 'center',
    },
    {
      id: uid(), type: 'table', x: L, y: 158, w: TW, h: 420,
      headerRows: [
        [
          { text: 'Материальные ценности', colspan: 3 },
          { text: 'Единица\nизмерения', colspan: 2 },
          { text: 'Цена', rowspan: 3 },
          { text: 'Количество', colspan: 2 },
          { text: 'Сумма\n(без НДС)', rowspan: 3 },
          { text: 'Корреспондирующие счета', colspan: 2 },
          { text: 'Примечание', rowspan: 3 },
        ],
        [
          { text: 'наименование', rowspan: 2 },
          { text: 'номер', colspan: 2 },
          { text: 'наимено-\nвание', rowspan: 2 },
          { text: 'код по\nОКЕИ', rowspan: 2 },
          { text: 'затре-\nбовано', rowspan: 2 },
          { text: 'отпу-\nщено', rowspan: 2 },
          { text: 'дебет', rowspan: 2 },
          { text: 'кредит', rowspan: 2 },
        ],
        [
          { text: 'номенкла-\nтурный' },
          { text: 'паспорта (иной)' },
        ],
      ],
      showRowNumbers: true,
      showTotals: true,
      totalsLabel: 'Итого',
      totalsLabelCol: 5,
      columns: [
        { label: 'наименование', width: 140 },
        { label: 'номенклатурный', width: 78 },
        { label: 'паспорта (иной)', width: 78 },
        { label: 'наименование', width: 62 },
        { label: 'код по ОКЕИ', width: 48 },
        { label: 'Цена', width: 50 },
        { label: 'затребовано', width: 56 },
        { label: 'отпущено', width: 52 },
        { label: 'Сумма', width: 60 },
        { label: 'дебет', width: 62 },
        { label: 'кредит', width: 60 },
        { label: 'Примечание', width: 66 },
      ],
      rows: [
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '130', '130', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '600', '600', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '600', '600', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '600', '600', '', '', '', 'М3'],
        ['', '', '', 'шт.', '', '', '', '', '', '', '', ''],
      ],
    },
    {
      id: uid(), type: 'text', x: L, y: 590, w: 60, h: 12,
      text: 'Отпустил', fontSize: 8, bold: false, align: 'left',
    },
    {
      id: uid(), type: 'signature', x: L, y: 604, w: 380, h: 44,
      children: [
        { id: uid(), type: 'sign-fields', parts: ['звание', 'подпись', 'расшифровка подписи'], gap: 16, minWidth: 100 },
        { id: uid(), type: 'date-text', text: '4 апреля 2026 г.', fontSize: 8 },
      ],
    },
    {
      id: uid(), type: 'text', x: 430, y: 590, w: 180, h: 12,
      text: 'Ответственный исполнитель', fontSize: 8, bold: false, align: 'left',
    },
    {
      id: uid(), type: 'signature', x: 430, y: 604, w: 310, h: 44,
      children: [
        { id: uid(), type: 'sign-fields', parts: ['должность', 'подпись', 'расшифровка\nподписи'], gap: 12, minWidth: 80 },
        { id: uid(), type: 'date-text', text: '«__» _________ 20__ г.', fontSize: 8 },
      ],
    },
    {
      id: uid(), type: 'text', x: L, y: 656, w: 60, h: 12,
      text: 'Получил', fontSize: 8, bold: false, align: 'left',
    },
    {
      id: uid(), type: 'text', x: 115, y: 652, w: 75, h: 11,
      text: 'лейтенант', fontSize: 8, italic: true, align: 'center',
    },
    { id: uid(), type: 'line', x: 100, y: 663, w: 105, h: 1, lineWidth: 1 },
    {
      id: uid(), type: 'text', x: 100, y: 664, w: 105, h: 9,
      text: '(звание)', fontSize: 6, align: 'center',
    },
    {
      id: uid(), type: 'signature', x: L, y: 676, w: 380, h: 44,
      children: [
        { id: uid(), type: 'sign-fields', parts: ['звание', 'подпись', 'расшифровка подписи'], gap: 16, minWidth: 100 },
        { id: uid(), type: 'date-text', text: '4 апреля 2026 г.', fontSize: 8 },
      ],
    },
    {
      id: uid(), type: 'frame', x: 760, y: 584, w: 330, h: 148, borderStyle: 'dashed',
      children: [
        { id: uid(), type: 'label', text: 'Отметка бухгалтерии', fontSize: 8, bold: false, align: 'center' },
        { id: uid(), type: 'free-text', text: 'Корреспонденция счетов (графы 10, 11) отражена\nв журнале операций за __________ 20___ г.', fontSize: 7 },
        { id: uid(), type: 'free-text', text: 'Исполнитель ____________________________', fontSize: 7 },
        { id: uid(), type: 'sign-fields', parts: ['должность', 'подпись', 'расшифровка подписи'], gap: 8, minWidth: 65 },
        { id: uid(), type: 'free-text', text: '«____» _______________ 20____ г.', fontSize: 7 },
      ],
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
  if (!hasNum) return '';
  return sum === Math.floor(sum) ? sum.toString() : sum.toFixed(2);
}

function isEditableElement(el: Element | null): boolean {
  if (!el) return false;
  if ((el as HTMLElement).isContentEditable) return true;
  const tag = el.tagName?.toLowerCase();
  return tag === 'input' || tag === 'textarea' || tag === 'select';
}

function childTypeLabel(type: ChildType): string {
  switch (type) {
    case 'label': return 'Заголовок';
    case 'sign-fields': return 'Поля подписи';
    case 'date-text': return 'Дата';
    case 'line-separator': return 'Линия';
    case 'free-text': return 'Текст';
  }
}

function renderMultiHeaderHtml(headerRows: HeaderCell[][], colCount: number, showRowNumbers?: boolean): string {
  let html = '';
  for (const row of headerRows) {
    html += '<tr>';
    for (const cell of row) {
      const cs = cell.colspan ? ` colspan="${cell.colspan}"` : '';
      const rs = cell.rowspan ? ` rowspan="${cell.rowspan}"` : '';
      const textLines = (cell.text || '').split('\n').join('<br/>');
      html += `<th${cs}${rs} style="border:1px solid #000;padding:2px 3px;font-weight:normal;text-align:center;font-size:7pt;white-space:pre-wrap;vertical-align:middle;">${textLines}</th>`;
    }
    html += '</tr>';
  }
  if (showRowNumbers) {
    html += '<tr>';
    for (let i = 0; i < colCount; i++) {
      html += `<td style="border:1px solid #000;padding:1px 2px;text-align:center;font-size:7pt;font-weight:normal;">${i + 1}</td>`;
    }
    html += '</tr>';
  }
  return html;
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
  const [editingCell, setEditingCell] = useState<{ blockId: string; row: number; col: number } | null>(null);
  const [zoom, setZoom] = useState(0.85);
  const [history, setHistory] = useState<Block[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [dragState, setDragState] = useState<{ blockId: string; offsetX: number; offsetY: number } | null>(null);
  const [resizeState, setResizeState] = useState<{ blockId: string; startX: number; startY: number; startW: number; startH: number } | null>(null);
  const [expandedChildId, setExpandedChildId] = useState<string | null>(null);
  const [saveFlash, setSaveFlash] = useState(false);
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
    const savedVersion = parseInt(localStorage.getItem(STORAGE_VERSION_KEY) || '0', 10);
    const hasUserData = !!localStorage.getItem(STORAGE_KEY);
    if (savedVersion < CURRENT_VERSION && !hasUserData) {
      localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
    }
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Block[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          const migrated = parsed.map(b => {
            if ((b.type === 'signature' || b.type === 'frame') && !b.children) {
              return { ...b, children: ensureChildren(b) };
            }
            return b;
          });
          setBlocks(migrated);
          setHistory([cloneBlocks(migrated)]);
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
      if (e.key === 'Delete' && selectedId && !editingCell && !isEditableElement(document.activeElement)) {
        e.preventDefault();
        const newBlocks = blocks.filter(b => b.id !== selectedId);
        setSelectedId(null);
        updateBlocks(newBlocks);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, selectedId, editingCell, blocks, updateBlocks]);

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
      newBlock.children = makeSignatureChildren(
        'Подпись',
        ['должность', 'подпись', 'расшифровка подписи'],
        '«__» _________ 20__ г.'
      );
    }
    if (type === 'frame') {
      newBlock.children = makeFrameChildren('Заголовок', '');
    }
    if (type === 'line') {
      newBlock.lineWidth = 1;
    }
    const newBlocks = [...blocks, newBlock];
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

  const updateChild = (blockId: string, childId: string, updates: Partial<BlockChild>) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const children = ensureChildren(block);
    const newChildren = children.map(c => c.id === childId ? { ...c, ...updates } : c);
    updateBlock(blockId, { children: newChildren });
  };

  const moveChild = (blockId: string, childId: string, direction: -1 | 1) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const children = [...ensureChildren(block)];
    const idx = children.findIndex(c => c.id === childId);
    if (idx < 0) return;
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= children.length) return;
    [children[idx], children[newIdx]] = [children[newIdx], children[idx]];
    updateBlock(blockId, { children });
  };

  const removeChild = (blockId: string, childId: string) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const children = ensureChildren(block).filter(c => c.id !== childId);
    updateBlock(blockId, { children });
    if (expandedChildId === childId) setExpandedChildId(null);
  };

  const addChild = (blockId: string, type: ChildType) => {
    const block = blocks.find(b => b.id === blockId);
    if (!block) return;
    const children = [...ensureChildren(block)];
    const newChild: BlockChild = { id: uid(), type };
    if (type === 'label') {
      newChild.text = 'Заголовок';
      newChild.fontSize = 10;
      newChild.bold = false;
    }
    if (type === 'sign-fields') {
      newChild.parts = ['подпись'];
      newChild.gap = 30;
      newChild.minWidth = 120;
    }
    if (type === 'date-text') {
      newChild.text = '«__» _________ 20__ г.';
      newChild.fontSize = 9;
    }
    if (type === 'line-separator') {
      newChild.lineStyle = 'solid';
    }
    if (type === 'free-text') {
      newChild.text = '';
      newChild.fontSize = 9;
    }
    children.push(newChild);
    updateBlock(blockId, { children });
  };

  const deleteBlock = (id: string) => {
    const newBlocks = blocks.filter(b => b.id !== id);
    setSelectedId(null);
    updateBlocks(newBlocks);
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    if (e.target === canvasRef.current || (e.target as HTMLElement).classList.contains('canvas-dots')) {
      setSelectedId(null);
      setEditingCell(null);
    }
  };

  const handleDragHandleMouseDown = (e: React.MouseEvent, blockId: string) => {
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
    setEditingCell(null);
    setDragState({ blockId, offsetX: mouseX - block.x, offsetY: mouseY - block.y });
  };

  const handleBlockClick = (e: React.MouseEvent, blockId: string) => {
    e.stopPropagation();
    setSelectedId(blockId);
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
    localStorage.setItem(STORAGE_VERSION_KEY, String(CURRENT_VERSION));
    setSaveFlash(true);
    setTimeout(() => setSaveFlash(false), 1500);
  };

  const handleClear = () => {
    const def = defaultBlocks();
    setSelectedId(null);
    setEditingCell(null);
    updateBlocks(def);
  };

  const renderChildHtml = (child: BlockChild): string => {
    switch (child.type) {
      case 'label': {
        const fs = child.fontSize || 10;
        const fw = child.bold ? 'font-weight:bold;' : '';
        const ta = child.align ? `text-align:${child.align};` : '';
        return `<div style="font-size:${fs}pt;${fw}${ta}margin-bottom:4px;">${child.text || ''}</div>`;
      }
      case 'sign-fields': {
        const parts = child.parts || [];
        const gap = child.gap || 30;
        const mw = child.minWidth || 120;
        let html = `<div style="display:flex;gap:${gap}px;">`;
        for (const p of parts) {
          html += `<div style="text-align:center;"><div style="border-bottom:1px solid #000;min-width:${mw}px;height:18px;"></div><div style="font-size:7pt;">(${p})</div></div>`;
        }
        html += '</div>';
        return html;
      }
      case 'date-text': {
        const fs = child.fontSize || 9;
        return `<div style="margin-top:4px;font-size:${fs}pt;">${child.text || ''}</div>`;
      }
      case 'line-separator': {
        const style = child.lineStyle === 'dashed' ? 'dashed' : 'solid';
        return `<div style="border-top:1px ${style} #000;margin:4px 0;"></div>`;
      }
      case 'free-text': {
        const fs = child.fontSize || 9;
        return `<div style="font-size:${fs}pt;white-space:pre-wrap;">${child.text || ''}</div>`;
      }
      default:
        return '';
    }
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
        const hasMultiHeader = block.headerRows && block.headerRows.length > 0;
        let html = `<div style="${baseStyle}"><table style="border-collapse:collapse;width:100%;font-size:8pt;font-family:'Times New Roman',serif;">`;

        if (hasMultiHeader) {
          html += '<thead>';
          html += renderMultiHeaderHtml(block.headerRows!, cols.length, block.showRowNumbers);
          html += '</thead>';
        } else {
          html += '<thead><tr>';
          for (const col of cols) {
            html += `<th style="border:1px solid #000;padding:2px 3px;font-weight:normal;text-align:center;">${col.label}</th>`;
          }
          html += '</tr></thead>';
        }

        html += '<tbody>';
        for (let ri = 0; ri < rows.length; ri++) {
          html += '<tr>';
          for (let ci = 0; ci < cols.length; ci++) {
            html += `<td style="border:1px solid #000;padding:2px 3px;text-align:center;">${rows[ri]?.[ci] || ''}</td>`;
          }
          html += '</tr>';
        }

        if (block.showTotals) {
          const sumRow = cols.map((_, ci) => computeTableSum(rows, ci));
          html += '<tr>';
          for (let ci = 0; ci < cols.length; ci++) {
            const isTotalsLabelCol = ci === (block.totalsLabelCol ?? 0);
            const val = isTotalsLabelCol ? (block.totalsLabel || 'Итого') : sumRow[ci];
            const fw = isTotalsLabelCol ? 'font-weight:bold;' : '';
            html += `<td style="border:1px solid #000;padding:2px 3px;text-align:center;${fw}">${val}</td>`;
          }
          html += '</tr>';
        }

        html += '</tbody></table></div>';
        return html;
      }

      if (block.type === 'signature') {
        const children = ensureChildren(block);
        let html = `<div style="${baseStyle}font-size:10pt;">`;
        for (const child of children) {
          html += renderChildHtml(child);
        }
        html += '</div>';
        return html;
      }

      if (block.type === 'frame') {
        const children = ensureChildren(block);
        const fbs = block.borderStyle || 'solid';
        let html = `<div style="${baseStyle}height:${block.h}px;border:1px ${fbs} #000;position:absolute;">`;
        for (const child of children) {
          if (child.type === 'label') {
            html += `<div style="font-size:${child.fontSize || 8}pt;padding:2px 4px;border-bottom:1px ${fbs} #000;background:#fff;${child.bold ? 'font-weight:bold;' : ''}">${child.text || ''}</div>`;
          } else {
            html += `<div style="padding:4px;">${renderChildHtml(child)}</div>`;
          }
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
    const isSelected = selectedId === block.id;
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
          cursor: 'text',
        }}
        contentEditable={isSelected}
        suppressContentEditableWarning
        onClick={(e) => {
          e.stopPropagation();
          if (isSelected) {
            (e.currentTarget as HTMLElement).focus();
          }
        }}
        onBlur={(e) => {
          updateBlock(block.id, { text: e.currentTarget.textContent || '' });
        }}
        onMouseDown={(e) => {
          if (isSelected) e.stopPropagation();
        }}
      >
        {block.text || ''}
      </div>
    );
  };

  const renderMultiHeaderRow = (block: Block) => {
    if (!block.headerRows || block.headerRows.length === 0) return null;
    const cols = block.columns || [];
    return (
      <>
        {block.headerRows.map((row, rowIdx) => (
          <tr key={`hdr-${rowIdx}`}>
            {row.map((cell, cellIdx) => (
              <th
                key={`hdr-${rowIdx}-${cellIdx}`}
                colSpan={cell.colspan || 1}
                rowSpan={cell.rowspan || 1}
                style={{
                  border: '1px solid #000',
                  padding: '2px 3px',
                  fontWeight: 'normal',
                  textAlign: 'center',
                  fontSize: '7pt',
                  whiteSpace: 'pre-wrap',
                  verticalAlign: 'middle',
                  lineHeight: '1.2',
                }}
              >
                {cell.text}
              </th>
            ))}
          </tr>
        ))}
        {block.showRowNumbers && (
          <tr>
            {cols.map((_, ci) => (
              <td
                key={`num-${ci}`}
                style={{
                  border: '1px solid #000',
                  padding: '1px 2px',
                  textAlign: 'center',
                  fontSize: '7pt',
                  fontWeight: 'normal',
                }}
              >
                {ci + 1}
              </td>
            ))}
          </tr>
        )}
      </>
    );
  };

  const renderTableBlock = (block: Block) => {
    const cols = block.columns || [];
    const rows = block.rows || [];
    const isSelected = selectedId === block.id;
    const hasMultiHeader = block.headerRows && block.headerRows.length > 0;

    return (
      <div style={{ width: '100%', fontFamily: "'Times New Roman', serif", fontSize: '8pt' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            {hasMultiHeader ? (
              renderMultiHeaderRow(block)
            ) : (
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
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingCell({ blockId: block.id, row: -1, col: ci });
                        }}
                        style={{ display: 'block', minHeight: 14, cursor: 'text' }}
                      >
                        {col.label}
                      </span>
                    )}
                  </th>
                ))}
                {isSelected && <th style={{ border: 'none', width: 20 }} />}
              </tr>
            )}
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
                      fontSize: '8pt',
                    }}
                  >
                    {editingCell?.blockId === block.id && editingCell.row === ri && editingCell.col === ci ? (
                      <input
                        autoFocus
                        className="w-full border-none bg-blue-50 text-center outline-none"
                        style={{ fontSize: '8pt', fontFamily: "'Times New Roman', serif" }}
                        defaultValue={row[ci] || ''}
                        onBlur={(e) => {
                          const newRows = rows.map((r, i) => {
                            if (i !== ri) return r;
                            const newRow = [...r];
                            newRow[ci] = e.target.value;
                            return newRow;
                          });
                          updateBlock(block.id, { rows: newRows });
                          setEditingCell(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                          if (e.key === 'Tab') {
                            e.preventDefault();
                            (e.target as HTMLInputElement).blur();
                            const nextCol = ci + 1 < cols.length ? ci + 1 : 0;
                            const nextRow = nextCol === 0 ? ri + 1 : ri;
                            if (nextRow < rows.length) {
                              setEditingCell({ blockId: block.id, row: nextRow, col: nextCol });
                            }
                          }
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <span
                        onClick={(e) => {
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
            {block.showTotals && (
              <tr>
                {cols.map((_, ci) => {
                  const isTotalsLabelCol = ci === (block.totalsLabelCol ?? 0);
                  const sumRow = computeTableSum(rows, ci);
                  return (
                    <td
                      key={ci}
                      style={{
                        border: '1px solid #000',
                        padding: '1px 3px',
                        textAlign: 'center',
                        fontWeight: isTotalsLabelCol ? 'bold' : 'normal',
                        fontSize: '8pt',
                      }}
                    >
                      {isTotalsLabelCol ? (block.totalsLabel || 'Итого') : sumRow}
                    </td>
                  );
                })}
              </tr>
            )}
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

  const renderChildElement = (block: Block, child: BlockChild, isSelected: boolean) => {
    switch (child.type) {
      case 'label':
        return (
          <div
            key={child.id}
            style={{
              fontSize: `${child.fontSize || 10}pt`,
              fontWeight: child.bold ? 'bold' : 'normal',
              textAlign: child.align || 'left',
              marginBottom: 4,
              outline: 'none',
              cursor: isSelected ? 'text' : 'default',
            }}
            contentEditable={isSelected}
            suppressContentEditableWarning
            onBlur={(e) => {
              updateChild(block.id, child.id, { text: e.currentTarget.textContent || '' });
            }}
            onMouseDown={(e) => { if (isSelected) e.stopPropagation(); }}
          >
            {child.text || ''}
          </div>
        );
      case 'sign-fields': {
        const parts = child.parts || [];
        const gap = child.gap || 30;
        const mw = child.minWidth || 120;
        return (
          <div key={child.id} style={{ display: 'flex', gap }}>
            {parts.map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ borderBottom: '1px solid #000', minWidth: mw, height: 18 }} />
                <div style={{ fontSize: '7pt' }}>
                  {'('}
                  <span
                    style={{ outline: 'none', cursor: isSelected ? 'text' : 'default' }}
                    contentEditable={isSelected}
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const newParts = [...parts];
                      newParts[i] = e.currentTarget.textContent || '';
                      updateChild(block.id, child.id, { parts: newParts });
                    }}
                    onMouseDown={(e) => { if (isSelected) e.stopPropagation(); }}
                  >
                    {p}
                  </span>
                  {')'}
                </div>
              </div>
            ))}
          </div>
        );
      }
      case 'date-text':
        return (
          <div
            key={child.id}
            style={{
              marginTop: 4,
              fontSize: `${child.fontSize || 9}pt`,
              outline: 'none',
              cursor: isSelected ? 'text' : 'default',
            }}
            contentEditable={isSelected}
            suppressContentEditableWarning
            onBlur={(e) => {
              updateChild(block.id, child.id, { text: e.currentTarget.textContent || '' });
            }}
            onMouseDown={(e) => { if (isSelected) e.stopPropagation(); }}
          >
            {child.text || ''}
          </div>
        );
      case 'line-separator':
        return (
          <div
            key={child.id}
            style={{
              borderTop: `1px ${child.lineStyle === 'dashed' ? 'dashed' : 'solid'} #000`,
              margin: '4px 0',
            }}
          />
        );
      case 'free-text':
        return (
          <div
            key={child.id}
            style={{
              fontSize: `${child.fontSize || 9}pt`,
              outline: 'none',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              cursor: isSelected ? 'text' : 'default',
              minHeight: 16,
            }}
            contentEditable={isSelected}
            suppressContentEditableWarning
            onBlur={(e) => {
              updateChild(block.id, child.id, { text: e.currentTarget.textContent || '' });
            }}
            onMouseDown={(e) => { if (isSelected) e.stopPropagation(); }}
          >
            {child.text || ''}
          </div>
        );
      default:
        return null;
    }
  };

  const renderSignatureBlock = (block: Block) => {
    const children = ensureChildren(block);
    const isSelected = selectedId === block.id;
    return (
      <div style={{ fontFamily: "'Times New Roman', serif", fontSize: '10pt', width: '100%' }}>
        {children.map(child => renderChildElement(block, child, isSelected))}
      </div>
    );
  };

  const renderFrameBlock = (block: Block) => {
    const children = ensureChildren(block);
    const isSelected = selectedId === block.id;
    return (
      <div style={{
        width: '100%',
        height: '100%',
        border: `1px ${block.borderStyle || 'solid'} #000`,
        fontFamily: "'Times New Roman', serif",
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}>
        {children.map((child, idx) => {
          if (child.type === 'label' && idx === 0) {
            return (
              <div
                key={child.id}
                style={{
                  fontSize: `${child.fontSize || 8}pt`,
                  fontWeight: child.bold ? 'bold' : 'normal',
                  padding: '2px 4px',
                  borderBottom: `1px ${block.borderStyle || 'solid'} #000`,
                  background: '#fff',
                  cursor: isSelected ? 'text' : 'default',
                  outline: 'none',
                  flexShrink: 0,
                }}
                contentEditable={isSelected}
                suppressContentEditableWarning
                onBlur={(e) => {
                  updateChild(block.id, child.id, { text: e.currentTarget.textContent || '' });
                }}
                onMouseDown={(e) => { if (isSelected) e.stopPropagation(); }}
              >
                {child.text || ''}
              </div>
            );
          }
          return (
            <div key={child.id} style={{ flex: idx === children.length - 1 ? 1 : undefined, padding: '4px', overflow: 'hidden' }}>
              {renderChildElement(block, child, isSelected)}
            </div>
          );
        })}
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

  const renderChildrenPanel = (b: Block) => {
    const children = ensureChildren(b);
    return (
      <div className="flex flex-col gap-1">
        <div className="text-[10px] font-semibold uppercase text-gray-400">Элементы</div>
        <div className="border-t border-gray-200" />
        {children.map((child, idx) => {
          const isExpanded = expandedChildId === child.id;
          const desc = child.type === 'label'
            ? `${childTypeLabel(child.type)}: "${(child.text || '').slice(0, 12)}${(child.text || '').length > 12 ? '...' : ''}"`
            : child.type === 'sign-fields'
            ? `${childTypeLabel(child.type)} (${(child.parts || []).length})`
            : child.type === 'date-text'
            ? `${childTypeLabel(child.type)}: "${(child.text || '').slice(0, 10)}..."`
            : child.type === 'free-text'
            ? `${childTypeLabel(child.type)}`
            : childTypeLabel(child.type);

          return (
            <div key={child.id} className="rounded border border-gray-100 bg-gray-50">
              <div className="flex items-center gap-0.5 px-1 py-0.5">
                <button
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
                  disabled={idx === 0}
                  onClick={() => moveChild(b.id, child.id, -1)}
                >
                  <Icon name="ChevronUp" size={10} />
                </button>
                <button
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-gray-400 hover:bg-gray-200 hover:text-gray-600 disabled:opacity-30"
                  disabled={idx === children.length - 1}
                  onClick={() => moveChild(b.id, child.id, 1)}
                >
                  <Icon name="ChevronDown" size={10} />
                </button>
                <button
                  className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-red-300 hover:bg-red-100 hover:text-red-500"
                  onClick={() => removeChild(b.id, child.id)}
                >
                  <Icon name="X" size={10} />
                </button>
                <button
                  className="flex-1 truncate text-left text-[10px] text-gray-600 hover:text-gray-900"
                  onClick={() => setExpandedChildId(isExpanded ? null : child.id)}
                >
                  {desc}
                </button>
              </div>
              {isExpanded && (
                <div className="border-t border-gray-100 px-1 pb-1 pt-1">
                  {child.type === 'label' && (
                    <div className="flex flex-col gap-1">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500">Текст</span>
                        <input
                          className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                          value={child.text || ''}
                          onChange={(e) => updateChild(b.id, child.id, { text: e.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500">Размер</span>
                        <input
                          type="number"
                          min={6}
                          max={24}
                          className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                          value={child.fontSize || 10}
                          onChange={(e) => updateChild(b.id, child.id, { fontSize: Number(e.target.value) })}
                        />
                      </label>
                      <div className="flex gap-1">
                        <button
                          className={`rounded border px-1.5 py-0.5 text-[10px] font-bold ${child.bold ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                          onClick={() => updateChild(b.id, child.id, { bold: !child.bold })}
                        >
                          B
                        </button>
                        {(['left', 'center', 'right'] as const).map(a => (
                          <button
                            key={a}
                            className={`rounded border px-1.5 py-0.5 text-[10px] ${child.align === a ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                            onClick={() => updateChild(b.id, child.id, { align: a })}
                          >
                            {a === 'left' ? 'Л' : a === 'center' ? 'Ц' : 'П'}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {child.type === 'sign-fields' && (
                    <div className="flex flex-col gap-1">
                      {(child.parts || []).map((part, pi) => (
                        <div key={pi} className="flex items-center gap-0.5">
                          <input
                            className="flex-1 rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                            value={part}
                            onChange={(e) => {
                              const newParts = [...(child.parts || [])];
                              newParts[pi] = e.target.value;
                              updateChild(b.id, child.id, { parts: newParts });
                            }}
                          />
                          <button
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-red-300 hover:bg-red-100 hover:text-red-500"
                            onClick={() => {
                              const newParts = (child.parts || []).filter((_, i) => i !== pi);
                              updateChild(b.id, child.id, { parts: newParts });
                            }}
                          >
                            <Icon name="X" size={8} />
                          </button>
                        </div>
                      ))}
                      <button
                        className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-600 hover:bg-gray-200"
                        onClick={() => {
                          const newParts = [...(child.parts || []), 'поле'];
                          updateChild(b.id, child.id, { parts: newParts });
                        }}
                      >
                        + поле
                      </button>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500">Отступ</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                          value={child.gap || 30}
                          onChange={(e) => updateChild(b.id, child.id, { gap: Number(e.target.value) })}
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500">Мин. ширина</span>
                        <input
                          type="number"
                          min={30}
                          max={300}
                          className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                          value={child.minWidth || 120}
                          onChange={(e) => updateChild(b.id, child.id, { minWidth: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                  )}
                  {(child.type === 'date-text' || child.type === 'free-text') && (
                    <div className="flex flex-col gap-1">
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500">Текст</span>
                        <textarea
                          className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                          rows={2}
                          value={child.text || ''}
                          onChange={(e) => updateChild(b.id, child.id, { text: e.target.value })}
                        />
                      </label>
                      <label className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-gray-500">Размер</span>
                        <input
                          type="number"
                          min={6}
                          max={24}
                          className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                          value={child.fontSize || 9}
                          onChange={(e) => updateChild(b.id, child.id, { fontSize: Number(e.target.value) })}
                        />
                      </label>
                    </div>
                  )}
                  {child.type === 'line-separator' && (
                    <div className="flex gap-1">
                      <button
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${child.lineStyle !== 'dashed' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                        onClick={() => updateChild(b.id, child.id, { lineStyle: 'solid' })}
                      >
                        Сплошная
                      </button>
                      <button
                        className={`rounded border px-1.5 py-0.5 text-[10px] ${child.lineStyle === 'dashed' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
                        onClick={() => updateChild(b.id, child.id, { lineStyle: 'dashed' })}
                      >
                        Пунктир
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
        <div className="border-t border-gray-200 pt-1" />
        <div className="flex flex-wrap gap-0.5">
          <button
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600 hover:bg-gray-200"
            onClick={() => addChild(b.id, 'label')}
          >
            + Заголовок
          </button>
          <button
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600 hover:bg-gray-200"
            onClick={() => addChild(b.id, 'sign-fields')}
          >
            + Подпись
          </button>
          <button
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600 hover:bg-gray-200"
            onClick={() => addChild(b.id, 'date-text')}
          >
            + Дата
          </button>
          <button
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600 hover:bg-gray-200"
            onClick={() => addChild(b.id, 'line-separator')}
          >
            + Линия
          </button>
          <button
            className="rounded bg-gray-100 px-1.5 py-0.5 text-[9px] text-gray-600 hover:bg-gray-200"
            onClick={() => addChild(b.id, 'free-text')}
          >
            + Текст
          </button>
        </div>
      </div>
    );
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
                min={6}
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

        {(b.type === 'signature' || b.type === 'frame') && renderChildrenPanel(b)}

        {b.type === 'table' && (
          <div className="flex flex-col gap-1">
            <span className="text-[10px] text-gray-500">Столбцов: {(b.columns || []).length}</span>
            <span className="text-[10px] text-gray-500">Строк: {(b.rows || []).length}</span>
            <div className="border-t border-gray-200 pt-1" />
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!b.headerRows && b.headerRows.length > 0}
                onChange={(e) => {
                  if (e.target.checked) {
                    const cols = b.columns || [];
                    const defaultHeader: HeaderCell[][] = [
                      cols.map(c => ({ text: c.label })),
                    ];
                    updateBlock(b.id, { headerRows: defaultHeader });
                  } else {
                    updateBlock(b.id, { headerRows: undefined });
                  }
                }}
                className="h-3 w-3"
              />
              <span className="text-[10px] text-gray-600">Многоуровневая шапка</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!b.showRowNumbers}
                onChange={(e) => updateBlock(b.id, { showRowNumbers: e.target.checked })}
                className="h-3 w-3"
              />
              <span className="text-[10px] text-gray-600">Нумерация столбцов</span>
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={!!b.showTotals}
                onChange={(e) => updateBlock(b.id, { showTotals: e.target.checked })}
                className="h-3 w-3"
              />
              <span className="text-[10px] text-gray-600">Строка итогов</span>
            </label>
            {b.showTotals && (
              <>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500">Текст итогов</span>
                  <input
                    className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                    value={b.totalsLabel || 'Итого'}
                    onChange={(e) => updateBlock(b.id, { totalsLabel: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[10px] text-gray-500">Столбец итогов (0-based)</span>
                  <input
                    type="number"
                    min={0}
                    max={(b.columns || []).length - 1}
                    className="rounded border border-gray-200 px-1.5 py-0.5 text-[10px]"
                    value={b.totalsLabelCol ?? 0}
                    onChange={(e) => updateBlock(b.id, { totalsLabelCol: Number(e.target.value) })}
                  />
                </label>
              </>
            )}
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
          <Button variant="ghost" size="sm" onClick={handleSave} title="Сохранить" className={saveFlash ? 'text-green-600' : ''}>
            <Icon name={saveFlash ? 'Check' : 'Save'} size={16} />
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
            {blocks.map(block => {
              const isSelected = selectedId === block.id;
              return (
                <div
                  key={block.id}
                  className="group"
                  style={{
                    position: 'absolute',
                    left: block.x,
                    top: block.y,
                    width: block.w,
                    height: block.type === 'frame' || block.type === 'table' ? block.h : undefined,
                    minHeight: block.type === 'line' ? 2 : undefined,
                    cursor: 'default',
                    outline: isSelected ? '2px solid #3b82f6' : 'none',
                    outlineOffset: 1,
                    zIndex: isSelected ? 10 : 1,
                    userSelect: isSelected ? 'text' : 'none',
                  }}
                  onClick={(e) => handleBlockClick(e, block.id)}
                >
                  {block.type !== 'line' && (
                    <div
                      className={`absolute -top-2 left-0 right-0 flex justify-center transition-opacity print:hidden ${isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
                      style={{ zIndex: 20, height: 6 }}
                    >
                      <div
                        style={{
                          width: 40,
                          height: 6,
                          background: isSelected ? '#3b82f6' : '#9ca3af',
                          borderRadius: 3,
                          cursor: 'move',
                        }}
                        onMouseDown={(e) => handleDragHandleMouseDown(e, block.id)}
                      />
                    </div>
                  )}
                  {renderBlock(block)}
                  {isSelected && (
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
              );
            })}
          </div>
        </div>

        {renderPropertyPanel()}
      </div>
    </div>
  );
}