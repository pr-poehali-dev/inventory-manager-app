import * as XLSX from 'xlsx';
import { InvoiceTemplate, InvElement, generateId } from './store';

const DEFAULT_COL_WCH = 8.43;
const DEFAULT_ROW_HPT = 15;
const CHAR_PX = 7.5;
const PT_PX = 1.333;
const PAD_X = 30;
const PAD_Y = 20;

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

function getMerge(merges: MergeRange[], r: number, c: number): MergeRange | undefined {
  return merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
}

function isMergeOrigin(m: MergeRange, r: number, c: number) {
  return m.s.r === r && m.s.c === c;
}

function colToPx(col: Record<string, unknown> | undefined): number {
  if (!col) return Math.round(DEFAULT_COL_WCH * CHAR_PX);
  if (col.wpx) return Math.round(col.wpx as number);
  if (col.wch) return Math.round((col.wch as number) * CHAR_PX);
  if (col.width) return Math.round((col.width as number) * CHAR_PX);
  return Math.round(DEFAULT_COL_WCH * CHAR_PX);
}

function rowToPx(row: Record<string, unknown> | undefined): number {
  if (!row) return Math.round(DEFAULT_ROW_HPT * PT_PX);
  if (row.hpx) return Math.round(row.hpx as number);
  if (row.hpt) return Math.round((row.hpt as number) * PT_PX);
  return Math.round(DEFAULT_ROW_HPT * PT_PX);
}

export function excelToTemplate(buffer: ArrayBuffer, fileName: string): InvoiceTemplate {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Пустой файл');

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const merges: MergeRange[] = (ws['!merges'] || []) as MergeRange[];

  const customCols = (ws['!cols'] || []) as (Record<string, unknown> | undefined)[];
  const customRows = (ws['!rows'] || []) as (Record<string, unknown> | undefined)[];

  const colWidths: number[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    colWidths[c] = colToPx(customCols[c]);
  }

  const rowHeights: number[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    rowHeights[r] = rowToPx(customRows[r]);
  }

  const colX: number[] = [];
  let cx = PAD_X;
  for (let c = range.s.c; c <= range.e.c; c++) {
    colX[c] = cx;
    cx += colWidths[c];
  }

  const rowY: number[] = [];
  let ry = PAD_Y;
  for (let r = range.s.r; r <= range.e.r; r++) {
    rowY[r] = ry;
    ry += rowHeights[r];
  }

  const elements: InvElement[] = [];
  const visited = new Set<string>();

  for (let r = range.s.r; r <= range.e.r; r++) {
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = `${r}:${c}`;
      if (visited.has(key)) continue;

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr];

      const merge = getMerge(merges, r, c);
      if (merge && !isMergeOrigin(merge, r, c)) {
        visited.add(key);
        continue;
      }

      let spanW = colWidths[c];
      let spanH = rowHeights[r];
      if (merge) {
        spanW = 0;
        for (let mc = merge.s.c; mc <= merge.e.c; mc++) spanW += colWidths[mc];
        spanH = 0;
        for (let mr = merge.s.r; mr <= merge.e.r; mr++) spanH += rowHeights[mr];
        for (let mr = merge.s.r; mr <= merge.e.r; mr++)
          for (let mc = merge.s.c; mc <= merge.e.c; mc++)
            visited.add(`${mr}:${mc}`);
      } else {
        visited.add(key);
      }

      if (!cell || cell.v === undefined || cell.v === null || String(cell.v).trim() === '') continue;

      const text = cell.w || String(cell.v);
      let bold = false;
      let italic = false;
      let fontSize = 10;
      let align: 'left' | 'center' | 'right' = 'left';

      if (cell.s) {
        const s = cell.s as Record<string, unknown>;
        const font = s.font as Record<string, unknown> | undefined;
        if (font) {
          if (font.bold) bold = true;
          if (font.italic) italic = true;
          if (font.sz) fontSize = Math.round(font.sz as number);
        }
        const alignment = s.alignment as Record<string, unknown> | undefined;
        if (alignment?.horizontal === 'center') align = 'center';
        if (alignment?.horizontal === 'right') align = 'right';
      }

      elements.push({
        id: generateId(),
        type: 'text',
        x: colX[c],
        y: rowY[r],
        w: Math.max(spanW, 20),
        h: Math.max(spanH, 14),
        text,
        fontSize,
        bold,
        italic,
        align,
      });
    }
  }

  const totalW = cx + PAD_X;
  const totalH = ry + PAD_Y;

  return {
    id: generateId(),
    name: fileName.replace(/\.\w+$/, ''),
    companyName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elements,
    canvasWidth: Math.max(1414, totalW),
    canvasHeight: Math.max(1000, totalH),
  };
}
