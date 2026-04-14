import * as XLSX from 'xlsx';
import { InvoiceTemplate, InvElement, InvGridCell, generateId } from './store';

const DEFAULT_COL_WCH = 8.43;
const DEFAULT_ROW_HPT = 15;
const CHAR_PX = 7.5;
const PT_PX = 1.333;
const PAD_X = 20;
const PAD_Y = 20;

type MergeRange = { s: { r: number; c: number }; e: { r: number; c: number } };

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

function findMerge(merges: MergeRange[], r: number, c: number): MergeRange | undefined {
  return merges.find(m => r >= m.s.r && r <= m.e.r && c >= m.s.c && c <= m.e.c);
}

function hasBorder(cell: XLSX.CellObject | undefined, side: 'top' | 'bottom' | 'left' | 'right'): boolean {
  if (!cell || !cell.s) return false;
  const s = cell.s as Record<string, unknown>;
  const border = s.border as Record<string, unknown> | undefined;
  if (!border) return false;
  const b = border[side] as Record<string, unknown> | undefined;
  return !!b && b.style !== undefined && b.style !== 'none';
}

export function excelToTemplate(buffer: ArrayBuffer, fileName: string): InvoiceTemplate {
  const wb = XLSX.read(buffer, { type: 'array', cellStyles: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Пустой файл');

  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const merges: MergeRange[] = (ws['!merges'] || []) as MergeRange[];
  const customCols = (ws['!cols'] || []) as (Record<string, unknown> | undefined)[];
  const customRows = (ws['!rows'] || []) as (Record<string, unknown> | undefined)[];

  const gridCols: number[] = [];
  for (let c = range.s.c; c <= range.e.c; c++) {
    gridCols.push(colToPx(customCols[c]));
  }

  const gridRows: number[] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    gridRows.push(rowToPx(customRows[r]));
  }

  const skipSet = new Set<string>();
  merges.forEach(m => {
    for (let mr = m.s.r; mr <= m.e.r; mr++)
      for (let mc = m.s.c; mc <= m.e.c; mc++)
        if (mr !== m.s.r || mc !== m.s.c)
          skipSet.add(`${mr - range.s.r}:${mc - range.s.c}`);
  });

  const gridCells: InvGridCell[][] = [];
  for (let r = range.s.r; r <= range.e.r; r++) {
    const row: InvGridCell[] = [];
    for (let c = range.s.c; c <= range.e.c; c++) {
      const ri = r - range.s.r;
      const ci = c - range.s.c;

      if (skipSet.has(`${ri}:${ci}`)) {
        row.push({ text: '', skip: true });
        continue;
      }

      const addr = XLSX.utils.encode_cell({ r, c });
      const cell = ws[addr] as XLSX.CellObject | undefined;
      const text = cell ? (cell.w || (cell.v !== undefined && cell.v !== null ? String(cell.v) : '')) : '';

      let bold = false;
      let italic = false;
      let fontSize = 10;
      let align: 'left' | 'center' | 'right' = 'left';
      let valign: 'top' | 'middle' | 'bottom' = 'top';

      if (cell?.s) {
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
        if (alignment?.vertical === 'center') valign = 'middle';
        if (alignment?.vertical === 'bottom') valign = 'bottom';
      }

      const border = {
        top: hasBorder(cell, 'top'),
        right: hasBorder(cell, 'right'),
        bottom: hasBorder(cell, 'bottom'),
        left: hasBorder(cell, 'left'),
      };

      const merge = findMerge(merges, r, c);
      let colspan: number | undefined;
      let rowspan: number | undefined;
      if (merge && merge.s.r === r && merge.s.c === c) {
        const cs = merge.e.c - merge.s.c + 1;
        const rs = merge.e.r - merge.s.r + 1;
        if (cs > 1) colspan = cs;
        if (rs > 1) rowspan = rs;
      }

      row.push({
        text,
        bold: bold || undefined,
        italic: italic || undefined,
        fontSize: fontSize !== 10 ? fontSize : undefined,
        align: align !== 'left' ? align : undefined,
        valign: valign !== 'top' ? valign : undefined,
        border: (border.top || border.right || border.bottom || border.left) ? border : undefined,
        colspan,
        rowspan,
      });
    }
    gridCells.push(row);
  }

  const totalW = gridCols.reduce((a, b) => a + b, 0);
  const totalH = gridRows.reduce((a, b) => a + b, 0);

  const elements: InvElement[] = [{
    id: generateId(),
    type: 'grid',
    x: PAD_X,
    y: PAD_Y,
    w: totalW,
    h: totalH,
    gridCols,
    gridRows,
    gridCells,
  }];

  return {
    id: generateId(),
    name: fileName.replace(/\.\w+$/, ''),
    companyName: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    elements,
    canvasWidth: Math.max(1414, totalW + PAD_X * 2),
    canvasHeight: Math.max(1000, totalH + PAD_Y * 2),
  };
}
